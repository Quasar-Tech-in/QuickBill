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

@pytest.mark.asyncio
async def test_duplicate_sku_and_barcode_uniqueness_enforced(auth_token):
    import secrets
    headers = {"Authorization": f"Bearer {auth_token}"}
    shared_sku = f"UNIQ-SKU-{secrets.token_hex(4)}"
    shared_barcode = f"UNIQ-BAR-{secrets.token_hex(4)}"

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Create first product
        item1_payload = {
            "name": "Standard Wheat Flour 1kg",
            "sku": shared_sku,
            "barcode": shared_barcode,
            "salePrice": 60.00,
            "purchasePrice": 45.00,
            "category": "Flour",
        }
        res1 = await client.post("/api/v1/items", json=item1_payload, headers=headers)
        assert res1.status_code == 201, res1.text
        item1 = res1.json()

        # 2. Attempt to create second product with exact same SKU (different name & barcode)
        item2_dup_sku = {
            "name": "Organic Wheat Flour 1kg",
            "sku": shared_sku.lower(),  # Case-insensitive duplicate check
            "barcode": f"DIFF-BAR-{secrets.token_hex(4)}",
            "salePrice": 90.00,
            "purchasePrice": 70.00,
            "category": "Organic",
        }
        res2 = await client.post("/api/v1/items", json=item2_dup_sku, headers=headers)
        assert res2.status_code == 400
        assert "SKU" in res2.json()["detail"]
        assert "already assigned" in res2.json()["detail"]

        # 3. Attempt to create second product with exact same Barcode (different name & SKU)
        item3_dup_bar = {
            "name": "Milled Whole Wheat 1kg",
            "sku": f"DIFF-SKU-{secrets.token_hex(4)}",
            "barcode": shared_barcode.lower(),  # Case-insensitive duplicate check
            "salePrice": 75.00,
            "purchasePrice": 55.00,
            "category": "Flour",
        }
        res3 = await client.post("/api/v1/items", json=item3_dup_bar, headers=headers)
        assert res3.status_code == 400
        assert "Barcode" in res3.json()["detail"]
        assert "already assigned" in res3.json()["detail"]

        # 4. Create product with identical name, category, prices, but distinct SKU & Barcode -> Must SUCCEED ("all can be same")
        item4_identical_fields = {
            "name": "Standard Wheat Flour 1kg",
            "sku": f"ALT-SKU-{secrets.token_hex(4)}",
            "barcode": f"ALT-BAR-{secrets.token_hex(4)}",
            "salePrice": 60.00,
            "purchasePrice": 45.00,
            "category": "Flour",
        }
        res4 = await client.post("/api/v1/items", json=item4_identical_fields, headers=headers)
        assert res4.status_code == 201, res4.text
        item4 = res4.json()

        # 5. Attempt to update Item 4's SKU to Item 1's SKU -> Must fail with 400
        res5 = await client.put(f"/api/v1/items/{item4['_id']}", json={"sku": shared_sku}, headers=headers)
        assert res5.status_code == 400
        assert "SKU" in res5.json()["detail"]

        # Cleanup
        await client.delete(f"/api/v1/items/{item1['_id']}", headers=headers)
        await client.delete(f"/api/v1/items/{item4['_id']}", headers=headers)

@pytest.mark.asyncio
async def test_cross_field_sku_and_barcode_uniqueness_enforced(auth_token):
    import secrets
    headers = {"Authorization": f"Bearer {auth_token}"}
    p1_sku = f"CROSS-SKU-{secrets.token_hex(4)}"
    p1_barcode = f"CROSS-BAR-{secrets.token_hex(4)}"

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Create first product with distinct SKU and Barcode
        p1_res = await client.post("/api/v1/items", json={
            "name": "First Product",
            "sku": p1_sku,
            "barcode": p1_barcode,
            "salePrice": 100.00,
        }, headers=headers)
        assert p1_res.status_code == 201
        p1 = p1_res.json()

        # 2. Attempt to create Product B whose SKU matches Product A's Barcode -> Must FAIL
        p2_res = await client.post("/api/v1/items", json={
            "name": "Second Product",
            "sku": p1_barcode,  # Matches p1's barcode!
            "barcode": f"RAND-BAR-{secrets.token_hex(4)}",
            "salePrice": 120.00,
        }, headers=headers)
        assert p2_res.status_code == 400
        assert "already assigned as a Barcode" in p2_res.json()["detail"]

        # 3. Attempt to create Product C whose Barcode matches Product A's SKU -> Must FAIL
        p3_res = await client.post("/api/v1/items", json={
            "name": "Third Product",
            "sku": f"RAND-SKU-{secrets.token_hex(4)}",
            "barcode": p1_sku,  # Matches p1's SKU!
            "salePrice": 140.00,
        }, headers=headers)
        assert p3_res.status_code == 400
        assert "already assigned as a SKU" in p3_res.json()["detail"] or "already assigned as an SKU" in p3_res.json()["detail"]

        # 4. Create Product D with unique codes
        p4_res = await client.post("/api/v1/items", json={
            "name": "Fourth Product",
            "sku": f"VALID-SKU-{secrets.token_hex(4)}",
            "barcode": f"VALID-BAR-{secrets.token_hex(4)}",
            "salePrice": 80.00,
        }, headers=headers)
        assert p4_res.status_code == 201
        p4 = p4_res.json()

        # 5. Attempt to update Product D's barcode to Product A's SKU -> Must FAIL
        update_res = await client.put(f"/api/v1/items/{p4['_id']}", json={"barcode": p1_sku}, headers=headers)
        assert update_res.status_code == 400

        # Cleanup
        await client.delete(f"/api/v1/items/{p1['_id']}", headers=headers)
        await client.delete(f"/api/v1/items/{p4['_id']}", headers=headers)

@pytest.mark.asyncio
async def test_clearing_sku_and_barcode_on_update(auth_token):
    import secrets
    headers = {"Authorization": f"Bearer {auth_token}"}
    sku = f"CLEAR-SKU-{secrets.token_hex(4)}"
    barcode = f"CLEAR-BAR-{secrets.token_hex(4)}"

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Create product with initial SKU and Barcode
        res1 = await client.post("/api/v1/items", json={
            "name": "Product To Be Cleared",
            "sku": sku,
            "barcode": barcode,
            "salePrice": 50.00,
        }, headers=headers)
        assert res1.status_code == 201
        p1 = res1.json()
        assert p1["sku"] == sku
        assert p1["barcode"] == barcode

        # 2. Update item setting sku and barcode to None / null
        update_res = await client.put(f"/api/v1/items/{p1['_id']}", json={
            "sku": None,
            "barcode": None,
        }, headers=headers)
        assert update_res.status_code == 200, update_res.text
        updated = update_res.json()
        assert updated["sku"] is None
        assert updated["barcode"] is None

        # 3. Verify via GET that sku and barcode are indeed None in DB
        get_res = await client.get(f"/api/v1/items/{p1['_id']}", headers=headers)
        assert get_res.status_code == 200
        fetched = get_res.json()
        assert fetched["sku"] is None
        assert fetched["barcode"] is None

        # 4. Now create another product reusing the cleared SKU and Barcode -> Must SUCCEED!
        res2 = await client.post("/api/v1/items", json={
            "name": "New Product Reusing Cleared Codes",
            "sku": sku,
            "barcode": barcode,
            "salePrice": 75.00,
        }, headers=headers)
        assert res2.status_code == 201
        p2 = res2.json()

        # 5. Clear Product 2 codes using empty strings ""
        clear_str_res = await client.put(f"/api/v1/items/{p2['_id']}", json={
            "sku": "",
            "barcode": "",
        }, headers=headers)
        assert clear_str_res.status_code == 200
        cleared_p2 = clear_str_res.json()
        assert cleared_p2["sku"] is None
        assert cleared_p2["barcode"] is None

        # Cleanup
        await client.delete(f"/api/v1/items/{p1['_id']}", headers=headers)
        await client.delete(f"/api/v1/items/{p2['_id']}", headers=headers)
