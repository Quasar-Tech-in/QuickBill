from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import Field
from app.core.security import get_current_business_id
from app.schemas.common import BaseSchema

router = APIRouter(prefix="/shipping", tags=["Shipping & Dispatch"])

class ShippingItemChecklist(BaseSchema):
    item_id: str = Field(..., alias="itemId")
    name: str
    sku: Optional[str] = None
    barcode: Optional[str] = None
    public_item_id: Optional[str] = Field(None, alias="publicItemId")
    quantity_required: int = Field(..., alias="quantityRequired")
    quantity_scanned: int = Field(default=0, alias="quantityScanned")
    is_verified: bool = Field(default=False, alias="isVerified")

class ShippingOrderDetails(BaseSchema):
    order_id: str = Field(..., alias="orderId")
    shipping_barcode: str = Field(..., alias="shippingBarcode")
    customer_name: str = Field(..., alias="customerName")
    customer_address: str = Field(..., alias="customerAddress")
    shipping_status: str = Field(default="PENDING_PACKING", alias="shippingStatus")
    items: List[ShippingItemChecklist]

class VerifyItemScanRequest(BaseSchema):
    scanned_code: str = Field(..., alias="scannedCode")

class VerifyItemScanResponse(BaseSchema):
    success: bool
    message: str
    order: ShippingOrderDetails

# Mock in-memory demo repository for shipping orders
MOCK_SHIPPING_ORDERS = {
    "ORD-9842": {
        "orderId": "ORD-9842",
        "shippingBarcode": "SHIP:ORD-9842",
        "customerName": "Aarav Sharma",
        "customerAddress": "45 Indiranagar 10th Main, Bengaluru - 560038",
        "shippingStatus": "PENDING_PACKING",
        "items": [
            {
                "itemId": "itm_rice",
                "name": "Basmati Rice 5kg",
                "sku": "SKU-RICE-5",
                "barcode": "ITEM:ITM-1001",
                "publicItemId": "ITM-1001",
                "quantityRequired": 1,
                "quantityScanned": 0,
                "isVerified": False
            },
            {
                "itemId": "itm_oil",
                "name": "Sunflower Oil 1L",
                "sku": "SKU-OIL-1",
                "barcode": "ITEM:ITM-1002",
                "publicItemId": "ITM-1002",
                "quantityRequired": 2,
                "quantityScanned": 0,
                "isVerified": False
            }
        ]
    }
}

@router.get("/orders/lookup/{barcode_payload}", response_model=ShippingOrderDetails)
async def lookup_shipping_order(
    barcode_payload: str,
    business_id: str = Depends(get_current_business_id),
):
    """
    Looks up shipping order packing details from scanned package shipping label (`SHIP:<order_id>`).
    """
    clean_code = barcode_payload.strip()
    if clean_code.startswith("SHIP:"):
        order_id = clean_code.replace("SHIP:", "").strip()
    else:
        order_id = clean_code

    if order_id not in MOCK_SHIPPING_ORDERS:
        # Fallback dynamic generator for any order ID requested
        return ShippingOrderDetails(
            orderId=order_id,
            shippingBarcode=f"SHIP:{order_id}",
            customerName="Customer " + order_id,
            customerAddress="Shipping Address for Order " + order_id,
            shippingStatus="PENDING_PACKING",
            items=[
                ShippingItemChecklist(
                    itemId="itm_1001",
                    name="Basmati Rice 5kg",
                    sku="SKU-RICE-5",
                    barcode="ITEM:ITM-1001",
                    publicItemId="ITM-1001",
                    quantityRequired=1,
                    quantityScanned=0,
                    isVerified=False
                )
            ]
        )

    data = MOCK_SHIPPING_ORDERS[order_id]
    return ShippingOrderDetails(**data)

@router.post("/orders/{order_id}/verify-item", response_model=VerifyItemScanResponse)
async def verify_shipping_item_scan(
    order_id: str,
    payload: VerifyItemScanRequest,
    business_id: str = Depends(get_current_business_id),
):
    """
    Verifies a scanned product barcode during box packing.
    """
    clean_code = payload.scanned_code.strip()
    
    # Retrieve order
    order_data = MOCK_SHIPPING_ORDERS.get(order_id)
    if not order_data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Shipping order {order_id} not found."
        )

    matched = False
    for item in order_data["items"]:
        # Match by ITEM:publicId, SKU, or raw barcode
        if (
            clean_code == item["barcode"] or 
            clean_code == f"ITEM:{item['publicItemId']}" or 
            clean_code == item["sku"] or
            clean_code == item["publicItemId"]
        ):
            matched = True
            if item["quantityScanned"] < item["quantityRequired"]:
                item["quantityScanned"] += 1
                if item["quantityScanned"] == item["quantityRequired"]:
                    item["isVerified"] = True
                break

    if not matched:
        return VerifyItemScanResponse(
            success=False,
            message=f"Barcode '{clean_code}' does not belong to order {order_id}!",
            order=ShippingOrderDetails(**order_data)
        )

    # Check if all items verified
    all_done = all(it["isVerified"] for it in order_data["items"])
    if all_done:
        order_data["shippingStatus"] = "PACKING_VERIFIED"

    return VerifyItemScanResponse(
        success=True,
        message="Item verified in package!" if not all_done else "All items verified! Box ready to seal.",
        order=ShippingOrderDetails(**order_data)
    )

@router.post("/orders/{order_id}/dispatch")
async def dispatch_shipping_order(
    order_id: str,
    business_id: str = Depends(get_current_business_id),
):
    """
    Marks box as dispatched/shipped to courier.
    """
    if order_id in MOCK_SHIPPING_ORDERS:
        MOCK_SHIPPING_ORDERS[order_id]["shippingStatus"] = "DISPATCHED"

    return {
        "status": "DISPATCHED",
        "orderId": order_id,
        "message": f"Order {order_id} marked as SHIPPED to courier."
    }
