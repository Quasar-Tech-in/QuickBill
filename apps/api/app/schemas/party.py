from decimal import Decimal
from typing import Optional, List, Union
from datetime import datetime
from pydantic import Field, field_validator
from app.schemas.common import BaseSchema

class PartyBase(BaseSchema):
    name: str = Field(..., min_length=1, max_length=200)
    phone: Optional[str] = Field(None, max_length=20)
    email: Optional[str] = Field(None, max_length=150)
    type: List[str] = Field(default=["customer"])  # ["customer"], ["supplier"]
    tax_id: Optional[str] = Field(None, max_length=50, alias="taxId")  # GSTIN / VAT
    billing_address: Optional[dict] = Field(None, alias="billingAddress")
    shipping_address: Optional[dict] = Field(None, alias="shippingAddress")
    credit_limit: Optional[Decimal] = Field(None, alias="creditLimit")
    notes: Optional[str] = None

    @field_validator("type", mode="before")
    @classmethod
    def normalize_type(cls, v):
        if isinstance(v, str):
            return [v]
        return v

class PartyCreate(PartyBase):
    opening_balance: Decimal = Field(default=Decimal("0.00"), alias="openingBalance")

class PartyUpdate(BaseSchema):
    name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    type: Optional[List[str]] = None
    tax_id: Optional[str] = Field(None, alias="taxId")
    billing_address: Optional[dict] = Field(None, alias="billingAddress")
    shipping_address: Optional[dict] = Field(None, alias="shippingAddress")
    credit_limit: Optional[Decimal] = Field(None, alias="creditLimit")
    notes: Optional[str] = None

    @field_validator("type", mode="before")
    @classmethod
    def normalize_type(cls, v):
        if isinstance(v, str):
            return [v]
        return v

class PartyResponse(PartyBase):
    id: str = Field(..., alias="_id")
    business_id: str = Field(..., alias="businessId")
    opening_balance: Decimal = Field(..., alias="openingBalance")
    current_receivable: Decimal = Field(default=Decimal("0.00"), alias="currentReceivable")
    current_payable: Decimal = Field(default=Decimal("0.00"), alias="currentPayable")
    created_at: datetime = Field(..., alias="createdAt")

