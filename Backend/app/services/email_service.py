"""Email notifications. Runs in FastAPI BackgroundTasks AFTER the DB transaction has committed,
so a slow/broken SMTP server can never roll back or delay an order.

If SMTP_HOST is empty, emails are only logged (console + email_logs table): ideal for local dev."""
import logging
import smtplib
from email.message import EmailMessage

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.session import SessionLocal
from app.models import ApprovalStatus, EmailLog, Role, User
from app.services.order_service import load_order

logger = logging.getLogger("app.email")


def _smtp_send(to: str, subject: str, body: str) -> None:
    msg = EmailMessage()
    msg["From"], msg["To"], msg["Subject"] = settings.email_from, to, subject
    msg.set_content(body)
    with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=15) as server:
        if settings.smtp_use_tls:
            server.starttls()
        if settings.smtp_username:
            server.login(settings.smtp_username, settings.smtp_password)
        server.send_message(msg)


def deliver(db: Session, to: str, subject: str, body: str) -> None:
    """Send one email and record the outcome. Never raises."""
    status, error = "LOGGED", None
    if settings.smtp_host:
        try:
            _smtp_send(to, subject, body)
            status = "SENT"
        except Exception as exc:  # noqa: BLE001 - notification failures must not propagate
            status, error = "FAILED", str(exc)
            logger.exception("Failed to send email to %s", to)
    else:
        logger.info("EMAIL (SMTP not configured) to=%s subject=%s\n%s", to, subject, body)
    db.add(EmailLog(recipient=to, subject=subject, body=body, status=status, error=error))
    db.commit()


def _money(value) -> str:
    return f"{settings.currency} {value:,.2f}"


def notify_approval_required(order_id: int) -> None:
    """Tell every active manager that an order is waiting for a decision."""
    with SessionLocal() as db:
        order = load_order(db, order_id)
        managers = list(db.scalars(select(User).where(User.role == Role.MANAGER, User.is_active.is_(True))))
        lines = "\n".join(f"  - {i.product.name} x {i.quantity} @ {_money(i.unit_price)}" for i in order.items)
        for manager in managers:
            deliver(
                db, manager.email,
                f"[Approval required] Order {order.order_number} - {_money(order.total_amount)}",
                f"Hello {manager.name},\n\n"
                f"{order.creator.name} created order {order.order_number} for customer {order.customer.name}.\n"
                f"Total: {_money(order.total_amount)} (above the approval limit of {_money(settings.approval_threshold)}).\n\n"
                f"Items:\n{lines}\n\n"
                f"Review it here: {settings.frontend_url}/orders/{order.id}\n",
            )


def notify_decision(order_id: int) -> None:
    """Tell the order creator whether the manager approved or rejected."""
    with SessionLocal() as db:
        order = load_order(db, order_id)
        approval = order.approval
        if approval is None or approval.status not in (ApprovalStatus.APPROVED, ApprovalStatus.REJECTED):
            return
        approved = approval.status == ApprovalStatus.APPROVED
        decider = approval.decider.name if approval.decider else "a manager"
        deliver(
            db, order.creator.email,
            f"Order {order.order_number} {'approved' if approved else 'rejected'}",
            f"Hello {order.creator.name},\n\n"
            f"Your order {order.order_number} ({_money(order.total_amount)}) was "
            f"{'APPROVED and completed' if approved else 'REJECTED'} by {decider}.\n"
            f"Comments: {approval.comments or '-'}\n\n"
            f"View it: {settings.frontend_url}/orders/{order.id}\n",
        )
