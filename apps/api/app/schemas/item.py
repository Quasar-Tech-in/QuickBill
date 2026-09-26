from decimal import Decimal
from typing import Optional, List
from datetime import datetime
from pydantic import Field
from app.schemas.common import BaseSchema

class LocationInventorySchema(BaseSchema):
    location_id: str = Field(..., alias="locationId")
    location_name: Optional[str] = Field(None, alias="locationName")
    mrp: Optional[Decimal] = Field(None, ge=0)
    sale_price: Decimal = Field(..., ge=0, alias="salePrice")
    purchase_price: Decimal = Field(default=Decimal("0.00"), ge=0, alias="purchasePrice")
    current_stock: Decimal = Field(default=Decimal("0.0"), alias="currentStock")
    min_stock_alert: Decimal = Field(default=Decimal("5.0"), ge=0, alias="minStockAlert")
    is_listed: bool = Field(default=True, alias="isListed")
    has_discount: bool = Field(default=False, alias="hasDiscount")
    discount_type: Optional[str] = Field(default="PERCENT", alias="discountType")
    discount_value: Optional[Decimal] = Field(default=Decimal("0.0"), ge=0, alias="discountValue")

class ItemImageSchema(BaseSchema):
    id: Optional[str] = None
    url: str
    order: int = 0
    is_primary: bool = Field(default=False, alias="isPrimary")
    name: Optional[str] = None
    size_bytes: Optional[int] = Field(None, alias="sizeBytes")
    original_size_bytes: Optional[int] = Field(None, alias="originalSizeBytes")

class ItemBase(BaseSchema):
    name: str = Field(..., min_length=1, max_length=200)
    sku: Optional[str] = Field(None, max_length=100)
    barcode: Optional[str] = Field(None, max_length=100)
    category: Optional[str] = Field(default="General", max_length=100)
    unit: str = Field(default="pcs", max_length=20)
    purchase_price: Decimal = Field(default=Decimal("0.00"), ge=0, alias="purchasePrice")
    sale_price: Decimal = Field(..., ge=0, alias="salePrice")
    mrp: Optional[Decimal] = Field(None, ge=0)
    tax_rate: Decimal = Field(default=Decimal("0.00"), ge=0, le=100, alias="taxRate")
    category_id: Optional[str] = Field(None, alias="categoryId")
    min_stock_alert: Decimal = Field(default=Decimal("5.0"), ge=0, alias="minStockAlert")
    allow_parts: bool = Field(default=False, alias="allowParts")
    description: Optional[str] = None
    has_discount: bool = Field(default=False, alias="hasDiscount")
    discount_type: Optional[str] = Field(default="PERCENT", alias="discountType")
    discount_value: Optional[Decimal] = Field(default=Decimal("0.0"), ge=0, alias="discountValue")
    locations: Optional[List[LocationInventorySchema]] = None
    images: Optional[List[ItemImageSchema]] = None
    image_url: Optional[str] = Field(None, alias="imageUrl")

class ItemCreate(ItemBase):
    opening_stock: Optional[Decimal] = Field(default=Decimal("0.0"), ge=0, alias="openingStock")
    current_stock: Optional[Decimal] = Field(default=None, alias="currentStock")

class ItemUpdate(BaseSchema):
    name: Optional[str] = None
    sku: Optional[str] = None
    barcode: Optional[str] = None
    category: Optional[str] = None
    unit: Optional[str] = None
    purchase_price: Optional[Decimal] = Field(None, alias="purchasePrice")
    sale_price: Optional[Decimal] = Field(None, alias="salePrice")
    mrp: Optional[Decimal] = Field(None, alias="mrp")
    tax_rate: Optional[Decimal] = Field(None, alias="taxRate")
    category_id: Optional[str] = Field(None, alias="categoryId")
    min_stock_alert: Optional[Decimal] = Field(None, alias="minStockAlert")
    allow_parts: Optional[bool] = Field(None, alias="allowParts")
    description: Optional[str] = None
    has_discount: Optional[bool] = Field(None, alias="hasDiscount")
    discount_type: Optional[str] = Field(None, alias="discountType")
    discount_value: Optional[Decimal] = Field(None, alias="discountValue")
    locations: Optional[List[LocationInventorySchema]] = None
    images: Optional[List[ItemImageSchema]] = None
    image_url: Optional[str] = Field(None, alias="imageUrl")
    is_active: Optional[bool] = Field(None, alias="isActive")
    current_stock: Optional[Decimal] = Field(None, alias="currentStock")

class StockAdjustmentRequest(BaseSchema):
    delta: Decimal = Field(...)
    location_id: Optional[str] = Field(None, alias="locationId")

class ItemResponse(ItemBase):
    id: str = Field(..., alias="_id")
    business_id: str = Field(..., alias="businessId")
    public_item_id: Optional[str] = Field(default="", alias="publicItemId")
    qr_payload: Optional[str] = Field(default="", alias="qrPayload")
    current_stock: Decimal = Field(default=Decimal("0.0"), alias="currentStock")
    is_active: bool = Field(default=True, alias="isActive")
    created_at: Optional[datetime] = Field(default=None, alias="createdAt")
    updated_at: Optional[datetime] = Field(None, alias="updatedAt")



