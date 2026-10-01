from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    PROJECT_NAME: str = "QuickBill & Inventory API"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    
    # Environment
    APP_ENV: str = "development"
    DEBUG: bool = True
    
    # MongoDB
    MONGODB_URI: str = "mongodb://admin:secretpassword@localhost:27017/quickbill_db?authSource=admin"
    DATABASE_NAME: str = "quickbill_db"
    
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

settings = Settings()
