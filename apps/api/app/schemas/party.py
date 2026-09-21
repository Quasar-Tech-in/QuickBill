from decimal import Decimal
from typing import Optional, List
from datetime import datetime
from pydantic import Field
from app.schemas.common import BaseSchema

class PartyBase(BaseSchema):
    name: str = Field(..., min_length=1, max_length=200)
    phone: Optional[str] = Field(None, max_length=20)
    email: Optional[str] = Field(None, max_length=150)
    type: List[str] = Field(default=["customer"])  # "customer", "supplier"
    tax_id: Optional[str] = Field(None, max_length=50)  # GSTIN / VAT
    billing_address: Optional[dict] = None
    shipping_address: Optional[dict] = None
    credit_limit: Optional[Decimal] = None
    notes: Optional[str] = None

class PartyCreate(PartyBase):
    opening_balance: Decimal = Field(default=Decimal("0.00"))

class PartyUpdate(BaseSchema):
    name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    type: Optional[List[str]] = None
    tax_id: Optional[str] = None
    billing_address: Optional[dict] = None
    shipping_address: Optional[dict] = None
    credit_limit: Optional[Decimal] = None
    notes: Optional[str] = None

class PartyResponse(PartyBase):
    id: str = Field(..., alias="_id")
    business_id: str = Field(..., alias="businessId")
    opening_balance: Decimal = Field(..., alias="openingBalance")
    current_receivable: Decimal = Field(default=Decimal("0.00"), alias="currentReceivable")
    current_payable: Decimal = Field(default=Decimal("0.00"), alias="currentPayable")
    created_at: datetime = Field(..., alias="createdAt")
