import pytest
from httpx import AsyncClient, ASGITransport
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from pymongo.errors import ServerSelectionTimeoutError
from app.core.config import Settings
from app.core.security import get_current_user
from app.main import app, mongo_exception_handler, add_security_headers


def test_settings_environment_detection():
    # Development mode defaults
    dev_settings = Settings(APP_ENV="development")
    assert not dev_settings.is_production
    assert dev_settings.docs_enabled is True
    assert dev_settings.DEBUG is True

    # Production mode detection
    prod_settings_1 = Settings(APP_ENV="prod")
    assert prod_settings_1.is_production is True
    assert prod_settings_1.docs_enabled is False
    assert prod_settings_1.DEBUG is False

    prod_settings_2 = Settings(APP_ENV="production")
    assert prod_settings_2.is_production is True
    assert prod_settings_2.docs_enabled is False

    # Explicit override: ENABLE_DOCS=True in production
    prod_with_docs = Settings(APP_ENV="prod", ENABLE_DOCS=True)
    assert prod_with_docs.is_production is True
    assert prod_with_docs.docs_enabled is True

    # Explicit override: ENABLE_DOCS=False in development
    dev_without_docs = Settings(APP_ENV="development", ENABLE_DOCS=False)
    assert dev_without_docs.is_production is False
    assert dev_without_docs.docs_enabled is False


def test_cors_wildcard_stripped_in_production():
    dev_settings = Settings(APP_ENV="development", BACKEND_CORS_ORIGINS=["http://localhost:3000", "*"])
    assert "*" in dev_settings.BACKEND_CORS_ORIGINS

    prod_settings = Settings(APP_ENV="prod", BACKEND_CORS_ORIGINS=["http://localhost:3000", "*"])
    assert "*" not in prod_settings.BACKEND_CORS_ORIGINS
    assert "http://localhost:3000" in prod_settings.BACKEND_CORS_ORIGINS


@pytest.mark.asyncio
async def test_api_docs_endpoints_disabled_in_prod():
    # Build app with prod settings (docs disabled)
    prod_app = FastAPI(
        docs_url=None,
        redoc_url=None,
        openapi_url=None,
    )
    transport = ASGITransport(app=prod_app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        r_docs = await client.get("/docs")
        assert r_docs.status_code == 404

        r_redoc = await client.get("/redoc")
        assert r_redoc.status_code == 404

        r_openapi = await client.get("/openapi.json")
        assert r_openapi.status_code == 404


@pytest.mark.asyncio
async def test_api_docs_endpoints_enabled_in_dev():
    # Build app with dev settings (docs enabled)
    dev_app = FastAPI(
        docs_url="/docs",
        redoc_url="/redoc",
        openapi_url="/openapi.json",
    )
    transport = ASGITransport(app=dev_app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        r_docs = await client.get("/docs")
        assert r_docs.status_code == 200

        r_redoc = await client.get("/redoc")
        assert r_redoc.status_code == 200

        r_openapi = await client.get("/openapi.json")
        assert r_openapi.status_code == 200


@pytest.mark.asyncio
async def test_security_headers_middleware():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/health")
        assert response.status_code == 200
        assert response.headers.get("X-Content-Type-Options") == "nosniff"
        assert response.headers.get("X-Frame-Options") == "DENY"
        assert response.headers.get("X-XSS-Protection") == "1; mode=block"
        assert response.headers.get("Referrer-Policy") == "strict-origin-when-cross-origin"


@pytest.mark.asyncio
async def test_auth_bypass_disallowed_in_production(monkeypatch):
    from app.core import security
    # Simulate production mode with DEBUG=True (e.g. misconfigured)
    monkeypatch.setattr(security.settings, "APP_ENV", "prod")
    monkeypatch.setattr(security.settings, "DEBUG", True)

    with pytest.raises(Exception) as exc_info:
        await get_current_user(auth=None)
    assert exc_info.value.status_code == 401


@pytest.mark.asyncio
async def test_mongo_exception_handler_sanitized_in_prod(monkeypatch):
    import app.main as main_mod
    monkeypatch.setattr(main_mod.settings, "APP_ENV", "prod")

    # Create dummy request
    scope = {"type": "http", "method": "GET", "path": "/api/v1/items", "headers": []}
    req = Request(scope)
    exc = ServerSelectionTimeoutError("No replica set members found at mongodb+srv://secret_user:secret_pass@cluster.mongodb.net")

    resp = await mongo_exception_handler(req, exc)
    assert resp.status_code == 503
    import json
    data = json.loads(resp.body.decode("utf-8"))
    # In production, sensitive connection strings must NOT be leaked
    assert "mongodb.net" not in data["detail"]
    assert "secret_pass" not in data["detail"]
    assert data["detail"] == "Database service temporarily unavailable. Please try again later."
