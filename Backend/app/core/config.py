"""Application settings, loaded from environment variables / .env file."""
from decimal import Decimal
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "Sales & Inventory Management API"
    database_url: str = "mysql+pymysql://root:password@localhost:3306/sales_inventory"

    secret_key: str = "dev-only-secret-change-me-0123456789abcdef"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60

    # Business rule: orders with total > threshold require manager approval.
    approval_threshold: Decimal = Decimal("50000")
    currency: str = "INR"

    cors_origins: str = "http://localhost:5173"
    frontend_url: str = "http://localhost:5173"

    smtp_host: str = ""
    smtp_port: int = 587
    smtp_username: str = ""
    smtp_password: str = ""
    smtp_use_tls: bool = True
    email_from: str = "no-reply@sales-inventory.local"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
