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
    if target_business not in user.authorized_business_ids and "admin" not in user.roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access forbidden: You are not authorized for this business tenant."
        )
    return target_business
