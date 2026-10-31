import hmac
import hashlib
import base64
import re
from datetime import datetime, timezone
from decimal import Decimal
from typing import Dict, Any, List, Optional
from bson import ObjectId
from fastapi import HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.core.config import settings
from app.schemas.cafe import (
    TableCreate,
    TableUpdate,
    TableResponse,
    PublicOrderSubmitRequest,
    TableSettleRequest,
    KOTResponse,
    TableSessionResponse
)
from app.services.billing_engine import BillingEngine, LineItemCalcInput
from app.services.sale_service import SaleService
from app.schemas.sale import SaleCreateRequest, SaleItemInput

def generate_table_qr_token(business_id: str, table_id: str, secret: Optional[str] = None) -> str:
    sec = secret or settings.JWT_SECRET
    msg = f"{business_id}:{table_id}".encode("utf-8")
    sig = hmac.new(sec.encode("utf-8"), msg, hashlib.sha256).digest()
    return base64.urlsafe_b64encode(sig).decode("utf-8").rstrip("=")

def verify_table_qr_token(token: str, business_id: str, table_id: str, secret: Optional[str] = None) -> bool:
    try:
        expected = generate_table_qr_token(business_id, table_id, secret)
        return hmac.compare_digest(token, expected)
    except Exception:
        return False

class CafeSessionService:
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db

    def _b_query(self, business_id: str) -> dict:
        b_oid = ObjectId(business_id) if ObjectId.is_valid(business_id) else None
        return {"$or": [{"businessId": b_oid}, {"businessId": business_id}]} if b_oid else {"businessId": business_id}

    async def list_tables(self, business_id: str, location_id: Optional[str] = None) -> List[Dict[str, Any]]:
        cond = [self._b_query(business_id), {"isActive": True}]
        if location_id and location_id != "ALL":
            cond.append({"$or": [{"locationId": location_id}, {"locationId": None}]})
        
        cursor = self.db.tables.find({"$and": cond}).sort("tableNumber", 1)
        docs = await cursor.to_list(length=200)

        results = []
        for d in docs:
            d["_id"] = str(d["_id"])
            d["businessId"] = str(d["businessId"])
            if d.get("activeSessionId"):
                d["activeSessionId"] = str(d["activeSessionId"])
            d["qrCodeToken"] = d.get("qrCodeSecret") or d.get("qrCodeToken")
            results.append(d)
        return results

    async def create_table(self, business_id: str, payload: TableCreate) -> Dict[str, Any]:
        b_oid = ObjectId(business_id) if ObjectId.is_valid(business_id) else ObjectId()
        clean_table_no = payload.table_number.strip().upper()

        # Check uniqueness per location
        exist_query = {
            "$and": [
                self._b_query(business_id),
                {"tableNumber": clean_table_no},
                {"isActive": True}
            ]
        }
        if payload.location_id:
            exist_query["$and"].append({"locationId": payload.location_id})

        existing = await self.db.tables.find_one(exist_query)
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Table with number '{clean_table_no}' already exists in this location."
            )

        now = datetime.now(timezone.utc)
        table_oid = ObjectId()
        token = generate_table_qr_token(str(b_oid), str(table_oid))
        qr_url = f"/order/{business_id}/{str(table_oid)}?token={token}"

        table_doc = {
            "_id": table_oid,
            "businessId": b_oid,
            "locationId": payload.location_id,
            "tableNumber": clean_table_no,
            "label": payload.label.strip() if payload.label else f"Table {clean_table_no}",
            "section": payload.section.strip() if payload.section else "Main Hall",
            "seatingCapacity": payload.seating_capacity,
            "currentStatus": "AVAILABLE",
            "activeSessionId": None,
            "qrCodeSecret": token,
            "qrCodeToken": token,
            "qrCodeUrl": qr_url,
            "isActive": True,
            "createdAt": now,
            "updatedAt": now
        }

        await self.db.tables.insert_one(table_doc)
        table_doc["_id"] = str(table_doc["_id"])
        table_doc["businessId"] = str(table_doc["businessId"])
        table_doc["qrCodeToken"] = table_doc.get("qrCodeSecret") or table_doc.get("qrCodeToken")
        return table_doc

    async def update_table(self, business_id: str, table_id: str, payload: TableUpdate) -> Dict[str, Any]:
        t_oid = ObjectId(table_id) if ObjectId.is_valid(table_id) else None
        if not t_oid:
            raise HTTPException(status_code=404, detail="Table not found")

        update_fields: dict = {"updatedAt": datetime.now(timezone.utc)}
        if payload.table_number is not None:
            update_fields["tableNumber"] = payload.table_number.strip().upper()
        if payload.label is not None:
            update_fields["label"] = payload.label.strip()
        if payload.section is not None:
            update_fields["section"] = payload.section.strip()
        if payload.seating_capacity is not None:
            update_fields["seatingCapacity"] = payload.seating_capacity
        if payload.current_status is not None:
            update_fields["currentStatus"] = payload.current_status.strip().upper()
        if payload.is_active is not None:
            update_fields["isActive"] = payload.is_active

        res = await self.db.tables.find_one_and_update(
            {"_id": t_oid, **self._b_query(business_id)},
            {"$set": update_fields},
            return_document=True
        )
        if not res:
            raise HTTPException(status_code=404, detail="Table not found")
        
        res["_id"] = str(res["_id"])
        res["businessId"] = str(res["businessId"])
        if res.get("activeSessionId"):
            res["activeSessionId"] = str(res["activeSessionId"])
        res["qrCodeToken"] = res.get("qrCodeSecret") or res.get("qrCodeToken")
        return res

    async def update_table_status(self, business_id: str, table_id: str, new_status: str) -> Dict[str, Any]:
        valid_statuses = ("AVAILABLE", "OCCUPIED", "ORDERING", "BILLING", "CLEANING")
        clean_status = new_status.strip().upper()
        if clean_status not in valid_statuses:
            raise HTTPException(status_code=400, detail=f"Invalid table status. Must be one of {valid_statuses}")

        t_oid = ObjectId(table_id) if ObjectId.is_valid(table_id) else None
        if not t_oid:
            raise HTTPException(status_code=404, detail="Table not found")

        update_set: dict = {
            "currentStatus": clean_status,
            "updatedAt": datetime.now(timezone.utc)
        }
        if clean_status == "AVAILABLE":
            update_set["activeSessionId"] = None

        res = await self.db.tables.find_one_and_update(
            {"_id": t_oid, **self._b_query(business_id)},
            {"$set": update_set},
            return_document=True
        )
        if not res:
            raise HTTPException(status_code=404, detail="Table not found")
        
        res["_id"] = str(res["_id"])
        res["businessId"] = str(res["businessId"])
        if res.get("activeSessionId"):
            res["activeSessionId"] = str(res["activeSessionId"])
        return res

    async def delete_table(self, business_id: str, table_id: str) -> bool:
        t_oid = ObjectId(table_id) if ObjectId.is_valid(table_id) else None
        if not t_oid:
            raise HTTPException(status_code=404, detail="Table not found")

        res = await self.db.tables.update_one(
            {"_id": t_oid, **self._b_query(business_id)},
            {"$set": {"isActive": False, "updatedAt": datetime.now(timezone.utc)}}
        )
        return res.modified_count > 0

    async def get_active_sessions(self, business_id: str, location_id: Optional[str] = None) -> List[Dict[str, Any]]:
        cond = [self._b_query(business_id), {"sessionStatus": {"$in": ["ACTIVE", "BILLING"]}}]
        if location_id and location_id != "ALL":
            cond.append({"$or": [{"locationId": location_id}, {"locationId": None}]})

        cursor = self.db.table_sessions.find({"$and": cond}).sort("openedAt", -1)
        docs = await cursor.to_list(length=100)
        
        results = []
        for d in docs:
            d["_id"] = str(d["_id"])
            d["businessId"] = str(d["businessId"])
            d["tableId"] = str(d["tableId"])
            results.append(d)
        return results

    async def submit_public_order(self, business_id: str, payload: PublicOrderSubmitRequest) -> Dict[str, Any]:
        t_oid = ObjectId(payload.table_id) if ObjectId.is_valid(payload.table_id) else None
        if not t_oid:
            raise HTTPException(status_code=404, detail="Table not found")

        table = await self.db.tables.find_one({"_id": t_oid, **self._b_query(business_id), "isActive": True})
        if not table:
            raise HTTPException(status_code=404, detail="Active table not found")

        # Verify HMAC token
        if not verify_table_qr_token(payload.qr_token, business_id, str(t_oid)):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid or expired table QR token")

        now = datetime.now(timezone.utc)
        b_oid = ObjectId(business_id) if ObjectId.is_valid(business_id) else business_id
        session_oid = table.get("activeSessionId")

        # Resolve live item details and prices
        resolved_items = []
        order_subtotal = 0.0
        for it in payload.items:
            it_oid = ObjectId(it.item_id) if ObjectId.is_valid(it.item_id) else None
            it_query = {"$and": [self._b_query(business_id), {"_id": it_oid}]} if it_oid else {"$and": [self._b_query(business_id), {"publicItemId": it.item_id}]}
            item_doc = await self.db.items.find_one(it_query)
            
            unit_price = float(it.unit_price) if it.unit_price > 0 else float(item_doc.get("salePrice", 0.0) if item_doc else 0.0)
            item_name = it.name or (item_doc.get("name") if item_doc else "Dish")
            tax_rate = float(item_doc.get("taxRate", 5.0) if item_doc else 5.0)
            line_total = round(unit_price * float(it.quantity), 2)
            order_subtotal += line_total

            resolved_items.append({
                "itemId": it.item_id,
                "name": item_name,
                "variantId": it.variant_id,
                "variantName": it.variant_name,
                "unitPrice": unit_price,
                "quantity": float(it.quantity),
                "notes": it.notes,
                "taxRate": tax_rate,
                "lineTotal": line_total
            })

        order_id = f"ord_{int(now.timestamp())}_{t_oid.binary[-2:].hex()}"
        new_order_entry = {
            "orderId": order_id,
            "source": "QR_CUSTOMER",
            "placedAt": now,
            "approvalStatus": "SUBMITTED",
            "kotId": None,
            "kotNumber": None,
            "customerName": payload.customer_name or table.get("label"),
            "customerPhone": payload.customer_phone,
            "notes": payload.notes,
            "items": resolved_items,
            "orderSubtotal": round(order_subtotal, 2)
        }

        if not session_oid:
            # Create new table session
            new_session_oid = ObjectId()
            session_doc = {
                "_id": new_session_oid,
                "businessId": b_oid,
                "locationId": table.get("locationId"),
                "tableId": t_oid,
                "tableNumber": table.get("tableNumber"),
                "sessionStatus": "ACTIVE",
                "guestCount": 1,
                "customerName": payload.customer_name,
                "customerPhone": payload.customer_phone,
                "orders": [new_order_entry],
                "subtotal": round(order_subtotal, 2),
                "taxTotal": round(order_subtotal * 0.05, 2), # Default rough estimate until settled
                "grandTotal": round(order_subtotal, 2),
                "openedAt": now,
                "closedAt": None
            }
            await self.db.table_sessions.insert_one(session_doc)
            await self.db.tables.update_one(
                {"_id": t_oid},
                {"$set": {"activeSessionId": new_session_oid, "currentStatus": "ORDERING", "updatedAt": now}}
            )
            session_id_str = str(new_session_oid)
        else:
            # Append to existing session
            await self.db.table_sessions.update_one(
                {"_id": session_oid},
                {
                    "$push": {"orders": new_order_entry},
                    "$inc": {"subtotal": order_subtotal, "grandTotal": order_subtotal},
                    "$set": {"updatedAt": now}
                }
            )
            await self.db.tables.update_one(
                {"_id": t_oid},
                {"$set": {"currentStatus": "ORDERING", "updatedAt": now}}
            )
            session_id_str = str(session_oid)

        return {
            "success": True,
            "sessionId": session_id_str,
            "orderId": order_id,
            "tableNumber": table.get("tableNumber"),
            "status": "SUBMITTED",
            "message": "Order submitted successfully! Waiting for cashier approval."
        }

    async def accept_session_order(self, business_id: str, session_id: str, order_id: str, user_name: str) -> Dict[str, Any]:
        s_oid = ObjectId(session_id) if ObjectId.is_valid(session_id) else None
        if not s_oid:
            raise HTTPException(status_code=404, detail="Table session not found")

        session = await self.db.table_sessions.find_one({"_id": s_oid, **self._b_query(business_id)})
        if not session:
            raise HTTPException(status_code=404, detail="Table session not found")

        orders = session.get("orders", [])
        target_order = None
        for o in orders:
            if o.get("orderId") == order_id:
                target_order = o
                break

        if not target_order:
            raise HTTPException(status_code=404, detail="Order not found in session")
        if target_order.get("approvalStatus") == "ACCEPTED":
            return {"success": True, "message": "Order is already accepted", "kotNumber": target_order.get("kotNumber")}

        now = datetime.now(timezone.utc)
        b_oid = ObjectId(business_id) if ObjectId.is_valid(business_id) else business_id
        
        # Calculate sequential round number for this table session
        kot_count = await self.db.kots.count_documents({"sessionId": s_oid})
        round_no = kot_count + 1
        
        # Format KOT number: KOT-YYYYMMDD-001 or KOT-001
        today_str = now.strftime("%Y%m%d")
        daily_kots = await self.db.kots.count_documents({
            **self._b_query(business_id),
            "createdAt": {"$gte": datetime(now.year, now.month, now.day, tzinfo=timezone.utc)}
        })
        kot_number = f"KOT-{daily_kots + 1:03d}"

        kot_oid = ObjectId()
        kot_doc = {
            "_id": kot_oid,
            "businessId": b_oid,
            "locationId": session.get("locationId"),
            "kotNumber": kot_number,
            "sessionId": s_oid,
            "tableId": session.get("tableId"),
            "tableNumber": session.get("tableNumber"),
            "roundNumber": round_no,
            "orderSource": target_order.get("source", "QR_CUSTOMER"),
            "kitchenStatus": "QUEUED",
            "serverName": user_name,
            "items": [
                {
                    "itemId": it.get("itemId"),
                    "name": it.get("name"),
                    "variantName": it.get("variantName"),
                    "quantity": float(it.get("quantity", 1.0)),
                    "notes": it.get("notes")
                }
                for it in target_order.get("items", [])
            ],
            "isPrinted": False,
            "printedAt": None,
            "createdAt": now
        }

        await self.db.kots.insert_one(kot_doc)

        # Update order in session
        target_order["approvalStatus"] = "ACCEPTED"
        target_order["kotId"] = kot_oid
        target_order["kotNumber"] = kot_number
        target_order["acceptedAt"] = now

        await self.db.table_sessions.update_one(
            {"_id": s_oid},
            {"$set": {"orders": orders, "updatedAt": now}}
        )

        # Update table status to OCCUPIED
        await self.db.tables.update_one(
            {"_id": session.get("tableId")},
            {"$set": {"currentStatus": "OCCUPIED", "updatedAt": now}}
        )

        kot_doc["_id"] = str(kot_doc["_id"])
        kot_doc["businessId"] = str(kot_doc["businessId"])
        kot_doc["sessionId"] = str(kot_doc["sessionId"])
        if kot_doc.get("tableId"):
            kot_doc["tableId"] = str(kot_doc["tableId"])

        return {
            "success": True,
            "kot": kot_doc,
            "orderId": order_id,
            "kotNumber": kot_number
        }

    async def reject_session_order(self, business_id: str, session_id: str, order_id: str, reason: str) -> Dict[str, Any]:
        s_oid = ObjectId(session_id) if ObjectId.is_valid(session_id) else None
        if not s_oid:
            raise HTTPException(status_code=404, detail="Session not found")

        session = await self.db.table_sessions.find_one({"_id": s_oid, **self._b_query(business_id)})
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")

        orders = session.get("orders", [])
        found = False
        deduct_subtotal = 0.0
        for o in orders:
            if o.get("orderId") == order_id:
                o["approvalStatus"] = "REJECTED"
                o["rejectionReason"] = reason
                deduct_subtotal = float(o.get("orderSubtotal", 0.0))
                found = True
                break

        if not found:
            raise HTTPException(status_code=404, detail="Order not found")

        now = datetime.now(timezone.utc)
        await self.db.table_sessions.update_one(
            {"_id": s_oid},
            {
                "$set": {"orders": orders, "updatedAt": now},
                "$inc": {"subtotal": -deduct_subtotal, "grandTotal": -deduct_subtotal}
            }
        )

        # Check if table still has active orders
        has_active = any(o.get("approvalStatus") in ("ACCEPTED", "SUBMITTED") for o in orders)
        new_table_status = "OCCUPIED" if has_active else "AVAILABLE"
        await self.db.tables.update_one(
            {"_id": session.get("tableId")},
            {"$set": {"currentStatus": new_table_status, "updatedAt": now}}
        )

        return {"success": True, "orderId": order_id, "status": "REJECTED"}

    async def list_kots(self, business_id: str, location_id: Optional[str] = None, kitchen_status: Optional[str] = None) -> List[Dict[str, Any]]:
        cond = [self._b_query(business_id)]
        if location_id and location_id != "ALL":
            cond.append({"$or": [{"locationId": location_id}, {"locationId": None}]})
        if kitchen_status and kitchen_status != "ALL":
            cond.append({"kitchenStatus": kitchen_status})
        else:
            # Active KOTs by default (exclude SERVED older than today)
            cond.append({"kitchenStatus": {"$in": ["QUEUED", "PREPARING", "READY"]}})

        cursor = self.db.kots.find({"$and": cond}).sort("createdAt", -1).limit(100)
        docs = await cursor.to_list(length=100)

        results = []
        for d in docs:
            d["_id"] = str(d["_id"])
            d["businessId"] = str(d["businessId"])
            d["sessionId"] = str(d["sessionId"])
            if d.get("tableId"):
                d["tableId"] = str(d["tableId"])
            results.append(d)
        return results

    async def update_kot_status(self, business_id: str, kot_id: str, new_status: str) -> Dict[str, Any]:
        k_oid = ObjectId(kot_id) if ObjectId.is_valid(kot_id) else None
        if not k_oid:
            raise HTTPException(status_code=404, detail="KOT not found")

        valid_k_statuses = ("QUEUED", "PREPARING", "READY", "SERVED")
        clean_status = new_status.strip().upper()
        if clean_status not in valid_k_statuses:
            raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of {valid_k_statuses}")

        res = await self.db.kots.find_one_and_update(
            {"_id": k_oid, **self._b_query(business_id)},
            {"$set": {"kitchenStatus": clean_status, "updatedAt": datetime.now(timezone.utc)}},
            return_document=True
        )
        if not res:
            raise HTTPException(status_code=404, detail="KOT not found")
        
        res["_id"] = str(res["_id"])
        res["businessId"] = str(res["businessId"])
        res["sessionId"] = str(res["sessionId"])
        return res

    async def settle_session_bill(
        self,
        business_id: str,
        session_id: str,
        user_id: str,
        user_name: str,
        payload: TableSettleRequest
    ) -> Dict[str, Any]:
        s_oid = ObjectId(session_id) if ObjectId.is_valid(session_id) else None
        if not s_oid:
            raise HTTPException(status_code=404, detail="Table session not found")

        session = await self.db.table_sessions.find_one({"_id": s_oid, **self._b_query(business_id)})
        if not session:
            raise HTTPException(status_code=404, detail="Table session not found")
        if session.get("sessionStatus") == "SETTLED":
            raise HTTPException(status_code=400, detail="Table session is already settled")

        # Collect all accepted items across all rounds
        sale_items = []
        for o in session.get("orders", []):
            if o.get("approvalStatus") == "ACCEPTED":
                for it in o.get("items", []):
                    sale_items.append(SaleItemInput(
                        itemId=it.get("itemId"),
                        quantity=Decimal(str(it.get("quantity", 1.0))),
                        unitPrice=Decimal(str(it.get("unitPrice", 0.0))),
                        taxRate=Decimal(str(it.get("taxRate", 5.0)))
                    ))

        if not sale_items:
            raise HTTPException(status_code=400, detail="No accepted items found to bill for this table session")

        # Get table details for location
        table_oid = session.get("tableId")
        table = await self.db.tables.find_one({"_id": table_oid}) if table_oid else None
        location_id = session.get("locationId") or (table.get("locationId") if table else None)

        # Call authoritative SaleService to generate official invoice
        sale_service = SaleService(self.db)
        customer_name = payload.customer_name or session.get("customerName") or (f"Table {session.get('tableNumber')} Guest")
        customer_phone = payload.customer_phone or session.get("customerPhone")

        disc_type = payload.discount_type
        disc_val = Decimal(str(payload.discount_value)) if payload.discount_value else None
        if disc_val is None and payload.discount_amount is not None:
            disc_type = "FIXED"
            disc_val = Decimal(str(payload.discount_amount))

        sale_request = SaleCreateRequest(
            locationId=location_id,
            consumerName=customer_name,
            consumerPhone=customer_phone,
            items=sale_items,
            paymentMode=payload.payment_mode or "CASH",
            paidAmount=Decimal(str(payload.paid_amount)) if payload.paid_amount is not None else None,
            discountType=disc_type,
            discountValue=disc_val,
            notes=f"Table {session.get('tableNumber')} Dine-In Settlement" + (f": {payload.notes}" if payload.notes else ""),
            billedByName=user_name,
            billedByRole="CASHIER"
        )

        invoice_doc = await sale_service.create_sale(
            business_id=business_id,
            user_id=user_id,
            request=sale_request
        )

        now = datetime.now(timezone.utc)
        # Mark table session SETTLED
        await self.db.table_sessions.update_one(
            {"_id": s_oid},
            {
                "$set": {
                    "sessionStatus": "SETTLED",
                    "settledInvoiceId": invoice_doc.get("_id"),
                    "invoiceNumber": invoice_doc.get("invoiceNumber"),
                    "closedAt": now,
                    "updatedAt": now
                }
            }
        )

        # Mark table CLEANING
        if table_oid:
            await self.db.tables.update_one(
                {"_id": table_oid},
                {"$set": {"currentStatus": "CLEANING", "activeSessionId": None, "updatedAt": now}}
            )

        return {
            "success": True,
            "invoice": invoice_doc,
            "sessionId": session_id,
            "tableStatus": "CLEANING"
        }
