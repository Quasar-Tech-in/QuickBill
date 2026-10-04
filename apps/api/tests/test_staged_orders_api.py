import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.core.security import create_access_token, TokenPayload

TENANT_A = "65f2a1b9a000000000000001"
TENANT_B = "65f2a1b9a000000000000002"

@pytest.fixture
def auth_headers_tenant_a():
    payload = TokenPayload(
        sub="usr_cashier_a",
        email="cashier_a@store.local",
        name="Cashier Amit",
        roles=["cashier"],
        permissions=["sales:read", "sales:write"],
        default_business_id=TENANT_A,
        authorized_business_ids=[TENANT_A]
    )
    token = create_access_token(payload)
    return {"Authorization": f"Bearer {token}"}

@pytest.fixture
def auth_headers_tenant_b():
    payload = TokenPayload(
        sub="usr_cashier_b",
        email="cashier_b@store.local",
        name="Cashier B",
        roles=["cashier"],
        permissions=["sales:read", "sales:write"],
        default_business_id=TENANT_B,
        authorized_business_ids=[TENANT_B]
    )
    token = create_access_token(payload)
    return {"Authorization": f"Bearer {token}"}

@pytest.mark.asyncio
async def test_staged_order_crud_and_isolation(auth_headers_tenant_a, auth_headers_tenant_b):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Create a staged order for Tenant A (Table 4)
        create_payload = {
            "label": "Table 4",
            "locationId": "loc_main_branch",
            "locationName": "Main Branch",
            "customerName": "Rohan Sharma",
            "customerPhone": "9876543210",
            "notes": "Less spicy food",
            "cart": [
                {
                    "item": {"id": "it_101", "name": "Cold Coffee", "salePrice": 120.0},
                    "quantity": 2,
                    "unitPrice": 120.0,
                    "discountPercent": 0,
                    "taxRate": 5.0,
                    "lineTotal": 240.0
                }
            ],
            "subtotal": 228.57,
            "taxTotal": 11.43,
            "grandTotal": 240.0
        }

        res = await client.post("/api/v1/staged-orders", json=create_payload, headers=auth_headers_tenant_a)
        assert res.status_code == 201
        created_data = res.json()
        assert created_data["label"] == "Table 4"
        assert created_data["businessId"] == TENANT_A
        assert len(created_data["cart"]) == 1
        order_id = created_data["_id"]

        # 2. List staged orders for Tenant A
        list_res = await client.get("/api/v1/staged-orders", headers=auth_headers_tenant_a)
        assert list_res.status_code == 200
        orders_a = list_res.json()
        assert any(o["_id"] == order_id for o in orders_a)

        # 3. Verify Tenant B cannot see Tenant A's staged order
        list_b_res = await client.get("/api/v1/staged-orders", headers=auth_headers_tenant_b)
        assert list_b_res.status_code == 200
        orders_b = list_b_res.json()
        assert not any(o["_id"] == order_id for o in orders_b)

        # 4. Update / Re-Hold the order in-place (Add Pizza to cart)
        update_payload = {
            "id": order_id,
            "label": "Table 4 - Amit",
            "locationId": "loc_main_branch",
            "cart": [
                {
                    "item": {"id": "it_101", "name": "Cold Coffee", "salePrice": 120.0},
                    "quantity": 2,
                    "unitPrice": 120.0,
                    "discountPercent": 0,
                    "taxRate": 5.0,
                    "lineTotal": 240.0
                },
                {
                    "item": {"id": "it_102", "name": "Veg Pizza", "salePrice": 250.0},
                    "quantity": 1,
                    "unitPrice": 250.0,
                    "discountPercent": 0,
                    "taxRate": 5.0,
                    "lineTotal": 250.0
                }
            ],
            "grandTotal": 490.0
        }

        update_res = await client.put(f"/api/v1/staged-orders/{order_id}", json=update_payload, headers=auth_headers_tenant_a)
        assert update_res.status_code == 200
        updated_data = update_res.json()
        assert updated_data["_id"] == order_id
        assert updated_data["label"] == "Table 4 - Amit"
        assert len(updated_data["cart"]) == 2
        assert updated_data["grandTotal"] == 490.0

        # 5. Delete the staged order upon billing completion
        del_res = await client.delete(f"/api/v1/staged-orders/{order_id}", headers=auth_headers_tenant_a)
        assert del_res.status_code == 200
        assert del_res.json()["deleted"] is True

        # 6. Verify it's no longer returned in active list
        list_after = await client.get("/api/v1/staged-orders", headers=auth_headers_tenant_a)
        assert not any(o["_id"] == order_id for o in list_after.json())
