from decimal import Decimal
from typing import Optional, List
from datetime import datetime
from pydantic import Field
from app.schemas.common import BaseSchema

class CustomerBase(BaseSchema):
    name: str = Field(..., min_length=1, max_length=200)
    phone: Optional[str] = Field(None, max_length=25)
    email: Optional[str] = Field(None, max_length=150)
    address: Optional[str] = None
    gstin: Optional[str] = Field(None, max_length=50)
    notes: Optional[str] = None
    tags: List[str] = Field(default_factory=list)  # e.g. ["VIP", "Regular", "Wholesale"]
    marketing_consent: bool = Field(default=True, alias="marketingConsent")
    location_ids: List[str] = Field(default_factory=list, alias="locationIds")

class CustomerCreate(CustomerBase):
    opening_balance: Decimal = Field(default=Decimal("0.00"), alias="openingBalance")

class CustomerUpdate(BaseSchema):
    name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    gstin: Optional[str] = None
    notes: Optional[str] = None
    tags: Optional[List[str]] = None
    marketing_consent: Optional[bool] = Field(None, alias="marketingConsent")
    location_ids: Optional[List[str]] = Field(None, alias="locationIds")

class CustomerResponse(CustomerBase):
    id: str = Field(..., alias="_id")
    business_id: str = Field(..., alias="businessId")
    opening_balance: Decimal = Field(default=Decimal("0.00"), alias="openingBalance")
    current_balance: Decimal = Field(default=Decimal("0.00"), alias="currentBalance")
    total_spent: Decimal = Field(default=Decimal("0.00"), alias="totalSpent")
    total_visits: int = Field(default=0, alias="totalVisits")
    last_purchase_date: Optional[datetime] = Field(None, alias="lastPurchaseDate")
    created_at: Optional[datetime] = Field(None, alias="createdAt")

class CustomerMarketingExport(BaseSchema):
    id: str
    name: str
    phone: Optional[str] = None
    email: Optional[str] = None
    total_spent: Decimal = Field(alias="totalSpent")
    total_visits: int = Field(alias="totalVisits")
    last_purchase_date: Optional[datetime] = Field(None, alias="lastPurchaseDate")
    tags: List[str]
    marketing_consent: bool = Field(alias="marketingConsent")
