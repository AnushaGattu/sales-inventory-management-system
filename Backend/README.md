# Backend - Sales & Inventory API (FastAPI)

## Run
```bash
py -3.14 -m venv .venv
.venv\Scripts\python.exe -m pip install -r requirements.txt
# Create Backend/.env with your database URL and a private SECRET_KEY.
.venv\Scripts\python.exe -m scripts.seed      # creates tables and demo data (safe to rerun)
.venv\Scripts\python.exe -m uvicorn app.main:app --reload
```
* Swagger UI: http://localhost:8000/docs (use **Authorize** with a seeded user's email and password)
* Health check: `GET /health`
* Tests: `pytest` (uses a temporary SQLite database)

## Folder layout
```
app/
  main.py              app factory, CORS, exception handlers, lifespan (create tables)
  models.py            SQLAlchemy models + enums
  schemas.py           Pydantic request/response models (input validation)
  core/                config (env), security (bcrypt + JWT), domain exceptions
  db/session.py        engine, SessionLocal, Base, get_db, commit_or_conflict
  api/
    deps.py            current user, role guards, pagination
    router.py          mounts all route modules under /api/v1
    routes/            thin HTTP layer: auth, meta, products, customers, orders, approvals, inventory, dashboard
  services/            business logic & transactions: order, approval, inventory, email, dashboard
scripts/seed.py        demo data
tests/                 pytest end-to-end tests
```

## Configuration (`.env`)
Create `Backend/.env` locally and set `DATABASE_URL` and a private `SECRET_KEY`. You can also set `APPROVAL_THRESHOLD`
(orders strictly above it need approval), `CURRENCY`, `CORS_ORIGINS`, and `FRONTEND_URL`. SMTP settings are optional; if
`SMTP_HOST` is blank, email messages are written to the backend log and the `email_logs` table instead of being sent.
