import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.core.config import settings
from app.core.database import connect_to_mongo, close_mongo_connection
from app.api.v1 import auth, items, sales, parties, customers, payments, expenses, reports, tenants, users, locations, categories, purchase_orders, labels, shipping, staged_orders

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Ensure uploads directory exists
    try:
        os.makedirs("uploads/item-images", exist_ok=True)
    except Exception:
        pass
    # Startup
    try:
        await connect_to_mongo()
    except Exception as e:
        print(f"Warning: Could not connect to MongoDB on startup ({e}). Continuing in standalone mode.")
    yield
    # Shutdown
    await close_mongo_connection()

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from pymongo.errors import PyMongoError, ServerSelectionTimeoutError
from fastapi.responses import JSONResponse
from fastapi import Request

@app.exception_handler(ServerSelectionTimeoutError)
@app.exception_handler(PyMongoError)
async def mongo_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=503,
        content={
            "detail": f"Database unreachable: {str(exc)}. Please ensure MongoDB Atlas Network Access has 0.0.0.0/0 enabled and MONGODB_URI is correctly configured in Vercel environment variables."
        }
    )

# Static media mount
try:
    os.makedirs("uploads", exist_ok=True)
    app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")
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

@app.get("/", tags=["Health"])
@app.get("/api/v1/health", tags=["Health"])
@app.get("/health", tags=["Health"])
@app.get("/health/live", tags=["Health"])
async def liveness():
    return {"status": "ok", "service": settings.PROJECT_NAME, "version": settings.VERSION}

@app.get("/health/ready", tags=["Health"])
async def readiness():
    return {"status": "ready", "database": "healthy"}

