from fastapi import APIRouter
from sqlalchemy import or_, select

from app.api.deps import CurrentUser, DbSession, ManagerUser, Pagination, paginate
from app.core.exceptions import ConflictError, NotFoundError
from app.db.session import commit_or_conflict
from app.models import Product, StockTxnType
from app.schemas import Page, ProductCreate, ProductOut, ProductUpdate
from app.services.inventory_service import record_txn

router = APIRouter(prefix="/products", tags=["Products"])


@router.get("", response_model=Page[ProductOut])
def list_products(db: DbSession, _: CurrentUser, pg: Pagination, q: str | None = None,
                  include_inactive: bool = False, low_stock: bool = False):
    stmt = select(Product).order_by(Product.name)
    if not include_inactive:
        stmt = stmt.where(Product.is_active.is_(True))
    if q:
        like = f"%{q.strip()}%"
        stmt = stmt.where(or_(Product.name.ilike(like), Product.sku.ilike(like)))
    if low_stock:
        stmt = stmt.where((Product.stock_quantity - Product.reserved_quantity) <= Product.reorder_level)
    return paginate(db, stmt, pg)


@router.post("", response_model=ProductOut, status_code=201)
def create_product(data: ProductCreate, db: DbSession, user: ManagerUser):
    if db.scalar(select(Product.id).where(Product.sku == data.sku)):
        raise ConflictError(f"SKU '{data.sku}' already exists")
    product = Product(**data.model_dump())
    db.add(product)
    db.flush()
    if product.stock_quantity:
        record_txn(db, product, product.stock_quantity, StockTxnType.INITIAL, note="Initial stock", user_id=user.id)
    commit_or_conflict(db, f"SKU '{data.sku}' already exists")
    return product


@router.get("/{product_id}", response_model=ProductOut)
def get_product(product_id: int, db: DbSession, _: CurrentUser):
    product = db.get(Product, product_id)
    if not product:
        raise NotFoundError("Product not found")
    return product


@router.put("/{product_id}", response_model=ProductOut)
def update_product(product_id: int, data: ProductUpdate, db: DbSession, _: ManagerUser):
    product = db.get(Product, product_id)
    if not product:
        raise NotFoundError("Product not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        if value is not None:
            setattr(product, field, value)
    db.commit()
    return product


@router.delete("/{product_id}", status_code=204)
def deactivate_product(product_id: int, db: DbSession, _: ManagerUser):
    """Soft delete: products referenced by historical orders must never disappear."""
    product = db.get(Product, product_id)
    if not product:
        raise NotFoundError("Product not found")
    product.is_active = False
    db.commit()
