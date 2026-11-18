"""Pydantic request/response models. Input validation lives here (first line of defence);
business-rule validation (stock, threshold, status transitions) lives in app/services."""
from datetime import datetime, timezone
from decimal import Decimal
from typing import Annotated, Generic, TypeVar

from pydantic import AfterValidator, BaseModel, ConfigDict, EmailStr, Field, field_validator

from app.models import ApprovalStatus, OrderStatus, Role, StockTxnType


def _as_utc(value: datetime) -> datetime:
    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)


UtcDateTime = Annotated[datetime, AfterValidator(_as_utc)]
Money = Annotated[Decimal, Field(gt=0, max_digits=12, decimal_places=2)]


class APIModel(BaseModel):
    model_config = ConfigDict(from_attributes=True, str_strip_whitespace=True)


T = TypeVar("T")


class Page(BaseModel, Generic[T]):
    items: list[T]
    total: int
    page: int
    page_size: int


def _blank_to_none(v):
    return None if isinstance(v, str) and not v.strip() else v


# ---------------------------------------------------------------- auth / users
class UserMini(APIModel):
    id: int
    name: str


class UserOut(UserMini):
    email: EmailStr
    role: Role
    is_active: bool


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class PublicSettings(BaseModel):
    approval_threshold: Decimal
    currency: str


# ---------------------------------------------------------------- products
class ProductBase(APIModel):
    name: str = Field(min_length=2, max_length=150)
    description: str | None = Field(default=None, max_length=2000)
    price: Money
    reorder_level: int = Field(default=10, ge=0, le=1_000_000)

    _blank = field_validator("description", mode="before")(_blank_to_none)


class ProductCreate(ProductBase):
    sku: str = Field(min_length=2, max_length=50, pattern=r"^[A-Za-z0-9][A-Za-z0-9\-_.]*$")
    stock_quantity: int = Field(default=0, ge=0, le=10_000_000)

    @field_validator("sku")
    @classmethod
    def upper_sku(cls, v: str) -> str:
        return v.upper()


class ProductUpdate(APIModel):
    """SKU and stock are intentionally not editable here (SKU is an identifier; stock changes go
    through the inventory ledger)."""
    name: str | None = Field(default=None, min_length=2, max_length=150)
    description: str | None = Field(default=None, max_length=2000)
    price: Money | None = None
    reorder_level: int | None = Field(default=None, ge=0, le=1_000_000)
    is_active: bool | None = None

    _blank = field_validator("description", mode="before")(_blank_to_none)


class ProductMini(APIModel):
    id: int
    sku: str
    name: str


class ProductOut(ProductMini):
    description: str | None
    price: Decimal
    stock_quantity: int
    reserved_quantity: int
    available_quantity: int
    reorder_level: int
    is_active: bool
    created_at: UtcDateTime
    updated_at: UtcDateTime


# ---------------------------------------------------------------- customers
class CustomerBase(APIModel):
    name: str = Field(min_length=2, max_length=150)
    email: EmailStr | None = None
    phone: str | None = Field(default=None, pattern=r"^[0-9+\-() ]{7,20}$")
    address: str | None = Field(default=None, max_length=500)

    _blank = field_validator("email", "phone", "address", mode="before")(_blank_to_none)

    @field_validator("email")
    @classmethod
    def lower_email(cls, v):
        return v.lower() if v else v


class CustomerCreate(CustomerBase):
    pass


class CustomerUpdate(CustomerBase):
    is_active: bool = True


class CustomerMini(APIModel):
    id: int
    name: str


class CustomerOut(CustomerMini):
    email: str | None
    phone: str | None
    address: str | None
    is_active: bool
    created_at: UtcDateTime


# ---------------------------------------------------------------- orders
class OrderItemIn(APIModel):
    product_id: int = Field(gt=0)
    quantity: int = Field(gt=0, le=10_000)


class OrderCreate(APIModel):
    customer_id: int = Field(gt=0)
    items: list[OrderItemIn] = Field(min_length=1, max_length=50)
    notes: str | None = Field(default=None, max_length=500)

    _blank = field_validator("notes", mode="before")(_blank_to_none)


class OrderItemOut(APIModel):
    id: int
    product: ProductMini
    quantity: int
    unit_price: Decimal
    line_total: Decimal


class ApprovalBrief(APIModel):
    id: int
    status: ApprovalStatus
    comments: str | None
    requested_at: UtcDateTime
    decided_at: UtcDateTime | None
    decider: UserMini | None


class OrderSummary(APIModel):
    id: int
    order_number: str
    status: OrderStatus
    total_amount: Decimal
    requires_approval: bool
    customer: CustomerMini
    creator: UserMini
    created_at: UtcDateTime


class OrderOut(OrderSummary):
    notes: str | None
    completed_at: UtcDateTime | None
    updated_at: UtcDateTime
    items: list[OrderItemOut]
    approval: ApprovalBrief | None


class ApprovalOut(ApprovalBrief):
    requester: UserMini
    order: OrderSummary


class ApproveRequest(APIModel):
    comments: str | None = Field(default=None, max_length=500)

    _blank = field_validator("comments", mode="before")(_blank_to_none)


class RejectRequest(APIModel):
    comments: str = Field(min_length=3, max_length=500)  # a reason is mandatory on rejection


# ---------------------------------------------------------------- inventory
class StockAdjustment(APIModel):
    product_id: int = Field(gt=0)
    quantity_change: int = Field(ge=-1_000_000, le=1_000_000)
    note: str = Field(min_length=3, max_length=255)

    @field_validator("quantity_change")
    @classmethod
    def non_zero(cls, v: int) -> int:
        if v == 0:
            raise ValueError("Quantity change cannot be zero")
        return v


class InventoryTransactionOut(APIModel):
    id: int
    product: ProductMini
    txn_type: StockTxnType
    quantity_change: int
    balance_after: int
    note: str | None
    order_id: int | None
    creator: UserMini | None
    created_at: UtcDateTime


# ---------------------------------------------------------------- dashboard
class DailySales(BaseModel):
    date: str
    orders: int
    revenue: Decimal


class TopProduct(BaseModel):
    product_id: int
    sku: str
    name: str
    quantity_sold: int
    revenue: Decimal


class DashboardSummary(BaseModel):
    total_revenue: Decimal
    orders_by_status: dict[str, int]
    total_orders: int
    pending_approvals: int
    low_stock_count: int
    inventory_value: Decimal
    active_products: int
    active_customers: int
    sales_last_7_days: list[DailySales]
    top_products: list[TopProduct]
    scope: str  # "all" for managers, "own" for sales users
