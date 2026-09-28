import pytest
from httpx import AsyncClient, ASGITransport
from bson import ObjectId
from app.main import app
from app.core.security import get_password_hash
from app.core.totp import generate_totp_secret, generate_totp_code, verify_totp_code, generate_backup_codes

@pytest.mark.asyncio
async def test_totp_core_math_and_drift():
    secret = generate_totp_secret()
    assert len(secret) == 32
    
    code = generate_totp_code(secret)
    assert len(code) == 6
    assert code.isdigit()
    
    assert verify_totp_code(secret, code) is True
    assert verify_totp_code(secret, "000000" if code != "000000" else "999999") is False

@pytest.mark.asyncio
async def test_superadmin_2fa_full_lifecycle(override_db):
    # 1. Seed Super Admin user in DB without 2FA enabled
    admin_id = ObjectId()
    superadmin_doc = {
        "_id": admin_id,
        "email": "superadmin@quickbill.local",
        "hashedPassword": get_password_hash("superadmin123"),
        "name": "Super Admin",
        "roles": ["SUPER_ADMIN"],
        "isActive": True,
        "isTotpEnabled": False,
        "totpSecret": None,
        "backupCodes": []
    }
    await override_db.users.insert_one(superadmin_doc)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # Step 1: Login with credentials (unconfigured 2FA)
        resp1 = await ac.post("/api/v1/auth/superadmin/login", json={
            "email": "superadmin@quickbill.local",
            "password": "superadmin123"
        })
        assert resp1.status_code == 200
        data1 = resp1.json()
        assert data1["requires_2fa"] is True
        assert data1["requires_2fa_setup"] is True
        assert "setup_token" in data1
        assert "otpauth_uri" in data1
        assert "secret_key" in data1
        
        setup_token = data1["setup_token"]
        secret_key = data1["secret_key"]
        
        # Step 2: Confirm 2FA setup with valid generated TOTP code
        valid_first_code = generate_totp_code(secret_key)
        resp_confirm = await ac.post("/api/v1/auth/superadmin/confirm-2fa-setup", json={
            "setup_token": setup_token,
            "code": valid_first_code
        })
        assert resp_confirm.status_code == 200
        confirm_data = resp_confirm.json()
        assert "access_token" in confirm_data
        assert "backup_codes" in confirm_data
        assert len(confirm_data["backup_codes"]) == 8
        
        saved_backup_codes = confirm_data["backup_codes"]
        
        # Step 3: Verify user record in DB now has isTotpEnabled=True
        updated_user = await override_db.users.find_one({"_id": admin_id})
        assert updated_user["isTotpEnabled"] is True
        assert updated_user["totpSecret"] == secret_key
        assert len(updated_user["backupCodes"]) == 8

        # Step 4: Login again now that 2FA is configured
        resp2 = await ac.post("/api/v1/auth/superadmin/login", json={
            "email": "superadmin@quickbill.local",
            "password": "superadmin123"
        })
        assert resp2.status_code == 200
        data2 = resp2.json()
        assert data2["requires_2fa"] is True
        assert data2["requires_2fa_setup"] is False
        assert "mfa_session_token" in data2
        
        mfa_session_token = data2["mfa_session_token"]

        # Step 5: Verify with valid 6-digit TOTP code
        current_code = generate_totp_code(secret_key)
        resp_verify = await ac.post("/api/v1/auth/superadmin/verify-2fa", json={
            "mfa_session_token": mfa_session_token,
            "code": current_code
        })
        assert resp_verify.status_code == 200
        verify_data = resp_verify.json()
        assert "access_token" in verify_data
        assert "SUPER_ADMIN" in verify_data["roles"]

        # Step 6: Test invalid code rejection
        resp_invalid = await ac.post("/api/v1/auth/superadmin/verify-2fa", json={
            "mfa_session_token": mfa_session_token,
            "code": "000000" if current_code != "000000" else "999999"
        })
        assert resp_invalid.status_code == 401

        # Step 7: Test emergency backup recovery code redemption
        # Request new MFA session
        resp3 = await ac.post("/api/v1/auth/superadmin/login", json={
            "email": "superadmin@quickbill.local",
            "password": "superadmin123"
        })
        mfa_token3 = resp3.json()["mfa_session_token"]
        
        # Use first backup code
        used_backup_code = saved_backup_codes[0]
        resp_backup = await ac.post("/api/v1/auth/superadmin/verify-2fa", json={
            "mfa_session_token": mfa_token3,
            "code": used_backup_code
        })
        assert resp_backup.status_code == 200
        assert "access_token" in resp_backup.json()

        # Step 8: Verify backup code was consumed (now only 7 left)
        db_user_after_backup = await override_db.users.find_one({"_id": admin_id})
        assert len(db_user_after_backup["backupCodes"]) == 7

        # Step 9: Reuse of the same backup code must fail
        resp4 = await ac.post("/api/v1/auth/superadmin/login", json={
            "email": "superadmin@quickbill.local",
            "password": "superadmin123"
        })
        mfa_token4 = resp4.json()["mfa_session_token"]
        resp_reuse = await ac.post("/api/v1/auth/superadmin/verify-2fa", json={
            "mfa_session_token": mfa_token4,
            "code": used_backup_code
        })
        assert resp_reuse.status_code == 401

@pytest.mark.asyncio
async def test_non_superadmin_forbidden_from_superadmin_login(override_db):
    # Standard tenant cashier
    user_id = ObjectId()
    cashier_doc = {
        "_id": user_id,
        "email": "cashier@store.com",
        "hashedPassword": get_password_hash("cashier123"),
        "name": "Cashier User",
        "roles": ["CASHIER"],
        "isActive": True,
    }
    await override_db.users.insert_one(cashier_doc)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        resp = await ac.post("/api/v1/auth/superadmin/login", json={
            "email": "cashier@store.com",
            "password": "cashier123"
        })
        assert resp.status_code == 403
        assert "Super Administrator role required" in resp.json()["detail"]
