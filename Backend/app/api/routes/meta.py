from fastapi import APIRouter

from app.api.deps import CurrentUser
from app.core.config import settings
from app.schemas import PublicSettings

router = APIRouter(prefix="/meta", tags=["Meta"])


@router.get("/settings", response_model=PublicSettings)
def public_settings(_: CurrentUser):
    """Business settings the UI needs (e.g. to warn that an order will require approval)."""
    return PublicSettings(approval_threshold=settings.approval_threshold, currency=settings.currency)
