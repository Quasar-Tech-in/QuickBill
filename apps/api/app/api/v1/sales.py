import re
import secrets
from datetime import datetime, timezone
from typing import Optional
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from app.core.database import get_tenant_db, db_manager
from app.core.security import get_current_user, get_current_business_id, enforce_active_store_operations, TokenPayload
from app.schemas.common import PaginatedResponse
from app.schemas.sale import SaleCreateRequest, SaleUpdateRequest, SaleResponse, AttachCustomerRequest
from app.services.sale_service import SaleService
from app.services.invoice_pdf_service import InvoicePdfService

router = APIRouter(prefix="/sales", tags=["Sales & Billing"])

@router.get("", response_model=PaginatedResponse[SaleResponse], response_model_by_alias=True)
async def list_sales(
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=200),
    search: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    location_id: Optional[str] = Query(None, alias="locationId"),
    from_date: Optional[str] = Query(None, alias="fromDate"),
    to_date: Optional[str] = Query(None, alias="toDate"),
    business_id: str = Depends(get_current_business_id),
):
    db = await get_tenant_db(business_id)
    b_oid = ObjectId(business_id) if ObjectId.is_valid(business_id) else ObjectId()
    skip = (page - 1) * page_size
    
    conditions: list = [{"$or": [{"businessId": b_oid}, {"businessId": business_id}]}]
    
    if location_id and location_id != "ALL":
        conditions.append({"locationId": location_id})

    if status and status != "ALL":
        if status == "RETURNS":
            conditions.append({
                "$or": [
                    {"hasReturns": True},
                    {"returnTotal": {"$gt": 0}}
                ]
            })
        else:
            conditions.append({"paymentStatus": status})

    if search and search.strip():
        s = search.strip()
        conditions.append({
            "$or": [
                {"invoiceNumber": {"$regex": s, "$options": "i"}},
                {"customerName": {"$regex": s, "$options": "i"}},
                {"customerPhone": {"$regex": s, "$options": "i"}},
                {"customerGstin": {"$regex": s, "$options": "i"}},
            ]
        })

    if from_date or to_date:
        from_dt = None
        to_dt = None
        if from_date:
            try:
                clean_from = from_date.split("T")[0]
                parts = [int(p) for p in clean_from.split("-")]
                from_dt = datetime(parts[0], parts[1], parts[2], 0, 0, 0, tzinfo=timezone.utc)
            except Exception:
                pass
        if to_date:
            try:
                clean_to = to_date.split("T")[0]
                parts = [int(p) for p in clean_to.split("-")]
                to_dt = datetime(parts[0], parts[1], parts[2], 23, 59, 59, 999999, tzinfo=timezone.utc)
            except Exception:
                pass

        created_dt_match: dict = {}
        created_str_match: dict = {}
        date_str_match: dict = {}

        if from_dt:
            created_dt_match["$gte"] = from_dt
        if to_dt:
            created_dt_match["$lte"] = to_dt

        if from_date:
            clean_f = from_date.split("T")[0]
            created_str_match["$gte"] = clean_f
            date_str_match["$gte"] = clean_f
        if to_date:
            clean_t = to_date.split("T")[0]
            created_str_match["$lte"] = f"{clean_t}T23:59:59.999Z"
            date_str_match["$lte"] = clean_t

        date_or = []
        if created_dt_match:
            date_or.append({"createdAt": created_dt_match})
        if created_str_match:
            date_or.append({"createdAt": created_str_match})
        if date_str_match:
            date_or.append({"date": date_str_match})

        if date_or:
            conditions.append({"$or": date_or})

    query = {"$and": conditions}

    total = await db.invoices.count_documents(query)
    cursor = db.invoices.find(query).sort("createdAt", -1).skip(skip).limit(page_size)
    docs = await cursor.to_list(length=page_size)

    sales = []
    for d in docs:
        d["_id"] = str(d["_id"])
        d["businessId"] = str(d["businessId"])
        if d.get("partyId"):
            d["partyId"] = str(d["partyId"])
        sales.append(SaleResponse(**d))

    return PaginatedResponse(
        data=sales,
        page=page,
        page_size=page_size,
        total=total,
        total_pages=(total + page_size - 1) // page_size if page_size else 1
    )

@router.post("", response_model=SaleResponse, status_code=status.HTTP_201_CREATED, response_model_by_alias=True)
async def create_sale(
    payload: SaleCreateRequest,
    user: TokenPayload = Depends(get_current_user),
    business_id: str = Depends(enforce_active_store_operations),
):
    db = await get_tenant_db(business_id)
    service = SaleService(db)
    doc = await service.create_sale(
        business_id=business_id,
        user_id=user.sub,
        request=payload
    )
    return SaleResponse(**doc)

@router.get("/{sale_id}", response_model=SaleResponse, response_model_by_alias=True)
async def get_sale(
    sale_id: str,
    business_id: str = Depends(get_current_business_id),
):
    db = await get_tenant_db(business_id)
    s_oid = ObjectId(sale_id) if ObjectId.is_valid(sale_id) else None
    b_oid = ObjectId(business_id) if ObjectId.is_valid(business_id) else None
    if not s_oid:
        raise HTTPException(status_code=404, detail="Sale invoice not found")
    
    doc = await db.invoices.find_one({"_id": s_oid, "$or": [{"businessId": b_oid}, {"businessId": business_id}]})
    if not doc:
        raise HTTPException(status_code=404, detail="Sale invoice not found")
    
    doc["_id"] = str(doc["_id"])
    doc["businessId"] = str(doc["businessId"])
    if doc.get("partyId"):
        doc["partyId"] = str(doc["partyId"])
    return SaleResponse(**doc)

@router.put("/{sale_id}", response_model=SaleResponse, response_model_by_alias=True)
async def update_sale_return(
    sale_id: str,
    payload: SaleUpdateRequest,
    user: TokenPayload = Depends(get_current_user),
    business_id: str = Depends(enforce_active_store_operations),
):
    db = await get_tenant_db(business_id)
    service = SaleService(db)
    doc = await service.update_sale_return(
        business_id=business_id,
        sale_id=sale_id,
        user_id=user.sub,
        request=payload
    )
    return SaleResponse(**doc)

@router.post("/{sale_id}/attach-customer", response_model=SaleResponse, response_model_by_alias=True)
async def attach_customer_to_sale(
    sale_id: str,
    payload: AttachCustomerRequest,
    business_id: str = Depends(get_current_business_id),
):
    """
    Attaches a customer phone number to an invoice before sharing to WhatsApp.
    1. Normalizes phone number.
    2. Searches for existing customer under the business.
    3. If found: links customer to sale, updates visits/spent.
    4. If not found: registers new customer in 'customers' collection.
    5. Updates sale document (customerId, customerName, customerPhone, partyId, partyNameSnapshot, partyPhoneSnapshot).
    6. Ensures 256-bit unguessable shareToken is generated.
    7. Returns updated SaleResponse.
    """
    db = await get_tenant_db(business_id)
    s_oid = ObjectId(sale_id) if ObjectId.is_valid(sale_id) else None
    b_oid = ObjectId(business_id) if ObjectId.is_valid(business_id) else ObjectId()
    if not s_oid:
        raise HTTPException(status_code=404, detail="Sale invoice not found")

    b_filter = {"$or": [{"businessId": b_oid}, {"businessId": business_id}]}
    invoice_doc = await db.invoices.find_one({"_id": s_oid, **b_filter})
    if not invoice_doc:
        raise HTTPException(status_code=404, detail="Sale invoice not found")

    clean_digits = re.sub(r"\D", "", payload.phone)
    if len(clean_digits) > 10 and clean_digits.startswith("91"):
        ten_digits = clean_digits[2:]
    elif len(clean_digits) > 10 and clean_digits.startswith("0"):
        ten_digits = clean_digits[1:]
    else:
        ten_digits = clean_digits[-10:] if len(clean_digits) >= 10 else clean_digits

    if len(ten_digits) != 10:
        raise HTTPException(status_code=400, detail="Invalid phone number: must be 10 digits")

    full_phone = f"+91{ten_digits}"
    spaced_phone = f"+91 {ten_digits[:5]} {ten_digits[5:]}"
    local_spaced = f"{ten_digits[:5]} {ten_digits[5:]}"

    phone_filter = {
        "$or": [
            {"phone": full_phone},
            {"phone": ten_digits},
            {"phone": spaced_phone},
            {"phone": local_spaced},
            {"phone": payload.phone.strip()},
            {"phone": {"$regex": rf"{ten_digits}$"}}
        ]
    }
    customer_query = {"$and": [b_filter, phone_filter]}

    now = datetime.now(timezone.utc)
    existing_customer = await db.customers.find_one(customer_query)
    if not existing_customer:
        existing_customer = await db.parties.find_one(customer_query)

    invoice_amount = float(invoice_doc.get("grandTotal") or 0.0)

    if existing_customer:
        cust_id = existing_customer["_id"]
        cust_name = existing_customer.get("name") or payload.name or f"Customer {ten_digits[-4:]}"
        await db.customers.update_one(
            {"_id": cust_id},
            {
                "$inc": {"totalVisits": 1, "totalSpent": invoice_amount},
                "$set": {"lastVisitDate": now, "updatedAt": now}
            }
        )
    else:
        cust_name = payload.name.strip() if (payload.name and payload.name.strip()) else f"Customer {ten_digits[-4:]}"
        new_customer_doc = {
            "businessId": b_oid,
            "name": cust_name,
            "phone": full_phone,
            "email": None,
            "tags": ["WALK_IN", "WHATSAPP_SHARED"],
            "totalSpent": invoice_amount,
            "totalVisits": 1,
            "lastVisitDate": now,
            "firstPurchaseDate": now,
            "createdAt": now,
            "updatedAt": now
        }
        res = await db.customers.insert_one(new_customer_doc)
        cust_id = res.inserted_id

    share_token = invoice_doc.get("shareToken")
    if not share_token:
        share_token = secrets.token_urlsafe(32)

    update_data = {
        "partyId": cust_id,
        "partyNameSnapshot": cust_name,
        "partyPhoneSnapshot": full_phone,
        "consumerName": cust_name,
        "consumerPhone": full_phone,
        "shareToken": share_token,
        "updatedAt": now
    }

    await db.invoices.update_one({"_id": s_oid}, {"$set": update_data})

    updated_doc = await db.invoices.find_one({"_id": s_oid})
    updated_doc["_id"] = str(updated_doc["_id"])
    updated_doc["businessId"] = str(updated_doc["businessId"])
    if updated_doc.get("partyId"):
        updated_doc["partyId"] = str(updated_doc["partyId"])

    return SaleResponse(**updated_doc)

@router.get("/{sale_id}/share-token")
async def get_or_generate_share_token(
    sale_id: str,
    business_id: str = Depends(get_current_business_id),
):
    """
    Returns or lazily creates a 256-bit unguessable share token for this invoice.
    """
    db = await get_tenant_db(business_id)
    s_oid = ObjectId(sale_id) if ObjectId.is_valid(sale_id) else None
    b_oid = ObjectId(business_id) if ObjectId.is_valid(business_id) else ObjectId()
    if not s_oid:
        raise HTTPException(status_code=404, detail="Sale invoice not found")

    doc = await db.invoices.find_one({"_id": s_oid, "$or": [{"businessId": b_oid}, {"businessId": business_id}]})
    if not doc:
        raise HTTPException(status_code=404, detail="Sale invoice not found")

    token = doc.get("shareToken")
    if not token:
        token = secrets.token_urlsafe(32)
        await db.invoices.update_one({"_id": s_oid}, {"$set": {"shareToken": token}})

    return {"shareToken": token, "invoiceNumber": doc.get("invoiceNumber")}

@router.get("/{sale_id}/pdf")
async def get_authenticated_invoice_pdf(
    sale_id: str,
    format_type: str = Query("A4", pattern="^(A4|THERMAL)$"),
    business_id: str = Depends(get_current_business_id),
):
    """
    Generates and returns an official Tax Invoice PDF for an authenticated user.
    """
    db = await get_tenant_db(business_id)
    s_oid = ObjectId(sale_id) if ObjectId.is_valid(sale_id) else None
    b_oid = ObjectId(business_id) if ObjectId.is_valid(business_id) else ObjectId()
    if not s_oid:
        raise HTTPException(status_code=404, detail="Sale invoice not found")

    doc = await db.invoices.find_one({"_id": s_oid, "$or": [{"businessId": b_oid}, {"businessId": business_id}]})
    if not doc:
        raise HTTPException(status_code=404, detail="Sale invoice not found")

    primary = db_manager.get_primary_database()
    tenant = await primary.tenants.find_one({"$or": [{"_id": b_oid}, {"slug": str(business_id)}]})

    pdf_bytes = InvoicePdfService.generate_pdf(doc, tenant, format_type=format_type)
    inv_no = doc.get("invoiceNumber", "Invoice").replace(" ", "_")

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"inline; filename=Invoice_{inv_no}.pdf"
        }
    )
