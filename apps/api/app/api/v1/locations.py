from typing import List, Optional
from datetime import datetime, timezone
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from app.core.security import TokenPayload, get_current_user
from app.core.database import get_database

router = APIRouter(prefix="/locations", tags=["Store Locations & Branches"])

class LocationCreateRequest(BaseModel):
    name: str
    code: str
    address: Optional[str] = None
    phone: Optional[str] = None
    isDefault: bool = False

class LocationUpdateRequest(BaseModel):
    name: Optional[str] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    isActive: Optional[bool] = None

class LocationResponse(BaseModel):
    id: str
    businessId: str
    name: str
    code: str
    address: Optional[str] = None
    phone: Optional[str] = None
    isDefault: bool = False
    isActive: bool = True
    createdAt: str

@router.get("", response_model=List[LocationResponse])
async def list_locations(
    user: TokenPayload = Depends(get_current_user)
):
    primary_db = get_database()
    filter_query = {}
    if "SUPER_ADMIN" not in user.roles:
        if not user.default_business_id:
            raise HTTPException(status_code=400, detail="No business tenant context.")
        filter_query = {"businessId": user.default_business_id}

    cursor = primary_db.locations.find(filter_query).sort("createdAt", 1)
    results = []
    async for loc in cursor:
        results.append(LocationResponse(
            id=str(loc["_id"]),
            businessId=str(loc.get("businessId", "")),
            name=loc.get("name", ""),
            code=loc.get("code", ""),
            address=loc.get("address"),
            phone=loc.get("phone"),
            isDefault=loc.get("isDefault", False),
            isActive=loc.get("isActive", True),
            createdAt=loc.get("createdAt", datetime.now(timezone.utc)).isoformat() if isinstance(loc.get("createdAt"), datetime) else str(loc.get("createdAt", ""))
        ))
    return results

@router.post("", response_model=LocationResponse, status_code=status.HTTP_201_CREATED)
async def create_location(
    req: LocationCreateRequest,
    current_user: TokenPayload = Depends(get_current_user)
):
    if "SUPER_ADMIN" not in current_user.roles and "TENANT_ADMIN" not in current_user.roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Store Administrators can add new store locations."
        )

    primary_db = get_database()
    tenant_id = current_user.default_business_id
    clean_code = req.code.strip().upper()

    existing = await primary_db.locations.find_one({"businessId": tenant_id, "code": clean_code})
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Location code '{clean_code}' already exists in this store."
        )

    now = datetime.now(timezone.utc)
    new_doc = {
        "businessId": tenant_id,
        "name": req.name.strip(),
        "code": clean_code,
        "address": req.address,
        "phone": req.phone,
        "isDefault": req.isDefault,
        "isActive": True,
        "createdAt": now
    }

    insert_res = await primary_db.locations.insert_one(new_doc)

    return LocationResponse(
        id=str(insert_res.inserted_id),
        businessId=tenant_id,
        name=req.name.strip(),
        code=clean_code,
        address=req.address,
        phone=req.phone,
        isDefault=req.isDefault,
        isActive=True,
        createdAt=now.isoformat()
    )
