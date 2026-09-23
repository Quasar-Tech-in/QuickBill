from datetime import datetime, timezone
from typing import Optional
from bson import ObjectId
from fastapi import APIRouter, Depends, Query, status
from app.core.database import get_database
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
    business_id: str = Depends(get_current_business_id),
    db = Depends(get_database)
):
    repo = BaseTenantRepository(db, "payments")
    query = {}
    if direction:
        query["direction"] = direction

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
    db = Depends(get_database)
):
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
