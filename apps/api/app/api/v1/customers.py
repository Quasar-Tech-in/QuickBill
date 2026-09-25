from datetime import datetime, timezone
from typing import Optional, List
import re
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, status
from app.core.database import get_tenant_db
from app.core.security import get_current_business_id
from app.schemas.common import PaginatedResponse
from app.schemas.customer import CustomerCreate, CustomerUpdate, CustomerResponse, CustomerMarketingExport
from app.repositories.base_repository import BaseTenantRepository

router = APIRouter(prefix="/customers", tags=["Customers CRM & Marketing"])

def normalize_phone(phone: str) -> str:
    if not phone:
        return ""
    digits = re.sub(r"\D", "", phone)
    if len(digits) > 10 and digits.startswith("91"):
        digits = digits[2:]
    elif len(digits) > 10 and digits.startswith("0"):
        digits = digits[1:]
    return digits[-10:] if len(digits) >= 10 else digits

@router.get("", response_model=PaginatedResponse[CustomerResponse])
async def list_customers(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: Optional[str] = None,
    tag: Optional[str] = None,
    min_spent: Optional[float] = None,
    location_id: Optional[str] = None,
    business_id: str = Depends(get_current_business_id)
):
    db = await get_tenant_db(business_id)
    repo = BaseTenantRepository(db, "customers")
    b_oid = repo._to_object_id(business_id)
    query: dict = {"businessId": b_oid}

    if search:
        clean_s = normalize_phone(search)
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"phone": {"$regex": clean_s if clean_s else search, "$options": "i"}},
            {"email": {"$regex": search, "$options": "i"}}
        ]

    if tag:
        query["tags"] = tag

    if min_spent is not None:
        query["totalSpent"] = {"$gte": min_spent}

    if location_id:
        query["$or"] = [
            {"locationIds": {"$exists": False}},
            {"locationIds": {"$size": 0}},
            {"locationIds": location_id}
        ]

    docs, total = await repo.list_paginated(
        business_id=business_id,
        filter_query=query,
        page=page,
        page_size=page_size,
        sort_by="lastPurchaseDate",
        sort_dir=-1
    )

    customers = []
    for d in docs:
        d["_id"] = str(d["_id"])
        d["businessId"] = str(d["businessId"])
        customers.append(CustomerResponse(**d))

    return PaginatedResponse(
        data=customers,
        page=page,
        page_size=page_size,
        total=total,
        total_pages=(total + page_size - 1) // page_size if page_size else 1
    )

@router.get("/lookup/by-phone", response_model=Optional[CustomerResponse])
async def lookup_customer_by_phone(
    phone: str = Query(..., min_length=3),
    business_id: str = Depends(get_current_business_id)
):
    db = await get_tenant_db(business_id)
    repo = BaseTenantRepository(db, "customers")
    b_oid = repo._to_object_id(business_id)

    # Extract clean digits
    clean_digits = re.sub(r"\D", "", phone)
    if len(clean_digits) > 10 and clean_digits.startswith("91"):
        ten_digits = clean_digits[2:]
    elif len(clean_digits) > 10 and clean_digits.startswith("0"):
        ten_digits = clean_digits[1:]
    else:
        ten_digits = clean_digits[-10:] if len(clean_digits) >= 10 else clean_digits

    if len(ten_digits) < 4:
        return None

    full_phone = f"+91{ten_digits}" if len(ten_digits) == 10 else phone.strip()

    query = {
        "businessId": b_oid,
        "$or": [
            {"phone": full_phone},
            {"phone": ten_digits},
            {"phone": phone.strip()},
            {"phone": {"$regex": ten_digits, "$options": "i"}}
        ]
    }

    doc = await repo.collection.find_one(query)
    if not doc:
        # Fallback to parties collection if not yet migrated
        parties_repo = BaseTenantRepository(db, "parties")
        p_doc = await parties_repo.collection.find_one(query)
        if p_doc:
            p_doc["_id"] = str(p_doc["_id"])
            p_doc["businessId"] = str(p_doc["businessId"])
            p_doc["currentBalance"] = p_doc.get("currentReceivable", 0.0)
            return CustomerResponse(**p_doc)
        return None

    doc["_id"] = str(doc["_id"])
    doc["businessId"] = str(doc["businessId"])
    return CustomerResponse(**doc)

@router.post("", response_model=CustomerResponse, status_code=status.HTTP_201_CREATED)
async def create_customer(
    payload: CustomerCreate,
    business_id: str = Depends(get_current_business_id)
):
    db = await get_tenant_db(business_id)
    repo = BaseTenantRepository(db, "customers")
    parties_repo = BaseTenantRepository(db, "parties")
    now = datetime.now(timezone.utc)
    b_oid = repo._to_object_id(business_id)

    # If phone is provided, check if customer already exists for this business
    clean_p = normalize_phone(payload.phone) if payload.phone else ""
    if clean_p and len(clean_p) >= 4:
        existing = await repo.collection.find_one({
            "businessId": b_oid,
            "phone": {"$regex": clean_p, "$options": "i"}
        })
        if existing:
            update_fields: dict = {"updatedAt": now}
            if payload.name and payload.name.strip():
                update_fields["name"] = payload.name.strip()
            if payload.email:
                update_fields["email"] = payload.email
            if payload.address:
                update_fields["address"] = payload.address
            if payload.gstin:
                update_fields["gstin"] = payload.gstin
            if payload.location_ids:
                update_fields["$addToSet"] = {"locationIds": {"$each": payload.location_ids}}
            
            await repo.collection.update_one({"_id": existing["_id"]}, {"$set": update_fields})
            updated_doc = await repo.collection.find_one({"_id": existing["_id"]})
            if updated_doc:
                updated_doc["_id"] = str(updated_doc["_id"])
                updated_doc["businessId"] = str(updated_doc["businessId"])
                return CustomerResponse(**updated_doc)

    doc = {
        "businessId": b_oid,
        "name": payload.name,
        "phone": payload.phone,
        "email": payload.email,
        "address": payload.address,
        "gstin": payload.gstin,
        "notes": payload.notes,
        "tags": payload.tags or ["Regular"],
        "marketingConsent": payload.marketing_consent,
        "locationIds": payload.location_ids or [],
        "openingBalance": float(payload.opening_balance),
        "currentBalance": float(payload.opening_balance),
        "totalSpent": 0.0,
        "totalVisits": 0,
        "lastPurchaseDate": None,
        "createdAt": now,
        "updatedAt": now
    }

    doc_id = await repo.insert(business_id, doc)
    doc["_id"] = doc_id
    doc["businessId"] = business_id

    # Mirror to parties collection for party ledger compatibility
    try:
        party_doc = {
            "businessId": b_oid,
            "name": payload.name,
            "phone": payload.phone,
            "email": payload.email,
            "type": ["customer"],
            "taxId": payload.gstin,
            "billingAddress": {"street": payload.address} if payload.address else None,
            "openingBalance": float(payload.opening_balance),
            "currentReceivable": float(payload.opening_balance),
            "currentPayable": 0.0,
            "notes": payload.notes,
            "createdAt": now
        }
        await parties_repo.insert(business_id, party_doc)
    except Exception:
        pass

    return CustomerResponse(**doc)

@router.get("/export/marketing", response_model=List[CustomerMarketingExport])
async def export_customers_for_marketing(
    consent_only: bool = Query(True, alias="consentOnly"),
    min_spent: Optional[float] = Query(None, alias="minSpent"),
    tag: Optional[str] = None,
    business_id: str = Depends(get_current_business_id)
):
    db = await get_tenant_db(business_id)
    repo = BaseTenantRepository(db, "customers")
    b_oid = repo._to_object_id(business_id)
    query: dict = {"businessId": b_oid}

    if consent_only:
        query["marketingConsent"] = True

    if min_spent is not None:
        query["totalSpent"] = {"$gte": min_spent}

    if tag:
        query["tags"] = tag

    cursor = repo.collection.find(query).sort("totalSpent", -1)
    docs = await cursor.to_list(length=1000)

    exports = []
    for d in docs:
        exports.append(CustomerMarketingExport(
            id=str(d["_id"]),
            name=d["name"],
            phone=d.get("phone"),
            email=d.get("email"),
            totalSpent=d.get("totalSpent", 0.0),
            totalVisits=d.get("totalVisits", 0),
            lastPurchaseDate=d.get("lastPurchaseDate"),
            tags=d.get("tags", []),
            marketingConsent=d.get("marketingConsent", True)
        ))

    return exports

@router.get("/{customer_id}", response_model=CustomerResponse)
async def get_customer(
    customer_id: str,
    business_id: str = Depends(get_current_business_id)
):
    db = await get_tenant_db(business_id)
    repo = BaseTenantRepository(db, "customers")
    doc = await repo.get_by_id(business_id, customer_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Customer not found in current store")
    doc["_id"] = str(doc["_id"])
    doc["businessId"] = str(doc["businessId"])
    return CustomerResponse(**doc)

@router.put("/{customer_id}", response_model=CustomerResponse)
async def update_customer(
    customer_id: str,
    payload: CustomerUpdate,
    business_id: str = Depends(get_current_business_id)
):
    db = await get_tenant_db(business_id)
    repo = BaseTenantRepository(db, "customers")
    existing = await repo.get_by_id(business_id, customer_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Customer not found in current store")

    update_data = payload.model_dump(exclude_unset=True, by_alias=True)
    if update_data:
        update_data["updatedAt"] = datetime.now(timezone.utc)
        await repo.update_by_id(business_id, customer_id, update_data)
        existing = await repo.get_by_id(business_id, customer_id)

    existing["_id"] = str(existing["_id"])
    existing["businessId"] = str(existing["businessId"])
    return CustomerResponse(**existing)

@router.delete("/{customer_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_customer(
    customer_id: str,
    business_id: str = Depends(get_current_business_id)
):
    db = await get_tenant_db(business_id)
    repo = BaseTenantRepository(db, "customers")
    existing = await repo.get_by_id(business_id, customer_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Customer not found in current store")
    await repo.delete_by_id(business_id, customer_id)
    return None
