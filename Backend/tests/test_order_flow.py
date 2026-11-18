from sqlalchemy import select

from app.db.session import SessionLocal
from app.models import EmailLog

API = "/api/v1"


def product_by_sku(client, headers, sku):
    items = client.get(f"{API}/products", params={"q": sku}, headers=headers).json()["items"]
    return items[0]


def place(client, headers, product_id, qty, customer_id=1):
    return client.post(f"{API}/orders", headers=headers,
                       json={"customer_id": customer_id, "items": [{"product_id": product_id, "quantity": qty}]})


def test_login_and_auth_required(client, sales):
    assert client.get(f"{API}/products").status_code == 401
    assert client.post(f"{API}/auth/login", data={"username": "sales@example.com", "password": "bad"}).status_code == 401
    assert client.get(f"{API}/auth/me", headers=sales).json()["role"] == "SALES"


def test_small_order_completes_immediately_and_deducts_stock(client, sales):
    mouse = product_by_sku(client, sales, "MOU-001")           # 1500 each
    r = place(client, sales, mouse["id"], 4)                    # 6000 <= threshold
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["status"] == "COMPLETED" and body["requires_approval"] is False
    after = product_by_sku(client, sales, "MOU-001")
    assert after["stock_quantity"] == mouse["stock_quantity"] - 4 and after["reserved_quantity"] == 0


def test_large_order_pending_reserves_then_manager_approves(client, sales, manager):
    laptop = product_by_sku(client, sales, "LAP-001")           # 55000 each -> above threshold
    r = place(client, sales, laptop["id"], 2)
    body = r.json()
    assert body["status"] == "PENDING_APPROVAL" and body["approval"]["status"] == "PENDING"
    mid = product_by_sku(client, sales, "LAP-001")
    assert mid["reserved_quantity"] == 2 and mid["stock_quantity"] == laptop["stock_quantity"]

    # approval request email was "sent" (logged) to the manager
    with SessionLocal() as db:
        mails = list(db.scalars(select(EmailLog)))
    assert any("Approval required" in m.subject and m.recipient == "manager@example.com" for m in mails)

    # a sales user cannot decide
    assert client.post(f"{API}/approvals/{body['approval']['id']}/approve", headers=sales, json={}).status_code == 403

    ok = client.post(f"{API}/approvals/{body['approval']['id']}/approve", headers=manager, json={"comments": "ok"})
    assert ok.status_code == 200 and ok.json()["status"] == "COMPLETED"
    end = product_by_sku(client, sales, "LAP-001")
    assert end["stock_quantity"] == laptop["stock_quantity"] - 2 and end["reserved_quantity"] == 0

    with SessionLocal() as db:
        subjects = [m.subject for m in db.scalars(select(EmailLog))]
    assert any("approved" in s for s in subjects)

    # deciding twice is rejected
    again = client.post(f"{API}/approvals/{body['approval']['id']}/approve", headers=manager, json={})
    assert again.status_code == 409


def test_reject_releases_reservation_and_requires_reason(client, sales, manager):
    laptop = product_by_sku(client, sales, "LAP-001")
    order = place(client, sales, laptop["id"], 1).json()
    aid = order["approval"]["id"]
    assert client.post(f"{API}/approvals/{aid}/reject", headers=manager, json={}).status_code == 422
    r = client.post(f"{API}/approvals/{aid}/reject", headers=manager, json={"comments": "Over budget"})
    assert r.json()["status"] == "REJECTED"
    after = product_by_sku(client, sales, "LAP-001")
    assert after["reserved_quantity"] == 0 and after["stock_quantity"] == laptop["stock_quantity"]


def test_insufficient_stock_and_reservation_counts_against_availability(client, sales):
    laptop = product_by_sku(client, sales, "LAP-001")           # stock 15
    assert place(client, sales, laptop["id"], 10).status_code == 201   # reserves 10
    r = place(client, sales, laptop["id"], 6)                          # only 5 available
    assert r.status_code == 409 and r.json()["code"] == "insufficient_stock"


def test_validation_errors(client, sales):
    r = client.post(f"{API}/orders", headers=sales, json={"customer_id": 1, "items": []})
    assert r.status_code == 422 and r.json()["code"] == "validation_error"
    r = place(client, sales, 1, 0)
    assert r.status_code == 422


def test_manager_cannot_approve_own_order(client, manager):
    laptop = product_by_sku(client, manager, "LAP-001")
    order = place(client, manager, laptop["id"], 1).json()
    assert client.post(f"{API}/approvals/{order['approval']['id']}/approve", headers=manager, json={}).status_code == 403


def test_cancel_pending_order_releases_stock(client, sales):
    laptop = product_by_sku(client, sales, "LAP-001")
    order = place(client, sales, laptop["id"], 2).json()
    r = client.post(f"{API}/orders/{order['id']}/cancel", headers=sales)
    assert r.json()["status"] == "CANCELLED"
    assert product_by_sku(client, sales, "LAP-001")["reserved_quantity"] == 0


def test_sales_sees_only_own_orders_and_dashboard(client, sales, manager):
    mouse = product_by_sku(client, sales, "MOU-001")
    place(client, sales, mouse["id"], 1)
    place(client, manager, mouse["id"], 1)
    assert client.get(f"{API}/orders", headers=sales).json()["total"] == 1
    assert client.get(f"{API}/orders", headers=manager).json()["total"] == 2
    d = client.get(f"{API}/dashboard/summary", headers=manager).json()
    assert d["scope"] == "all" and d["orders_by_status"]["COMPLETED"] == 2 and len(d["sales_last_7_days"]) == 7
    assert client.get(f"{API}/approvals", headers=sales).status_code == 403


def test_products_permissions_and_stock_adjustment(client, sales, manager):
    payload = {"sku": "tst-1", "name": "Test Item", "price": "10.50", "stock_quantity": 5}
    assert client.post(f"{API}/products", headers=sales, json=payload).status_code == 403
    created = client.post(f"{API}/products", headers=manager, json=payload)
    assert created.status_code == 201 and created.json()["sku"] == "TST-1"
    assert client.post(f"{API}/products", headers=manager, json=payload).status_code == 409
    pid = created.json()["id"]
    bad = client.post(f"{API}/inventory/adjustments", headers=manager,
                      json={"product_id": pid, "quantity_change": -50, "note": "shrinkage"})
    assert bad.status_code == 422
    good = client.post(f"{API}/inventory/adjustments", headers=manager,
                       json={"product_id": pid, "quantity_change": 20, "note": "restock"})
    assert good.status_code == 201 and good.json()["stock_quantity"] == 25
    txns = client.get(f"{API}/inventory/transactions", params={"product_id": pid}, headers=manager).json()
    assert txns["total"] == 2
