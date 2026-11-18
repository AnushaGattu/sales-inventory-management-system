from fastapi import APIRouter
from sqlalchemy import select
from sqlalchemy.orm import joinedload

from app.api.deps import CurrentUser, DbSession, ManagerUser, Pagination, paginate
from app.models import InventoryTransaction, StockTxnType
from app.schemas import InventoryTransactionOut, Page, ProductOut, StockAdjustment
from app.services import inventory_service

router = APIRouter(prefix="/inventory", tags=["Inventory"])


@router.get("/transactions", response_model=Page[InventoryTransactionOut])
def list_transactions(db: DbSession, _: CurrentUser, pg: Pagination,
                      product_id: int | None = None, txn_type: StockTxnType | None = None):
    stmt = (
        select(InventoryTransaction)
        .options(joinedload(InventoryTransaction.product), joinedload(InventoryTransaction.creator))
        .order_by(InventoryTransaction.created_at.desc(), InventoryTransaction.id.desc())
    )
    if product_id:
        stmt = stmt.where(InventoryTransaction.product_id == product_id)
    if txn_type:
        stmt = stmt.where(InventoryTransaction.txn_type == txn_type)
    return paginate(db, stmt, pg)


@router.post("/adjustments", response_model=ProductOut, status_code=201)
def adjust_stock(data: StockAdjustment, db: DbSession, user: ManagerUser):
    return inventory_service.adjust_stock(db, data.product_id, data.quantity_change, data.note, user)
