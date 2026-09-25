from decimal import Decimal
from typing import Optional
from datetime import datetime
from pydantic import Field
from app.schemas.common import BaseSchema

class ExpenseCreate(BaseSchema):
    category: str = Field(..., min_length=1, max_length=100)  # Electricity Bill, Staff Salary, Rent, Custom, etc.
    amount: Decimal = Field(..., gt=0)
    payee: Optional[str] = Field(None, max_length=200)
    payment_mode: str = Field(default="CASH", alias="paymentMode")
    reference_number: Optional[str] = Field(None, alias="referenceNumber")
    description: Optional[str] = None
    location_id: Optional[str] = Field(None, alias="locationId")
    location_name: Optional[str] = Field(None, alias="locationName")
    expense_date: Optional[datetime] = Field(None, alias="expenseDate")

class ExpenseUpdate(BaseSchema):
    category: Optional[str] = Field(None, min_length=1, max_length=100)
    amount: Optional[Decimal] = Field(None, gt=0)
    payee: Optional[str] = Field(None, max_length=200)
    payment_mode: Optional[str] = Field(None, alias="paymentMode")
    reference_number: Optional[str] = Field(None, alias="referenceNumber")
    description: Optional[str] = None
    location_id: Optional[str] = Field(None, alias="locationId")
    location_name: Optional[str] = Field(None, alias="locationName")
    expense_date: Optional[datetime] = Field(None, alias="expenseDate")

class ExpenseResponse(BaseSchema):
    id: str = Field(..., alias="_id")
    business_id: str = Field(..., alias="businessId")
    category: str
    amount: Decimal
    payee: Optional[str] = None
    payment_mode: str = Field(..., alias="paymentMode")
    reference_number: Optional[str] = Field(None, alias="referenceNumber")
    description: Optional[str] = None
    location_id: Optional[str] = Field(None, alias="locationId")
    location_name: Optional[str] = Field(None, alias="locationName")
    expense_date: datetime = Field(..., alias="expenseDate")
    created_at: datetime = Field(..., alias="createdAt")
