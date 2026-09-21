from datetime import datetime, timezone
from typing import Optional
from bson import ObjectId
from fastapi import APIRouter, Depends, Query, status
from app.core.database import get_database
from app.core.security import get_current_business_id
from app.schemas.common import PaginatedResponse
from app.schemas.expense import ExpenseCreate, ExpenseResponse
from app.repositories.base_repository import BaseTenantRepository

router = APIRouter(prefix="/expenses", tags=["Expenses"])

@router.get("", response_model=PaginatedResponse[ExpenseResponse])
async def list_expenses(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    category: Optional[str] = None,
    business_id: str = Depends(get_current_business_id),
    db = Depends(get_database)
):
    repo = BaseTenantRepository(db, "expenses")
    query = {}
    if category:
        query["category"] = category

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
    business_id: str = Depends(get_current_business_id),
    db = Depends(get_database)
):
    repo = BaseTenantRepository(db, "expenses")
    now = datetime.now(timezone.utc)
    doc = {
        "businessId": ObjectId(business_id),
        "category": payload.category,
        "amount": float(payload.amount),
        "payee": payload.payee,
        "paymentMode": payload.payment_mode,
        "description": payload.description,
        "expenseDate": payload.expense_date or now,
        "createdAt": now
    }

    doc_id = await repo.insert(business_id, doc)
    doc["_id"] = doc_id
    doc["businessId"] = business_id
    return ExpenseResponse(**doc)
