import secrets
from datetime import datetime, timezone
from typing import Optional
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, status
from app.core.database import get_database
from app.core.security import get_current_business_id
from app.schemas.common import PaginatedResponse
from app.schemas.item import ItemCreate, ItemUpdate, ItemResponse
from app.repositories.item_repository import ItemRepository

router = APIRouter(prefix="/items", tags=["Items"])

@router.get("", response_model=PaginatedResponse[ItemResponse])
async def list_items(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: Optional[str] = None,
    business_id: str = Depends(get_current_business_id),
    db = Depends(get_database)
):
    repo = ItemRepository(db)
    query = {"isActive": True}
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"sku": {"$regex": search, "$options": "i"}},
            {"publicItemId": {"$regex": search, "$options": "i"}}
        ]
    
    docs, total = await repo.list_paginated(
        business_id=business_id,
        filter_query=query,
        page=page,
        page_size=page_size
    )

    items = []
    for d in docs:
        d["_id"] = str(d["_id"])
        d["businessId"] = str(d["businessId"])
        items.append(ItemResponse(**d))

    return PaginatedResponse(
        data=items,
        page=page,
        page_size=page_size,
        total=total,
        total_pages=(total + page_size - 1) // page_size if page_size else 1
    )

@router.post("", response_model=ItemResponse, status_code=status.HTTP_201_CREATED)
async def create_item(
    payload: ItemCreate,
    business_id: str = Depends(get_current_business_id),
    db = Depends(get_database)
):
    repo = ItemRepository(db)
    public_id = f"itm_{secrets.token_hex(6)}"
    now = datetime.now(timezone.utc)

    item_doc = {
        "businessId": ObjectId(business_id),
        "publicItemId": public_id,
        "name": payload.name,
        "sku": payload.sku,
        "unit": payload.unit,
        "purchasePrice": float(payload.purchase_price),
        "salePrice": float(payload.sale_price),
        "taxRate": float(payload.tax_rate),
        "categoryId": payload.category_id,
        "currentStock": payload.opening_stock,
        "minStockAlert": payload.min_stock_alert,
        "qrPayload": f"ITEM:{public_id}",
        "isActive": True,
        "createdAt": now,
        "updatedAt": now
    }

    doc_id = await repo.insert(business_id, item_doc)
    item_doc["_id"] = doc_id
    item_doc["businessId"] = business_id
    return ItemResponse(**item_doc)

@router.get("/lookup/qr/{public_item_id}", response_model=ItemResponse)
async def lookup_item_by_qr(
    public_item_id: str,
    business_id: str = Depends(get_current_business_id),
    db = Depends(get_database)
):
    repo = ItemRepository(db)
    item = await repo.find_by_public_id(business_id, public_item_id)
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Item not found in current business catalog."
        )
    item["_id"] = str(item["_id"])
    item["businessId"] = str(item["businessId"])
    return ItemResponse(**item)

@router.get("/{item_id}", response_model=ItemResponse)
async def get_item(
    item_id: str,
    business_id: str = Depends(get_current_business_id),
    db = Depends(get_database)
):
    repo = ItemRepository(db)
    item = await repo.get_by_id(business_id, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    item["_id"] = str(item["_id"])
    item["businessId"] = str(item["businessId"])
    return ItemResponse(**item)
