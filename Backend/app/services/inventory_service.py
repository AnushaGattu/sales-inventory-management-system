"""Stock logic. Every stock mutation goes through here so the ledger and the product row never drift.

Stock model:  available = stock_quantity - reserved_quantity
  * order <= threshold  -> stock deducted immediately
  * order  > threshold  -> stock RESERVED until a manager decides (approve = deduct, reject = release)
"""
from collections.abc import Iterable

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.exceptions import BusinessRuleError, InsufficientStockError, NotFoundError
from app.models import InventoryTransaction, OrderStatus, Product, SalesOrder, StockTxnType, User, utcnow


def lock_products(db: Session, product_ids: Iterable[int]) -> dict[int, Product]:
    """SELECT ... FOR UPDATE on the given products.
    Ids are sorted so concurrent transactions lock rows in the same order (prevents deadlocks)."""
    ids = sorted(set(product_ids))
    stmt = (
        select(Product)
        .where(Product.id.in_(ids))
        .order_by(Product.id)
        .with_for_update()
        .execution_options(populate_existing=True)  # refresh from DB, not the identity map
    )
    return {p.id: p for p in db.scalars(stmt)}


def record_txn(db: Session, product: Product, change: int, txn_type: StockTxnType, *,
               order_id: int | None = None, note: str | None = None, user_id: int | None = None) -> None:
    db.add(InventoryTransaction(
        product_id=product.id, txn_type=txn_type, quantity_change=change,
        balance_after=product.stock_quantity, order_id=order_id, note=note, created_by=user_id,
    ))


def fulfil_order(db: Session, order: SalesOrder, products: dict[int, Product], actor_id: int, *,
                 from_reserved: bool) -> None:
    """Deduct stock for every line, write ledger rows and mark the order COMPLETED."""
    for item in order.items:
        product = products[item.product_id]
        if product.stock_quantity < item.quantity:  # defensive: should be impossible while reserved
            raise InsufficientStockError(f"Insufficient stock for {product.name}")
        product.stock_quantity -= item.quantity
        if from_reserved:
            product.reserved_quantity -= item.quantity
        record_txn(db, product, -item.quantity, StockTxnType.SALE,
                   order_id=order.id, note=f"Sale {order.order_number}", user_id=actor_id)
    order.status = OrderStatus.COMPLETED
    order.completed_at = utcnow()


def reserve_order(order: SalesOrder, products: dict[int, Product]) -> None:
    for item in order.items:
        products[item.product_id].reserved_quantity += item.quantity


def release_reservation(order: SalesOrder, products: dict[int, Product]) -> None:
    for item in order.items:
        product = products[item.product_id]
        product.reserved_quantity = max(0, product.reserved_quantity - item.quantity)


def adjust_stock(db: Session, product_id: int, change: int, note: str, user: User) -> Product:
    products = lock_products(db, [product_id])
    product = products.get(product_id)
    if product is None:
        raise NotFoundError("Product not found")
    new_stock = product.stock_quantity + change
    if new_stock < 0:
        raise BusinessRuleError(f"Stock cannot go below zero (current stock: {product.stock_quantity})")
    if new_stock < product.reserved_quantity:
        raise BusinessRuleError(
            f"{product.reserved_quantity} units are reserved by orders awaiting approval; "
            f"stock cannot go below that"
        )
    product.stock_quantity = new_stock
    record_txn(db, product, change, StockTxnType.ADJUSTMENT, note=note, user_id=user.id)
    db.commit()
    return product
