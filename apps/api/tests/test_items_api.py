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
async def test_item_full_lifecycle_and_db_sync(auth_token):
    import secrets
    headers = {"Authorization": f"Bearer {auth_token}"}
    sku = f"HONEY-{secrets.token_hex(4)}"

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Create item with images, allowParts, location overrides, barcodes
        create_payload = {
            "name": "Organic Honey 500g",
            "sku": sku,
            "barcode": "8901234567890",
            "category": "Organic & Natural",
            "unit": "jar",
            "purchasePrice": 180.00,
            "salePrice": 250.00,
            "mrp": 275.00,
            "taxRate": 5.0,
            "allowParts": True,
            "description": "100% Pure raw organic wildflower honey.",
            "hasDiscount": True,
            "discountType": "FLAT",
            "discountValue": 25.00,
            "currentStock": 50.0,
            "minStockAlert": 10.0,
            "locations": [
                {
                    "locationId": "loc_main",
                    "locationName": "Main Flagship Counter",
                    "mrp": 275.00,
                    "salePrice": 250.00,
                    "purchasePrice": 180.00,
                    "currentStock": 30.0,
                    "minStockAlert": 5.0,
                    "isListed": True,
                    "hasDiscount": True,
                    "discountType": "FLAT",
                    "discountValue": 25.00,
                },
                {
                    "locationId": "loc_warehouse",
                    "locationName": "Warehouse 1",
                    "mrp": 275.00,
                    "salePrice": 250.00,
                    "purchasePrice": 180.00,
                    "currentStock": 20.0,
                    "minStockAlert": 10.0,
                    "isListed": False,
                    "hasDiscount": False,
                    "discountType": "PERCENT",
                    "discountValue": 0.0,
                }
            ],
            "images": [
                {
                    "id": "img_honey_1",
                    "url": "https://example.com/honey.webp",
                    "order": 0,
                    "isPrimary": True,
                    "name": "honey.webp",
                    "sizeBytes": 45000,
                }
            ],
            "imageUrl": "https://example.com/honey.webp",
        }

        res = await client.post("/api/v1/items", json=create_payload, headers=headers)
        assert res.status_code == 201, res.text
        created = res.json()
        item_id = created["_id"]
        assert created["name"] == "Organic Honey 500g"
        assert created["barcode"] == "8901234567890"
        assert created["allowParts"] is True
        assert len(created["locations"]) == 2
        assert len(created["images"]) == 1
        assert created["imageUrl"] == "https://example.com/honey.webp"
        assert float(created["currentStock"]) == 50.0

        # 2. Get by ID and verify all fields returned
        get_res = await client.get(f"/api/v1/items/{item_id}", headers=headers)
        assert get_res.status_code == 200
        fetched = get_res.json()
        assert fetched["allowParts"] is True
        assert fetched["locations"][0]["locationId"] == "loc_main"
        assert float(fetched["locations"][0]["currentStock"]) == 30.0

        # 3. Adjust Stock via API
        adjust_res = await client.post(
            f"/api/v1/items/{item_id}/adjust-stock",
            json={"delta": 15.0, "locationId": "loc_main"},
            headers=headers
        )
        assert adjust_res.status_code == 200
        adjusted = adjust_res.json()
        assert float(adjusted["currentStock"]) == 65.0
        loc_main = next(l for l in adjusted["locations"] if l["locationId"] == "loc_main")
        assert float(loc_main["currentStock"]) == 45.0

        # 4. Update item (prices, images, locations)
        update_payload = {
            "name": "Organic Wildflower Honey 500g",
            "salePrice": 260.00,
            "allowParts": False,
            "locations": [
                {
                    "locationId": "loc_main",
                    "salePrice": 260.00,
                    "purchasePrice": 180.00,
                    "currentStock": 45.0,
                    "minStockAlert": 5.0,
                    "isListed": True,
                }
            ]
        }
        put_res = await client.put(f"/api/v1/items/{item_id}", json=update_payload, headers=headers)
        assert put_res.status_code == 200
        updated = put_res.json()
        assert updated["name"] == "Organic Wildflower Honey 500g"
        assert float(updated["salePrice"]) == 260.00
        assert updated["allowParts"] is False

        # 5. Delete item
        del_res = await client.delete(f"/api/v1/items/{item_id}", headers=headers)
        assert del_res.status_code == 204
