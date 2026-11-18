"""Manager approval workflow: approve -> deduct stock & complete; reject -> release stock."""
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.exceptions import ConflictError, NotFoundError, PermissionDeniedError
from app.models import Approval, ApprovalStatus, OrderStatus, SalesOrder, User, utcnow
from app.services import inventory_service as inv
from app.services.order_service import load_order


def _lock_pending(db: Session, approval_id: int, manager: User) -> tuple[Approval, SalesOrder]:
    approval = db.get(Approval, approval_id)
    if approval is None:
        raise NotFoundError("Approval request not found")
    # Lock the order row so two managers clicking at once cannot both decide.
    order = db.scalars(
        select(SalesOrder).where(SalesOrder.id == approval.order_id).with_for_update()
        .execution_options(populate_existing=True)
    ).one()
    db.refresh(approval)
    if order.status != OrderStatus.PENDING_APPROVAL or approval.status != ApprovalStatus.PENDING:
        raise ConflictError(f"This order is no longer awaiting approval (current status: {order.status.value})")
    # Separation of duties: managers cannot approve or reject their own orders.
    if order.created_by == manager.id:
        raise PermissionDeniedError("You cannot approve or reject an order you created")
    return approval, order


def approve(db: Session, approval_id: int, manager: User, comments: str | None) -> SalesOrder:
    try:
        approval, order = _lock_pending(db, approval_id, manager)
        products = inv.lock_products(db, [i.product_id for i in order.items])
        inv.fulfil_order(db, order, products, manager.id, from_reserved=True)
        approval.status = ApprovalStatus.APPROVED
        approval.decided_by = manager.id
        approval.decided_at = utcnow()
        approval.comments = comments
        db.commit()
    except Exception:
        db.rollback()
        raise
    return load_order(db, order.id)


def reject(db: Session, approval_id: int, manager: User, comments: str) -> SalesOrder:
    try:
        approval, order = _lock_pending(db, approval_id, manager)
        products = inv.lock_products(db, [i.product_id for i in order.items])
        inv.release_reservation(order, products)
        order.status = OrderStatus.REJECTED
        approval.status = ApprovalStatus.REJECTED
        approval.decided_by = manager.id
        approval.decided_at = utcnow()
        approval.comments = comments
        db.commit()
    except Exception:
        db.rollback()
        raise
    return load_order(db, order.id)
