from decimal import Decimal
from typing import List, Optional, Any, Dict
from datetime import datetime
from pydantic import Field
from app.schemas.common import BaseSchema

class StagedOrderCartItem(BaseSchema):
    item: Dict[str, Any]
    quantity: Decimal = Field(default=Decimal("1.0"), gt=0)
    unit_price: Decimal = Field(..., ge=0, alias="unitPrice")
    discount_percent: Decimal = Field(default=Decimal("0.00"), ge=0, le=100, alias="discountPercent")
    discount_type: Optional[str] = Field(None, alias="discountType")
    discount_value: Optional[Decimal] = Field(None, alias="discountValue")
    tax_rate: Decimal = Field(default=Decimal("0.00"), ge=0, le=100, alias="taxRate")
    line_total: Decimal = Field(..., ge=0, alias="lineTotal")
    allow_parts: Optional[bool] = Field(None, alias="allowParts")

class StagedOrderCreateRequest(BaseSchema):
    id: Optional[str] = None
    label: str = Field(..., min_length=1, max_length=150)
    location_id: Optional[str] = Field(None, alias="locationId")
    location_name: Optional[str] = Field(None, alias="locationName")
    customer_name: Optional[str] = Field(None, alias="customerName")
    customer_phone: Optional[str] = Field(None, alias="customerPhone")
    party_id: Optional[str] = Field(None, alias="partyId")
    cart: List[Dict[str, Any]] = Field(default_factory=list)
    order_discount_type: Optional[str] = Field(None, alias="orderDiscountType")
    order_discount_value: Optional[str] = Field(None, alias="orderDiscountValue")
    payment_mode: Optional[str] = Field(None, alias="paymentMode")
    subtotal: Optional[float] = None
    tax_total: Optional[float] = Field(None, alias="taxTotal")
    grand_total: Optional[float] = Field(None, alias="grandTotal")
    notes: Optional[str] = None

class StagedOrderUpdateRequest(BaseSchema):
    label: Optional[str] = Field(None, min_length=1, max_length=150)
    location_id: Optional[str] = Field(None, alias="locationId")
    location_name: Optional[str] = Field(None, alias="locationName")
    customer_name: Optional[str] = Field(None, alias="customerName")
    customer_phone: Optional[str] = Field(None, alias="customerPhone")
    party_id: Optional[str] = Field(None, alias="partyId")
    cart: Optional[List[Dict[str, Any]]] = None
    order_discount_type: Optional[str] = Field(None, alias="orderDiscountType")
    order_discount_value: Optional[str] = Field(None, alias="orderDiscountValue")
    payment_mode: Optional[str] = Field(None, alias="paymentMode")
    subtotal: Optional[float] = None
    tax_total: Optional[float] = Field(None, alias="taxTotal")
    grand_total: Optional[float] = Field(None, alias="grandTotal")
    notes: Optional[str] = None

class StagedOrderResponse(BaseSchema):
    id: str = Field(..., alias="_id")
    business_id: str = Field(..., alias="businessId")
    location_id: Optional[str] = Field(None, alias="locationId")
    location_name: Optional[str] = Field(None, alias="locationName")
    label: str
    customer_name: Optional[str] = Field(None, alias="customerName")
    customer_phone: Optional[str] = Field(None, alias="customerPhone")
    party_id: Optional[str] = Field(None, alias="partyId")
    cart: List[Dict[str, Any]] = Field(default_factory=list)
    order_discount_type: Optional[str] = Field(None, alias="orderDiscountType")
    order_discount_value: Optional[str] = Field(None, alias="orderDiscountValue")
    payment_mode: Optional[str] = Field(None, alias="paymentMode")
    subtotal: Optional[float] = None
    tax_total: Optional[float] = Field(None, alias="taxTotal")
    grand_total: Optional[float] = Field(None, alias="grandTotal")
    notes: Optional[str] = None
    created_at: datetime = Field(..., alias="createdAt")
    updated_at: datetime = Field(..., alias="updatedAt")
    created_by_id: Optional[str] = Field(None, alias="createdById")
    created_by_name: Optional[str] = Field(None, alias="createdByName")
