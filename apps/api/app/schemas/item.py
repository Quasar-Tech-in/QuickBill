from decimal import Decimal
from typing import Optional
from datetime import datetime
from pydantic import Field
from app.schemas.common import BaseSchema

class ItemBase(BaseSchema):
    name: str = Field(..., min_length=1, max_length=200)
    sku: Optional[str] = Field(None, max_length=100)
    unit: str = Field(default="pcs", max_length=20)
    purchase_price: Decimal = Field(default=Decimal("0.00"), ge=0, alias="purchasePrice")
    sale_price: Decimal = Field(..., ge=0, alias="salePrice")
    tax_rate: Decimal = Field(default=Decimal("0.00"), ge=0, le=100, alias="taxRate")
    category_id: Optional[str] = Field(None, alias="categoryId")
    min_stock_alert: Decimal = Field(default=Decimal("5.0"), ge=0, alias="minStockAlert")
    allow_parts: bool = Field(default=False, alias="allowParts")

class ItemCreate(ItemBase):
    opening_stock: Decimal = Field(default=Decimal("0.0"), ge=0, alias="openingStock")

class ItemUpdate(BaseSchema):
    name: Optional[str] = None
    sku: Optional[str] = None
    unit: Optional[str] = None
    purchase_price: Optional[Decimal] = Field(None, alias="purchasePrice")
    sale_price: Optional[Decimal] = Field(None, alias="salePrice")
    tax_rate: Optional[Decimal] = Field(None, alias="taxRate")
    category_id: Optional[str] = Field(None, alias="categoryId")
    min_stock_alert: Optional[Decimal] = Field(None, alias="minStockAlert")
    allow_parts: Optional[bool] = Field(None, alias="allowParts")
    is_active: Optional[bool] = Field(None, alias="isActive")

class ItemResponse(ItemBase):
    id: str = Field(..., alias="_id")
    business_id: str = Field(..., alias="businessId")
    public_item_id: str = Field(..., alias="publicItemId")
    qr_payload: str = Field(..., alias="qrPayload")
    current_stock: Decimal = Field(..., alias="currentStock")
    is_active: bool = Field(default=True, alias="isActive")
    created_at: datetime = Field(..., alias="createdAt")
    updated_at: Optional[datetime] = Field(None, alias="updatedAt")


