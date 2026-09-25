from datetime import datetime, timezone
from typing import Optional
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, status
from app.core.database import get_tenant_db
from app.core.security import get_current_business_id
from app.schemas.common import PaginatedResponse
from app.schemas.party import PartyCreate, PartyUpdate, PartyResponse
from app.repositories.base_repository import BaseTenantRepository

router = APIRouter(prefix="/parties", tags=["Parties (Customers & Suppliers)"])

@router.get("", response_model=PaginatedResponse[PartyResponse])
async def list_parties(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    party_type: Optional[str] = Query(None, alias="type"),
    search: Optional[str] = None,
    business_id: str = Depends(get_current_business_id)
):
    db = await get_tenant_db(business_id)
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
    business_id: str = Depends(get_current_business_id)
):
    db = await get_tenant_db(business_id)
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

@router.get("/{party_id}", response_model=PartyResponse)
async def get_party(
    party_id: str,
    business_id: str = Depends(get_current_business_id)
):
    db = await get_tenant_db(business_id)
    repo = BaseTenantRepository(db, "parties")
    doc = await repo.get_by_id(business_id, party_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Party contact not found in current store")
    doc["_id"] = str(doc["_id"])
    doc["businessId"] = str(doc["businessId"])
    return PartyResponse(**doc)

@router.put("/{party_id}", response_model=PartyResponse)
async def update_party(
    party_id: str,
    payload: PartyUpdate,
    business_id: str = Depends(get_current_business_id)
):
    db = await get_tenant_db(business_id)
    repo = BaseTenantRepository(db, "parties")
    existing = await repo.get_by_id(business_id, party_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Party contact not found in current store")

    update_fields = {}
    if payload.name is not None:
        update_fields["name"] = payload.name
    if payload.phone is not None:
        update_fields["phone"] = payload.phone
    if payload.email is not None:
        update_fields["email"] = payload.email
    if payload.type is not None:
        update_fields["type"] = payload.type
    if payload.tax_id is not None:
        update_fields["taxId"] = payload.tax_id
    if payload.billing_address is not None:
        update_fields["billingAddress"] = payload.billing_address
    if payload.shipping_address is not None:
        update_fields["shippingAddress"] = payload.shipping_address
    if payload.credit_limit is not None:
        update_fields["creditLimit"] = float(payload.credit_limit)
    if payload.notes is not None:
        update_fields["notes"] = payload.notes

    if update_fields:
        update_fields["updatedAt"] = datetime.now(timezone.utc)
        await repo.update_by_id(business_id, party_id, update_fields)

    updated_doc = await repo.get_by_id(business_id, party_id)
    updated_doc["_id"] = str(updated_doc["_id"])
    updated_doc["businessId"] = str(updated_doc["businessId"])
    return PartyResponse(**updated_doc)

@router.delete("/{party_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_party(
    party_id: str,
    business_id: str = Depends(get_current_business_id)
):
    db = await get_tenant_db(business_id)
    repo = BaseTenantRepository(db, "parties")
    existing = await repo.get_by_id(business_id, party_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Party contact not found in current store")
    await repo.delete_by_id(business_id, party_id)
    return None
