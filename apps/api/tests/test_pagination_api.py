import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.core.security import create_access_token, TokenPayload
from app.core.database import connect_to_mongo, close_mongo_connection

TENANT_ID = "65f2a1b9a000000000000001"

@pytest.fixture(autouse=True)
async def init_db():
    try:
        await connect_to_mongo()
    except Exception:
        pass
    yield

@pytest.fixture
def auth_token():
    payload = TokenPayload(
        sub="usr_test_admin",
        email="admin@quickbill.local",
        roles=["tenant_admin"],
        permissions=["all"],
        default_business_id=TENANT_ID,
        authorized_business_ids=[TENANT_ID]
    )
    return create_access_token(payload)

@pytest.mark.asyncio
async def test_items_backend_pagination(auth_token):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        headers = {"Authorization": f"Bearer {auth_token}"}
        res = await ac.get("/api/v1/items?page=1&page_size=5", headers=headers)
        assert res.status_code == 200
        data = res.json()
        assert "data" in data
        assert "page" in data
        assert data["page"] == 1
        assert "page_size" in data
        assert data["page_size"] == 5
        assert "total" in data
        assert "total_pages" in data

@pytest.mark.asyncio
async def test_sales_backend_pagination(auth_token):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        headers = {"Authorization": f"Bearer {auth_token}"}
        res = await ac.get("/api/v1/sales?page=1&page_size=10", headers=headers)
        assert res.status_code == 200
        data = res.json()
        assert "data" in data
        assert "page" in data
        assert data["page"] == 1
        assert "total" in data
        assert "total_pages" in data

@pytest.mark.asyncio
async def test_parties_backend_pagination(auth_token):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        headers = {"Authorization": f"Bearer {auth_token}"}
        res = await ac.get("/api/v1/parties?page=1&page_size=10&type=CUSTOMER", headers=headers)
        assert res.status_code == 200
        data = res.json()
        assert "data" in data
        assert "page" in data
        assert "total" in data

@pytest.mark.asyncio
async def test_expenses_backend_pagination(auth_token):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        headers = {"Authorization": f"Bearer {auth_token}"}
        res = await ac.get("/api/v1/expenses?page=1&page_size=10", headers=headers)
        assert res.status_code == 200
        data = res.json()
        assert "data" in data
        assert "page" in data
        assert "total" in data
