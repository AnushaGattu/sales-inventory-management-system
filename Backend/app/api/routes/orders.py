from fastapi import APIRouter, BackgroundTasks
from sqlalchemy import or_, select
from sqlalchemy.orm import joinedload

from app.api.deps import CurrentUser, DbSession, Pagination, paginate
from app.models import Customer, OrderStatus, Role, SalesOrder
from app.schemas import OrderCreate, OrderOut, OrderSummary, Page
from app.services import email_service, order_service

router = APIRouter(prefix="/orders", tags=["Orders"])


@router.get("", response_model=Page[OrderSummary])
def list_orders(db: DbSession, user: CurrentUser, pg: Pagination,
                status: OrderStatus | None = None, q: str | None = None):
    stmt = (
        select(SalesOrder).join(Customer, Customer.id == SalesOrder.customer_id)
        .options(joinedload(SalesOrder.customer), joinedload(SalesOrder.creator))
        .order_by(SalesOrder.created_at.desc(), SalesOrder.id.desc())
    )
    if user.role == Role.SALES:  # sales users only ever see their own orders
        stmt = stmt.where(SalesOrder.created_by == user.id)
    if status:
        stmt = stmt.where(SalesOrder.status == status)
    if q:
        like = f"%{q.strip()}%"
        stmt = stmt.where(or_(SalesOrder.order_number.ilike(like), Customer.name.ilike(like)))
    return paginate(db, stmt, pg)


@router.post("", response_model=OrderOut, status_code=201)
def create_order(data: OrderCreate, background: BackgroundTasks, db: DbSession, user: CurrentUser):
    order = order_service.create_order(db, data, user)
    if order.status == OrderStatus.PENDING_APPROVAL:
        background.add_task(email_service.notify_approval_required, order.id)
    return order


@router.get("/{order_id}", response_model=OrderOut)
def get_order(order_id: int, db: DbSession, user: CurrentUser):
    order = order_service.load_order(db, order_id)
    order_service.assert_can_view(order, user)
    return order


@router.post("/{order_id}/cancel", response_model=OrderOut)
def cancel_order(order_id: int, db: DbSession, user: CurrentUser):
    return order_service.cancel_order(db, order_id, user)
