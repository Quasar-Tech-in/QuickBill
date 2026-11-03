import pytest
from httpx import AsyncClient, ASGITransport
from bson import ObjectId
from app.main import app
from app.core.security import create_access_token, TokenPayload
from app.services.cafe_session_service import generate_table_qr_token, verify_table_qr_token

TENANT_ID = "65f2a1b9a000000000000001"
TENANT_SLUG = "urban-cafe"

@pytest.fixture
def auth_headers_admin():
    payload = TokenPayload(
        sub="usr_admin_cafe",
        email="admin@urbancafe.local",
        name="Urban Cafe Admin",
        roles=["TENANT_ADMIN"],
        permissions=["all"],
        default_business_id=TENANT_ID,
        authorized_business_ids=[TENANT_ID]
    )
    token = create_access_token(payload)
    return {"Authorization": f"Bearer {token}"}

@pytest.fixture
def auth_headers_cashier():
    payload = TokenPayload(
        sub="usr_cashier_cafe",
        email="cashier@urbancafe.local",
        name="Cashier Ramesh",
        roles=["CASHIER"],
        permissions=["sales:read", "sales:write"],
        default_business_id=TENANT_ID,
        authorized_business_ids=[TENANT_ID]
    )
    token = create_access_token(payload)
    return {"Authorization": f"Bearer {token}"}

@pytest.mark.asyncio
async def test_complete_cafe_host_join_session_lifecycle(auth_headers_admin, auth_headers_cashier):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # -------------------------------------------------------------
        # 1. Admin creates a table (T-10) with clean URL format
        # -------------------------------------------------------------
        table_payload = {
            "tableNumber": "T-10",
            "label": "Window Table 10",
            "section": "Terrace View",
            "seatingCapacity": 4,
            "locationId": "loc_terrace"
        }
        create_res = await client.post("/api/v1/cafe/tables", json=table_payload, headers=auth_headers_admin)
        assert create_res.status_code == 201
        table_data = create_res.json()
        table_id = table_data["_id"]
        table_number = table_data["tableNumber"]
        qr_token = table_data["qrCodeToken"]
        assert table_number == "T-10"
        assert qr_token is not None
        assert "qrCodeUrl" in table_data
        # Verify clean URL format in qrCodeUrl
        assert "/menu/" in table_data["qrCodeUrl"]
        assert "t=" in table_data["qrCodeUrl"]

        # -------------------------------------------------------------
        # 2. Public Menu check by clean URL (tableNum + t)
        # -------------------------------------------------------------
        menu_res = await client.get(
            f"/api/v1/public/cafe/{TENANT_ID}/menu",
            params={"tableNum": "T-10", "t": qr_token}
        )
        assert menu_res.status_code == 200
        menu_data = menu_res.json()
        assert menu_data["table"] is not None
        assert menu_data["table"]["tableNumber"] == "T-10"
        assert menu_data["table"]["isValidToken"] is True
        assert "categories" in menu_data
        assert "items" in menu_data

        # -------------------------------------------------------------
        # 3. Public Session Check: Before any scan, table is AVAILABLE
        # -------------------------------------------------------------
        check_res = await client.get(
            f"/api/v1/public/cafe/{TENANT_ID}/table/T-10/session",
            params={"t": qr_token}
        )
        assert check_res.status_code == 200
        check_data = check_res.json()
        assert check_data["hasActiveSession"] is False
        assert check_data["qrValid"] is True
        assert check_data["tableNumber"] == "T-10"

        # -------------------------------------------------------------
        # 4. Host Scan: First user provides phone number and starts session
        # -------------------------------------------------------------
        host_start_payload = {
            "phone": "9876543210",
            "name": "Host Rahul"
        }
        start_res = await client.post(
            f"/api/v1/public/cafe/{TENANT_ID}/table/T-10/session/start",
            json=host_start_payload,
            params={"t": qr_token}
        )
        assert start_res.status_code == 201
        host_session = start_res.json()
        assert host_session["role"] == "HOST"
        assert len(host_session["joinCode"]) == 6
        assert host_session["memberToken"] is not None
        session_id = host_session["sessionId"]
        join_code = host_session["joinCode"]
        host_member_token = host_session["memberToken"]

        # -------------------------------------------------------------
        # 5. Session Check Now Reports Active Session & Join Code
        # -------------------------------------------------------------
        check_after_res = await client.get(
            f"/api/v1/public/cafe/{TENANT_ID}/table/T-10/session",
            params={"t": qr_token}
        )
        assert check_after_res.status_code == 200
        assert check_after_res.json()["hasActiveSession"] is True
        assert check_after_res.json()["joinCode"] == join_code

        # -------------------------------------------------------------
        # 6. Another User Tries to Start Session on Same Table -> 409 Conflict
        # -------------------------------------------------------------
        conflict_res = await client.post(
            f"/api/v1/public/cafe/{TENANT_ID}/table/T-10/session/start",
            json={"phone": "9111122222", "name": "Intruder Bob"},
            params={"t": qr_token}
        )
        assert conflict_res.status_code == 409

        # Same Host Phone Re-scanning Restores Session
        restore_res = await client.post(
            f"/api/v1/public/cafe/{TENANT_ID}/table/T-10/session/start",
            json={"phone": "9876543210"},
            params={"t": qr_token}
        )
        assert restore_res.status_code == 201
        assert restore_res.json().get("restored") is True

        # -------------------------------------------------------------
        # 7. Guest Join: Second user enters wrong join code -> 403 Forbidden
        # -------------------------------------------------------------
        wrong_code_res = await client.post(
            f"/api/v1/public/cafe/{TENANT_ID}/table/T-10/session/join",
            json={"phone": "9988776655", "name": "Guest Sneha", "joinCode": "WRONG1"},
            params={"t": qr_token}
        )
        assert wrong_code_res.status_code == 403

        # Guest Join with Correct Join Code -> 200 OK, role=GUEST
        guest_join_res = await client.post(
            f"/api/v1/public/cafe/{TENANT_ID}/table/T-10/session/join",
            json={"phone": "9988776655", "name": "Guest Sneha", "joinCode": join_code},
            params={"t": qr_token}
        )
        assert guest_join_res.status_code == 200
        guest_session = guest_join_res.json()
        assert guest_session["role"] == "GUEST"
        guest_member_token = guest_session["memberToken"]
        assert guest_member_token != host_member_token

        # -------------------------------------------------------------
        # 8. Host & Guest Submit Orders
        # -------------------------------------------------------------
        # Create a test item for the tenant
        item_payload = {
            "name": "Iced Vanilla Latte",
            "category": "Coffee",
            "salePrice": 180.0,
            "taxRate": 5.0,
            "unit": "cup",
            "isActive": True
        }
        item_res = await client.post("/api/v1/items", json=item_payload, headers=auth_headers_admin)
        assert item_res.status_code in (200, 201)
        item_id = item_res.json()["_id"]

        # Host submits order
        host_order_payload = {
            "tableId": table_id,
            "qrToken": qr_token,
            "memberToken": host_member_token,
            "items": [
                {
                    "itemId": item_id,
                    "name": "Iced Vanilla Latte",
                    "quantity": 2,
                    "unitPrice": 180.0,
                    "notes": "Oat milk please"
                }
            ],
            "notes": "Please serve with ice"
        }
        order1_res = await client.post(
            "/api/v1/public/cafe/orders",
            json=host_order_payload,
            params={"businessId": TENANT_ID}
        )
        assert order1_res.status_code == 201
        order1_data = order1_res.json()
        assert order1_data["status"] == "SUBMITTED"
        order1_id = order1_data["orderId"]

        # Guest submits order independently
        guest_order_payload = {
            "tableId": table_id,
            "qrToken": qr_token,
            "memberToken": guest_member_token,
            "items": [
                {
                    "itemId": item_id,
                    "name": "Iced Vanilla Latte",
                    "quantity": 1,
                    "unitPrice": 180.0,
                    "notes": "Extra cold"
                }
            ]
        }
        order2_res = await client.post(
            "/api/v1/public/cafe/orders",
            json=guest_order_payload,
            params={"businessId": TENANT_ID}
        )
        assert order2_res.status_code == 201
        order2_data = order2_res.json()
        assert order2_data["status"] == "SUBMITTED"
        order2_id = order2_data["orderId"]

        # -------------------------------------------------------------
        # 9. Verify Active Sessions Endpoint Exposes ID and _ID
        # -------------------------------------------------------------
        active_sess_res = await client.get(
            "/api/v1/cafe/sessions/active",
            headers=auth_headers_cashier
        )
        assert active_sess_res.status_code == 200
        active_sessions = active_sess_res.json()
        assert len(active_sessions) >= 1
        target_s = next((s for s in active_sessions if s.get("tableNumber") == "T-10"), None)
        assert target_s is not None
        assert target_s["id"] == session_id
        assert target_s["_id"] == session_id

        # -------------------------------------------------------------
        # 9a. Staff Edits Order 2 Before Accepting (modifies quantity and notes)
        # -------------------------------------------------------------
        edit_res = await client.patch(
            f"/api/v1/cafe/sessions/{session_id}/orders/{order2_id}",
            json={
                "items": [
                    {
                        "itemId": item_id,
                        "name": "Iced Vanilla Latte",
                        "quantity": 2,
                        "unitPrice": 180.0,
                        "notes": "Extra cold and sweet"
                    }
                ],
                "notes": "Customer requested 2 instead of 1"
            },
            headers=auth_headers_cashier
        )
        assert edit_res.status_code == 200
        edit_data = edit_res.json()
        assert edit_data["success"] is True
        assert edit_data["order"]["orderSubtotal"] == 360.0
        assert edit_data["order"]["items"][0]["quantity"] == 2

        # -------------------------------------------------------------
        # 9b. Customer Checks Live Table Orders (Pending vs Accepted)
        # -------------------------------------------------------------
        customer_orders_res = await client.get(
            f"/api/v1/public/cafe/{TENANT_ID}/table/T-10/orders",
            params={"t": qr_token}
        )
        assert customer_orders_res.status_code == 200
        cust_orders = customer_orders_res.json()
        assert cust_orders["sessionId"] == session_id
        # Both orders are currently in SUBMITTED state (pending)
        assert len(cust_orders["pendingOrders"]) == 2
        assert len(cust_orders["acceptedOrders"]) == 0

        # -------------------------------------------------------------
        # 9c. Cashier Accepts Order 1 -> Dispatches KOT
        # -------------------------------------------------------------
        accept_res = await client.post(
            f"/api/v1/cafe/sessions/{session_id}/orders/{order1_id}/accept",
            headers=auth_headers_cashier
        )
        assert accept_res.status_code == 200
        accept_data = accept_res.json()
        assert accept_data["success"] is True
        assert "kotNumber" in accept_data

        # Customer checks again: Order 1 is now in acceptedOrders, Order 2 is pending
        customer_orders_res2 = await client.get(
            f"/api/v1/public/cafe/{TENANT_ID}/table/T-10/orders",
            params={"t": qr_token}
        )
        assert customer_orders_res2.status_code == 200
        cust_orders2 = customer_orders_res2.json()
        assert len(cust_orders2["pendingOrders"]) == 1
        assert len(cust_orders2["acceptedOrders"]) == 1
        assert cust_orders2["acceptedOrders"][0]["orderId"] == order1_id
        assert cust_orders2["acceptedOrders"][0]["kotNumber"] == accept_data["kotNumber"]

        # -------------------------------------------------------------
        # 10. Admin/Cashier Force-Closes Table Session
        # -------------------------------------------------------------
        close_res = await client.post(
            f"/api/v1/cafe/sessions/{session_id}/force-close",
            headers=auth_headers_cashier
        )
        assert close_res.status_code == 200
        close_data = close_res.json()
        assert close_data["success"] is True
        assert close_data["tableStatus"] == "CLEANING"

        # Check session status now shows CLOSED / table is released
        check_closed_res = await client.get(
            f"/api/v1/public/cafe/{TENANT_ID}/table/T-10/session",
            params={"t": qr_token}
        )
        assert check_closed_res.status_code == 200
        assert check_closed_res.json()["hasActiveSession"] is False

