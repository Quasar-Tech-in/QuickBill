from datetime import datetime, timezone
from typing import List, Optional
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, status
from app.core.database import get_database
from app.core.security import get_current_business_id
from app.schemas.category import CategoryCreate, CategoryUpdate, CategoryResponse

router = APIRouter(prefix="/categories", tags=["Categories"])

@router.get("", response_model=List[CategoryResponse])
async def list_categories(
    search: Optional[str] = None,
    business_id: str = Depends(get_current_business_id),
    db = Depends(get_database)
):
    query = {"businessId": business_id}
    if search:
        query["name"] = {"$regex": search, "$options": "i"}

    cursor = db.categories.find(query).sort("name", 1)
    categories = []
    async for doc in cursor:
        doc["_id"] = str(doc["_id"])
        doc["businessId"] = str(doc["businessId"])
        categories.append(CategoryResponse(**doc))
    return categories

@router.post("", response_model=CategoryResponse, status_code=status.HTTP_201_CREATED)
async def create_category(
    payload: CategoryCreate,
    business_id: str = Depends(get_current_business_id),
    db = Depends(get_database)
):
    clean_name = payload.name.strip()
    existing = await db.categories.find_one({
        "businessId": business_id,
        "name": {"$regex": f"^{clean_name}$", "$options": "i"}
    })
    if existing:
        existing["_id"] = str(existing["_id"])
        existing["businessId"] = str(existing["businessId"])
        return CategoryResponse(**existing)

    now = datetime.now(timezone.utc)
    cat_doc = {
        "businessId": business_id,
        "name": clean_name,
        "description": payload.description.strip() if payload.description else None,
        "createdAt": now,
    }

    res = await db.categories.insert_one(cat_doc)
    cat_doc["_id"] = str(res.inserted_id)
    cat_doc["businessId"] = str(business_id)
    return CategoryResponse(**cat_doc)

@router.delete("/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_category(
    category_id: str,
    business_id: str = Depends(get_current_business_id),
    db = Depends(get_database)
):
    if not ObjectId.is_valid(category_id):
        raise HTTPException(status_code=400, detail="Invalid Category ID format.")

    res = await db.categories.delete_one({
        "_id": ObjectId(category_id),
        "businessId": business_id
    })
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Category not found.")
    return None
