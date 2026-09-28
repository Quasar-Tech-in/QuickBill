from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from app.core.security import (
    create_access_token,
    verify_password,
    TokenPayload,
    get_current_user
)
from app.core.database import get_database

from datetime import datetime, timezone
from bson import ObjectId

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

@router.get("/me")
async def get_me(user: TokenPayload = Depends(get_current_user)):
    return user

