from fastapi import APIRouter

from app.api.routes import approvals, auth, customers, dashboard, inventory, meta, orders, products

api_router = APIRouter()
for module in (auth, meta, products, customers, orders, approvals, inventory, dashboard):
    api_router.include_router(module.router)
