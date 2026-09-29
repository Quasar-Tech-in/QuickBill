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
