from fastapi import APIRouter, BackgroundTasks
from sqlalchemy import select
from sqlalchemy.orm import joinedload

from app.api.deps import DbSession, ManagerUser, Pagination, paginate
from app.models import Approval, ApprovalStatus, SalesOrder
from app.schemas import ApprovalOut, ApproveRequest, OrderOut, Page, RejectRequest
from app.services import approval_service, email_service

router = APIRouter(prefix="/approvals", tags=["Approvals (manager)"])


@router.get("", response_model=Page[ApprovalOut])
def list_approvals(db: DbSession, _: ManagerUser, pg: Pagination, status: ApprovalStatus | None = None):
    stmt = (
        select(Approval)
        .options(
            joinedload(Approval.requester), joinedload(Approval.decider),
            joinedload(Approval.order).joinedload(SalesOrder.customer),
            joinedload(Approval.order).joinedload(SalesOrder.creator),
        )
        .order_by(Approval.requested_at.desc())
    )
    if status:
        stmt = stmt.where(Approval.status == status)
    return paginate(db, stmt, pg)


@router.post("/{approval_id}/approve", response_model=OrderOut)
def approve(approval_id: int, body: ApproveRequest, background: BackgroundTasks,
            db: DbSession, manager: ManagerUser):
    order = approval_service.approve(db, approval_id, manager, body.comments)
    background.add_task(email_service.notify_decision, order.id)
    return order


@router.post("/{approval_id}/reject", response_model=OrderOut)
def reject(approval_id: int, body: RejectRequest, background: BackgroundTasks,
           db: DbSession, manager: ManagerUser):
    order = approval_service.reject(db, approval_id, manager, body.comments)
    background.add_task(email_service.notify_decision, order.id)
    return order
