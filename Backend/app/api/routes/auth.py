from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import select

from app.api.deps import CurrentUser, DbSession
from app.core.security import create_access_token, verify_password
from app.models import User
from app.schemas import TokenOut, UserOut

router = APIRouter(prefix="/auth", tags=["Auth"])


@router.post("/login", response_model=TokenOut)
def login(form: Annotated[OAuth2PasswordRequestForm, Depends()], db: DbSession):
    """OAuth2 password flow (form fields `username` = email, `password`) so Swagger's Authorize button works."""
    user = db.scalars(select(User).where(User.email == form.username.strip().lower())).first()
    # Same message for unknown user / wrong password / inactive: don't leak which accounts exist.
    if not user or not user.is_active or not verify_password(form.password, user.hashed_password):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid email or password",
                            headers={"WWW-Authenticate": "Bearer"})
    return TokenOut(access_token=create_access_token(user.id, user.role.value), user=user)


@router.get("/me", response_model=UserOut)
def me(user: CurrentUser):
    return user
