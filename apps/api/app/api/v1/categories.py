from datetime import datetime, timezone
from typing import List, Optional
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, status
from app.core.database import get_tenant_db
from app.core.security import get_current_business_id
from app.schemas.category import CategoryCreate, CategoryUpdate, CategoryResponse
from app.repositories.base_repository import BaseTenantRepository

router = APIRouter(prefix="/categories", tags=["Categories"])

@router.get("", response_model=List[CategoryResponse])
async def list_categories(
    search: Optional[str] = None,
    category_type: Optional[str] = Query(None, alias="type"),
    business_id: str = Depends(get_current_business_id)
):
    db = await get_tenant_db(business_id)
    repo = BaseTenantRepository(db, "categories")

    query: dict = {
        "$and": [repo._biz_query(business_id)]
    }
    if category_type:
        query["type"] = category_type.upper()
    if search:
        query["name"] = {"$regex": search, "$options": "i"}

    cursor = repo.collection.find(query).sort("name", 1)
    categories = []
    async for doc in cursor:
        doc["_id"] = str(doc["_id"])
        doc["businessId"] = str(doc.get("businessId", business_id))
        doc["type"] = doc.get("type", "PRODUCT")
        categories.append(CategoryResponse(**doc))
    return categories

@router.post("", response_model=CategoryResponse, status_code=status.HTTP_201_CREATED)
async def create_category(
    payload: CategoryCreate,
    business_id: str = Depends(get_current_business_id)
):
    db = await get_tenant_db(business_id)
    repo = BaseTenantRepository(db, "categories")
    clean_name = payload.name.strip()
    c_type = (payload.type or "PRODUCT").upper()

    existing = await repo.collection.find_one({
        "$and": [
            repo._biz_query(business_id),
            {"name": {"$regex": f"^{clean_name}$", "$options": "i"}},
            {"type": c_type}
        ]
    })
    if existing:
        existing["_id"] = str(existing["_id"])
        existing["businessId"] = str(existing.get("businessId", business_id))
        existing["type"] = existing.get("type", c_type)
        return CategoryResponse(**existing)

    now = datetime.now(timezone.utc)
    cat_doc = {
        "name": clean_name,
        "type": c_type,
        "description": payload.description.strip() if payload.description else None,
        "createdAt": now,
        "updatedAt": now
    }

    doc_id = await repo.insert(business_id, cat_doc)
    cat_doc["_id"] = doc_id
    cat_doc["businessId"] = business_id
    return CategoryResponse(**cat_doc)

@router.put("/{category_id}", response_model=CategoryResponse)
async def update_category(
    category_id: str,
    payload: CategoryUpdate,
    business_id: str = Depends(get_current_business_id)
):
    db = await get_tenant_db(business_id)
    repo = BaseTenantRepository(db, "categories")
    existing = await repo.get_by_id(business_id, category_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Category not found in current store")

    update_fields: dict = {}
    if payload.name is not None and payload.name.strip():
        update_fields["name"] = payload.name.strip()
    if payload.type is not None and payload.type.strip():
        update_fields["type"] = payload.type.strip().upper()
    if payload.description is not None:
        update_fields["description"] = payload.description.strip() if payload.description else None

    if update_fields:
        update_fields["updatedAt"] = datetime.now(timezone.utc)
        await repo.update_by_id(business_id, category_id, update_fields)
        existing = await repo.get_by_id(business_id, category_id)

    existing["_id"] = str(existing["_id"])
    existing["businessId"] = str(existing.get("businessId", business_id))
    existing["type"] = existing.get("type", "PRODUCT")
    return CategoryResponse(**existing)

@router.delete("/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_category(
    category_id: str,
    business_id: str = Depends(get_current_business_id)
):
    db = await get_tenant_db(business_id)
    repo = BaseTenantRepository(db, "categories")
    existing = await repo.get_by_id(business_id, category_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Category not found in current store")

    await repo.delete_by_id(business_id, category_id)
    return None
