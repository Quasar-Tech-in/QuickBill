from datetime import datetime, timedelta, timezone
from typing import Optional, List
import jwt
import bcrypt
from pydantic import BaseModel
from fastapi import Depends, HTTPException, status, Header
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.core.config import settings

security_bearer = HTTPBearer(auto_error=False)

class TokenPayload(BaseModel):
    sub: str  # userId
    email: str
    roles: List[str] = ["admin"]
    permissions: List[str] = []
    default_business_id: Optional[str] = None
    authorized_business_ids: List[str] = []
    assigned_location_ids: List[str] = []
    store_status: Optional[str] = "ACTIVE"
    is_store_locked: Optional[bool] = False
    lockout_reason: Optional[str] = None

def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return bcrypt.checkpw(plain_password.encode('utf-8')[:72], hashed_password.encode('utf-8'))
    except Exception:
        return False

def get_password_hash(password: str) -> str:
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode('utf-8')[:72], salt).decode('utf-8')


def create_access_token(payload: TokenPayload, expires_delta: Optional[timedelta] = None) -> str:
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    to_encode = payload.model_dump()
    to_encode.update({"exp": expire, "iat": datetime.now(timezone.utc)})
    return jwt.encode(to_encode, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)

def decode_access_token(token: str) -> Optional[TokenPayload]:
    try:
        decoded = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
        return TokenPayload(**decoded)
    except jwt.PyJWTError:
        return None

async def get_current_user(
    auth: Optional[HTTPAuthorizationCredentials] = Depends(security_bearer)
) -> TokenPayload:
    if not auth or not auth.credentials:
        # Development fallback bypass if DEBUG is True and no auth header
        if settings.DEBUG:
            return TokenPayload(
                sub="demo_user_001",
                email="admin@quickbill.local",
                roles=["admin"],
                permissions=["all"],
                default_business_id="65f2a1b9a000000000000001",
                authorized_business_ids=["65f2a1b9a000000000000001"]
            )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid authentication token"
        )
    
    payload = decode_access_token(auth.credentials)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Expired or invalid authentication token"
        )
    return payload

async def get_current_business_id(
    user: TokenPayload = Depends(get_current_user),
    x_business_id: Optional[str] = Header(None, alias="X-Business-ID")
) -> str:
    target_business = x_business_id or user.default_business_id
    if not target_business:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No business context specified in request."
        )
    normalized_roles = [r.lower() for r in (user.roles or [])]
    is_admin = any(r in ("admin", "super_admin", "tenant_admin") for r in normalized_roles)
    if not is_admin and target_business not in (user.authorized_business_ids or []):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access forbidden: You are not authorized for this business tenant."
        )
    return target_business

async def enforce_active_store_operations(
    business_id: str = Depends(get_current_business_id),
    user: TokenPayload = Depends(get_current_user)
) -> str:
    normalized_roles = [r.upper() for r in (user.roles or [])]
    if "SUPER_ADMIN" in normalized_roles or "SUPERADMIN" in normalized_roles:
        return business_id

    # Check database tenant status
    try:
        from app.core.database import db_manager
        from bson import ObjectId
        primary_db = db_manager.get_primary_database()
        t_oid = ObjectId(business_id) if ObjectId.is_valid(business_id) else None
        q = {"_id": t_oid} if t_oid else {"slug": business_id}
        tenant = await primary_db.tenants.find_one(q)
        if tenant:
            if tenant.get("status") == "SUSPENDED" or tenant.get("subscription", {}).get("status") == "SUSPENDED":
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Store operations are locked: This store account is currently suspended."
                )
            sub = tenant.get("subscription", {})
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
                        raise HTTPException(
                            status_code=status.HTTP_403_FORBIDDEN,
                            detail="Store operations are locked: Store subscription license has expired."
                        )
                except HTTPException:
                    raise
                except Exception:
                    pass
    except HTTPException:
        raise
    except Exception:
        pass

    return business_id
