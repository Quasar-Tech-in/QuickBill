from decimal import Decimal
from enum import Enum
from typing import Optional, List
from pydantic import Field
from app.schemas.common import BaseSchema

class LabelStyle(str, Enum):
    STANDARD = "STANDARD"
    JEWELRY_STRING_TAG = "JEWELRY_STRING_TAG"
    SHELF = "SHELF"
    SHIPPING = "SHIPPING"

class PaperSize(str, Enum):
    THERMAL_50x30 = "THERMAL_50x30"
    THERMAL_38x25 = "THERMAL_38x25"
    DUMBBELL_70x12 = "DUMBBELL_70x12"
    A4_GRID_24 = "A4_GRID_24"
    A4_GRID_40 = "A4_GRID_40"
    A4_GRID_65 = "A4_GRID_65"
    SHIPPING_4x6 = "SHIPPING_4x6"

class LabelPrintConfig(BaseSchema):
    item_id: Optional[str] = Field(None, alias="itemId")
    item_name: str = Field("Sample Item", max_length=200, alias="itemName")
    sku: Optional[str] = Field(None, max_length=100)
    barcode: Optional[str] = Field(None, max_length=100)
    public_item_id: Optional[str] = Field(None, alias="publicItemId")
    sale_price: Decimal = Field(default=Decimal("0.00"), ge=0, alias="salePrice")
    mrp: Optional[Decimal] = Field(None, ge=0)
    style: LabelStyle = Field(default=LabelStyle.STANDARD)
    paper_size: PaperSize = Field(default=PaperSize.THERMAL_50x30, alias="paperSize")
    quantity: int = Field(default=1, ge=1, le=1000)
    show_price: bool = Field(default=True, alias="showPrice")
    show_mrp: bool = Field(default=True, alias="showMrp")
    show_sku: bool = Field(default=True, alias="showSku")
    show_store_name: bool = Field(default=True, alias="showStoreName")
    store_name: Optional[str] = Field(default=None, alias="storeName")

class BatchLabelPrintRequest(BaseSchema):
    items: List[LabelPrintConfig]
    paper_size: PaperSize = Field(default=PaperSize.A4_GRID_24, alias="paperSize")
