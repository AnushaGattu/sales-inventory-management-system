"""Dashboard aggregates. Sales users only see numbers for their own orders."""
from datetime import datetime, time, timedelta
from decimal import Decimal

from sqlalchemy import desc, func, select
from sqlalchemy.orm import Session

from app.models import Customer, OrderItem, OrderStatus, Product, Role, SalesOrder, User, utcnow
from app.schemas import DailySales, DashboardSummary, TopProduct


def build_summary(db: Session, user: User) -> DashboardSummary:
    scope = [SalesOrder.created_by == user.id] if user.role == Role.SALES else []

    rows = db.execute(
        select(SalesOrder.status, func.count(), func.coalesce(func.sum(SalesOrder.total_amount), 0))
        .where(*scope).group_by(SalesOrder.status)
    ).all()
    by_status = {s.value: 0 for s in OrderStatus}
    revenue = Decimal("0")
    for status, count, total in rows:
        by_status[status.value] = count
        if status == OrderStatus.COMPLETED:
            revenue = Decimal(total)

    start = utcnow().date() - timedelta(days=6)
    daily_rows = db.execute(
        select(func.date(SalesOrder.completed_at), func.count(), func.coalesce(func.sum(SalesOrder.total_amount), 0))
        .where(*scope, SalesOrder.status == OrderStatus.COMPLETED,
               SalesOrder.completed_at >= datetime.combine(start, time.min))
        .group_by(func.date(SalesOrder.completed_at))
    ).all()
    daily = {str(d): (c, Decimal(t)) for d, c, t in daily_rows}
    last7 = []
    for i in range(7):
        day = str(start + timedelta(days=i))
        count, total = daily.get(day, (0, Decimal("0")))
        last7.append(DailySales(date=day, orders=count, revenue=total))

    qty = func.sum(OrderItem.quantity)
    top_rows = db.execute(
        select(Product.id, Product.sku, Product.name, qty, func.sum(OrderItem.line_total))
        .join(OrderItem, OrderItem.product_id == Product.id)
        .join(SalesOrder, SalesOrder.id == OrderItem.order_id)
        .where(*scope, SalesOrder.status == OrderStatus.COMPLETED)
        .group_by(Product.id, Product.sku, Product.name)
        .order_by(desc(qty)).limit(5)
    ).all()

    active = Product.is_active.is_(True)
    low_stock = db.scalar(select(func.count()).select_from(Product).where(
        active, (Product.stock_quantity - Product.reserved_quantity) <= Product.reorder_level)) or 0
    inventory_value = db.scalar(select(func.coalesce(func.sum(Product.stock_quantity * Product.price), 0))
                                .where(active)) or 0

    return DashboardSummary(
        total_revenue=revenue,
        orders_by_status=by_status,
        total_orders=sum(by_status.values()),
        pending_approvals=by_status[OrderStatus.PENDING_APPROVAL.value],
        low_stock_count=low_stock,
        inventory_value=Decimal(inventory_value),
        active_products=db.scalar(select(func.count()).select_from(Product).where(active)) or 0,
        active_customers=db.scalar(select(func.count()).select_from(Customer).where(Customer.is_active.is_(True))) or 0,
        sales_last_7_days=last7,
        top_products=[TopProduct(product_id=i, sku=s, name=n, quantity_sold=int(q), revenue=Decimal(r))
                      for i, s, n, q, r in top_rows],
        scope="own" if scope else "all",
    )
