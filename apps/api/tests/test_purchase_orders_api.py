import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.core.security import create_access_token, TokenPayload
from app.core.database import connect_to_mongo, close_mongo_connection

@pytest.fixture(autouse=True)
async def init_db():
    try:
        await connect_to_mongo()
    except Exception:
        pass
    yield

@pytest.fixture
def auth_headers():
    token = create_access_token(
        payload=TokenPayload(
            sub="65f2a1b9a000000000000011",
            email="admin@quickbill.local",
            roles=["admin", "TENANT_ADMIN"],
            default_business_id="65f2a1b9a000000000000001",
            authorized_business_ids=["65f2a1b9a000000000000001"]
        )
    )
    return {
        "Authorization": f"Bearer {token}",
        "X-Business-ID": "65f2a1b9a000000000000001",
        "Content-Type": "application/json"
    }

@pytest.mark.asyncio
async def test_purchase_order_lifecycle(auth_headers):
    import secrets
    sku = f"NUT-ALM-{secrets.token_hex(4)}"
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. First, create a product to use in PO
        item_payload = {
            "name": "Organic Almond Butter 500g",
            "sku": sku,
            "category": "Grocery",
            "unit": "pcs",
            "purchase_price": 250.0,
            "sale_price": 380.0,
            "mrp": 400.0,
            "tax_rate": 5.0,
            "current_stock": 10.0,
            "min_stock_alert": 5.0,
            "allow_parts": False
        }
        item_res = await client.post("/api/v1/items", headers=auth_headers, json=item_payload)
        assert item_res.status_code == 201
        item_data = item_res.json()
        item_id = str(item_data.get("_id") or item_data.get("id"))

        # 2. Create a Purchase Order
        po_payload = {
            "supplierId": "65f2a1b9a000000000000301",
            "supplierName": "Himalayan Organic Farms",
            "supplierPhone": "+91 9876500001",
            "locationId": "65f2a1b9a000000000000101",
            "locationName": "Main Flagship Counter",
            "expectedDeliveryDate": "2026-10-15",
            "notes": "Urgent restock for holiday weekend",
            "items": [
                {
                    "itemId": item_id,
                    "itemName": "Organic Almond Butter 500g",
                    "sku": sku,
                    "unit": "pcs",
                    "orderedQuantity": 20.0,
                    "unitCost": 240.0,
                    "taxRate": 5.0,
                    "updateMasterPurchasePrice": True
                }
            ],
            "status": "ORDERED"
        }
        po_res = await client.post("/api/v1/purchase-orders", headers=auth_headers, json=po_payload)
        assert po_res.status_code == 201
        po_data = po_res.json()
        po_id = po_data["id"]
        assert po_data["status"] == "ORDERED"
        assert len(po_data["items"]) == 1
        assert po_data["items"][0]["orderedQuantity"] == 20.0
        assert po_data["items"][0]["receivedQuantity"] == 0.0

        # 3. List Purchase Orders
        list_res = await client.get("/api/v1/purchase-orders", headers=auth_headers)
        assert list_res.status_code == 200
        assert list_res.json()["total"] >= 1

        # 4. Partial Receive: Receive 8 of 20 units
        receive_payload_partial = {
            "receiptNotes": "Partial shipment batch 1 received via Express Logistics",
            "receivedItems": [
                {
                    "itemId": item_id,
                    "quantityReceived": 8.0,
                    "unitCost": 240.0
                }
            ],
            "paymentDetails": {
                "amountPaid": 1000.0,
                "paymentMode": "BANK_TRANSFER"
            }
        }
        rcpt1_res = await client.post(f"/api/v1/purchase-orders/{po_id}/receive", headers=auth_headers, json=receive_payload_partial)
        assert rcpt1_res.status_code == 200
        rcpt1_data = rcpt1_res.json()
        assert rcpt1_data["status"] == "PARTIALLY_RECEIVED"
        assert rcpt1_data["items"][0]["receivedQuantity"] == 8.0
        assert len(rcpt1_data["receipts"]) == 1

        # Check stock increased by 8 units (10 + 8 = 18)
        item_check = await client.get(f"/api/v1/items/{item_id}", headers=auth_headers)
        assert item_check.status_code == 200
        assert float(item_check.json()["currentStock"]) == 18.0

        # 5. Full Receive Remaining: Receive remaining 12 units
        receive_payload_full = {
            "receiptNotes": "Final balance shipment batch 2",
            "receivedItems": [
                {
                    "itemId": item_id,
                    "quantityReceived": 12.0,
                    "unitCost": 240.0
                }
            ],
            "paymentDetails": {
                "amountPaid": 2024.0,
                "paymentMode": "UPI"
            }
        }
        rcpt2_res = await client.post(f"/api/v1/purchase-orders/{po_id}/receive", headers=auth_headers, json=receive_payload_full)
        assert rcpt2_res.status_code == 200
        rcpt2_data = rcpt2_res.json()
        assert rcpt2_data["status"] == "FULLY_RECEIVED"
        assert rcpt2_data["items"][0]["receivedQuantity"] == 20.0
        assert len(rcpt2_data["receipts"]) == 2

        # Check stock increased to 30 units (18 + 12 = 30)
        item_check2 = await client.get(f"/api/v1/items/{item_id}", headers=auth_headers)
        assert item_check2.status_code == 200
        assert float(item_check2.json()["currentStock"]) == 30.0

@pytest.mark.asyncio
async def test_purchase_order_cancellation(auth_headers):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Create PO
        po_payload = {
            "supplierId": "65f2a1b9a000000000000302",
            "supplierName": "Metro Packaging Supplies",
            "locationId": "65f2a1b9a000000000000101",
            "items": [
                {
                    "itemId": "65f2a1b9a000000000000116",
                    "itemName": "Biodegradable Garbage Bags 30L",
                    "orderedQuantity": 50.0,
                    "unitCost": 60.0
                }
            ],
            "status": "ORDERED"
        }
        po_res = await client.post("/api/v1/purchase-orders", headers=auth_headers, json=po_payload)
        assert po_res.status_code == 201
        po_id = po_res.json()["id"]

        # Cancel PO with reason
        cancel_res = await client.post(
            f"/api/v1/purchase-orders/{po_id}/cancel",
            headers=auth_headers,
            json={"cancellationReason": "Vendor out of stock for this SKU"}
        )
        assert cancel_res.status_code == 200
        assert cancel_res.json()["status"] == "CANCELLED"
        assert cancel_res.json()["cancellationReason"] == "Vendor out of stock for this SKU"
