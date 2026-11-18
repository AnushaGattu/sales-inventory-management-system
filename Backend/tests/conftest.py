"""Tests run against a throw-away SQLite file so no MySQL server is needed.
(Row locks are no-ops on SQLite; the logic and constraints are still exercised.)"""
import os
import tempfile

_db_file = os.path.join(tempfile.mkdtemp(), "test.db")
os.environ["DATABASE_URL"] = f"sqlite:///{_db_file}"
os.environ["APPROVAL_THRESHOLD"] = "50000"

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.db.session import Base, engine  # noqa: E402
from app.main import app  # noqa: E402
from scripts import seed  # noqa: E402


@pytest.fixture(autouse=True)
def fresh_db():
    Base.metadata.drop_all(bind=engine)
    seed.main()
    yield


@pytest.fixture()
def client():
    with TestClient(app) as c:
        yield c


def login(client, email, password):
    r = client.post("/api/v1/auth/login", data={"username": email, "password": password})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


@pytest.fixture()
def sales(client):
    return login(client, "sales@example.com", "Sales@123")


@pytest.fixture()
def manager(client):
    return login(client, "manager@example.com", "Manager@123")
