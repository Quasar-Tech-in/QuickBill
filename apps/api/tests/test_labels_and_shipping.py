import uuid
import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.core.security import create_access_token, TokenPayload

TENANT_ID = "65f2a1b9a000000000000001"

@pytest.fixture
def auth_headers():
    payload = TokenPayload(
        sub="usr_test_admin",
        email="admin@quickbill.local",
        roles=["tenant_admin"],
        permissions=["all"],
        default_business_id=TENANT_ID,
        authorized_business_ids=[TENANT_ID]
    )
    token = create_access_token(payload)
    return {"Authorization": f"Bearer {token}"}

@pytest.mark.asyncio
async def test_generate_custom_thermal_label_pdf(auth_headers):
    for code_type in ["BARCODE", "QR"]:
        payload = {
            "itemName": "Organic Almond Milk 1L",
            "sku": "SKU-MILK-1",
            "publicItemId": "itm_milk_123",
            "salePrice": 240.0,
            "mrp": 260.0,
            "paperSize": "THERMAL_50x30",
            "style": "STANDARD",
            "codeType": code_type,
            "quantity": 2,
            "showPrice": True,
            "showMrp": True
        }
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.post("/api/v1/labels/custom-pdf", json=payload, headers=auth_headers)
            assert response.status_code == 200
            assert response.headers["content-type"] == "application/pdf"
            assert len(response.content) > 100

@pytest.mark.asyncio
async def test_generate_jewelry_dumbbell_tag_pdf(auth_headers):
    payload = {
        "itemName": "Gold Diamond Ring 18K",
        "sku": "JW-RING-99",
        "salePrice": 15500.0,
        "paperSize": "DUMBBELL_70x12",
        "style": "JEWELRY_STRING_TAG",
        "quantity": 1,
        "showPrice": True,
        "showStoreName": True,
        "storeName": "Royal Jewelers"
    }
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post("/api/v1/labels/custom-pdf", json=payload, headers=auth_headers)
        assert response.status_code == 200
        assert response.headers["content-type"] == "application/pdf"
        assert len(response.content) > 100

@pytest.mark.asyncio
async def test_generate_a4_batch_sticker_grid_pdf(auth_headers):
    payload = {
        "paperSize": "A4_GRID_24",
        "items": [
            {
                "itemName": "Item 1",
                "sku": "SKU-1",
                "salePrice": 100.0,
                "quantity": 10
            },
            {
                "itemName": "Item 2",
                "sku": "SKU-2",
                "salePrice": 250.0,
                "quantity": 14
            }
        ]
    }
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post("/api/v1/labels/batch-pdf", json=payload, headers=auth_headers)
        assert response.status_code == 200
        assert response.headers["content-type"] == "application/pdf"
        assert len(response.content) > 100

@pytest.mark.asyncio
async def test_generate_shipping_label_4x6_pdf(auth_headers):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/api/v1/labels/shipping/ORD-9842/pdf", headers=auth_headers)
        assert response.status_code == 200
        assert response.headers["content-type"] == "application/pdf"
        assert len(response.content) > 100

@pytest.mark.asyncio
async def test_shipping_order_lookup_and_verification(auth_headers):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Lookup order by shipping barcode
        lookup_res = await client.get("/api/v1/shipping/orders/lookup/SHIP:ORD-9842", headers=auth_headers)
        assert lookup_res.status_code == 200
        data = lookup_res.json()
        assert data["orderId"] == "ORD-9842"
        assert len(data["items"]) == 2

        # 2. Verify scanning a correct item barcode
        verify_res = await client.post(
            "/api/v1/shipping/orders/ORD-9842/verify-item",
            json={"scannedCode": "ITEM:ITM-1001"},
            headers=auth_headers
        )
        assert verify_res.status_code == 200
        res_json = verify_res.json()
        assert res_json["success"] is True

        # 3. Complete dispatch
        dispatch_res = await client.post("/api/v1/shipping/orders/ORD-9842/dispatch", headers=auth_headers)
        assert dispatch_res.status_code == 200
        assert dispatch_res.json()["status"] == "DISPATCHED"


@pytest.mark.asyncio
async def test_barcode_uniqueness_enforcement(auth_headers):
    unique_barcode = f"BAR-{uuid.uuid4().hex[:8]}"
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Create first product with barcode
        item_a = {
            "name": "Product Alpha Barcode Test",
            "salePrice": 100.0,
            "purchasePrice": 60.0,
            "barcode": unique_barcode,
            "sku": f"SKU-{uuid.uuid4().hex[:6]}"
        }
        res_a = await client.post("/api/v1/items", json=item_a, headers=auth_headers)
        assert res_a.status_code == 201

        # 2. Attempt to create second product with identical barcode in same tenant -> Should fail with 400
        item_b = {
            "name": "Product Beta Barcode Collision",
            "salePrice": 120.0,
            "purchasePrice": 70.0,
            "barcode": unique_barcode,
            "sku": f"SKU-{uuid.uuid4().hex[:6]}"
        }
        res_b = await client.post("/api/v1/items", json=item_b, headers=auth_headers)
        assert res_b.status_code == 400
        assert "already assigned" in res_b.json()["detail"].lower()
