from decimal import Decimal
from typing import Optional
from datetime import datetime
from pydantic import Field
from app.schemas.common import BaseSchema

class PaymentCreate(BaseSchema):
    direction: str = Field(default="IN")  # IN (from customer) or OUT (to supplier)
    party_id: Optional[str] = None
    invoice_id: Optional[str] = None
    amount: Decimal = Field(..., gt=0)
    payment_mode: str = Field(default="CASH")  # CASH, UPI, CARD, BANK_TRANSFER, CHEQUE
    reference_number: Optional[str] = None
    account_id: Optional[str] = None
    notes: Optional[str] = None
    paid_at: Optional[datetime] = None

class PaymentResponse(BaseSchema):
    id: str = Field(..., alias="_id")
    business_id: str = Field(..., alias="businessId")
    payment_number: str = Field(..., alias="paymentNumber")
    direction: str = "IN"
    type: Optional[str] = None
    party_id: Optional[str] = Field(None, alias="partyId")
    party_name: Optional[str] = Field(None, alias="partyName")
    party_name_snapshot: Optional[str] = Field(None, alias="partyNameSnapshot")
    invoice_id: Optional[str] = Field(None, alias="invoiceId")
    invoice_number: Optional[str] = Field(None, alias="invoiceNumber")
    reference_type: Optional[str] = Field(None, alias="referenceType")
    reference_id: Optional[str] = Field(None, alias="referenceId")
    reference_number: Optional[str] = Field(None, alias="referenceNumber")
    amount: Decimal
    payment_mode: str = Field(..., alias="paymentMode")
    notes: Optional[str] = None
    paid_at: datetime = Field(..., alias="paidAt")
    created_at: datetime = Field(..., alias="createdAt")

