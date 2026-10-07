import pytest
import secrets
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.core.security import create_access_token, TokenPayload
from app.core.database import connect_to_mongo

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
async def test_weighted_average_cost_and_movements(auth_headers):
    sku = f"COF-WAC-{secrets.token_hex(4)}"
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Create item with initial stock = 10, purchase price = 100
        item_payload = {
            "name": "Artisanal Coffee Beans 500g",
            "sku": sku,
            "category": "Beverages",
            "unit": "pcs",
            "purchase_price": 100.0,
            "sale_price": 200.0,
            "mrp": 220.0,
            "tax_rate": 5.0,
            "current_stock": 10.0,
            "min_stock_alert": 2.0
        }
        create_res = await client.post("/api/v1/items", headers=auth_headers, json=item_payload)
        assert create_res.status_code == 201
        item_data = create_res.json()
        item_id = str(item_data.get("_id") or item_data.get("id"))

        # Verify initial average cost price is 100.0
        assert float(item_data.get("averageCostPrice", 100.0)) == 100.0

        # 2. Check that OPENING_STOCK movement was logged
        mov_res = await client.get(f"/api/v1/inventory/movements?itemId={item_id}", headers=auth_headers)
        assert mov_res.status_code == 200
        mov_data = mov_res.json()
        assert mov_data["total"] >= 1
        opening_mov = next((m for m in mov_data["data"] if m.get("type") == "OPENING_STOCK"), None)
        assert opening_mov is not None
        assert float(opening_mov.get("quantityChange") or opening_mov.get("quantity", 0)) == 10.0
        assert float(opening_mov.get("quantityAfter") or opening_mov.get("resultingStock", 0)) == 10.0

        # 3. Create a PO: Order 10 units at new higher cost = 140.0
        po_payload = {
            "supplierId": "65f2a1b9a000000000000301",
            "supplierName": "Highland Roasters",
            "locationId": "65f2a1b9a000000000000101",
            "locationName": "Main Flagship Counter",
            "expectedDeliveryDate": "2026-10-20",
            "items": [
                {
                    "itemId": item_id,
                    "itemName": "Artisanal Coffee Beans 500g",
                    "sku": sku,
                    "unit": "pcs",
                    "orderedQuantity": 10.0,
                    "unitCost": 140.0,
                    "taxRate": 5.0
                }
            ]
        }
        po_res = await client.post("/api/v1/purchase-orders", headers=auth_headers, json=po_payload)
        assert po_res.status_code == 201
        po_id = po_res.json()["id"]

        # 4. Receive 10 units at 140.0 with immediate partial payment of 500.0
        # Expected new stock: 10 + 10 = 20
        # Expected new WAC: (10 * 100 + 10 * 140) / 20 = 2400 / 20 = 120.0
        rec_payload = {
            "receiptNotes": "Fresh roast batch",
            "receivedItems": [
                {
                    "itemId": item_id,
                    "quantityReceived": 10.0,
                    "unitCost": 140.0
                }
            ],
            "paymentDetails": {
                "amountPaid": 500.0,
                "paymentMode": "BANK_TRANSFER"
            }
        }
        rec_res = await client.post(f"/api/v1/purchase-orders/{po_id}/receive", headers=auth_headers, json=rec_payload)
        assert rec_res.status_code == 200

        # 5. Check item's updated currentStock, averageCostPrice, and synchronized purchasePrice
        item_updated_res = await client.get(f"/api/v1/items/{item_id}", headers=auth_headers)
        assert item_updated_res.status_code == 200
        item_updated = item_updated_res.json()
        assert float(item_updated["currentStock"]) == 20.0
        assert float(item_updated["averageCostPrice"]) == 120.0
        assert float(item_updated["purchasePrice"]) == 120.0

        # 6. Verify PURCHASE inventory movement was logged
        mov_res2 = await client.get(f"/api/v1/inventory/movements?itemId={item_id}&movementType=PURCHASE", headers=auth_headers)
        assert mov_res2.status_code == 200
        purchase_movs = mov_res2.json()["data"]
        assert len(purchase_movs) >= 1
        pmov = purchase_movs[0]
        assert float(pmov.get("quantityChange") or pmov.get("quantity", 0)) == 10.0
        assert float(pmov["unitCost"]) == 140.0
        assert float(pmov.get("quantityAfter") or pmov.get("resultingStock", 0)) == 20.0
        assert pmov["referenceId"] == po_id

        # 7. Test direct edit attempt to change currentStock is ignored by PUT /items/{id}
        put_res = await client.put(f"/api/v1/items/{item_id}", headers=auth_headers, json={
            "name": "Artisanal Coffee Beans 500g (Updated Name)",
            "current_stock": 999.0  # Should be stripped/ignored to prevent un-audited stock alteration
        })
        assert put_res.status_code == 200
        put_data = put_res.json()
        assert put_data["name"] == "Artisanal Coffee Beans 500g (Updated Name)"
        assert float(put_data["currentStock"]) == 20.0  # Kept unchanged

        # 8. Check manual stock adjustment with custom unitCost (5 units @ 150.0)
        # Prior stock: 20 @ 120.0 = 2400.0
        # Inflow: +5 @ 150.0 = 750.0
        # New Stock: 25.0
        # New WAC: (2400 + 750) / 25 = 3150 / 25 = 126.0
        adj_payload = {
            "delta": 5.0,
            "unitCost": 150.0,
            "reason": "Supplier direct restock without PO",
            "notes": "Verified by inventory auditor"
        }
        adj_res = await client.post(f"/api/v1/items/{item_id}/adjust-stock", headers=auth_headers, json=adj_payload)
        assert adj_res.status_code == 200
        adj_item = adj_res.json()
        assert float(adj_item["currentStock"]) == 25.0
        assert float(adj_item["averageCostPrice"]) == 126.0
        assert float(adj_item["purchasePrice"]) == 126.0

        # 9. Verify MANUAL_ADJUSTMENT movement audit log with user tagging
        mov_res3 = await client.get(f"/api/v1/inventory/movements?itemId={item_id}&movementType=MANUAL_ADJUSTMENT", headers=auth_headers)
        assert mov_res3.status_code == 200
        adj_movs = mov_res3.json()["data"]
        assert len(adj_movs) >= 1
        amov = adj_movs[0]
        assert float(amov.get("quantityChange") or amov.get("quantity", 0)) == 5.0
        assert float(amov["unitCost"]) == 150.0
        assert float(amov.get("quantityAfter") or amov.get("resultingStock", 0)) == 25.0
        assert amov.get("createdByUserId") == "65f2a1b9a000000000000011"
        assert amov.get("createdByName") is not None

@pytest.mark.asyncio
async def test_supplier_payment_ledger_entries(auth_headers):
    sku = f"TEA-LED-{secrets.token_hex(4)}"
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Create item
        item_res = await client.post("/api/v1/items", headers=auth_headers, json={
            "name": "Assam Orthodox Leaf",
            "sku": sku,
            "category": "Beverages",
            "unit": "pcs",
            "purchase_price": 200.0,
            "sale_price": 300.0,
            "current_stock": 5.0
        })
        item_id = str(item_res.json().get("_id") or item_res.json().get("id"))

        # 2. Create PO
        po_res = await client.post("/api/v1/purchase-orders", headers=auth_headers, json={
            "supplierId": "65f2a1b9a000000000000301",
            "supplierName": "Himalayan Organic Farms",
            "locationId": "65f2a1b9a000000000000101",
            "items": [
                {
                    "itemId": item_id,
                    "itemName": "Assam Orthodox Leaf",
                    "orderedQuantity": 10.0,
                    "unitCost": 200.0,
                    "taxRate": 0.0
                }
            ]
        })
        assert po_res.status_code == 201
        po_id = po_res.json()["id"]

        # 3. Receive goods with immediate payment of 800.0
        rec_res = await client.post(f"/api/v1/purchase-orders/{po_id}/receive", headers=auth_headers, json={
            "receivedItems": [{"itemId": item_id, "quantityReceived": 10.0, "unitCost": 200.0}],
            "paymentDetails": {
                "amountPaid": 800.0,
                "paymentMode": "UPI",
                "referenceNumber": "UPI-RCV-9901"
            }
        })
        assert rec_res.status_code == 200

        # 4. Check payments endpoint for the business - verify PAYMENT_OUT was recorded
        pay_list_res = await client.get("/api/v1/payments?partyId=65f2a1b9a000000000000301", headers=auth_headers)
        assert pay_list_res.status_code == 200
        payments = pay_list_res.json().get("data", [])
        rcv_payment = next((p for p in payments if p.get("referenceId") == po_id or p.get("referenceNumber") == "UPI-RCV-9901"), None)
        assert rcv_payment is not None
        assert rcv_payment["type"] == "PAYMENT_OUT"
        assert float(rcv_payment["amount"]) == 800.0

        # 5. Record standalone payment for remaining balance (1200.0)
        pay_res = await client.post(f"/api/v1/purchase-orders/{po_id}/payments", headers=auth_headers, json={
            "amount": 1200.0,
            "paymentMode": "CASH",
            "notes": "Settled remaining cash on delivery"
        })
        assert pay_res.status_code == 200

        # 6. Verify second payment is also in payment ledger
        pay_list_res2 = await client.get("/api/v1/payments?partyId=65f2a1b9a000000000000301", headers=auth_headers)
        assert pay_list_res2.status_code == 200
        payments2 = pay_list_res2.json().get("data", [])
        settle_payment = next((p for p in payments2 if float(p.get("amount", 0)) == 1200.0 and p.get("paymentMode") == "CASH"), None)
        assert settle_payment is not None
        assert settle_payment["type"] == "PAYMENT_OUT"
        assert float(settle_payment["amount"]) == 1200.0
