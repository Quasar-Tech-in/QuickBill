from datetime import datetime, timezone
from typing import Optional
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, status
from app.core.database import get_database
from app.core.security import get_current_business_id
from app.schemas.common import PaginatedResponse
from app.schemas.party import PartyCreate, PartyResponse
from app.repositories.base_repository import BaseTenantRepository

router = APIRouter(prefix="/parties", tags=["Parties (Customers & Suppliers)"])

@router.get("", response_model=PaginatedResponse[PartyResponse])
async def list_parties(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    party_type: Optional[str] = Query(None, alias="type"),
    search: Optional[str] = None,
    business_id: str = Depends(get_current_business_id),
    db = Depends(get_database)
):
    repo = BaseTenantRepository(db, "parties")
    query = {}
    if party_type:
        query["type"] = party_type
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"phone": {"$regex": search, "$options": "i"}}
        ]
    
    docs, total = await repo.list_paginated(
        business_id=business_id,
        filter_query=query,
        page=page,
        page_size=page_size
    )

    parties = []
    for d in docs:
        d["_id"] = str(d["_id"])
        d["businessId"] = str(d["businessId"])
        parties.append(PartyResponse(**d))

    return PaginatedResponse(
        data=parties,
        page=page,
        page_size=page_size,
        total=total,
        total_pages=(total + page_size - 1) // page_size if page_size else 1
    )

@router.post("", response_model=PartyResponse, status_code=status.HTTP_201_CREATED)
async def create_party(
    payload: PartyCreate,
    business_id: str = Depends(get_current_business_id),
    db = Depends(get_database)
):
    repo = BaseTenantRepository(db, "parties")
    now = datetime.now(timezone.utc)
    doc = {
        "businessId": ObjectId(business_id),
        "name": payload.name,
        "phone": payload.phone,
        "email": payload.email,
        "type": payload.type,
        "taxId": payload.tax_id,
        "billingAddress": payload.billing_address,
        "shippingAddress": payload.shipping_address,
        "openingBalance": float(payload.opening_balance),
        "currentReceivable": float(payload.opening_balance) if "customer" in payload.type else 0.0,
        "currentPayable": float(payload.opening_balance) if "supplier" in payload.type else 0.0,
        "creditLimit": float(payload.credit_limit) if payload.credit_limit else None,
        "notes": payload.notes,
        "createdAt": now
    }

    doc_id = await repo.insert(business_id, doc)
    doc["_id"] = doc_id
    doc["businessId"] = business_id
    return PartyResponse(**doc)
