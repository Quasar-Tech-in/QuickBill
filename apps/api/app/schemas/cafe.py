from enum import Enum
from typing import List, Optional, Any, Dict
from datetime import datetime
from pydantic import Field, BaseModel, model_validator
from app.schemas.common import BaseSchema

class BusinessPersona(str, Enum):
    RETAIL = "RETAIL"
    CAFE = "CAFE"
    HYBRID = "HYBRID"

class CafeConfig(BaseSchema):
    enable_qr_ordering: bool = Field(default=True, alias="enableQrOrdering")
    require_order_approval: bool = Field(default=True, alias="requireOrderApproval")
    auto_print_kot: bool = Field(default=True, alias="autoPrintKot")
    kot_printer_type: str = Field(default="THERMAL_80MM", alias="kotPrinterType")
    allow_customer_order_cancellation: bool = Field(default=False, alias="allowCustomerOrderCancellation")
    service_charge_percent: float = Field(default=0.0, alias="serviceChargePercent")
    sections: List[str] = Field(default=["Main Hall", "Indoor AC", "Outdoor Patio", "Terrace"])

class TenantSettings(BaseSchema):
    business_persona: BusinessPersona = Field(default=BusinessPersona.RETAIL, alias="businessPersona")
    cafe_config: Optional[CafeConfig] = Field(default=None, alias="cafeConfig")
    currency: str = "INR"
    currency_symbol: str = Field(default="₹", alias="currencySymbol")
    enable_round_off: bool = Field(default=True, alias="enableRoundOff")
    default_tax_rate: float = Field(default=5.0, alias="defaultTaxRate")

class TableCreate(BaseSchema):
    table_number: str = Field(..., min_length=1, max_length=50, alias="tableNumber")
    label: Optional[str] = None
    section: str = Field(default="Main Hall", max_length=100)
    seating_capacity: int = Field(default=4, ge=1, le=100, alias="seatingCapacity")
    location_id: Optional[str] = Field(default=None, alias="locationId")

class TableUpdate(BaseSchema):
    table_number: Optional[str] = Field(default=None, alias="tableNumber")
    label: Optional[str] = None
    section: Optional[str] = None
    seating_capacity: Optional[int] = Field(default=None, alias="seatingCapacity")
    current_status: Optional[str] = Field(default=None, alias="currentStatus")
    is_active: Optional[bool] = Field(default=None, alias="isActive")

class TableStatusUpdate(BaseSchema):
    status: str = Field(..., alias="status") # AVAILABLE | OCCUPIED | ORDERING | BILLING | CLEANING

class TableResponse(BaseSchema):
    id: str = Field(..., alias="_id")
    business_id: str = Field(..., alias="businessId")
    location_id: Optional[str] = Field(None, alias="locationId")
    table_number: str = Field(..., alias="tableNumber")
    label: str
    section: str = "Main Hall"
    seating_capacity: int = Field(default=4, alias="seatingCapacity")
    current_status: str = Field(default="AVAILABLE", alias="currentStatus")
    active_session_id: Optional[str] = Field(None, alias="activeSessionId")
    qr_code_url: Optional[str] = Field(None, alias="qrCodeUrl")
    qr_code_token: Optional[str] = Field(None, alias="qrCodeToken")
    is_active: bool = Field(default=True, alias="isActive")
    created_at: Optional[Any] = Field(None, alias="createdAt")
    updated_at: Optional[Any] = Field(None, alias="updatedAt")

class PublicOrderItem(BaseSchema):
    item_id: str = Field(..., alias="itemId")
    name: Optional[str] = None
    variant_id: Optional[str] = Field(None, alias="variantId")
    variant_name: Optional[str] = Field(None, alias="variantName")
    unit_price: float = Field(..., alias="unitPrice")
    quantity: float = Field(1.0, gt=0)
    notes: Optional[str] = None
    modifiers: Optional[List[Dict[str, Any]]] = None

class PublicOrderSubmitRequest(BaseSchema):
    table_id: str = Field(..., alias="tableId")
    qr_token: str = Field(..., alias="qrToken")
    customer_name: Optional[str] = Field(None, alias="customerName")
    customer_phone: Optional[str] = Field(None, alias="customerPhone")
    items: List[PublicOrderItem] = Field(..., min_length=1)
    notes: Optional[str] = None

    @model_validator(mode="before")
    @classmethod
    def normalize_qr_token(cls, data: Any) -> Any:
        if isinstance(data, dict):
            token_val = data.get("qrToken") or data.get("qr_token") or data.get("token")
            if token_val is not None:
                data["qrToken"] = token_val
                data["qr_token"] = token_val
        return data

class KOTItem(BaseSchema):
    item_id: str = Field(..., alias="itemId")
    name: str
    variant_name: Optional[str] = Field(None, alias="variantName")
    quantity: float
    notes: Optional[str] = None

class KOTResponse(BaseSchema):
    id: str = Field(..., alias="_id")
    business_id: str = Field(..., alias="businessId")
    location_id: Optional[str] = Field(None, alias="locationId")
    kot_number: str = Field(..., alias="kotNumber")
    session_id: str = Field(..., alias="sessionId")
    table_id: Optional[str] = Field(None, alias="tableId")
    table_number: str = Field(..., alias="tableNumber")
    round_number: int = Field(default=1, alias="roundNumber")
    order_source: str = Field(default="QR_CUSTOMER", alias="orderSource")
    kitchen_status: str = Field(default="QUEUED", alias="kitchenStatus")
    items: List[KOTItem] = []
    is_printed: bool = Field(default=False, alias="isPrinted")
    printed_at: Optional[Any] = Field(None, alias="printedAt")
    created_at: Any = Field(..., alias="createdAt")

class TableSessionOrder(BaseSchema):
    order_id: str = Field(..., alias="orderId")
    source: str = Field(default="QR_CUSTOMER", alias="source")
    placed_at: Any = Field(..., alias="placedAt")
    approval_status: str = Field(default="SUBMITTED", alias="approvalStatus")
    kot_id: Optional[str] = Field(None, alias="kotId")
    kot_number: Optional[str] = Field(None, alias="kotNumber")
    rejection_reason: Optional[str] = Field(None, alias="rejectionReason")
    items: List[Dict[str, Any]] = []

class TableSessionResponse(BaseSchema):
    id: str = Field(..., alias="_id")
    business_id: str = Field(..., alias="businessId")
    location_id: Optional[str] = Field(None, alias="locationId")
    table_id: str = Field(..., alias="tableId")
    table_number: str = Field(..., alias="tableNumber")
    session_status: str = Field(default="ACTIVE", alias="sessionStatus")
    guest_count: int = Field(default=1, alias="guestCount")
    customer_name: Optional[str] = Field(None, alias="customerName")
    customer_phone: Optional[str] = Field(None, alias="customerPhone")
    orders: List[TableSessionOrder] = []
    subtotal: float = 0.0
    tax_total: float = Field(default=0.0, alias="taxTotal")
    grand_total: float = Field(default=0.0, alias="grandTotal")
    opened_at: Any = Field(..., alias="openedAt")
    closed_at: Optional[Any] = Field(None, alias="closedAt")

class TableSettleRequest(BaseSchema):
    payment_mode: str = Field(default="CASH", alias="paymentMode")
    paid_amount: Optional[float] = Field(None, alias="paidAmount")
    discount_type: Optional[str] = Field(None, alias="discountType")
    discount_value: Optional[float] = Field(None, alias="discountValue")
    discount_amount: Optional[float] = Field(None, alias="discountAmount")
    customer_name: Optional[str] = Field(None, alias="customerName")
    customer_phone: Optional[str] = Field(None, alias="customerPhone")
    notes: Optional[str] = None

