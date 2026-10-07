from datetime import datetime
from decimal import Decimal
from enum import Enum
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field


class InventoryMovementType(str, Enum):
    PURCHASE = "PURCHASE"
    SALE = "SALE"
    SALE_RETURN = "SALE_RETURN"
    MANUAL_ADJUSTMENT = "MANUAL_ADJUSTMENT"
    DAMAGED_WRITE_OFF = "DAMAGED_WRITE_OFF"
    OPENING_STOCK = "OPENING_STOCK"
    PO_CANCEL = "PO_CANCEL"


class InventoryMovementResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True, from_attributes=True)

    id: str = Field(..., alias="_id")
    business_id: str = Field(..., alias="businessId")
    item_id: Optional[str] = Field("", alias="itemId")
    public_item_id: Optional[str] = Field(None, alias="publicItemId")
    item_name: Optional[str] = Field("Item", alias="itemName")
    sku: Optional[str] = None
    location_id: Optional[str] = Field(None, alias="locationId")
    location_name: Optional[str] = Field(None, alias="locationName")
    type: str = "MANUAL_ADJUSTMENT"
    reference_type: Optional[str] = Field(None, alias="referenceType")
    reference_id: Optional[str] = Field(None, alias="referenceId")
    reference_number: Optional[str] = Field(None, alias="referenceNumber")
    quantity_change: float = Field(0.0, alias="quantityChange")
    quantity_before: float = Field(0.0, alias="quantityBefore")
    quantity_after: float = Field(0.0, alias="quantityAfter")
    unit_cost: float = Field(0.0, alias="unitCost")
    total_cost: Optional[float] = Field(0.0, alias="totalCost")
    reason: Optional[str] = None
    notes: Optional[str] = None
    created_by_user_id: Optional[str] = Field(None, alias="createdByUserId")
    created_by_name: Optional[str] = Field(None, alias="createdByName")
    created_at: datetime = Field(..., alias="createdAt")

