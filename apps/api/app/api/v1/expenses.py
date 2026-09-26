from datetime import datetime, timezone
from typing import Optional
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, status
from app.core.database import get_tenant_db
from app.core.security import get_current_business_id
from app.schemas.common import PaginatedResponse
from app.schemas.expense import ExpenseCreate, ExpenseUpdate, ExpenseResponse
from app.repositories.base_repository import BaseTenantRepository

router = APIRouter(prefix="/expenses", tags=["Expenses"])

@router.get("", response_model=PaginatedResponse[ExpenseResponse])
async def list_expenses(
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=200),
    search: Optional[str] = None,
    category: Optional[str] = None,
    location_id: Optional[str] = Query(None, alias="locationId"),
    from_date: Optional[str] = Query(None, alias="fromDate"),
    to_date: Optional[str] = Query(None, alias="toDate"),
    business_id: str = Depends(get_current_business_id)
):
    db = await get_tenant_db(business_id)
    repo = BaseTenantRepository(db, "expenses")
    b_oid = repo._to_object_id(business_id)
    conditions: list = [{"$or": [{"businessId": b_oid}, {"businessId": business_id}]}]

    if category and category != "ALL":
        conditions.append({"category": category})

    if location_id and location_id != "ALL":
        conditions.append({"locationId": location_id})

    if search and search.strip():
        s = search.strip()
        conditions.append({
            "$or": [
                {"payee": {"$regex": s, "$options": "i"}},
                {"description": {"$regex": s, "$options": "i"}},
                {"referenceNumber": {"$regex": s, "$options": "i"}},
                {"category": {"$regex": s, "$options": "i"}},
            ]
        })

    if from_date or to_date:
        date_cond: dict = {}
        if from_date:
            date_cond["$gte"] = from_date
        if to_date:
            date_cond["$lte"] = f"{to_date}T23:59:59.999Z" if "T" not in to_date else to_date
        conditions.append({"$or": [{"createdAt": date_cond}, {"expenseDate": date_cond}]})

    query = {"$and": conditions}

    docs, total = await repo.list_paginated(
        business_id=business_id,
        filter_query=query,
        page=page,
        page_size=page_size
    )

    expenses = []
    for d in docs:
        d["_id"] = str(d["_id"])
        d["businessId"] = str(d["businessId"])
        expenses.append(ExpenseResponse(**d))

    return PaginatedResponse(
        data=expenses,
        page=page,
        page_size=page_size,
        total=total,
        total_pages=(total + page_size - 1) // page_size if page_size else 1
    )

@router.post("", response_model=ExpenseResponse, status_code=status.HTTP_201_CREATED)
async def create_expense(
    payload: ExpenseCreate,
    business_id: str = Depends(get_current_business_id)
):
    db = await get_tenant_db(business_id)
    repo = BaseTenantRepository(db, "expenses")
    now = datetime.now(timezone.utc)
    doc = {
        "businessId": ObjectId(business_id),
        "category": payload.category,
        "amount": float(payload.amount),
        "payee": payload.payee,
        "paymentMode": payload.payment_mode,
        "referenceNumber": payload.reference_number,
        "description": payload.description,
        "locationId": payload.location_id,
        "locationName": payload.location_name,
        "expenseDate": payload.expense_date or now,
        "createdAt": now
    }

    doc_id = await repo.insert(business_id, doc)
    doc["_id"] = doc_id
    doc["businessId"] = business_id
    return ExpenseResponse(**doc)

@router.put("/{expense_id}", response_model=ExpenseResponse)
async def update_expense(
    expense_id: str,
    payload: ExpenseUpdate,
    business_id: str = Depends(get_current_business_id)
):
    db = await get_tenant_db(business_id)
    repo = BaseTenantRepository(db, "expenses")
    existing = await repo.get_by_id(business_id, expense_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Expense record not found in current store")

    update_fields = {}
    if payload.category is not None:
        update_fields["category"] = payload.category
    if payload.amount is not None:
        update_fields["amount"] = float(payload.amount)
    if payload.payee is not None:
        update_fields["payee"] = payload.payee
    if payload.payment_mode is not None:
        update_fields["paymentMode"] = payload.payment_mode
    if payload.reference_number is not None:
        update_fields["referenceNumber"] = payload.reference_number
    if payload.description is not None:
        update_fields["description"] = payload.description
    if payload.location_id is not None:
        update_fields["locationId"] = payload.location_id
    if payload.location_name is not None:
        update_fields["locationName"] = payload.location_name
    if payload.expense_date is not None:
        update_fields["expenseDate"] = payload.expense_date

    if update_fields:
        update_fields["updatedAt"] = datetime.now(timezone.utc)
        await repo.update_by_id(business_id, expense_id, update_fields)

    updated_doc = await repo.get_by_id(business_id, expense_id)
    updated_doc["_id"] = str(updated_doc["_id"])
    updated_doc["businessId"] = str(updated_doc["businessId"])
    return ExpenseResponse(**updated_doc)

@router.delete("/{expense_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_expense(
    expense_id: str,
    business_id: str = Depends(get_current_business_id)
):
    db = await get_tenant_db(business_id)
    repo = BaseTenantRepository(db, "expenses")
    existing = await repo.get_by_id(business_id, expense_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Expense record not found in current store")
    await repo.delete_by_id(business_id, expense_id)
    return None
