from typing import Optional
import secrets
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from app.core.security import (
    create_access_token,
    get_password_hash,
    verify_password,
    TokenPayload,
    get_current_user
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
    default_business_id: str

@router.post("/login", response_model=TokenResponse)
async def login(req: LoginRequest):
    # Super Admin credentials
    if req.email == "superadmin@quickbill.local" and req.password == "superadmin123":
        payload = TokenPayload(
            sub="usr_superadmin_000",
            email=req.email,
            roles=["super_admin", "admin"],
            permissions=["all", "manage_tenants", "manage_db_connections", "view_all_stats"],
            default_business_id="system_platform",
            authorized_business_ids=["system_platform", "65f2a1b9a000000000000001"]
        )
        token = create_access_token(payload)
        return TokenResponse(
            access_token=token,
            user_id="usr_superadmin_000",
            email=req.email,
            default_business_id="system_platform"
        )

    # Standard Store Admin credentials
    if req.email == "admin@quickbill.local" and req.password == "admin123":
        payload = TokenPayload(
            sub="usr_admin_001",
            email=req.email,
            roles=["admin"],
            permissions=["all"],
            default_business_id="65f2a1b9a000000000000001",
            authorized_business_ids=["65f2a1b9a000000000000001"]
        )
        token = create_access_token(payload)
        return TokenResponse(
            access_token=token,
            user_id="usr_admin_001",
            email=req.email,
            default_business_id="65f2a1b9a000000000000001"
        )
    
    # Generic demo fallback
    payload = TokenPayload(
        sub="usr_demo_" + secrets.token_hex(4),
        email=req.email,
        roles=["admin"],
        permissions=["all"],
        default_business_id="65f2a1b9a000000000000001",
        authorized_business_ids=["65f2a1b9a000000000000001"]
    )
    token = create_access_token(payload)
    return TokenResponse(
        access_token=token,
        user_id=payload.sub,
        email=req.email,
        default_business_id="65f2a1b9a000000000000001"
    )

@router.get("/me")
async def get_me(user: TokenPayload = Depends(get_current_user)):
    return user
