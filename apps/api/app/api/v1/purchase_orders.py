from typing import List, Optional
from datetime import datetime, timezone
import secrets
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, status
from app.core.database import get_database, get_tenant_db
from app.core.security import get_current_user, get_current_business_id, enforce_active_store_operations, TokenPayload
from app.schemas.common import PaginatedResponse
from app.schemas.purchase_orders import (
    PurchaseOrderCreate,
    PurchaseOrderUpdate,
    PurchaseOrderResponse,
    ReceiveGoodsRequest,
    CancelPORequest,
    RecordPOPaymentRequest,
    PurchaseReceiptHistoryRecord,
    PurchaseOrderPaymentRecord,
    PurchaseOrderItemResponse
)

router = APIRouter(prefix="/purchase-orders", tags=["Purchase Orders & Procurement"])


def _to_po_response(doc: dict) -> PurchaseOrderResponse:
    doc_id = str(doc.get("_id") or doc.get("id"))
    biz_id = str(doc.get("businessId", ""))
    
    items = []
    for item in doc.get("items", []):
        ord_qty = float(item.get("orderedQuantity", item.get("ordered_qty", item.get("quantity", 0.0))))
        rec_qty = float(item.get("receivedQuantity", item.get("received_qty", 0.0)))
        u_cost = float(item.get("unitCost", item.get("unit_cost", item.get("unitPrice", item.get("unit_price", 0.0)))))
        t_rate = float(item.get("taxRate", item.get("tax_rate", 0.0)))
        t_cost = float(item.get("totalCost", item.get("total_cost", item.get("totalAmount", 0.0))))
        itm_name = str(item.get("itemName", item.get("item_name", item.get("name", "Item"))))
        items.append(PurchaseOrderItemResponse(
            itemId=str(item.get("itemId", item.get("item_id", ""))),
            itemName=itm_name,
            name=itm_name,
            sku=item.get("sku"),
            unit=item.get("unit", "pcs"),
            orderedQuantity=ord_qty,
            orderedQty=ord_qty,
            receivedQuantity=rec_qty,
            receivedQty=rec_qty,
            unitCost=u_cost,
            unitPrice=u_cost,
            taxRate=t_rate,
            taxAmount=round(ord_qty * u_cost * (t_rate / 100.0), 2),
            totalCost=t_cost if t_cost > 0 else round((ord_qty * u_cost) + (ord_qty * u_cost * (t_rate / 100.0)), 2),
            totalAmount=t_cost if t_cost > 0 else round((ord_qty * u_cost) + (ord_qty * u_cost * (t_rate / 100.0)), 2)
        ))

    receipts = []
    for r in doc.get("receipts", []):
        receipts.append(PurchaseReceiptHistoryRecord(
            receiptId=str(r.get("receiptId", "")),
            receivedAt=r.get("receivedAt", ""),
            receivedByUserId=str(r.get("receivedByUserId", "")) if r.get("receivedByUserId") else None,
            receivedByName=r.get("receivedByName"),
            notes=r.get("notes"),
            items=r.get("items", []),
            totalAmountReceived=float(r.get("totalAmountReceived", 0.0)),
            amountPaid=float(r.get("amountPaid", 0.0)),
            paymentMode=r.get("paymentMode"),
            referenceNumber=r.get("referenceNumber")
        ))

    payments = []
    for p in doc.get("payments", []):
        payments.append(PurchaseOrderPaymentRecord(
            paymentId=str(p.get("paymentId", "")),
            paymentNumber=p.get("paymentNumber"),
            amount=float(p.get("amount", 0.0)),
            paymentMode=p.get("paymentMode", "BANK_TRANSFER"),
            referenceNumber=p.get("referenceNumber"),
            notes=p.get("notes"),
            paidAt=str(p.get("paidAt", ""))
        ))

    created_at_raw = doc.get("createdAt")
    created_at_str = created_at_raw.isoformat() if isinstance(created_at_raw, datetime) else str(created_at_raw or "")
    
    order_date = doc.get("orderDate") or (created_at_str.split("T")[0] if created_at_str else datetime.now(timezone.utc).strftime("%Y-%m-%d"))
    tot_rec = float(doc.get("totalReceivedAmount", 0.0))
    tot_paid = float(doc.get("totalPaidAmount", 0.0))
    bal_due = max(0.0, round(tot_rec - tot_paid, 2)) if tot_rec > 0 else 0.0

    pmt_status = doc.get("paymentStatus")
    if not pmt_status:
        if tot_rec <= 0:
            pmt_status = "NO_DUES"
        elif tot_paid >= (tot_rec - 0.01):
            pmt_status = "PAID"
        elif tot_paid > 0:
            pmt_status = "PARTIALLY_PAID"
        else:
            pmt_status = "UNPAID"

    tax_amt = float(doc.get("taxAmount", doc.get("taxTotal", 0.0)))
    return PurchaseOrderResponse(
        id=doc_id,
        poNumber=doc.get("poNumber", f"PO-{doc_id[:8].upper()}"),
        businessId=biz_id,
        supplierId=str(doc.get("supplierId", "")),
        supplierName=doc.get("supplierName", "Supplier"),
        supplierPhone=doc.get("supplierPhone"),
        locationId=str(doc.get("locationId", "")),
        locationName=doc.get("locationName", "Main Branch"),
        status=doc.get("status", "ORDERED"),
        orderDate=order_date,
        expectedDeliveryDate=doc.get("expectedDeliveryDate"),
        notes=doc.get("notes"),
        terms=doc.get("terms"),
        cancellationReason=doc.get("cancellationReason"),
        items=items,
        subtotal=float(doc.get("subtotal", 0.0)),
        taxAmount=tax_amt,
        taxTotal=tax_amt,
        grandTotal=float(doc.get("grandTotal", 0.0)),
        totalReceivedAmount=tot_rec,
        totalPaidAmount=tot_paid,
        balanceDue=bal_due,
        paymentStatus=pmt_status,
        receipts=receipts,
        payments=payments,
        createdByUserId=str(doc.get("createdByUserId", "")) if doc.get("createdByUserId") else None,
        createdByName=doc.get("createdByName"),
        createdAt=created_at_str,
        updatedAt=doc.get("updatedAt").isoformat() if isinstance(doc.get("updatedAt"), datetime) else str(doc.get("updatedAt", ""))
    )


@router.get("", response_model=PaginatedResponse[PurchaseOrderResponse])
async def list_purchase_orders(
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=200),
    search: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    supplier_id: Optional[str] = Query(None, alias="supplierId"),
    location_id: Optional[str] = Query(None, alias="locationId"),
    from_date: Optional[str] = Query(None, alias="fromDate"),
    to_date: Optional[str] = Query(None, alias="toDate"),
    business_id: str = Depends(get_current_business_id),
):
    db = await get_tenant_db(business_id)
    b_oid = ObjectId(business_id) if ObjectId.is_valid(business_id) else business_id
    skip = (page - 1) * page_size

    conditions: list = [{"$or": [{"businessId": b_oid}, {"businessId": business_id}]}]

    if status and status != "ALL":
        if status.upper() in ["RECEIVED", "FULLY_RECEIVED"]:
            conditions.append({"status": {"$in": ["RECEIVED", "FULLY_RECEIVED"]}})
        elif status.upper() in ["ORDERED", "DRAFT"]:
            conditions.append({"status": {"$in": ["ORDERED", "DRAFT"]}})
        else:
            conditions.append({"status": status.upper()})

    if supplier_id and supplier_id != "ALL":
        conditions.append({"$or": [{"supplierId": supplier_id}, {"supplierId": ObjectId(supplier_id) if ObjectId.is_valid(supplier_id) else supplier_id}]})

    if location_id and location_id != "ALL":
        conditions.append({"$or": [{"locationId": location_id}, {"locationId": ObjectId(location_id) if ObjectId.is_valid(location_id) else location_id}]})

    if search and search.strip():
        s = search.strip()
        conditions.append({
            "$or": [
                {"poNumber": {"$regex": s, "$options": "i"}},
                {"supplierName": {"$regex": s, "$options": "i"}},
                {"supplierPhone": {"$regex": s, "$options": "i"}},
                {"items.itemName": {"$regex": s, "$options": "i"}},
                {"items.sku": {"$regex": s, "$options": "i"}},
            ]
        })

    if from_date or to_date:
        from_dt = None
        to_dt = None
        if from_date:
            try:
                clean_from = from_date.split("T")[0]
                parts = [int(p) for p in clean_from.split("-")]
                from_dt = datetime(parts[0], parts[1], parts[2], 0, 0, 0, tzinfo=timezone.utc)
            except Exception:
                pass
        if to_date:
            try:
                clean_to = to_date.split("T")[0]
                parts = [int(p) for p in clean_to.split("-")]
                to_dt = datetime(parts[0], parts[1], parts[2], 23, 59, 59, 999999, tzinfo=timezone.utc)
            except Exception:
                pass

        created_dt_match: dict = {}
        created_str_match: dict = {}
        order_str_match: dict = {}

        if from_dt:
            created_dt_match["$gte"] = from_dt
        if to_dt:
            created_dt_match["$lte"] = to_dt

        if from_date:
            clean_f = from_date.split("T")[0]
            created_str_match["$gte"] = clean_f
            order_str_match["$gte"] = clean_f
        if to_date:
            clean_t = to_date.split("T")[0]
            created_str_match["$lte"] = f"{clean_t}T23:59:59.999Z"
            order_str_match["$lte"] = clean_t

        date_or = []
        if created_dt_match:
            date_or.append({"createdAt": created_dt_match})
        if created_str_match:
            date_or.append({"createdAt": created_str_match})
        if order_str_match:
            date_or.append({"orderDate": order_str_match})

        if date_or:
            conditions.append({"$or": date_or})

    query = {"$and": conditions}

    total = await db.purchase_orders.count_documents(query)
    cursor = db.purchase_orders.find(query).sort("createdAt", -1).skip(skip).limit(page_size)
    docs = await cursor.to_list(length=page_size)

    results = [_to_po_response(d) for d in docs]

    return PaginatedResponse(
        data=results,
        page=page,
        page_size=page_size,
        total=total,
        total_pages=(total + page_size - 1) // page_size if page_size else 1
    )


@router.post("", response_model=PurchaseOrderResponse, status_code=status.HTTP_201_CREATED)
async def create_purchase_order(
    payload: PurchaseOrderCreate,
    business_id: str = Depends(enforce_active_store_operations),
    current_user: TokenPayload = Depends(get_current_user)
):
    if "CASHIER" in current_user.roles and len(current_user.roles) == 1:
        raise HTTPException(status_code=403, detail="Cashiers do not have permission to place purchase orders.")

    db = await get_tenant_db(business_id)
    primary_db = get_database()
    now = datetime.now(timezone.utc)
    b_oid = ObjectId(business_id) if ObjectId.is_valid(business_id) else business_id

    supplier_id = str(payload.supplierId or payload.supplier_id or "")
    if not supplier_id:
        raise HTTPException(status_code=422, detail="supplierId is required to place a purchase order.")

    location_id = str(payload.locationId or payload.location_id or "65f2a1b9a000000000000101")

    # Generate sequential PO Number (e.g. PO-2026-000001)
    year = now.year
    count = await db.purchase_orders.count_documents({"$or": [{"businessId": b_oid}, {"businessId": business_id}]})
    po_number = f"PO-{year}-{str(count + 1).zfill(6)}"

    # Resolve supplier name and phone if not provided
    supplier_name = payload.supplierName or payload.supplier_name
    supplier_phone = payload.supplierPhone or payload.supplier_phone
    if not supplier_name:
        sup_query = {
            "$and": [
                {"$or": [{"businessId": b_oid}, {"businessId": business_id}]},
                {"$or": [{"_id": ObjectId(supplier_id) if ObjectId.is_valid(supplier_id) else supplier_id}, {"id": supplier_id}]}
            ]
        }
        sup_doc = await db.parties.find_one(sup_query)
        if not sup_doc:
            sup_doc = await primary_db.parties.find_one({"$or": [{"_id": ObjectId(supplier_id) if ObjectId.is_valid(supplier_id) else supplier_id}, {"id": supplier_id}]})
        if sup_doc:
            supplier_name = sup_doc.get("name", "Supplier")
            supplier_phone = supplier_phone or sup_doc.get("phone")
        else:
            supplier_name = "Supplier"

    # Resolve location name if not provided
    loc_name = payload.locationName or payload.location_name
    if not loc_name:
        loc_doc = await db.locations.find_one({"$or": [{"_id": ObjectId(location_id) if ObjectId.is_valid(location_id) else location_id}, {"code": location_id}]})
        if not loc_doc:
            loc_doc = await primary_db.locations.find_one({"$or": [{"_id": ObjectId(location_id) if ObjectId.is_valid(location_id) else location_id}, {"code": location_id}]})
        loc_name = loc_doc.get("name", "Store Branch") if loc_doc else "Store Branch"

    subtotal = 0.0
    tax_total = 0.0
    items_data = []

    for item in payload.items:
        item_id_str = str(item.itemId or item.item_id or "")
        ordered_qty = float(item.orderedQuantity if item.orderedQuantity is not None else (item.ordered_qty if item.ordered_qty is not None else (item.quantity or 1.0)))
        unit_cost = float(item.unitCost if item.unitCost is not None else (item.unit_cost if item.unit_cost is not None else (item.unitPrice if item.unitPrice is not None else (item.unit_price or 0.0))))
        tax_rate = float(item.taxRate if item.taxRate is not None else (item.tax_rate or 0.0))
        item_name = item.itemName or item.item_name or item.name
        sku = item.sku
        unit = item.unit or "pcs"
        update_master = bool(item.updateMasterPurchasePrice or item.update_item_purchase_price)

        # Look up item details in database if name or unit missing
        if (not item_name or item_name == "Item") and item_id_str:
            itm_query = {
                "$and": [
                    {"$or": [{"businessId": b_oid}, {"businessId": business_id}]},
                    {"$or": [{"_id": ObjectId(item_id_str) if ObjectId.is_valid(item_id_str) else item_id_str}, {"publicItemId": item_id_str}, {"sku": item_id_str}]}
                ]
            }
            itm_doc = await db.items.find_one(itm_query)
            if not itm_doc:
                itm_doc = await primary_db.items.find_one({"$or": [{"_id": ObjectId(item_id_str) if ObjectId.is_valid(item_id_str) else item_id_str}, {"publicItemId": item_id_str}, {"sku": item_id_str}]})
            if itm_doc:
                item_name = itm_doc.get("name", "Item")
                sku = sku or itm_doc.get("sku")
                unit = itm_doc.get("unit", unit)
                if tax_rate == 0.0 and itm_doc.get("taxRate"):
                    tax_rate = float(itm_doc.get("taxRate", 0.0))

        item_name = item_name or "Item"

        line_sub = ordered_qty * unit_cost
        line_tax = line_sub * (tax_rate / 100.0)
        line_total = line_sub + line_tax
        subtotal += line_sub
        tax_total += line_tax

        items_data.append({
            "itemId": item_id_str,
            "itemName": item_name,
            "sku": sku,
            "unit": unit,
            "orderedQuantity": ordered_qty,
            "receivedQuantity": 0.0,
            "unitCost": unit_cost,
            "taxRate": tax_rate,
            "totalCost": round(line_total, 2),
            "updateMasterPurchasePrice": update_master
        })

    grand_total = round(subtotal + tax_total, 2)

    order_date = payload.orderDate or payload.order_date or now.strftime("%Y-%m-%d")

    po_doc = {
        "businessId": b_oid,
        "poNumber": po_number,
        "supplierId": supplier_id,
        "supplierName": supplier_name,
        "supplierPhone": supplier_phone,
        "locationId": location_id,
        "locationName": loc_name,
        "status": payload.status or "ORDERED",
        "orderDate": order_date,
        "expectedDeliveryDate": payload.expectedDeliveryDate or payload.expected_delivery_date,
        "notes": payload.notes,
        "terms": payload.terms,
        "items": items_data,
        "subtotal": round(subtotal, 2),
        "taxAmount": round(tax_total, 2),
        "grandTotal": grand_total,
        "totalReceivedAmount": 0.0,
        "totalPaidAmount": 0.0,
        "balanceDue": 0.0,
        "paymentStatus": "NO_DUES",
        "receipts": [],
        "payments": [],
        "createdByUserId": current_user.sub,
        "createdByName": current_user.email.split("@")[0] if current_user.email else "Admin",
        "createdAt": now,
        "updatedAt": now
    }

    insert_res = await db.purchase_orders.insert_one(po_doc)
    po_doc["_id"] = insert_res.inserted_id

    # Also backup to primary_db if distinct
    if primary_db.name != db.name:
        await primary_db.purchase_orders.insert_one(po_doc)

    return _to_po_response(po_doc)


@router.get("/{po_id}", response_model=PurchaseOrderResponse)
async def get_purchase_order(
    po_id: str,
    business_id: str = Depends(get_current_business_id),
):
    db = await get_tenant_db(business_id)
    b_oid = ObjectId(business_id) if ObjectId.is_valid(business_id) else business_id

    query = {
        "$and": [
            {"$or": [{"businessId": b_oid}, {"businessId": business_id}]},
            {"$or": [{"_id": ObjectId(po_id) if ObjectId.is_valid(po_id) else po_id}, {"id": po_id}, {"poNumber": po_id}]}
        ]
    }

    doc = await db.purchase_orders.find_one(query)
    if not doc:
        primary_db = get_database()
        doc = await primary_db.purchase_orders.find_one(query)

    if not doc:
        raise HTTPException(status_code=404, detail="Purchase Order not found.")

    return _to_po_response(doc)


@router.put("/{po_id}", response_model=PurchaseOrderResponse)
async def update_purchase_order(
    po_id: str,
    payload: PurchaseOrderUpdate,
    business_id: str = Depends(get_current_business_id),
    current_user: TokenPayload = Depends(get_current_user)
):
    db = await get_tenant_db(business_id)
    b_oid = ObjectId(business_id) if ObjectId.is_valid(business_id) else business_id
    now = datetime.now(timezone.utc)

    query = {
        "$and": [
            {"$or": [{"businessId": b_oid}, {"businessId": business_id}]},
            {"$or": [{"_id": ObjectId(po_id) if ObjectId.is_valid(po_id) else po_id}, {"id": po_id}]}
        ]
    }

    doc = await db.purchase_orders.find_one(query)
    if not doc:
        raise HTTPException(status_code=404, detail="Purchase Order not found.")

    if doc.get("status") in ["FULLY_RECEIVED", "CANCELLED"]:
        raise HTTPException(status_code=400, detail=f"Cannot edit purchase order in '{doc.get('status')}' status.")

    update_fields = {"updatedAt": now}
    if payload.supplierId is not None:
        update_fields["supplierId"] = payload.supplierId
    if payload.supplierName is not None:
        update_fields["supplierName"] = payload.supplierName
    if payload.supplierPhone is not None:
        update_fields["supplierPhone"] = payload.supplierPhone
    if payload.locationId is not None:
        update_fields["locationId"] = payload.locationId
    if payload.locationName is not None:
        update_fields["locationName"] = payload.locationName
    if payload.orderDate is not None or payload.order_date is not None:
        update_fields["orderDate"] = payload.orderDate or payload.order_date
    if payload.expectedDeliveryDate is not None:
        update_fields["expectedDeliveryDate"] = payload.expectedDeliveryDate
    if payload.notes is not None:
        update_fields["notes"] = payload.notes
    if payload.status is not None:
        update_fields["status"] = payload.status

    if payload.items is not None:
        subtotal = 0.0
        tax_total = 0.0
        items_data = []
        for item in payload.items:
            line_sub = float(item.orderedQuantity) * float(item.unitCost)
            line_tax = line_sub * (float(item.taxRate) / 100.0)
            line_total = line_sub + line_tax
            subtotal += line_sub
            tax_total += line_tax
            items_data.append({
                "itemId": item.itemId,
                "itemName": item.itemName,
                "sku": item.sku,
                "unit": item.unit or "pcs",
                "orderedQuantity": float(item.orderedQuantity),
                "receivedQuantity": float(item.orderedQuantity if doc.get("status") == "FULLY_RECEIVED" else 0.0),
                "unitCost": float(item.unitCost),
                "taxRate": float(item.taxRate),
                "totalCost": round(line_total, 2)
            })
        update_fields["items"] = items_data
        update_fields["subtotal"] = round(subtotal, 2)
        update_fields["taxAmount"] = round(tax_total, 2)
        update_fields["grandTotal"] = round(subtotal + tax_total, 2)

    await db.purchase_orders.update_one({"_id": doc["_id"]}, {"$set": update_fields})
    updated_doc = await db.purchase_orders.find_one({"_id": doc["_id"]})

    return _to_po_response(updated_doc)


@router.post("/{po_id}/receive", response_model=PurchaseOrderResponse)
async def receive_purchase_order_goods(
    po_id: str,
    payload: ReceiveGoodsRequest,
    business_id: str = Depends(get_current_business_id),
    current_user: TokenPayload = Depends(get_current_user)
):
    db = await get_tenant_db(business_id)
    b_oid = ObjectId(business_id) if ObjectId.is_valid(business_id) else business_id
    now = datetime.now(timezone.utc)

    query = {
        "$and": [
            {"$or": [{"businessId": b_oid}, {"businessId": business_id}]},
            {"$or": [{"_id": ObjectId(po_id) if ObjectId.is_valid(po_id) else po_id}, {"id": po_id}]}
        ]
    }

    po_doc = await db.purchase_orders.find_one(query)
    if not po_doc:
        raise HTTPException(status_code=404, detail="Purchase Order not found.")

    current_status = po_doc.get("status", "ORDERED")
    if current_status in ["FULLY_RECEIVED", "CANCELLED"]:
        raise HTTPException(status_code=400, detail=f"Cannot receive items for PO in '{current_status}' status.")

    po_number = po_doc.get("poNumber", f"PO-{str(po_doc['_id'])[:8].upper()}")
    location_id = str(po_doc.get("locationId", "65f2a1b9a000000000000101"))
    location_name = po_doc.get("locationName", "Store Branch")
    supplier_id = str(po_doc.get("supplierId", ""))
    supplier_name = po_doc.get("supplierName", "Supplier")

    po_items = list(po_doc.get("items") or [])
    item_map = {str(it.get("itemId")): it for it in po_items}

    receipt_items_record = []
    total_received_amount_this_batch = 0.0

    received_items_list = payload.receivedItems or payload.received_items or payload.items or []

    for r_item in received_items_list:
        item_id_str = str(r_item.itemId or r_item.item_id or "")
        qty_received = float(r_item.quantityReceived if r_item.quantityReceived is not None else (r_item.quantity_received if r_item.quantity_received is not None else (r_item.qty or 0.0)))

        if qty_received <= 0:
            continue

        target_po_item = item_map.get(item_id_str)
        if not target_po_item:
            # Fallback search by sku or publicId
            target_po_item = next((it for it in po_items if str(it.get("sku")) == item_id_str or str(it.get("publicItemId")) == item_id_str), None)

        if not target_po_item:
            raise HTTPException(status_code=400, detail=f"Item '{item_id_str}' is not in this purchase order.")

        ordered_qty = float(target_po_item.get("orderedQuantity", 0.0))
        already_received = float(target_po_item.get("receivedQuantity", 0.0))
        remaining_qty = max(0.0, ordered_qty - already_received)

        if qty_received > (remaining_qty + 0.001):
            raise HTTPException(
                status_code=400,
                detail=f"Received quantity ({qty_received}) exceeds remaining ordered quantity ({remaining_qty}) for item '{target_po_item.get('itemName')}'."
            )

        unit_cost = float(r_item.unitCost if r_item.unitCost is not None else (r_item.unit_cost if r_item.unit_cost is not None else target_po_item.get("unitCost", 0.0)))
        tax_rate = float(target_po_item.get("taxRate", 0.0))
        item_batch_cost = (qty_received * unit_cost) * (1.0 + tax_rate / 100.0)
        total_received_amount_this_batch += item_batch_cost

        # 1. Update receivedQuantity on PO item
        target_po_item["receivedQuantity"] = round(already_received + qty_received, 3)

        # 2. Update stock & branch stock in Database
        item_query = {
            "$and": [
                {"$or": [{"businessId": b_oid}, {"businessId": business_id}]},
                {"$or": [{"_id": ObjectId(item_id_str) if ObjectId.is_valid(item_id_str) else item_id_str}, {"publicItemId": item_id_str}, {"sku": item_id_str}]}
            ]
        }
        item_doc = await db.items.find_one(item_query)

        if item_doc:
            item_oid = item_doc["_id"]
            current_master_stock = float(item_doc.get("currentStock", 0.0) or 0.0)
            new_master_stock = current_master_stock + qty_received

            # Update location-specific stock
            loc_list = list(item_doc.get("locations") or [])
            found_loc = False
            for l in loc_list:
                if str(l.get("locationId")) == location_id or str(l.get("locationId")) == po_doc.get("locationId"):
                    l["currentStock"] = round(float(l.get("currentStock", 0.0) or 0.0) + qty_received, 3)
                    l["isListed"] = True
                    found_loc = True
                    break

            if not found_loc:
                loc_list.append({
                    "locationId": location_id,
                    "locationName": location_name,
                    "mrp": float(item_doc.get("mrp", item_doc.get("salePrice", unit_cost * 1.3))),
                    "salePrice": float(item_doc.get("salePrice", unit_cost * 1.3)),
                    "purchasePrice": unit_cost,
                    "currentStock": qty_received,
                    "minStockAlert": float(item_doc.get("minStockAlert", 5.0)),
                    "isListed": True,
                    "hasDiscount": False,
                    "discountType": "PERCENT",
                    "discountValue": 0.0
                })

            # Calculate Weighted Average Cost
            old_avg_cost = float(item_doc.get("averageCostPrice") or item_doc.get("purchasePrice") or unit_cost)
            old_stock = max(0.0, current_master_stock)
            new_avg_cost = ((old_stock * old_avg_cost) + (qty_received * unit_cost)) / new_master_stock if new_master_stock > 0 else unit_cost

            # Append or update FIFO Batch Record
            existing_batches = list(item_doc.get("batches") or [])
            batch_num = f"BAT-{po_number.replace('PO-', '')}-{item_id_str[-4:].upper()}"
            existing_batches.append({
                "batchId": f"batch_{secrets.token_hex(6)}",
                "batchNumber": batch_num,
                "purchaseOrderId": str(po_doc["_id"]),
                "purchaseOrderNumber": po_number,
                "purchasePrice": round(unit_cost, 2),
                "salePrice": float(item_doc.get("salePrice", unit_cost * 1.3)),
                "mrp": float(item_doc.get("mrp", unit_cost * 1.4)),
                "currentStock": qty_received,
                "locationId": location_id,
                "receivedDate": now.isoformat().split("T")[0],
                "receivedAt": now.isoformat(),
                "supplierId": supplier_id,
                "supplierName": supplier_name
            })

            item_updates = {
                "currentStock": round(new_master_stock, 3),
                "averageCostPrice": round(new_avg_cost, 2),
                "batches": existing_batches,
                "locations": loc_list,
                "updatedAt": now
            }

            if payload.updateMasterPurchasePrice or target_po_item.get("updateMasterPurchasePrice"):
                item_updates["purchasePrice"] = unit_cost

            await db.items.update_one({"_id": item_oid}, {"$set": item_updates})

            # 3. Append Immutable Inventory Movement Audit Record
            movement_doc = {
                "businessId": b_oid,
                "itemId": item_oid,
                "publicItemId": item_doc.get("publicItemId"),
                "itemName": item_doc.get("name", target_po_item.get("itemName")),
                "sku": item_doc.get("sku"),
                "locationId": location_id,
                "locationName": location_name,
                "type": "PURCHASE",
                "referenceType": "PURCHASE_ORDER",
                "referenceId": str(po_doc["_id"]),
                "referenceNumber": po_number,
                "quantityChange": qty_received,
                "quantityBefore": current_master_stock,
                "quantityAfter": round(new_master_stock, 3),
                "unitCost": unit_cost,
                "totalCost": round(item_batch_cost, 2),
                "reason": f"Goods received from PO {po_number} ({supplier_name})",
                "createdByUserId": current_user.sub,
                "createdByName": current_user.email.split("@")[0] if current_user.email else "Admin",
                "createdAt": now
            }
            await db.inventory_movements.insert_one(movement_doc)

        receipt_items_record.append({
            "itemId": item_id_str,
            "itemName": target_po_item.get("itemName", "Item"),
            "sku": target_po_item.get("sku"),
            "unit": target_po_item.get("unit", "pcs"),
            "quantityReceived": qty_received,
            "unitCost": unit_cost,
            "totalCost": round(item_batch_cost, 2)
        })

    # 4. Record Receipt History & Payments
    payment_obj = payload.paymentDetails or payload.payment_details or payload.payment
    amount_paid_now = 0.0
    pay_mode = "CREDIT"
    ref_no = None
    if payment_obj:
        amount_paid_now = float(payment_obj.amountPaid if payment_obj.amountPaid is not None else (payment_obj.amount_paid if payment_obj.amount_paid is not None else (payment_obj.amount or 0.0)))
        pay_mode = payment_obj.paymentMode or payment_obj.payment_mode or "CASH"
        ref_no = payment_obj.referenceNumber or payment_obj.reference_number

    receipt_record = {
        "receiptId": f"rcpt_{secrets.token_hex(6)}",
        "receivedAt": now.isoformat(),
        "receivedByUserId": current_user.sub,
        "receivedByName": current_user.email.split("@")[0] if current_user.email else "Admin",
        "notes": payload.receiptNotes or payload.receipt_notes or payload.notes,
        "items": receipt_items_record,
        "totalAmountReceived": round(total_received_amount_this_batch, 2),
        "amountPaid": round(amount_paid_now, 2),
        "paymentMode": pay_mode,
        "referenceNumber": ref_no
    }

    all_receipts = list(po_doc.get("receipts") or [])
    all_receipts.append(receipt_record)

    all_payments = list(po_doc.get("payments") or [])
    payment_number = f"PAY-{now.year}-{secrets.token_hex(3).upper()}"
    if amount_paid_now > 0:
        all_payments.append({
            "paymentId": f"pay_{secrets.token_hex(6)}",
            "paymentNumber": payment_number,
            "amount": round(amount_paid_now, 2),
            "paymentMode": pay_mode,
            "referenceNumber": ref_no,
            "notes": f"Payment on goods receipt for PO {po_number}",
            "paidAt": now.isoformat()
        })

    # 5. Financial Ledger & Supplier Payables Integration
    if supplier_id:
        supplier_query = {
            "$and": [
                {"$or": [{"businessId": b_oid}, {"businessId": business_id}]},
                {"$or": [{"_id": ObjectId(supplier_id) if ObjectId.is_valid(supplier_id) else supplier_id}, {"id": supplier_id}]}
            ]
        }
        net_payable_delta = total_received_amount_this_batch - amount_paid_now
        await db.parties.update_one(
            supplier_query,
            {"$inc": {
                "currentPayable": round(net_payable_delta, 2),
                "balance": round(net_payable_delta, 2)
            }, "$set": {"updatedAt": now}}
        )

        if amount_paid_now > 0:
            payment_doc = {
                "businessId": b_oid,
                "paymentNumber": payment_number,
                "partyId": ObjectId(supplier_id) if ObjectId.is_valid(supplier_id) else supplier_id,
                "partyNameSnapshot": supplier_name,
                "partyName": supplier_name,
                "direction": "OUT",
                "type": "PAYMENT_OUT",
                "amount": round(amount_paid_now, 2),
                "paymentMode": pay_mode,
                "referenceType": "PURCHASE_ORDER",
                "referenceId": str(po_doc["_id"]),
                "referenceNumber": po_number,
                "notes": f"Payment for PO {po_number} goods receipt",
                "paidAt": now,
                "createdAt": now
            }
            await db.payments.insert_one(payment_doc)

    # 6. Check Overall PO Completion Status & Balances
    all_fully_received = True
    for it in po_items:
        ordered = float(it.get("orderedQuantity", 0.0))
        received = float(it.get("receivedQuantity", 0.0))
        if received < (ordered - 0.001):
            all_fully_received = False
            break

    new_po_status = "FULLY_RECEIVED" if all_fully_received else "PARTIALLY_RECEIVED"
    total_cum_received = round(float(po_doc.get("totalReceivedAmount", 0.0) or 0.0) + total_received_amount_this_batch, 2)
    total_cum_paid = round(float(po_doc.get("totalPaidAmount", 0.0) or 0.0) + amount_paid_now, 2)
    balance_due = max(0.0, round(total_cum_received - total_cum_paid, 2))

    if balance_due <= 0.001 and total_cum_received > 0:
        pmt_status = "PAID"
    elif total_cum_paid > 0:
        pmt_status = "PARTIALLY_PAID"
    else:
        pmt_status = "UNPAID" if total_cum_received > 0 else "NO_DUES"

    await db.purchase_orders.update_one(
        {"_id": po_doc["_id"]},
        {"$set": {
            "items": po_items,
            "status": new_po_status,
            "totalReceivedAmount": total_cum_received,
            "totalPaidAmount": total_cum_paid,
            "balanceDue": balance_due,
            "paymentStatus": pmt_status,
            "receipts": all_receipts,
            "payments": all_payments,
            "updatedAt": now
        }}
    )

    updated_po = await db.purchase_orders.find_one({"_id": po_doc["_id"]})
    return _to_po_response(updated_po)


@router.post("/{po_id}/payments", response_model=PurchaseOrderResponse)
async def record_purchase_order_payment(
    po_id: str,
    payload: RecordPOPaymentRequest,
    business_id: str = Depends(get_current_business_id),
    current_user: TokenPayload = Depends(get_current_user)
):
    db = await get_tenant_db(business_id)
    b_oid = ObjectId(business_id) if ObjectId.is_valid(business_id) else business_id
    now = datetime.now(timezone.utc)

    query = {
        "$and": [
            {"$or": [{"businessId": b_oid}, {"businessId": business_id}]},
            {"$or": [{"_id": ObjectId(po_id) if ObjectId.is_valid(po_id) else po_id}, {"id": po_id}]}
        ]
    }

    po_doc = await db.purchase_orders.find_one(query)
    if not po_doc:
        raise HTTPException(status_code=404, detail="Purchase Order not found.")

    if po_doc.get("status") == "CANCELLED":
        raise HTTPException(status_code=400, detail="Cannot record payments for a CANCELLED purchase order.")

    pay_amount = float(payload.amount)
    if pay_amount <= 0:
        raise HTTPException(status_code=400, detail="Payment amount must be greater than zero.")

    supplier_id = str(po_doc.get("supplierId", ""))
    supplier_name = str(po_doc.get("supplierName", "Supplier"))
    po_number = str(po_doc.get("poNumber", f"PO-{str(po_doc['_id'])[:8].upper()}"))

    payment_mode = payload.paymentMode or payload.payment_mode or "BANK_TRANSFER"
    ref_number = payload.referenceNumber or payload.reference_number
    notes = payload.notes or f"Payment towards PO {po_number}"
    paid_at = payload.paidAt or payload.paid_at or now.isoformat()

    # 1. Insert into discrete payments collection
    payment_number = f"PAY-{now.year}-{secrets.token_hex(3).upper()}"
    payment_doc = {
        "businessId": b_oid,
        "paymentNumber": payment_number,
        "direction": "OUT",
        "type": "PAYMENT_OUT",
        "partyId": ObjectId(supplier_id) if ObjectId.is_valid(supplier_id) else supplier_id,
        "partyNameSnapshot": supplier_name,
        "partyName": supplier_name,
        "amount": round(pay_amount, 2),
        "paymentMode": payment_mode,
        "referenceType": "PURCHASE_ORDER",
        "referenceId": str(po_doc["_id"]),
        "referenceNumber": po_number,
        "notes": notes,
        "paidAt": paid_at,
        "createdAt": now
    }
    await db.payments.insert_one(payment_doc)

    # 2. Update Supplier Party Balance (reduce payable)
    if supplier_id:
        supplier_query = {
            "$and": [
                {"$or": [{"businessId": b_oid}, {"businessId": business_id}]},
                {"$or": [{"_id": ObjectId(supplier_id) if ObjectId.is_valid(supplier_id) else supplier_id}, {"id": supplier_id}]}
            ]
        }
        await db.parties.update_one(
            supplier_query,
            {"$inc": {
                "currentPayable": -round(pay_amount, 2),
                "balance": -round(pay_amount, 2)
            }, "$set": {"updatedAt": now}}
        )

    # 3. Update PO totals & payment status
    existing_payments = list(po_doc.get("payments") or [])
    existing_payments.append({
        "paymentId": f"pay_{secrets.token_hex(6)}",
        "paymentNumber": payment_number,
        "amount": round(pay_amount, 2),
        "paymentMode": payment_mode,
        "referenceNumber": ref_number,
        "notes": notes,
        "paidAt": paid_at
    })

    tot_rec = float(po_doc.get("totalReceivedAmount", 0.0) or 0.0)
    old_paid = float(po_doc.get("totalPaidAmount", 0.0) or 0.0)
    new_tot_paid = round(old_paid + pay_amount, 2)
    new_bal_due = max(0.0, round(tot_rec - new_tot_paid, 2))

    if new_bal_due <= 0.001 and tot_rec > 0:
        new_pmt_status = "PAID"
    elif new_tot_paid > 0:
        new_pmt_status = "PARTIALLY_PAID"
    else:
        new_pmt_status = "UNPAID" if tot_rec > 0 else "NO_DUES"

    await db.purchase_orders.update_one(
        {"_id": po_doc["_id"]},
        {"$set": {
            "totalPaidAmount": new_tot_paid,
            "balanceDue": new_bal_due,
            "paymentStatus": new_pmt_status,
            "payments": existing_payments,
            "updatedAt": now
        }}
    )

    updated_po = await db.purchase_orders.find_one({"_id": po_doc["_id"]})
    return _to_po_response(updated_po)


@router.post("/{po_id}/cancel", response_model=PurchaseOrderResponse)
async def cancel_purchase_order(
    po_id: str,
    payload: CancelPORequest,
    business_id: str = Depends(get_current_business_id),
    current_user: TokenPayload = Depends(get_current_user)
):
    db = await get_tenant_db(business_id)
    b_oid = ObjectId(business_id) if ObjectId.is_valid(business_id) else business_id
    now = datetime.now(timezone.utc)

    query = {
        "$and": [
            {"$or": [{"businessId": b_oid}, {"businessId": business_id}]},
            {"$or": [{"_id": ObjectId(po_id) if ObjectId.is_valid(po_id) else po_id}, {"id": po_id}]}
        ]
    }

    po_doc = await db.purchase_orders.find_one(query)
    if not po_doc:
        raise HTTPException(status_code=404, detail="Purchase Order not found.")

    if po_doc.get("status") in ["FULLY_RECEIVED", "CANCELLED"]:
        raise HTTPException(status_code=400, detail=f"Cannot cancel PO with status '{po_doc.get('status')}'.")

    cancellation_reason = payload.cancellationReason or payload.cancellation_reason or payload.reason or "Cancelled by user"

    await db.purchase_orders.update_one(
        {"_id": po_doc["_id"]},
        {"$set": {
            "status": "CANCELLED",
            "cancellationReason": cancellation_reason.strip(),
            "updatedAt": now
        }}
    )

    updated_po = await db.purchase_orders.find_one({"_id": po_doc["_id"]})
    return _to_po_response(updated_po)


@router.delete("/{po_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_purchase_order(
    po_id: str,
    business_id: str = Depends(get_current_business_id),
    current_user: TokenPayload = Depends(get_current_user)
):
    if "SUPER_ADMIN" not in current_user.roles and "TENANT_ADMIN" not in current_user.roles:
        raise HTTPException(status_code=403, detail="Only store administrators can delete purchase orders.")

    db = await get_tenant_db(business_id)
    b_oid = ObjectId(business_id) if ObjectId.is_valid(business_id) else business_id

    query = {
        "$and": [
            {"$or": [{"businessId": b_oid}, {"businessId": business_id}]},
            {"$or": [{"_id": ObjectId(po_id) if ObjectId.is_valid(po_id) else po_id}, {"id": po_id}]}
        ]
    }

    po_doc = await db.purchase_orders.find_one(query)
    if not po_doc:
        raise HTTPException(status_code=404, detail="Purchase Order not found.")

    if po_doc.get("status") != "DRAFT":
        raise HTTPException(status_code=400, detail="Only 'DRAFT' purchase orders can be deleted. Cancel placed orders instead.")

    await db.purchase_orders.delete_one({"_id": po_doc["_id"]})
