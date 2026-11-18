"""Order creation, validation and cancellation. One request == one DB transaction."""
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload, selectinload

from app.core.config import settings
from app.core.exceptions import (
    BusinessRuleError, InsufficientStockError, NotFoundError, PermissionDeniedError, ConflictError,
)
from app.models import (
    Approval, ApprovalStatus, Customer, OrderItem, OrderStatus, Product, Role, SalesOrder, User,
    utcnow,
)
from app.schemas import OrderCreate
from app.services import inventory_service as inv


def load_order(db: Session, order_id: int) -> SalesOrder:
    """Fetch an order with everything the API response needs (avoids lazy loading in serialization)."""
    stmt = (
        select(SalesOrder)
        .where(SalesOrder.id == order_id)
        .options(
            joinedload(SalesOrder.customer),
            joinedload(SalesOrder.creator),
            selectinload(SalesOrder.items).joinedload(OrderItem.product),
            joinedload(SalesOrder.approval).joinedload(Approval.decider),
        )
        .execution_options(populate_existing=True)
    )
    order = db.scalars(stmt).first()
    if order is None:
        raise NotFoundError("Order not found")
    return order


def assert_can_view(order: SalesOrder, user: User) -> None:
    if user.role == Role.SALES and order.created_by != user.id:
        raise PermissionDeniedError("You can only view your own orders")


def create_order(db: Session, data: OrderCreate, user: User) -> SalesOrder:
    customer = db.get(Customer, data.customer_id)
    if customer is None:
        raise NotFoundError("Customer not found")
    if not customer.is_active:
        raise BusinessRuleError("Customer is inactive")

    # Merge duplicate product lines so "2 x A" + "3 x A" becomes "5 x A".
    wanted: dict[int, int] = {}
    for item in data.items:
        wanted[item.product_id] = wanted.get(item.product_id, 0) + item.quantity

    try:
        products = inv.lock_products(db, wanted)

        missing = sorted(set(wanted) - set(products))
        if missing:
            raise NotFoundError(f"Product(s) not found: {', '.join(map(str, missing))}")

        problems = []
        for pid, qty in wanted.items():
            p = products[pid]
            if not p.is_active:
                problems.append({"field": f"product:{pid}", "message": f"{p.name} is inactive and cannot be sold"})
            elif p.available_quantity < qty:
                problems.append({
                    "field": f"product:{pid}",
                    "message": f"{p.name}: requested {qty}, only {p.available_quantity} available",
                })
        if problems:
            raise InsufficientStockError("Some items cannot be ordered", errors=problems)

        order = SalesOrder(
            order_number=f"TMP-{utcnow().timestamp():.6f}-{user.id}",  # replaced right after we know the id
            customer_id=customer.id, created_by=user.id, notes=data.notes,
            status=OrderStatus.COMPLETED, total_amount=Decimal("0"),
        )
        total = Decimal("0")
        for pid, qty in wanted.items():
            p = products[pid]
            line_total = (p.price * qty).quantize(Decimal("0.01"))
            total += line_total
            order.items.append(OrderItem(product_id=pid, quantity=qty, unit_price=p.price, line_total=line_total))
        order.total_amount = total
        order.requires_approval = total > settings.approval_threshold

        db.add(order)
        db.flush()  # assigns order.id
        order.order_number = f"SO-{utcnow():%Y%m%d}-{order.id:06d}"

        if order.requires_approval:
            order.status = OrderStatus.PENDING_APPROVAL
            inv.reserve_order(order, products)
            db.add(Approval(order_id=order.id, requested_by=user.id, status=ApprovalStatus.PENDING))
        else:
            inv.fulfil_order(db, order, products, user.id, from_reserved=False)

        db.commit()
    except Exception:
        db.rollback()
        raise
    return load_order(db, order.id)


def cancel_order(db: Session, order_id: int, user: User) -> SalesOrder:
    """Only orders still waiting for approval can be cancelled (completed orders have moved stock)."""
    try:
        order = db.scalars(
            select(SalesOrder).where(SalesOrder.id == order_id).with_for_update()
            .execution_options(populate_existing=True)
        ).first()
        if order is None:
            raise NotFoundError("Order not found")
        if user.role == Role.SALES and order.created_by != user.id:
            raise PermissionDeniedError("You can only cancel your own orders")
        if order.status != OrderStatus.PENDING_APPROVAL:
            raise ConflictError(f"Only orders awaiting approval can be cancelled (this one is {order.status.value})")

        products = inv.lock_products(db, [i.product_id for i in order.items])
        inv.release_reservation(order, products)
        order.status = OrderStatus.CANCELLED
        if order.approval:
            order.approval.status = ApprovalStatus.CANCELLED
            order.approval.decided_at = utcnow()
        db.commit()
    except Exception:
        db.rollback()
        raise
    return load_order(db, order_id)
