from typing import List, Optional
from datetime import datetime, timezone
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from app.core.security import (
    TokenPayload,
    get_current_user,
    get_password_hash
)
from app.core.database import get_database

router = APIRouter(prefix="/users", tags=["Users & Staff Management"])

class UserCreateRequest(BaseModel):
    name: str
    email: str
    password: str
    role: str = "CASHIER"  # TENANT_ADMIN | MANAGER | CASHIER
    assignedLocationIds: List[str] = []

class UserUpdateRequest(BaseModel):
    name: Optional[str] = None
    role: Optional[str] = None
    assignedLocationIds: Optional[List[str]] = None
    isActive: Optional[bool] = None
    password: Optional[str] = None

class UserResponse(BaseModel):
    id: str
    name: str
    email: str
    role: str
    businessId: str
    assignedLocationIds: List[str] = []
    isActive: bool
    createdAt: str

@router.get("", response_model=List[UserResponse])
async def list_store_users(
    user: TokenPayload = Depends(get_current_user)
):
    primary_db = get_database()
    
    # Super admin can see all; tenant users see only their store staff
    filter_query = {}
    if "SUPER_ADMIN" not in user.roles:
        if not user.default_business_id:
            raise HTTPException(status_code=400, detail="No business tenant context.")
        b_oid = ObjectId(user.default_business_id) if ObjectId.is_valid(user.default_business_id) else None
        filter_query = {"$or": [{"tenantId": b_oid}, {"tenantId": user.default_business_id}]}

    cursor = primary_db.users.find(filter_query).sort("createdAt", -1)
    results = []
    async for u in cursor:
        if u.get("isSystemRoot") and "SUPER_ADMIN" not in user.roles:
            continue
        
        role_list = u.get("roles", ["CASHIER"])
        main_role = role_list[0] if role_list else "CASHIER"
        
        results.append(UserResponse(
            id=str(u["_id"]),
            name=u.get("name", ""),
            email=u.get("email", ""),
            role=main_role,
            businessId=str(u.get("tenantId", "")),
            assignedLocationIds=[str(loc) for loc in u.get("assignedLocationIds", [])],
            isActive=u.get("isActive", True),
            createdAt=u.get("createdAt", datetime.now(timezone.utc)).isoformat() if isinstance(u.get("createdAt"), datetime) else str(u.get("createdAt", ""))
        ))
    return results

@router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_store_user(
    req: UserCreateRequest,
    current_user: TokenPayload = Depends(get_current_user)
):
    # Only Store Admin and Super Admin can create staff users
    if "SUPER_ADMIN" not in current_user.roles and "TENANT_ADMIN" not in current_user.roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Store Administrators can add new staff members."
        )

    clean_email = req.email.strip().lower()
    if len(req.password) < 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 6 characters."
        )

    primary_db = get_database()
    
    # Check if user already exists
    existing = await primary_db.users.find_one({"email": clean_email})
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"User with email '{clean_email}' already exists."
        )

    tenant_id = ObjectId(current_user.default_business_id) if ObjectId.is_valid(current_user.default_business_id) else current_user.default_business_id
    now = datetime.now(timezone.utc)
    hashed = get_password_hash(req.password)

    new_user_doc = {
        "email": clean_email,
        "name": req.name.strip(),
        "passwordHash": hashed,
        "roles": [req.role.upper()],
        "isSystemRoot": False,
        "tenantId": tenant_id,
        "authorizedTenantIds": [str(tenant_id)],
        "assignedLocationIds": req.assignedLocationIds,
        "isActive": True,
        "createdAt": now
    }

    insert_result = await primary_db.users.insert_one(new_user_doc)

    return UserResponse(
        id=str(insert_result.inserted_id),
        name=req.name.strip(),
        email=clean_email,
        role=req.role.upper(),
        businessId=str(tenant_id),
        assignedLocationIds=req.assignedLocationIds,
        isActive=True,
        createdAt=now.isoformat()
    )

@router.put("/{user_id}", response_model=UserResponse)
async def update_store_user(
    user_id: str,
    req: UserUpdateRequest,
    current_user: TokenPayload = Depends(get_current_user)
):
    if "SUPER_ADMIN" not in current_user.roles and "TENANT_ADMIN" not in current_user.roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Store Administrators can update staff accounts."
        )

    primary_db = get_database()
    target_oid = ObjectId(user_id) if ObjectId.is_valid(user_id) else None
    if not target_oid:
        raise HTTPException(status_code=400, detail="Invalid user ID format.")

    user_doc = await primary_db.users.find_one({"_id": target_oid})
    if not user_doc:
        raise HTTPException(status_code=404, detail="User not found.")

    update_fields = {}
    if req.name is not None:
        update_fields["name"] = req.name.strip()
    if req.role is not None:
        update_fields["roles"] = [req.role.upper()]
    if req.assignedLocationIds is not None:
        update_fields["assignedLocationIds"] = req.assignedLocationIds
    if req.isActive is not None:
        update_fields["isActive"] = req.isActive
    if req.password:
        if len(req.password) < 6:
            raise HTTPException(status_code=400, detail="Password must be at least 6 characters.")
        update_fields["passwordHash"] = get_password_hash(req.password)

    if update_fields:
        await primary_db.users.update_one({"_id": target_oid}, {"$set": update_fields})
        user_doc = await primary_db.users.find_one({"_id": target_oid})

    role_list = user_doc.get("roles", ["CASHIER"])
    main_role = role_list[0] if role_list else "CASHIER"

    return UserResponse(
        id=str(user_doc["_id"]),
        name=user_doc.get("name", ""),
        email=user_doc.get("email", ""),
        role=main_role,
        businessId=str(user_doc.get("tenantId", "")),
        assignedLocationIds=[str(loc) for loc in user_doc.get("assignedLocationIds", [])],
        isActive=user_doc.get("isActive", True),
        createdAt=user_doc.get("createdAt", datetime.now(timezone.utc)).isoformat() if isinstance(user_doc.get("createdAt"), datetime) else str(user_doc.get("createdAt", ""))
    )

@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_store_user(
    user_id: str,
    current_user: TokenPayload = Depends(get_current_user)
):
    if "SUPER_ADMIN" not in current_user.roles and "TENANT_ADMIN" not in current_user.roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Store Administrators can delete staff accounts."
        )

    if current_user.sub == user_id:
        raise HTTPException(status_code=400, detail="Cannot delete your own active administrator account.")

    primary_db = get_database()
    target_oid = ObjectId(user_id) if ObjectId.is_valid(user_id) else None
    if not target_oid:
        raise HTTPException(status_code=400, detail="Invalid user ID format.")

    result = await primary_db.users.delete_one({"_id": target_oid})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="User not found.")
