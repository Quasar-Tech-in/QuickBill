from typing import List, Optional
import logging
from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

logger = logging.getLogger("quickbill.config")

class Settings(BaseSettings):
    PROJECT_NAME: str = "QuickBill & Inventory API"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    
    # Environment & Documentation Controls
    APP_ENV: str = "development"  # Options: 'development', 'staging', 'prod', 'production'
    DEBUG: bool = True
    ENABLE_DOCS: Optional[bool] = None  # None = auto-detect (False in prod, True in dev)
    
    # MongoDB
    MONGODB_URI: str = "mongodb://admin:secretpassword@localhost:27017/quickbill_db?authSource=admin"
    DATABASE_NAME: str = "quickbill_db"
    DEFAULT_TENANT_DATABASE_NAME: str = "quickbill_main_db"
    
    # JWT Security
    JWT_SECRET: str = "development_jwt_secret_key_32_characters_minimum"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 1 day for dev, 15 min for prod
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30
    
    # SuperAdmin Default Credentials
    SUPERADMIN_EMAIL: str = "superadmin@quickbill.local"
    SUPERADMIN_PASSWORD: str = "superadmin123"
    SUPERADMIN_NAME: str = "Super Administrator"
    
    # CORS
    BACKEND_CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://localhost:5173",
        "http://localhost:8081",
        "http://localhost:19006",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
        "*",
    ]

    # Supabase Storage Configuration
    SUPABASE_PROJECT_REF: str = "dhuxosaclrchhfmvrria"
    SUPABASE_URL: str = "https://dhuxosaclrchhfmvrria.supabase.co"
    SUPABASE_KEY: str = "sb_publishable_pCciqXpswa6hLDVFgc6Rsg_JKjtDGhE"
    SUPABASE_SERVICE_ROLE_KEY: str = ""
    SUPABASE_BUCKET: str = "item-images"
    MEDIA_ROOT: str = "uploads"

    model_config = SettingsConfigDict(
        env_file=(".env", "apps/api/.env", "../.env"),
        env_file_encoding="utf-8",
        extra="ignore"
    )

    @property
    def is_production(self) -> bool:
        """Returns True if running in production mode."""
        return self.APP_ENV.strip().lower() in ("prod", "production")

    @property
    def docs_enabled(self) -> bool:
        """
        Returns True if API docs (/docs, /redoc, /openapi.json) should be exposed.
        Defaults to False in production, True in other environments.
        Can be explicitly overridden with ENABLE_DOCS=True or ENABLE_DOCS=False.
        """
        if self.ENABLE_DOCS is not None:
            return bool(self.ENABLE_DOCS)
        return not self.is_production

    @model_validator(mode="after")
    def validate_environment_mode(self):
        """Auto-adjust security settings for production mode."""
        if self.is_production:
            # Enforce DEBUG=False in production to prevent stack trace leaks
            self.DEBUG = False
            
            # Wildcard '*' is unsafe when credentials are used; remove from CORS origins in prod
            if "*" in self.BACKEND_CORS_ORIGINS:
                self.BACKEND_CORS_ORIGINS = [o for o in self.BACKEND_CORS_ORIGINS if o != "*"]
        return self

settings = Settings()

