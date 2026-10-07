from datetime import datetime, timezone
from typing import Optional
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, status
from app.core.database import get_tenant_db
from app.core.security import get_current_user, get_current_business_id, enforce_active_store_operations, TokenPayload
from app.schemas.common import PaginatedResponse
from app.schemas.sale import SaleCreateRequest, SaleUpdateRequest, SaleResponse
from app.services.sale_service import SaleService

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

