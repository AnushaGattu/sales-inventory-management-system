from fastapi import APIRouter
from sqlalchemy import or_, select

from app.api.deps import CurrentUser, DbSession, ManagerUser, Pagination, paginate
from app.core.exceptions import NotFoundError
from app.db.session import commit_or_conflict
from app.models import Customer
from app.schemas import CustomerCreate, CustomerOut, CustomerUpdate, Page

router = APIRouter(prefix="/customers", tags=["Customers"])
EMAIL_TAKEN = "A customer with this email already exists"


@router.get("", response_model=Page[CustomerOut])
def list_customers(db: DbSession, _: CurrentUser, pg: Pagination, q: str | None = None,
                   include_inactive: bool = False):
    stmt = select(Customer).order_by(Customer.name)
    if not include_inactive:
        stmt = stmt.where(Customer.is_active.is_(True))
    if q:
        like = f"%{q.strip()}%"
        stmt = stmt.where(or_(Customer.name.ilike(like), Customer.email.ilike(like), Customer.phone.ilike(like)))
    return paginate(db, stmt, pg)


@router.post("", response_model=CustomerOut, status_code=201)
def create_customer(data: CustomerCreate, db: DbSession, _: CurrentUser):
    customer = Customer(**data.model_dump())
    db.add(customer)
    commit_or_conflict(db, EMAIL_TAKEN)
    return customer


@router.get("/{customer_id}", response_model=CustomerOut)
def get_customer(customer_id: int, db: DbSession, _: CurrentUser):
    customer = db.get(Customer, customer_id)
    if not customer:
        raise NotFoundError("Customer not found")
    return customer


@router.put("/{customer_id}", response_model=CustomerOut)
def update_customer(customer_id: int, data: CustomerUpdate, db: DbSession, _: CurrentUser):
    customer = db.get(Customer, customer_id)
    if not customer:
        raise NotFoundError("Customer not found")
    for field, value in data.model_dump().items():
        setattr(customer, field, value)
    commit_or_conflict(db, EMAIL_TAKEN)
    return customer


@router.delete("/{customer_id}", status_code=204)
def deactivate_customer(customer_id: int, db: DbSession, _: ManagerUser):
    customer = db.get(Customer, customer_id)
    if not customer:
        raise NotFoundError("Customer not found")
    customer.is_active = False
    db.commit()
