from typing import List, Optional, Any
from datetime import datetime
from pydantic import BaseModel, Field

class PurchaseOrderItemCreate(BaseModel):
    itemId: Optional[str] = None
    item_id: Optional[str] = None
    itemName: Optional[str] = None
    item_name: Optional[str] = None
    name: Optional[str] = None
    sku: Optional[str] = None
    unit: Optional[str] = "pcs"
    orderedQuantity: Optional[float] = None
    ordered_qty: Optional[float] = None
    quantity: Optional[float] = None
    unitCost: Optional[float] = None
    unit_cost: Optional[float] = None
    unitPrice: Optional[float] = None
    unit_price: Optional[float] = None
    taxRate: Optional[float] = 0.0
    tax_rate: Optional[float] = 0.0
    totalCost: Optional[float] = 0.0
    total_cost: Optional[float] = 0.0
    updateMasterPurchasePrice: Optional[bool] = False
    update_item_purchase_price: Optional[bool] = False

class PurchaseOrderItemResponse(BaseModel):
    itemId: str
    itemName: str
    name: Optional[str] = None
    sku: Optional[str] = None
    unit: str = "pcs"
    orderedQuantity: float
    orderedQty: Optional[float] = None
    receivedQuantity: float = 0.0
    receivedQty: Optional[float] = None
    unitCost: float
    unitPrice: Optional[float] = None
    taxRate: float = 0.0
    taxAmount: Optional[float] = 0.0
    totalCost: float
    totalAmount: Optional[float] = None

class PurchaseReceiptItem(BaseModel):
    itemId: Optional[str] = None
    item_id: Optional[str] = None
    name: Optional[str] = None
    quantityReceived: Optional[float] = None
    quantity_received: Optional[float] = None
    qty: Optional[float] = None
    unitCost: Optional[float] = None
    unit_cost: Optional[float] = None

class PurchasePaymentInput(BaseModel):
    amountPaid: Optional[float] = 0.0
    amount_paid: Optional[float] = None
    amount: Optional[float] = None
    paymentMode: Optional[str] = "CASH"
    payment_mode: Optional[str] = None
    referenceNumber: Optional[str] = None
    reference_number: Optional[str] = None
    notes: Optional[str] = None

class ReceiveGoodsRequest(BaseModel):
    receiptNotes: Optional[str] = None
    receipt_notes: Optional[str] = None
    notes: Optional[str] = None
    receivedItems: Optional[List[PurchaseReceiptItem]] = None
    received_items: Optional[List[PurchaseReceiptItem]] = None
    items: Optional[List[PurchaseReceiptItem]] = None
    paymentDetails: Optional[PurchasePaymentInput] = None
    payment_details: Optional[PurchasePaymentInput] = None
    payment: Optional[PurchasePaymentInput] = None
    updateMasterPurchasePrice: Optional[bool] = False
    update_item_purchase_price: Optional[bool] = False

class CancelPORequest(BaseModel):
    cancellationReason: Optional[str] = None
    cancellation_reason: Optional[str] = None
    reason: Optional[str] = None

class RecordPOPaymentRequest(BaseModel):
    amount: float
    paymentMode: Optional[str] = "BANK_TRANSFER"
    payment_mode: Optional[str] = None
    referenceNumber: Optional[str] = None
    reference_number: Optional[str] = None
    notes: Optional[str] = None
    paidAt: Optional[str] = None
    paid_at: Optional[str] = None

class PurchaseOrderCreate(BaseModel):
    supplierId: Optional[str] = None
    supplier_id: Optional[str] = None
    supplierName: Optional[str] = None
    supplier_name: Optional[str] = None
    supplierPhone: Optional[str] = None
    supplier_phone: Optional[str] = None
    locationId: Optional[str] = None
    location_id: Optional[str] = None
    locationName: Optional[str] = None
    location_name: Optional[str] = None
    orderDate: Optional[str] = None
    order_date: Optional[str] = None
    expectedDeliveryDate: Optional[str] = None
    expected_delivery_date: Optional[str] = None
    notes: Optional[str] = None
    terms: Optional[str] = None
    items: List[PurchaseOrderItemCreate] = []
    status: Optional[str] = "ORDERED"

class PurchaseOrderUpdate(BaseModel):
    supplierId: Optional[str] = None
    supplierName: Optional[str] = None
    supplierPhone: Optional[str] = None
    locationId: Optional[str] = None
    locationName: Optional[str] = None
    orderDate: Optional[str] = None
    order_date: Optional[str] = None
    expectedDeliveryDate: Optional[str] = None
    notes: Optional[str] = None
    terms: Optional[str] = None
    items: Optional[List[PurchaseOrderItemCreate]] = None
    status: Optional[str] = None

class PurchaseReceiptHistoryRecord(BaseModel):
    receiptId: str
    receivedAt: str
    receivedByUserId: Optional[str] = None
    receivedByName: Optional[str] = None
    notes: Optional[str] = None
    items: List[Any] = []
    totalAmountReceived: float = 0.0
    amountPaid: float = 0.0
    paymentMode: Optional[str] = None
    referenceNumber: Optional[str] = None

class PurchaseOrderPaymentRecord(BaseModel):
    paymentId: Optional[str] = None
    paymentNumber: Optional[str] = None
    amount: float
    paymentMode: str = "BANK_TRANSFER"
    referenceNumber: Optional[str] = None
    notes: Optional[str] = None
    paidAt: str

class PurchaseOrderResponse(BaseModel):
    id: str
    poNumber: str
    businessId: str
    supplierId: str
    supplierName: str
    supplierPhone: Optional[str] = None
    locationId: str
    locationName: str
    status: str
    orderDate: Optional[str] = None
    expectedDeliveryDate: Optional[str] = None
    notes: Optional[str] = None
    terms: Optional[str] = None
    cancellationReason: Optional[str] = None
    items: List[PurchaseOrderItemResponse] = []
    subtotal: float = 0.0
    taxAmount: float = 0.0
    taxTotal: Optional[float] = None
    grandTotal: float = 0.0
    totalReceivedAmount: float = 0.0
    totalPaidAmount: float = 0.0
    balanceDue: float = 0.0
    paymentStatus: str = "UNPAID"
    receipts: List[PurchaseReceiptHistoryRecord] = []
    payments: List[PurchaseOrderPaymentRecord] = []
    createdByUserId: Optional[str] = None
    createdByName: Optional[str] = None
    createdAt: str
    updatedAt: Optional[str] = None
