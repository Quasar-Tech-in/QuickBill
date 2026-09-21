from typing import Optional
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, status
from app.core.database import get_database
from app.core.security import get_current_user, get_current_business_id, TokenPayload
from app.schemas.common import PaginatedResponse
from app.schemas.sale import SaleCreateRequest, SaleResponse
from app.services.sale_service import SaleService

router = APIRouter(prefix="/sales", tags=["Sales & Billing"])

@router.get("", response_model=PaginatedResponse[SaleResponse])
async def list_sales(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    business_id: str = Depends(get_current_business_id),
    db = Depends(get_database)
):
    b_oid = ObjectId(business_id) if ObjectId.is_valid(business_id) else ObjectId()
    skip = (page - 1) * page_size
    total = await db.invoices.count_documents({"businessId": b_oid})
    cursor = db.invoices.find({"businessId": b_oid}).sort("createdAt", -1).skip(skip).limit(page_size)
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

@router.post("", response_model=SaleResponse, status_code=status.HTTP_201_CREATED)
async def create_sale(
    payload: SaleCreateRequest,
    user: TokenPayload = Depends(get_current_user),
    business_id: str = Depends(get_current_business_id),
    db = Depends(get_database)
):
    service = SaleService(db)
    doc = await service.create_sale(
        business_id=business_id,
        user_id=user.sub,
        request=payload
    )
    return SaleResponse(**doc)

@router.get("/{sale_id}", response_model=SaleResponse)
async def get_sale(
    sale_id: str,
    business_id: str = Depends(get_current_business_id),
    db = Depends(get_database)
):
    s_oid = ObjectId(sale_id) if ObjectId.is_valid(sale_id) else None
    b_oid = ObjectId(business_id) if ObjectId.is_valid(business_id) else None
    if not s_oid:
        raise HTTPException(status_code=404, detail="Sale invoice not found")
    
    doc = await db.invoices.find_one({"_id": s_oid, "businessId": b_oid})
    if not doc:
        raise HTTPException(status_code=404, detail="Sale invoice not found")
    
    doc["_id"] = str(doc["_id"])
    doc["businessId"] = str(doc["businessId"])
    if doc.get("partyId"):
        doc["partyId"] = str(doc["partyId"])
    return SaleResponse(**doc)
