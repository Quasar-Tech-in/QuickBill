from typing import Optional, List
from datetime import datetime, timezone, timedelta
from bson import ObjectId
import jwt
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from app.core.config import settings
from app.core.security import (
    create_access_token,
    verify_password,
    get_password_hash,
    TokenPayload,
    get_current_user
)
from app.core.database import get_database
from app.core.totp import (
    generate_totp_secret,
    get_totp_uri,
    verify_totp_code,
    generate_backup_codes
)

router = APIRouter(prefix="/auth", tags=["Authentication"])

class LoginRequest(BaseModel):
    email: str
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: str
    email: str
    name: str
    roles: List[str]
    default_business_id: str
    assigned_location_ids: List[str] = []
    store_status: Optional[str] = "ACTIVE"
    is_store_locked: Optional[bool] = False
    lockout_reason: Optional[str] = None

class SuperAdminStep1Response(BaseModel):
    requires_2fa: bool = True
    requires_2fa_setup: bool = False
    mfa_session_token: Optional[str] = None
    setup_token: Optional[str] = None
    otpauth_uri: Optional[str] = None
    secret_key: Optional[str] = None
    email: str

class Verify2FARequest(BaseModel):
    mfa_session_token: str
    code: str

class Confirm2FASetupRequest(BaseModel):
    setup_token: str
    code: str

class Confirm2FASetupResponse(TokenResponse):
    backup_codes: List[str] = []

@router.post("/login", response_model=TokenResponse)
async def login(req: LoginRequest):
    clean_email = req.email.strip().lower()

    if not clean_email or not req.password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email and password are required."
        )

    try:
        primary_db = get_database()
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database service unavailable. Please check system health."
        )

    user = await primary_db.users.find_one({"email": clean_email})

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password."
        )

    if not user.get("isActive", True):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account has been deactivated. Please contact your Store Administrator."
        )

    password_hash = user.get("passwordHash") or user.get("hashedPassword", "")
    if not verify_password(req.password, password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password."
        )

    user_id = str(user["_id"])
    raw_tenant_id = user.get("tenantId")
    tenant_id = str(raw_tenant_id) if raw_tenant_id else "system_platform"
    auth_tenant_ids = [str(t) for t in user.get("authorizedTenantIds", [tenant_id])]
    roles = user.get("roles", ["CASHIER"])
    user_name = user.get("name", clean_email.split("@")[0].title())
    assigned_locations = [str(loc) for loc in user.get("assignedLocationIds", [])]

    normalized_roles = [r.upper() for r in roles]
    is_super_admin = "SUPER_ADMIN" in normalized_roles or "SUPERADMIN" in normalized_roles
    is_store_owner = "TENANT_ADMIN" in normalized_roles or is_super_admin

    store_status = "ACTIVE"
    is_store_locked = False
    lockout_reason = None

    # Check tenant status if user belongs to a tenant
    if not is_super_admin and tenant_id != "system_platform":
        t_oid = ObjectId(tenant_id) if ObjectId.is_valid(tenant_id) else None
        q = {"_id": t_oid} if t_oid else {"slug": tenant_id}
        tenant = await primary_db.tenants.find_one(q)

        if tenant:
            raw_status = tenant.get("status", "ACTIVE")
            sub = tenant.get("subscription", {})
            sub_status = sub.get("status", "ACTIVE")

            is_suspended = (raw_status == "SUSPENDED" or sub_status == "SUSPENDED")
            is_expired = False

            end_date_str = sub.get("endDate") or sub.get("end_date")
            if end_date_str:
                try:
                    clean_str = end_date_str.replace("Z", "+00:00")
                    end_dt = datetime.fromisoformat(clean_str)
                    if end_dt.tzinfo is None:
                        end_dt = end_dt.replace(tzinfo=timezone.utc)
                    now_dt = datetime.now(timezone.utc)
                    grace_days = sub.get("gracePeriodDays") or sub.get("grace_period_days") or 7
                    delta_days = (end_dt.date() - now_dt.date()).days
                    if delta_days < -grace_days:
                        is_expired = True
                except Exception:
                    pass

            if is_suspended:
                store_status = "SUSPENDED"
                is_store_locked = True
                lockout_reason = "Store account has been suspended by platform administration."

                # Block non-owner staff from logging in
                if not is_store_owner:
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="Access Denied: Your store account has been suspended by platform administration. Please contact your Store Owner to restore access."
                    )
            elif is_expired:
                store_status = "EXPIRED"
                is_store_locked = True
                lockout_reason = "Store subscription license has expired."

                # Block non-owner staff from logging in
                if not is_store_owner:
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="Access Denied: Your store subscription license has expired. Please contact your Store Owner to renew the plan."
                    )

    payload = TokenPayload(
        sub=user_id,
        email=clean_email,
        roles=roles,
        permissions=["all"],
        default_business_id=tenant_id,
        authorized_business_ids=auth_tenant_ids,
        assigned_location_ids=assigned_locations,
        store_status=store_status,
        is_store_locked=is_store_locked,
        lockout_reason=lockout_reason
    )

    token = create_access_token(payload)

    return TokenResponse(
        access_token=token,
        user_id=user_id,
        email=clean_email,
        name=user_name,
        roles=roles,
        default_business_id=tenant_id,
        assigned_location_ids=assigned_locations,
        store_status=store_status,
        is_store_locked=is_store_locked,
        lockout_reason=lockout_reason
    )

@router.post("/superadmin/login", response_model=SuperAdminStep1Response)
async def superadmin_login_step1(req: LoginRequest, primary_db = Depends(get_database)):
    """
    Step 1 of Super Admin authentication.
    Validates email and password, then prompts for Google/Microsoft Authenticator 2FA.
    If 2FA is not yet configured, returns setup parameters with QR code URI.
    """
    clean_email = req.email.strip().lower()

    if not clean_email or not req.password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Super Admin email and password are required."
        )

    user = await primary_db.users.find_one({"email": clean_email})

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Super Admin credentials."
        )

    normalized_roles = [r.upper() for r in user.get("roles", [])]
    if "SUPER_ADMIN" not in normalized_roles and "SUPERADMIN" not in normalized_roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Unauthorized: Super Administrator role required."
        )

    password_hash = user.get("passwordHash") or user.get("hashedPassword", "")
    if not verify_password(req.password, password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Super Admin credentials."
        )

    user_id = str(user["_id"])
    is_totp_enabled = bool(user.get("isTotpEnabled") and user.get("totpSecret"))

    now = datetime.now(timezone.utc)

    if is_totp_enabled:
        # Generate short-lived MFA Session Token (5 minutes)
        mfa_payload = {
            "sub": user_id,
            "email": clean_email,
            "type": "superadmin_mfa_pending",
            "exp": now + timedelta(minutes=5),
            "iat": now
        }
        mfa_token = jwt.encode(mfa_payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)

        return SuperAdminStep1Response(
            requires_2fa=True,
            requires_2fa_setup=False,
            mfa_session_token=mfa_token,
            email=clean_email
        )
    else:
        # First-Time 2FA Setup: generate secret and otpauth URI
        secret = generate_totp_secret()
        otpauth_uri = get_totp_uri(secret, clean_email, issuer="QuickBill Super Admin")
        
        setup_payload = {
            "sub": user_id,
            "email": clean_email,
            "type": "superadmin_2fa_setup",
            "temp_secret": secret,
            "exp": now + timedelta(minutes=10),
            "iat": now
        }
        setup_token = jwt.encode(setup_payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)

        return SuperAdminStep1Response(
            requires_2fa=True,
            requires_2fa_setup=True,
            setup_token=setup_token,
            otpauth_uri=otpauth_uri,
            secret_key=secret,
            email=clean_email
        )

@router.post("/superadmin/verify-2fa", response_model=TokenResponse)
async def superadmin_verify_2fa(req: Verify2FARequest, primary_db = Depends(get_database)):
    """
    Step 2: Verifies the 6-digit TOTP code from Google or Microsoft Authenticator app (or emergency backup code).
    """
    try:
        decoded = jwt.decode(req.mfa_session_token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
    except jwt.PyJWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="MFA verification session expired. Please start login again."
        )

    if decoded.get("type") != "superadmin_mfa_pending":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid MFA session token."
        )

    user_id = decoded.get("sub")
    user = await primary_db.users.find_one({"_id": ObjectId(user_id)})

    if not user or not user.get("totpSecret"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="2FA authentication record not found."
        )

    totp_secret = user["totpSecret"]
    submitted_code = req.code.strip()

    # 1. Verify standard 6-digit TOTP code
    is_valid_totp = verify_totp_code(totp_secret, submitted_code)
    
    # 2. If not valid TOTP, check if single-use emergency backup code
    is_valid_backup = False
    if not is_valid_totp and "-" in submitted_code and user.get("backupCodes"):
        clean_backup = submitted_code.upper()
        for idx, bc_hash in enumerate(user["backupCodes"]):
            if verify_password(clean_backup, bc_hash):
                is_valid_backup = True
                # Consume single-use backup code
                user["backupCodes"].pop(idx)
                await primary_db.users.update_one(
                    {"_id": ObjectId(user_id)},
                    {"$set": {"backupCodes": user["backupCodes"]}}
                )
                break

    if not is_valid_totp and not is_valid_backup:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Authenticator verification code. Please check Google/Microsoft Authenticator and enter the current 6-digit code."
        )

    # Issue final Super Admin JWT Token
    roles = user.get("roles", ["SUPER_ADMIN"])
    payload = TokenPayload(
        sub=user_id,
        email=user.get("email", ""),
        roles=roles,
        permissions=["all"],
        default_business_id="system_platform",
        authorized_business_ids=["*"],
        assigned_location_ids=[],
        store_status="ACTIVE",
        is_store_locked=False
    )

    access_token = create_access_token(payload)

    return TokenResponse(
        access_token=access_token,
        user_id=user_id,
        email=user.get("email", ""),
        name=user.get("name", "Super Administrator"),
        roles=roles,
        default_business_id="system_platform",
        assigned_location_ids=[],
        store_status="ACTIVE",
        is_store_locked=False
    )

@router.post("/superadmin/confirm-2fa-setup", response_model=Confirm2FASetupResponse)
async def superadmin_confirm_2fa_setup(req: Confirm2FASetupRequest, primary_db = Depends(get_database)):
    """
    Confirms initial 2FA setup by verifying the first 6-digit code, activates TOTP in MongoDB,
    generates emergency backup codes, and returns the final Super Admin JWT session.
    """
    try:
        decoded = jwt.decode(req.setup_token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
    except jwt.PyJWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="2FA setup session expired. Please start login again."
        )

    if decoded.get("type") != "superadmin_2fa_setup":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid 2FA setup token."
        )

    user_id = decoded.get("sub")
    temp_secret = decoded.get("temp_secret")

    if not temp_secret or not verify_totp_code(temp_secret, req.code):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid 6-digit verification code. Please ensure your smartphone clock is accurate and try again."
        )

    raw_backup_codes = generate_backup_codes(8)
    hashed_backup_codes = [get_password_hash(bc) for bc in raw_backup_codes]

    now = datetime.now(timezone.utc)
    await primary_db.users.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {
            "isTotpEnabled": True,
            "totpSecret": temp_secret,
            "backupCodes": hashed_backup_codes,
            "totpConfiguredAt": now
        }}
    )

    user = await primary_db.users.find_one({"_id": ObjectId(user_id)})
    roles = user.get("roles", ["SUPER_ADMIN"]) if user else ["SUPER_ADMIN"]

    payload = TokenPayload(
        sub=user_id,
        email=decoded.get("email", ""),
        roles=roles,
        permissions=["all"],
        default_business_id="system_platform",
        authorized_business_ids=["*"],
        assigned_location_ids=[],
        store_status="ACTIVE",
        is_store_locked=False
    )

    access_token = create_access_token(payload)

    return Confirm2FASetupResponse(
        access_token=access_token,
        user_id=user_id,
        email=decoded.get("email", ""),
        name=user.get("name", "Super Administrator") if user else "Super Administrator",
        roles=roles,
        default_business_id="system_platform",
        assigned_location_ids=[],
        store_status="ACTIVE",
        is_store_locked=False,
        backup_codes=raw_backup_codes
    )

@router.post("/superadmin/reset-2fa")
async def superadmin_reset_2fa(user: TokenPayload = Depends(get_current_user), primary_db = Depends(get_database)):
    """
    Authenticated endpoint for Super Admin to reset/re-enroll their Authenticator app.
    """
    normalized_roles = [r.upper() for r in user.roles]
    if "SUPER_ADMIN" not in normalized_roles and "SUPERADMIN" not in normalized_roles:
        raise HTTPException(status_code=403, detail="Super Administrator authorization required.")

    await primary_db.users.update_one(
        {"_id": ObjectId(user.sub)},
        {"$set": {
            "isTotpEnabled": False,
            "totpSecret": None,
            "backupCodes": []
        }}
    )

    return {
        "success": True,
        "message": "Two-factor authentication reset. You will be prompted to re-scan the QR code on your next login."
    }

@router.get("/me")
async def get_me(user: TokenPayload = Depends(get_current_user)):
    return user

