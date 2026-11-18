"""SQLAlchemy engine, session factory and declarative Base."""
from collections.abc import Iterator

from sqlalchemy import create_engine
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.core.config import settings
from app.core.exceptions import ConflictError

_connect_args = {"check_same_thread": False} if settings.database_url.startswith("sqlite") else {}

engine = create_engine(
    settings.database_url,
    pool_pre_ping=True,   # drop stale connections (MySQL closes idle ones)
    pool_recycle=1800,
    connect_args=_connect_args,
)
# expire_on_commit=False: objects stay readable after commit (no surprise lazy reloads).
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


def get_db() -> Iterator[Session]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def commit_or_conflict(db: Session, message: str) -> None:
    """Commit; translate unique-constraint violations into a 409 instead of a 500."""
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise ConflictError(message) from exc
