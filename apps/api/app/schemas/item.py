from decimal import Decimal
from typing import Optional
from datetime import datetime
from pydantic import Field
from app.schemas.common import BaseSchema

class ItemBase(BaseSchema):
    name: str = Field(..., min_length=1, max_length=200)
    sku: Optional[str] = Field(None, max_length=100)
    unit: str = Field(default="pcs", max_length=20)
    purchase_price: Decimal = Field(default=Decimal("0.00"), ge=0)
    sale_price: Decimal = Field(..., ge=0)
    tax_rate: Decimal = Field(default=Decimal("0.00"), ge=0, le=100)
    category_id: Optional[str] = None
    min_stock_alert: int = Field(default=5, ge=0)

class ItemCreate(ItemBase):
    opening_stock: int = Field(default=0, ge=0)

class ItemUpdate(BaseSchema):
    name: Optional[str] = None
    sku: Optional[str] = None
    unit: Optional[str] = None
    purchase_price: Optional[Decimal] = None
    sale_price: Optional[Decimal] = None
    tax_rate: Optional[Decimal] = None
    category_id: Optional[str] = None
    min_stock_alert: Optional[int] = None
    is_active: Optional[bool] = None

class ItemResponse(ItemBase):
    id: str = Field(..., alias="_id")
    business_id: str = Field(..., alias="businessId")
    public_item_id: str = Field(..., alias="publicItemId")
    qr_payload: str = Field(..., alias="qrPayload")
    current_stock: int = Field(..., alias="currentStock")
    is_active: bool = Field(default=True, alias="isActive")
    created_at: datetime = Field(..., alias="createdAt")
    updated_at: Optional[datetime] = Field(None, alias="updatedAt")
