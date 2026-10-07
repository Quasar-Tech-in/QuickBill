from datetime import datetime, timezone
from typing import Optional
from bson import ObjectId
from fastapi import APIRouter, Depends, Query, status
from app.core.database import get_tenant_db, get_database
from app.core.security import get_current_business_id
from app.schemas.common import PaginatedResponse
from app.schemas.payment import PaymentCreate, PaymentResponse
from app.repositories.base_repository import BaseTenantRepository

router = APIRouter(prefix="/payments", tags=["Payments In/Out"])

@router.get("", response_model=PaginatedResponse[PaymentResponse])
async def list_payments(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    direction: Optional[str] = None,
    party_id: Optional[str] = Query(None, alias="partyId"),
    search: Optional[str] = None,
    location_id: Optional[str] = Query(None, alias="locationId"),
    business_id: str = Depends(get_current_business_id),
):
    db = await get_tenant_db(business_id)
    repo = BaseTenantRepository(db, "payments")
    b_oid = repo._to_object_id(business_id)
    conditions: list = [{"$or": [{"businessId": b_oid}, {"businessId": business_id}]}]

    if direction and direction != "ALL":
        conditions.append({"$or": [{"direction": direction}, {"type": f"PAYMENT_{direction}"}]})

    if party_id and party_id != "ALL":
        p_queries = [{"partyId": party_id}]
        if ObjectId.is_valid(party_id):
            p_queries.append({"partyId": ObjectId(party_id)})
        conditions.append({"$or": p_queries})

    if location_id and location_id != "ALL":
        conditions.append({"locationId": location_id})

    if search and search.strip():
        s = search.strip()
        conditions.append({
            "$or": [
                {"paymentNumber": {"$regex": s, "$options": "i"}},
                {"partyName": {"$regex": s, "$options": "i"}},
                {"partyNameSnapshot": {"$regex": s, "$options": "i"}},
                {"referenceNumber": {"$regex": s, "$options": "i"}},
                {"notes": {"$regex": s, "$options": "i"}},
            ]
        })

    query = {"$and": conditions}

    docs, total = await repo.list_paginated(
        business_id=business_id,
        filter_query=query,
        page=page,
        page_size=page_size
    )

    payments = []
    for d in docs:
        d["_id"] = str(d["_id"])
        d["businessId"] = str(d["businessId"])
        if d.get("partyId"):
            d["partyId"] = str(d["partyId"])
        if d.get("invoiceId"):
            d["invoiceId"] = str(d["invoiceId"])
        if d.get("referenceId"):
            d["referenceId"] = str(d["referenceId"])
        if not d.get("direction") and d.get("type"):
            d["direction"] = "OUT" if "OUT" in d["type"] else "IN"
        payments.append(PaymentResponse(**d))


    return PaginatedResponse(
        data=payments,
        page=page,
        page_size=page_size,
        total=total,
        total_pages=(total + page_size - 1) // page_size if page_size else 1
    )

@router.post("", response_model=PaymentResponse, status_code=status.HTTP_201_CREATED)
async def create_payment(
    payload: PaymentCreate,
    business_id: str = Depends(get_current_business_id),
):
    db = await get_tenant_db(business_id)
    b_oid = ObjectId(business_id) if ObjectId.is_valid(business_id) else ObjectId()
    count = await db.payments.count_documents({"businessId": b_oid})
    payment_number = f"PAY-{datetime.now().year}-{count + 1:06d}"
    now = datetime.now(timezone.utc)

    party_oid = ObjectId(payload.party_id) if payload.party_id and ObjectId.is_valid(payload.party_id) else None
    invoice_oid = ObjectId(payload.invoice_id) if payload.invoice_id and ObjectId.is_valid(payload.invoice_id) else None

    party_name = None
    if party_oid:
        party = await db.parties.find_one({"_id": party_oid, "businessId": b_oid})
        if party:
            party_name = party.get("name")

    doc = {
        "businessId": b_oid,
        "paymentNumber": payment_number,
        "direction": payload.direction,
        "partyId": party_oid,
        "partyNameSnapshot": party_name,
        "invoiceId": invoice_oid,
        "invoiceNumber": None,
        "amount": float(payload.amount),
        "paymentMode": payload.payment_mode,
        "referenceNumber": payload.reference_number,
        "notes": payload.notes,
        "paidAt": payload.paid_at or now,
        "createdAt": now
    }

    res = await db.payments.insert_one(doc)
    
    # Adjust party balance if applicable
    if party_oid:
        if payload.direction == "IN":
            await db.parties.update_one(
                {"_id": party_oid, "businessId": b_oid},
                {"$inc": {"currentReceivable": -float(payload.amount)}}
            )
        else:
            await db.parties.update_one(
                {"_id": party_oid, "businessId": b_oid},
                {"$inc": {"currentPayable": -float(payload.amount)}}
            )

    doc["_id"] = str(res.inserted_id)
    doc["businessId"] = business_id
    if party_oid:
        doc["partyId"] = str(party_oid)
    if invoice_oid:
        doc["invoiceId"] = str(invoice_oid)
    return PaymentResponse(**doc)
