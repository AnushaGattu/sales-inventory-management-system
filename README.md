# Sales & Inventory Management System

Web application for managing products, customers, sales orders and inventory, with a **manager approval workflow**
for high-value orders and email notifications.

| Layer | Stack |
|-------|-------|
| Frontend (`Frontend/`) | React 18, Vite, **Material UI 6**, React Router 7 (data router), Axios |
| Backend (`Backend/`) | **FastAPI**, Python 3.11+, SQLAlchemy 2, Pydantic v2, JWT auth |
| Database | **MySQL 8.0.16+** |

## Quick start

```bash
# 1. Database
mysql -u root -p -e "CREATE DATABASE sales_inventory CHARACTER SET utf8mb4;"

# 2. Backend  (http://localhost:8000, API docs at /docs)
cd Backend
py -3.14 -m venv .venv
.venv\Scripts\python.exe -m pip install -r requirements.txt
# Create Backend/.env with your database URL and a private SECRET_KEY.
.venv\Scripts\python.exe -m scripts.seed
.venv\Scripts\python.exe -m uvicorn app.main:app --reload

# 3. Frontend (http://localhost:5173)
cd ..\Frontend
npm install
npm run dev
```

The frontend uses `http://localhost:8000/api/v1` by default. If your backend uses another URL, create `Frontend/.env` and set `VITE_API_BASE_URL` there.

Demo logins (created by the seed script)

| Role | Email | Password |
|------|-------|----------|
| Manager | manager@example.com | Manager@123 |
| Sales | sales@example.com | Sales@123 |

## The workflow in one paragraph

A sales user creates an order. The API validates the customer and stock inside one database transaction.
If the total is **at or below** `APPROVAL_THRESHOLD` (default 50,000) the order is completed immediately and stock is
deducted. If it is **above**, stock is *reserved*, the order becomes `PENDING_APPROVAL`, and all managers are emailed.
A manager approves (stock deducted, order `COMPLETED`) or rejects with a reason (reservation released, order
`REJECTED`); either way the creator is emailed. Emails are logged to the console and an `email_logs` table when
SMTP is not configured, so the whole flow can be demoed without a mail server.

## Documentation

* `Backend/README.md` - backend setup and API overview
* `Frontend/README.md` - frontend setup, scripts, and screens

## Tests

`cd Backend && pytest` runs 10 end-to-end API tests (SQLite, no MySQL needed) covering approval, rejection,
reservation, stock errors, permissions and the dashboard. `cd Frontend && npm run build` verifies the UI compiles.
