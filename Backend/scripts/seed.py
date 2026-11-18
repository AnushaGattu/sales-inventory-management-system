"""Seed demo users, products and customers (idempotent).   Run:  python -m scripts.seed"""
from decimal import Decimal

from sqlalchemy import select, text

from app import models  # noqa: F401
from app.core.security import hash_password
from app.db.session import Base, SessionLocal, engine
from app.models import Customer, Product, Role, StockTxnType, User
from app.services.inventory_service import record_txn

USERS = [
    ("Maya Manager", "manager@example.com", "Manager@123", Role.MANAGER),
    ("Sam Sales", "sales@example.com", "Sales@123", Role.SALES),
]
PRODUCTS = [
    ("LAP-001", "Business Laptop 14\"", "16GB RAM, 512GB SSD", "55000.00", 15, 3),
    ("MON-001", "27\" 4K Monitor", "IPS panel, USB-C", "24000.00", 25, 5),
    ("KEY-001", "Mechanical Keyboard", "Hot-swappable switches", "4500.00", 60, 10),
    ("MOU-001", "Wireless Mouse", "Ergonomic, 2.4GHz", "1500.00", 120, 20),
    ("HDS-001", "Noise Cancelling Headset", "Bluetooth 5.3", "8500.00", 40, 8),
    ("DOC-001", "USB-C Docking Station", "11-in-1", "9500.00", 8, 10),
    ("CAM-001", "HD Webcam", "1080p with mic", "3200.00", 4, 10),
    ("CHR-001", "Ergonomic Office Chair", "Adjustable lumbar support", "18000.00", 20, 4),
]
CUSTOMERS = [
    ("Acme Traders", "orders@acme.example", "9876543210", "Hitech City, Hyderabad"),
    ("Globex Solutions", "buy@globex.example", "9123456780", "Koramangala, Bengaluru"),
    ("Initech Pvt Ltd", "purchase@initech.example", "9988776655", "Anna Nagar, Chennai"),
    ("Umbrella Retail", "stores@umbrella.example", "9090909090", "MG Road, Kochi"),
]


def main() -> None:
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        # Migrate existing Admin accounts to Manager so rows remain valid after removing the role.
        db.execute(text("UPDATE users SET role = 'MANAGER' WHERE role = 'ADMIN'"))
        for name, email, password, role in USERS:
            if not db.scalar(select(User.id).where(User.email == email)):
                db.add(User(name=name, email=email, role=role, hashed_password=hash_password(password)))
        for sku, name, desc, price, stock, reorder in PRODUCTS:
            if not db.scalar(select(Product.id).where(Product.sku == sku)):
                p = Product(sku=sku, name=name, description=desc, price=Decimal(price),
                            stock_quantity=stock, reorder_level=reorder)
                db.add(p)
                db.flush()
                record_txn(db, p, stock, StockTxnType.INITIAL, note="Seed data")
        for name, email, phone, address in CUSTOMERS:
            if not db.scalar(select(Customer.id).where(Customer.email == email)):
                db.add(Customer(name=name, email=email, phone=phone, address=address))
        db.commit()
    print("Seed complete. Logins: manager@example.com / sales@example.com")


if __name__ == "__main__":
    main()
