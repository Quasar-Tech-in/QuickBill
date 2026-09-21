import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app

@pytest.mark.asyncio
async def test_api_health_live():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        response = await ac.get("/health/live")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"

@pytest.mark.asyncio
async def test_auth_login_demo():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        response = await ac.post("/api/v1/auth/login", json={
            "email": "admin@quickbill.local",
            "password": "admin123"
        })
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["email"] == "admin@quickbill.local"

@pytest.mark.asyncio
async def test_super_admin_login_and_tenant_list():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        login_res = await ac.post("/api/v1/auth/login", json={
            "email": "superadmin@quickbill.local",
            "password": "superadmin123"
        })
        assert login_res.status_code == 200
        token = login_res.json()["access_token"]

        headers = {"Authorization": f"Bearer {token}"}
        tenants_res = await ac.get("/api/v1/tenants", headers=headers)
        assert tenants_res.status_code == 200
        tenants = tenants_res.json()
        assert len(tenants) >= 1
        assert "database_config" in tenants[0]
