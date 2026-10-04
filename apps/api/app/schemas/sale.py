from decimal import Decimal
from typing import List, Optional
from datetime import datetime
from pydantic import Field
from app.schemas.common import BaseSchema

class SaleItemInput(BaseSchema):
    item_id: str
    quantity: Decimal = Field(..., gt=0)
    unit_price: Decimal = Field(..., ge=0)
    discount: Decimal = Field(default=Decimal("0.00"), ge=0)
    tax_rate: Decimal = Field(default=Decimal("0.00"), ge=0, le=100)

class SaleItemSnapshot(BaseSchema):
    item_id: str = Field(..., alias="itemId")
    name_snapshot: Optional[str] = Field(None, alias="nameSnapshot")
    name: Optional[str] = None
    sku_snapshot: Optional[str] = Field(None, alias="skuSnapshot")
    quantity: Decimal = Field(default=Decimal("1.0"))
    returned_quantity: Decimal = Field(default=Decimal("0.00"), alias="returnedQuantity")
    return_reason: Optional[str] = Field(None, alias="returnReason")  # RESTOCKABLE_RETURN, DEFECTIVE_DAMAGED, EXCHANGE, WRONG_ITEM
    return_note: Optional[str] = Field(None, alias="returnNote")
    return_date: Optional[datetime] = Field(None, alias="returnDate")
    return_status: Optional[str] = Field(None, alias="returnStatus")  # NONE, PARTIAL, FULL
    unit_price: Decimal = Field(..., alias="unitPrice")
    discount: Decimal = Field(default=Decimal("0.00"))
    taxable_amount: Optional[Decimal] = Field(default=None, alias="taxableAmount")
    tax_rate: Decimal = Field(default=Decimal("0.00"), alias="taxRate")
    tax_amount: Optional[Decimal] = Field(default=Decimal("0.00"), alias="taxAmount")
    line_total: Decimal = Field(..., alias="lineTotal")

class SaleCreateRequest(BaseSchema):
    party_id: Optional[str] = Field(None, alias="partyId")
    party_name_input: Optional[str] = Field(None, alias="partyNameInput")
    party_phone_input: Optional[str] = Field(None, alias="partyPhoneInput")
    consumer_name: Optional[str] = Field(None, alias="consumerName")
    consumer_phone: Optional[str] = Field(None, alias="consumerPhone")
    location_id: Optional[str] = Field(None, alias="locationId")
    location_name: Optional[str] = Field(None, alias="locationName")
    location_code: Optional[str] = Field(None, alias="locationCode")
    location_address: Optional[str] = Field(None, alias="locationAddress")
    location_phone: Optional[str] = Field(None, alias="locationPhone")
    location_gstin: Optional[str] = Field(None, alias="locationGstin")
    billed_by_id: Optional[str] = Field(None, alias="billedById")
    billed_by_name: Optional[str] = Field(None, alias="billedByName")
    billed_by_role: Optional[str] = Field(None, alias="billedByRole")
    items: List[SaleItemInput] = Field(..., min_length=1)
    invoice_discount: Decimal = Field(default=Decimal("0.00"), ge=0, alias="invoiceDiscount")
    discount_type: Optional[str] = Field(None, alias="discountType")
    discount_value: Optional[Decimal] = Field(None, alias="discountValue")
    additional_charges: Decimal = Field(default=Decimal("0.00"), ge=0, alias="additionalCharges")
    paid_amount: Decimal = Field(default=Decimal("0.00"), ge=0, alias="paidAmount")
    payment_mode: str = Field(default="CASH", alias="paymentMode")  # CASH, UPI, CARD, BANK
    payment_reference: Optional[str] = Field(None, alias="paymentReference")
    notes: Optional[str] = None
    enable_round_off: bool = Field(default=True, alias="enableRoundOff")

class SaleItemReturnInput(BaseSchema):
    item_id: str = Field(..., alias="itemId")
    quantity: Decimal = Field(..., ge=0)
    returned_quantity: Decimal = Field(default=Decimal("0.00"), ge=0, alias="returnedQuantity")
    return_reason: Optional[str] = Field(None, alias="returnReason")  # RESTOCKABLE_RETURN, DEFECTIVE_DAMAGED, EXCHANGE, WRONG_ITEM
    return_note: Optional[str] = Field(None, alias="returnNote")
    unit_price: Optional[Decimal] = Field(None, alias="unitPrice")
    discount: Optional[Decimal] = None
    tax_rate: Optional[Decimal] = Field(None, alias="taxRate")

class SaleUpdateRequest(BaseSchema):
    items: List[SaleItemReturnInput] = Field(..., min_length=1)
    invoice_discount: Optional[Decimal] = Field(None, ge=0, alias="invoiceDiscount")
    additional_charges: Optional[Decimal] = Field(None, ge=0, alias="additionalCharges")
    paid_amount: Optional[Decimal] = Field(None, ge=0, alias="paidAmount")
    payment_status: Optional[str] = Field(None, alias="paymentStatus")
    payment_mode: Optional[str] = Field(None, alias="paymentMode")
    notes: Optional[str] = None
    return_notes: Optional[str] = Field(None, alias="returnNotes")
    enable_round_off: bool = Field(default=True, alias="enableRoundOff")

class SaleResponse(BaseSchema):
    id: str = Field(..., alias="_id")
    business_id: str = Field(..., alias="businessId")
    invoice_number: str = Field(..., alias="invoiceNumber")
    party_id: Optional[str] = Field(None, alias="partyId")
    party_name_snapshot: Optional[str] = Field(None, alias="partyNameSnapshot")
    party_phone_snapshot: Optional[str] = Field(None, alias="partyPhoneSnapshot")
    consumer_name: Optional[str] = Field(None, alias="consumerName")
    consumer_phone: Optional[str] = Field(None, alias="consumerPhone")
    location_id: Optional[str] = Field(None, alias="locationId")
    location_name: Optional[str] = Field(None, alias="locationName")
    location_code: Optional[str] = Field(None, alias="locationCode")
    location_address: Optional[str] = Field(None, alias="locationAddress")
    location_phone: Optional[str] = Field(None, alias="locationPhone")
    location_gstin: Optional[str] = Field(None, alias="locationGstin")
    billed_by_id: Optional[str] = Field(None, alias="billedById")
    billed_by_name: Optional[str] = Field(None, alias="billedByName")
    billed_by_role: Optional[str] = Field(None, alias="billedByRole")
    status: str = "CONFIRMED"  # CONFIRMED, PARTIALLY_RETURNED, RETURNED, CANCELLED
    payment_status: Optional[str] = Field(default="PAID", alias="paymentStatus")  # PAID, PARTIAL, UNPAID, REFUNDED
    items: List[SaleItemSnapshot] = Field(default=[])
    subtotal: Decimal = Field(default=Decimal("0.00"))
    tax_total: Decimal = Field(default=Decimal("0.00"), alias="taxTotal")
    discount_total: Decimal = Field(default=Decimal("0.00"), alias="discountTotal")
    discount_type: Optional[str] = Field(None, alias="discountType")
    discount_value: Optional[Decimal] = Field(None, alias="discountValue")
    additional_charges: Decimal = Field(default=Decimal("0.00"), alias="additionalCharges")
    round_off: Decimal = Field(default=Decimal("0.00"), alias="roundOff")
    grand_total: Decimal = Field(default=Decimal("0.00"), alias="grandTotal")
    original_grand_total: Optional[Decimal] = Field(None, alias="originalGrandTotal")
    return_total: Optional[Decimal] = Field(default=Decimal("0.00"), alias="returnTotal")
    has_returns: Optional[bool] = Field(default=False, alias="hasReturns")
    return_status: Optional[str] = Field(default="NONE", alias="returnStatus")
    return_notes: Optional[str] = Field(None, alias="returnNotes")
    paid_amount: Decimal = Field(default=Decimal("0.00"), alias="paidAmount")
    balance_due: Decimal = Field(default=Decimal("0.00"), alias="balanceDue")
    payment_mode: Optional[str] = Field(default="CASH", alias="paymentMode")
    type: Optional[str] = "SALE"
    notes: Optional[str] = None
    created_at: Optional[datetime] = Field(default=None, alias="createdAt")
    updated_at: Optional[datetime] = Field(None, alias="updatedAt")

