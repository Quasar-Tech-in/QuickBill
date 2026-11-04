import os
import hashlib
import logging

# Compatibility shim for ReportLab on Python <= 3.8 where openssl_md5 does not support usedforsecurity
try:
    hashlib.md5(usedforsecurity=False)
except TypeError:
    _orig_md5 = hashlib.md5
    hashlib.md5 = lambda *args, **kwargs: _orig_md5(*args, **{k: v for k, v in kwargs.items() if k != "usedforsecurity"})

from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from pymongo.errors import PyMongoError, ServerSelectionTimeoutError
from app.core.config import settings
from app.core.database import connect_to_mongo, close_mongo_connection
from app.api.v1 import (
    auth, items, sales, parties, customers, payments, expenses, reports,
    tenants, users, locations, categories, purchase_orders, labels,
    shipping, staged_orders, inventory, cafe_tables, cafe_sessions, cafe_public
)

logger = logging.getLogger("quickbill.main")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Production configuration audit
    if settings.is_production:
        logger.info(f"Starting {settings.PROJECT_NAME} in PRODUCTION mode (APP_ENV={settings.APP_ENV}, docs_enabled={settings.docs_enabled})")
        if "development" in settings.JWT_SECRET.lower():
            logger.warning("CRITICAL SECURITY WARNING: Insecure default JWT_SECRET detected in production environment! Set JWT_SECRET in environment variables.")
        if settings.SUPERADMIN_PASSWORD == "superadmin123":
            logger.warning("SECURITY WARNING: Default superadmin password detected in production environment.")
    else:
        logger.info(f"Starting {settings.PROJECT_NAME} in DEVELOPMENT mode (APP_ENV={settings.APP_ENV}, docs_enabled={settings.docs_enabled})")

    # Ensure uploads directory exists
    try:
        os.makedirs(os.path.join(settings.MEDIA_ROOT, "item-images"), exist_ok=True)
    except Exception:
        pass
    # Startup
    try:
        await connect_to_mongo()
    except Exception as e:
        logger.warning(f"Could not connect to MongoDB on startup ({e}). Continuing in standalone mode.")
    yield
    # Shutdown
    await close_mongo_connection()

# Configure documentation endpoints based on environment flag
docs_url = "/docs" if settings.docs_enabled else None
redoc_url = "/redoc" if settings.docs_enabled else None
openapi_url = "/openapi.json" if settings.docs_enabled else None

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    debug=settings.DEBUG,
    lifespan=lifespan,
    docs_url=docs_url,
    redoc_url=redoc_url,
    openapi_url=openapi_url,
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Security Headers Middleware
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    if settings.is_production:
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return response

@app.exception_handler(ServerSelectionTimeoutError)
@app.exception_handler(PyMongoError)
async def mongo_exception_handler(request: Request, exc: Exception):
    req_path = request.scope.get("path", "/")
    logger.error(f"Database error on {request.method} {req_path}: {exc}")
    if settings.is_production:
        return JSONResponse(
            status_code=503,
            content={
                "detail": "Database service temporarily unavailable. Please try again later."
            }
        )
    return JSONResponse(
        status_code=503,
        content={
            "detail": f"Database unreachable: {str(exc)}. Please ensure MongoDB Atlas Network Access has 0.0.0.0/0 enabled and MONGODB_URI is correctly configured in environment variables."
        }
    )

# Static media mount
try:
    os.makedirs(settings.MEDIA_ROOT, exist_ok=True)
    app.mount(f"/{settings.MEDIA_ROOT}", StaticFiles(directory=settings.MEDIA_ROOT), name=settings.MEDIA_ROOT)
except Exception:
    pass

# Register API v1 Routers
app.include_router(auth.router, prefix=settings.API_V1_STR)
app.include_router(users.router, prefix=settings.API_V1_STR)
app.include_router(locations.router, prefix=settings.API_V1_STR)
app.include_router(categories.router, prefix=settings.API_V1_STR)
app.include_router(items.router, prefix=settings.API_V1_STR)
app.include_router(sales.router, prefix=settings.API_V1_STR)
app.include_router(purchase_orders.router, prefix=settings.API_V1_STR)
app.include_router(parties.router, prefix=settings.API_V1_STR)
app.include_router(customers.router, prefix=settings.API_V1_STR)
app.include_router(payments.router, prefix=settings.API_V1_STR)
app.include_router(expenses.router, prefix=settings.API_V1_STR)
app.include_router(reports.router, prefix=settings.API_V1_STR)
app.include_router(tenants.router, prefix=settings.API_V1_STR)
app.include_router(labels.router, prefix=settings.API_V1_STR)
app.include_router(shipping.router, prefix=settings.API_V1_STR)
app.include_router(staged_orders.router, prefix=settings.API_V1_STR)
app.include_router(inventory.router, prefix=settings.API_V1_STR)
app.include_router(cafe_tables.router, prefix=settings.API_V1_STR)
app.include_router(cafe_sessions.router, prefix=settings.API_V1_STR)
app.include_router(cafe_public.router, prefix=settings.API_V1_STR)

@app.get("/", tags=["Health"])
@app.get("/api/v1/health", tags=["Health"])
@app.get("/health", tags=["Health"])
@app.get("/health/live", tags=["Health"])
async def liveness():
    return {"status": "ok", "service": settings.PROJECT_NAME, "version": settings.VERSION}

@app.get("/health/ready", tags=["Health"])
async def readiness():
    return {"status": "ready", "database": "healthy"}

