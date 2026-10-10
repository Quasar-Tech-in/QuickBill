import pytest
from decimal import Decimal
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.core.security import create_access_token, TokenPayload

@pytest.mark.asyncio
async def test_sale_return_cost_tax_and_db_persistence():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        token = create_access_token(TokenPayload(
            sub="user_cashier_101",
            email="cashier@quickbill.com",
            business_id="65f2a1b9a000000000000001",
            role="CASHIER",
            permissions=["pos", "sales", "inventory"]
        ))
        headers = {
            "Authorization": f"Bearer {token}",
            "X-Business-ID": "65f2a1b9a000000000000001"
        }

        # 1. Create a sale invoice: Item unit price 100 with 18% tax (total per unit = 118)
        sale_payload = {
            "partyNameInput": "Return Flow Customer",
            "partyPhoneInput": "9876543210",
            "locationId": "65f2a1b9a000000000000101",
            "items": [
                {
                    "item_id": "item_ret_test_1",
                    "name": "Widget Ret A",
                    "quantity": 2,
                    "unit_price": 100.0,
                    "discount": 0.0,
                    "tax_rate": 18.0
                }
            ],
            "paidAmount": 236.0,
            "paymentMode": "CASH",
            "enableRoundOff": True
        }

        create_res = await ac.post("/api/v1/sales", json=sale_payload, headers=headers)
        assert create_res.status_code == 201, create_res.text
        created_data = create_res.json()
        sale_id = created_data["_id"]
        assert Decimal(str(created_data["grandTotal"])) == Decimal("200.00")
        assert len(created_data["items"]) == 1

        # 2. Return 1 unit of the item (Return cost is 100.00 including tax)
        return_payload = {
            "items": [
                {
                    "itemId": created_data["items"][0]["itemId"],
                    "quantity": 2,
                    "returnedQuantity": 1,
                    "returnReason": "RESTOCKABLE_RETURN",
                    "returnNote": "Customer returned 1 surplus item",
                    "unitPrice": 100.0,
                    "taxRate": 18.0
                }
            ],
            "returnNotes": "Processed partial return",
            "enableRoundOff": True
        }

        return_res = await ac.put(f"/api/v1/sales/{sale_id}", json=return_payload, headers=headers)
        assert return_res.status_code == 200, return_res.text
        returned_data = return_res.json()

        # Verify net invoice total is updated to 100 (1 remaining item) and returnTotal is 100
        assert Decimal(str(returned_data["grandTotal"])) == Decimal("100.00")
        assert Decimal(str(returned_data["returnTotal"])) == Decimal("100.00")
        assert returned_data["hasReturns"] is True
        assert returned_data["returnStatus"] == "PARTIALLY_RETURNED"
        assert returned_data["status"] == "PARTIALLY_RETURNED"

        # 3. Verify it is persisted in DB via GET /sales/{id}
        get_res = await ac.get(f"/api/v1/sales/{sale_id}", headers=headers)
        assert get_res.status_code == 200
        persisted = get_res.json()
        assert Decimal(str(persisted["grandTotal"])) == Decimal("100.00")
        assert Decimal(str(persisted["returnTotal"])) == Decimal("100.00")
        assert Decimal(str(persisted["items"][0]["returnedQuantity"])) == Decimal("1.00")
        assert persisted["items"][0]["returnStatus"] == "PARTIAL"

        # 4. Now perform a full return (return 2 out of 2)
        full_return_payload = {
            "items": [
                {
                    "itemId": created_data["items"][0]["itemId"],
                    "quantity": 2,
                    "returnedQuantity": 2,
                    "returnReason": "RESTOCKABLE_RETURN",
                    "returnNote": "Customer returned all remaining items",
                    "unitPrice": 100.0,
                    "taxRate": 18.0
                }
            ],
            "returnNotes": "Full return completed",
            "enableRoundOff": True
        }

        full_res = await ac.put(f"/api/v1/sales/{sale_id}", json=full_return_payload, headers=headers)
        assert full_res.status_code == 200, full_res.text
        full_data = full_res.json()

        assert Decimal(str(full_data["grandTotal"])) == Decimal("0.00")
        assert Decimal(str(full_data["returnTotal"])) == Decimal("200.00")
        assert full_data["returnStatus"] == "FULLY_RETURNED"
        assert full_data["status"] == "RETURNED"
        assert full_data["paymentStatus"] == "REFUNDED"


@pytest.mark.asyncio
async def test_sale_return_with_item_and_bill_discounts():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        token = create_access_token(TokenPayload(
            sub="user_cashier_102",
            email="cashier2@quickbill.com",
            business_id="65f2a1b9a000000000000001",
            role="CASHIER",
            permissions=["pos", "sales", "inventory"]
        ))
        headers = {
            "Authorization": f"Bearer {token}",
            "X-Business-ID": "65f2a1b9a000000000000001"
        }

        # 1. Create sale:
        # Item 1: 2 units @ 100 each, discount 20 => net 180
        # Item 2: 1 unit @ 20 each, discount 0 => net 20
        # Net subtotal = 200
        # Bill discount = 40 (20% of net subtotal)
        # Final Grand Total = 160
        sale_payload = {
            "partyNameInput": "Discount Customer",
            "partyPhoneInput": "9123456780",
            "locationId": "65f2a1b9a000000000000101",
            "items": [
                {
                    "item_id": "item_ret_test_disc_1",
                    "name": "Widget Discount A",
                    "quantity": 2,
                    "unit_price": 100.0,
                    "discount": 20.0,
                    "tax_rate": 0.0
                },
                {
                    "item_id": "item_ret_test_disc_2",
                    "name": "Widget Discount B",
                    "quantity": 1,
                    "unit_price": 20.0,
                    "discount": 0.0,
                    "tax_rate": 0.0
                }
            ],
            "invoiceDiscount": 40.0, # Invoice-level discount
            "paidAmount": 160.0,
            "paymentMode": "CASH",
            "enableRoundOff": True
        }

        create_res = await ac.post("/api/v1/sales", json=sale_payload, headers=headers)
        assert create_res.status_code == 201, create_res.text
        created_data = create_res.json()
        sale_id = created_data["_id"]

        assert Decimal(str(created_data["grandTotal"])) == Decimal("160.00")
        assert Decimal(str(created_data["discountTotal"])) == Decimal("60.00")

        # 2. Return 1 unit of Item 1:
        # Original net for 2 units of Item 1 = 180.
        # Bill discount allocated to Item 1 = 180 * (40 / 200) = 36.
        # Total effective paid for 2 units of Item 1 = 180 - 36 = 144 ($72 per unit).
        # Returning 1 unit: Return Total should be 72.00.
        # Revised Grand Total should be 160 - 72 = 88.00.
        return_payload = {
            "items": [
                {
                    "itemId": created_data["items"][0]["itemId"],
                    "quantity": 2,
                    "returnedQuantity": 1,
                    "returnReason": "RESTOCKABLE_RETURN",
                    "returnNote": "Returned 1 unit with discounts",
                    "unitPrice": 100.0,
                    "taxRate": 0.0
                },
                {
                    "itemId": created_data["items"][1]["itemId"],
                    "quantity": 1,
                    "returnedQuantity": 0,
                    "unitPrice": 20.0,
                    "taxRate": 0.0
                }
            ],
            "returnNotes": "Return 1 unit of Item 1",
            "enableRoundOff": True
        }

        return_res = await ac.put(f"/api/v1/sales/{sale_id}", json=return_payload, headers=headers)
        assert return_res.status_code == 200, return_res.text
        ret_data = return_res.json()

        assert Decimal(str(ret_data["returnTotal"])) == Decimal("72.00")
        assert Decimal(str(ret_data["grandTotal"])) == Decimal("88.00")
        assert ret_data["returnStatus"] == "PARTIALLY_RETURNED"


@pytest.mark.asyncio
async def test_sale_return_wac_and_stock_movements():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        token = create_access_token(TokenPayload(
            sub="user_cashier_103",
            email="cashier3@quickbill.com",
            business_id="65f2a1b9a000000000000001",
            role="CASHIER",
            permissions=["pos", "sales", "inventory"]
        ))
        headers = {
            "Authorization": f"Bearer {token}",
            "X-Business-ID": "65f2a1b9a000000000000001"
        }

        # 1. Create a catalog item with purchase price 100 and stock 10
        item_create_payload = {
            "name": "WAC Test Item Return",
            "sku": "SKU-WAC-RET-01",
            "mrp": 200.0,
            "salePrice": 180.0,
            "purchasePrice": 100.0,
            "currentStock": 10.0,
            "minStockAlert": 2.0,
            "taxRate": 0.0,
            "locations": [
                {
                    "locationId": "65f2a1b9a000000000000101",
                    "locationName": "Main Branch",
                    "purchasePrice": 100.0,
                    "salePrice": 180.0,
                    "currentStock": 10.0,
                    "minStockAlert": 2.0,
                    "isListed": True
                }
            ]
        }
        item_res = await ac.post("/api/v1/items", json=item_create_payload, headers=headers)
        assert item_res.status_code == 201, item_res.text
        item_data = item_res.json()
        item_id = item_data["_id"]

        # 2. Make a sale of 2 units (Stock reduces from 10 to 8)
        sale_payload = {
            "partyNameInput": "WAC Customer",
            "partyPhoneInput": "9998887776",
            "locationId": "65f2a1b9a000000000000101",
            "locationName": "Main Branch",
            "items": [
                {
                    "item_id": item_id,
                    "name": "WAC Test Item Return",
                    "quantity": 2.0,
                    "unit_price": 180.0,
                    "tax_rate": 0.0
                }
            ],
            "paidAmount": 360.0,
            "paymentMode": "CASH",
            "enableRoundOff": True
        }
        sale_res = await ac.post("/api/v1/sales", json=sale_payload, headers=headers)
        assert sale_res.status_code == 201, sale_res.text
        sale_data = sale_res.json()
        sale_id = sale_data["_id"]

        # Check stock is now 8
        get_item_res = await ac.get(f"/api/v1/items/{item_id}", headers=headers)
        assert get_item_res.status_code == 200
        assert float(get_item_res.json()["currentStock"]) == 8.0

        # 3. Process a sales return of 1 unit
        return_payload = {
            "items": [
                {
                    "itemId": item_id,
                    "quantity": 2.0,
                    "returnedQuantity": 1.0,
                    "returnReason": "RESTOCKABLE_RETURN",
                    "returnNote": "Surplus unit returned",
                    "unitPrice": 180.0,
                    "taxRate": 0.0
                }
            ],
            "returnNotes": "Return 1 unit",
            "enableRoundOff": True
        }
        ret_res = await ac.put(f"/api/v1/sales/{sale_id}", json=return_payload, headers=headers)
        assert ret_res.status_code == 200, ret_res.text

        # 4. Verify item stock is incremented back to 9 and WAC remains intact at 100.00
        get_item_after_ret = await ac.get(f"/api/v1/items/{item_id}", headers=headers)
        assert get_item_after_ret.status_code == 200
        after_data = get_item_after_ret.json()
        assert float(after_data["currentStock"]) == 9.0
        assert float(after_data["purchasePrice"]) == 100.0
        assert float(after_data["averageCostPrice"]) == 100.0

        # Verify branch location stock
        loc = next((l for l in after_data["locations"] if l["locationId"] == "65f2a1b9a000000000000101"), None)
        assert loc is not None
        assert float(loc["currentStock"]) == 9.0
        assert float(loc["purchasePrice"]) == 100.0

        # 5. Verify Inventory Movement log entry
        mov_res = await ac.get(f"/api/v1/inventory/movements?itemId={item_id}&type=SALE_RETURN", headers=headers)
        assert mov_res.status_code == 200, mov_res.text
        mov_data = mov_res.json()
        assert mov_data["total"] >= 1
        mov = mov_data["data"][0]
        assert mov["type"] == "SALE_RETURN"
        assert float(mov["quantityChange"]) == 1.0
        assert float(mov["quantityBefore"]) == 8.0
        assert float(mov["quantityAfter"]) == 9.0
        assert float(mov["unitCost"]) == 100.0
        assert mov["locationId"] == "65f2a1b9a000000000000101"


