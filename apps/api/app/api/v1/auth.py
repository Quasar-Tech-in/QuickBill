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
    tenant_id = str(user.get("tenantId")) if user.get("tenantId") else "system_platform"
    auth_tenant_ids = [str(t) for t in user.get("authorizedTenantIds", [tenant_id])]
    roles = user.get("roles", ["CASHIER"])
    user_name = user.get("name", clean_email.split("@")[0].title())
    assigned_locations = [str(loc) for loc in user.get("assignedLocationIds", [])]

    payload = TokenPayload(
        sub=user_id,
        email=clean_email,
        roles=roles,
        permissions=["all"],
        default_business_id=tenant_id,
        authorized_business_ids=auth_tenant_ids,
        assigned_location_ids=assigned_locations
    )

    token = create_access_token(payload)

    return TokenResponse(
        access_token=token,
        user_id=user_id,
        email=clean_email,
        name=user_name,
        roles=roles,
        default_business_id=tenant_id,
        assigned_location_ids=assigned_locations
    )

@router.get("/me")
async def get_me(user: TokenPayload = Depends(get_current_user)):
    return user

