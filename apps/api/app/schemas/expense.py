from decimal import Decimal
from typing import Optional
from datetime import datetime
from pydantic import Field
from app.schemas.common import BaseSchema

class ExpenseCreate(BaseSchema):
    category: str = Field(..., min_length=1, max_length=100)  # Rent, Salary, Electricity, Transport, etc.
    amount: Decimal = Field(..., gt=0)
    payee: Optional[str] = Field(None, max_length=200)
    payment_mode: str = Field(default="CASH")
    description: Optional[str] = None
    expense_date: Optional[datetime] = None

class ExpenseResponse(BaseSchema):
    id: str = Field(..., alias="_id")
    business_id: str = Field(..., alias="businessId")
    category: str
    amount: Decimal
    payee: Optional[str] = None
    payment_mode: str = Field(..., alias="paymentMode")
    description: Optional[str] = None
    expense_date: datetime = Field(..., alias="expenseDate")
    created_at: datetime = Field(..., alias="createdAt")
