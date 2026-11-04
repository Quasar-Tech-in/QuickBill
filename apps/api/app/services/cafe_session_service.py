import copy
import hmac
import hashlib
import base64
import re
import secrets
import string
import uuid
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
    TableSessionStartRequest,
    TableSessionJoinRequest,
    TableSettleRequest,
    KOTResponse,
    TableSessionResponse,
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


def is_table_qr_valid(table_doc: Optional[Dict[str, Any]], qr_token: str, business_id: str) -> bool:
    """
    Validates QR token against:
    1. Direct match on table_doc.qrCodeToken or qrCodeSecret (constant time comparison)
    2. HMAC generated using business_id and table_doc._id
    3. HMAC generated using table_doc.businessId and table_doc._id
    """
    if not qr_token or not table_doc:
        return False
    stored_token = table_doc.get("qrCodeToken") or table_doc.get("qrCodeSecret")
    if stored_token and hmac.compare_digest(qr_token, stored_token):
        return True
    t_id = str(table_doc.get("_id", ""))
    if verify_table_qr_token(qr_token, business_id, t_id):
        return True
    doc_biz = str(table_doc.get("businessId", ""))
    if doc_biz and doc_biz != business_id and verify_table_qr_token(qr_token, doc_biz, t_id):
        return True
    return False


async def resolve_table_by_number_and_token(
    db: AsyncIOMotorDatabase, business_id: str, table_num: str, qr_token: Optional[str] = None
) -> Optional[Dict[str, Any]]:
    """
    Resolves the exact dining table matching a table number and optional QR token.
    Prioritizes the table that generated the token (handling duplicate table names or recreations).
    """
    clean_num = table_num.strip().upper()
    num_filter = {"$or": [{"tableNumber": clean_num}, {"tableNumber": int(clean_num)}]} if clean_num.isdigit() else {"tableNumber": clean_num}

    # 1. If qr_token is provided, prioritize exact match on qrCodeToken / qrCodeSecret
    if qr_token:
        exact = await db.tables.find_one({
            "isActive": True,
            "$or": [{"qrCodeToken": qr_token}, {"qrCodeSecret": qr_token}]
        })
        if exact:
            return exact

    # 2. Search active tables with this number, newest first
    cursor = db.tables.find({
        "isActive": True,
        **num_filter,
    }).sort([("updatedAt", -1), ("createdAt", -1)]).limit(10)
    candidates = await cursor.to_list(length=10)

    if not candidates:
        return None

    # 3. If qr_token is provided, find which candidate matches HMAC or stored token
    if qr_token:
        for t in candidates:
            if is_table_qr_valid(t, qr_token, business_id):
                return t

    # 4. Fallback to newest candidate
    return candidates[0]


def _generate_join_code() -> str:
    """Generate a 6-char uppercase alphanumeric join code."""
    alphabet = string.ascii_uppercase + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(6))


def _generate_member_token(session_id: str, member_id: str, secret: Optional[str] = None) -> str:
    """HMAC-signed member identity token (stateless, no DB lookup needed)."""
    sec = secret or settings.JWT_SECRET
    msg = f"{session_id}:{member_id}".encode("utf-8")
    sig = hmac.new(sec.encode("utf-8"), msg, hashlib.sha256).digest()
    return base64.urlsafe_b64encode(sig).decode("utf-8").rstrip("=")


def verify_member_token(token: str, session_id: str, member_id: str, secret: Optional[str] = None) -> bool:
    """Verify a member token against the expected HMAC."""
    try:
        expected = _generate_member_token(session_id, member_id, secret)
        return hmac.compare_digest(token, expected)
    except Exception:
        return False


class CafeSessionService:
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db

    def _b_query(self, business_id: str) -> dict:
        b_oid = ObjectId(business_id) if ObjectId.is_valid(business_id) else None
        return {"$or": [{"businessId": b_oid}, {"businessId": business_id}]} if b_oid else {"businessId": business_id}

    # ------------------------------------------------------------------
    # Tables
    # ------------------------------------------------------------------

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

    async def create_table(self, business_id: str, payload: TableCreate, business_slug: Optional[str] = None) -> Dict[str, Any]:
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

        # Build clean, human-readable QR URL using slug + table number
        slug = business_slug or business_id
        qr_url = f"/menu/{slug}/{clean_table_no}?t={token}"

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

        now_utc = datetime.now(timezone.utc)
        update_set: dict = {
            "currentStatus": clean_status,
            "updatedAt": now_utc
        }

        # When freeing or cleaning the table, clear activeSessionId and close active sessions
        if clean_status in ("AVAILABLE", "CLEANING"):
            update_set["activeSessionId"] = None
            await self.db.table_sessions.update_many(
                {"tableId": t_oid, "sessionStatus": "ACTIVE"},
                {
                    "$set": {
                        "sessionStatus": "CLOSED",
                        "joinCode": None,
                        "closedAt": now_utc,
                        "updatedAt": now_utc,
                    }
                }
            )

        res = await self.db.tables.find_one_and_update(
            {"_id": t_oid, **self._b_query(business_id)},
            {"$set": update_set},
            return_document=True
        )
        if not res:
            res = await self.db.tables.find_one_and_update(
                {"_id": t_oid},
                {"$set": update_set},
                return_document=True
            )
        if not res:
            raise HTTPException(status_code=404, detail="Table not found")

        # When staff manually marks a table as OCCUPIED (e.g. seating walk-in guests):
        if clean_status == "OCCUPIED" and not res.get("activeSessionId"):
            existing_sess = await self.db.table_sessions.find_one({
                "tableId": t_oid,
                "sessionStatus": "ACTIVE"
            })
            if existing_sess:
                res["activeSessionId"] = str(existing_sess["_id"])
                await self.db.tables.update_one(
                    {"_id": t_oid},
                    {"$set": {"activeSessionId": existing_sess["_id"]}}
                )
            else:
                new_session_oid = ObjectId()
                table_no = res.get("tableNumber", "")
                table_lbl = res.get("label") or f"Table {table_no}"
                sess_doc = {
                    "_id": new_session_oid,
                    "businessId": res.get("businessId"),
                    "locationId": res.get("locationId"),
                    "tableId": t_oid,
                    "tableNumber": table_no,
                    "sessionStatus": "ACTIVE",
                    "joinCode": _generate_join_code(),
                    "members": [],
                    "guestCount": 1,
                    "customerName": f"Walk-in ({table_lbl})",
                    "customerPhone": None,
                    "orders": [],
                    "subtotal": 0.0,
                    "taxTotal": 0.0,
                    "grandTotal": 0.0,
                    "openedAt": now_utc,
                    "closedAt": None,
                }
                await self.db.table_sessions.insert_one(sess_doc)
                await self.db.tables.update_one(
                    {"_id": t_oid},
                    {"$set": {"activeSessionId": new_session_oid}}
                )
                res["activeSessionId"] = str(new_session_oid)

        res["_id"] = str(res["_id"])
        res["businessId"] = str(res["businessId"])
        if res.get("activeSessionId"):
            res["activeSessionId"] = str(res["activeSessionId"])
        res["qrCodeToken"] = res.get("qrCodeSecret") or res.get("qrCodeToken")
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

    # ------------------------------------------------------------------
    # Active sessions list (admin/cashier)
    # ------------------------------------------------------------------

    async def get_active_sessions(self, business_id: str, location_id: Optional[str] = None) -> List[Dict[str, Any]]:
        cond = [self._b_query(business_id), {"sessionStatus": {"$in": ["ACTIVE", "BILLING"]}}]
        if location_id and location_id != "ALL":
            cond.append({"$or": [{"locationId": location_id}, {"locationId": None}]})

        cursor = self.db.table_sessions.find({"$and": cond}).sort("openedAt", -1)
        docs = await cursor.to_list(length=100)

        results = []
        for d in docs:
            sid = str(d["_id"])
            d["_id"] = sid
            d["id"] = sid
            d["businessId"] = str(d["businessId"])
            d["tableId"] = str(d["tableId"])
            for o in d.get("orders", []):
                if o.get("kotId") is not None:
                    o["kotId"] = str(o["kotId"])
            results.append(d)
        return results

    # ------------------------------------------------------------------
    # Host/Join session management (public — no auth required)
    # ------------------------------------------------------------------

    async def check_table_session(
        self, business_id: str, table_id_str: str, qr_token: str
    ) -> Dict[str, Any]:
        """
        Public: check whether a table has an active session and whether the QR token is valid.
        Used by the customer-facing landing page to decide which screen to show.
        """
        t_oid = ObjectId(table_id_str) if ObjectId.is_valid(table_id_str) else None
        if not t_oid:
            raise HTTPException(status_code=404, detail="Table not found")

        table = await self.db.tables.find_one({"_id": t_oid, **self._b_query(business_id), "isActive": True})
        if not table:
            table = await self.db.tables.find_one({"_id": t_oid, "isActive": True})
        if not table:
            raise HTTPException(status_code=404, detail="Table not found or inactive")

        qr_valid = is_table_qr_valid(table, qr_token, business_id)

        session = await self.db.table_sessions.find_one({
            "tableId": t_oid,
            "sessionStatus": "ACTIVE"
        })

        return {
            "tableId": str(t_oid),
            "tableNumber": table.get("tableNumber"),
            "tableLabel": table.get("label"),
            "hasActiveSession": bool(session),
            "sessionId": str(session["_id"]) if session else None,
            "qrValid": qr_valid,
        }

    async def check_table_session_by_number(
        self, business_id: str, table_number: str, qr_token: str
    ) -> Dict[str, Any]:
        """
        Public: check session status by table number (clean-URL version).
        Resolves table with token preference.
        """
        table = await resolve_table_by_number_and_token(self.db, business_id, table_number, qr_token)
        if not table:
            raise HTTPException(status_code=404, detail="Table not found")

        table_id_str = str(table["_id"])
        qr_valid = is_table_qr_valid(table, qr_token, business_id)

        session = await self.db.table_sessions.find_one({
            "tableId": table["_id"],
            "sessionStatus": "ACTIVE"
        })

        return {
            "tableId": table_id_str,
            "tableNumber": table.get("tableNumber"),
            "tableLabel": table.get("label"),
            "hasActiveSession": bool(session),
            "sessionId": str(session["_id"]) if session else None,
            "joinCode": session.get("joinCode") if session else None,
            "qrValid": qr_valid,
        }

    async def start_table_session(
        self, business_id: str, table_id_str: str, qr_token: str,
        phone: str, name: Optional[str], store_name: str
    ) -> Dict[str, Any]:
        """
        Public: First scanner becomes HOST and opens a new table session.
        Validates QR token. Returns memberToken + joinCode.
        """
        t_oid = ObjectId(table_id_str) if ObjectId.is_valid(table_id_str) else None
        if not t_oid:
            raise HTTPException(status_code=404, detail="Table not found")

        table = await self.db.tables.find_one({"_id": t_oid, **self._b_query(business_id), "isActive": True})
        if not table:
            table = await self.db.tables.find_one({"_id": t_oid, "isActive": True})
        if not table:
            raise HTTPException(status_code=404, detail="Table not found or inactive")

        # Validate QR token
        if not is_table_qr_valid(table, qr_token, business_id):
            raise HTTPException(status_code=403, detail="Invalid or expired QR code. Please scan the QR on your table.")

        # Check if an active session already exists
        existing_session = await self.db.table_sessions.find_one({
            "tableId": t_oid,
            "sessionStatus": "ACTIVE"
        })
        if existing_session:
            # Session already exists — check if this phone is already the host
            existing_members = existing_session.get("members", [])
            for m in existing_members:
                if m.get("phone") == phone and m.get("role") == "HOST":
                    # Restore host's session
                    member_token = _generate_member_token(str(existing_session["_id"]), m["memberId"])
                    return {
                        "sessionId": str(existing_session["_id"]),
                        "memberId": m["memberId"],
                        "memberToken": member_token,
                        "role": "HOST",
                        "joinCode": existing_session.get("joinCode", ""),
                        "tableId": str(t_oid),
                        "tableNumber": table.get("tableNumber"),
                        "tableLabel": table.get("label"),
                        "storeName": store_name,
                        "restored": True,
                    }
            raise HTTPException(
                status_code=409,
                detail="Table already has an active session. Ask the host for the join code."
            )

        now = datetime.now(timezone.utc)
        b_oid = ObjectId(business_id) if ObjectId.is_valid(business_id) else business_id

        # Upsert customer by phone
        await self._upsert_customer(b_oid, phone, name)

        member_id = str(uuid.uuid4())
        session_oid = ObjectId()
        member_token = _generate_member_token(str(session_oid), member_id)
        join_code = _generate_join_code()

        session_doc = {
            "_id": session_oid,
            "businessId": b_oid,
            "locationId": table.get("locationId"),
            "tableId": t_oid,
            "tableNumber": table.get("tableNumber"),
            "sessionStatus": "ACTIVE",
            "joinCode": join_code,
            "members": [{
                "memberId": member_id,
                "phone": phone,
                "name": name,
                "role": "HOST",
                "joinedAt": now,
                "memberToken": member_token,
            }],
            "guestCount": 1,
            # Legacy fields kept for compatibility with existing settle flow
            "customerName": name,
            "customerPhone": phone,
            "orders": [],
            "subtotal": 0.0,
            "taxTotal": 0.0,
            "grandTotal": 0.0,
            "openedAt": now,
            "closedAt": None,
        }

        await self.db.table_sessions.insert_one(session_doc)
        await self.db.tables.update_one(
            {"_id": t_oid},
            {"$set": {"activeSessionId": session_oid, "currentStatus": "OCCUPIED", "updatedAt": now}}
        )

        return {
            "sessionId": str(session_oid),
            "memberId": member_id,
            "memberToken": member_token,
            "role": "HOST",
            "joinCode": join_code,
            "tableId": str(t_oid),
            "tableNumber": table.get("tableNumber"),
            "tableLabel": table.get("label"),
            "storeName": store_name,
            "restored": False,
        }

    async def join_table_session(
        self, business_id: str, table_id_str: str, qr_token: str,
        phone: str, name: Optional[str], join_code: str, store_name: str
    ) -> Dict[str, Any]:
        """
        Public: Subsequent scanner joins an existing session as GUEST.
        Validates joinCode. Returns memberToken.
        """
        t_oid = ObjectId(table_id_str) if ObjectId.is_valid(table_id_str) else None
        if not t_oid:
            raise HTTPException(status_code=404, detail="Table not found")

        table = await self.db.tables.find_one({"_id": t_oid, **self._b_query(business_id), "isActive": True})
        if not table:
            table = await self.db.tables.find_one({"_id": t_oid, "isActive": True})
        if not table:
            raise HTTPException(status_code=404, detail="Table not found or inactive")

        # Validate QR token
        if not is_table_qr_valid(table, qr_token, business_id):
            raise HTTPException(status_code=403, detail="Invalid or expired QR code. Please scan the QR on your table.")

        session = await self.db.table_sessions.find_one({
            "tableId": t_oid,
            "sessionStatus": "ACTIVE"
        })
        if not session:
            raise HTTPException(status_code=404, detail="No active session found for this table. Ask the host to start a session first.")

        # Validate join code
        if session.get("joinCode", "").upper() != join_code.strip().upper():
            raise HTTPException(status_code=403, detail="Incorrect join code. Please ask the host for the correct code.")

        # Check if this phone already joined
        existing_members = session.get("members", [])
        for m in existing_members:
            if m.get("phone") == phone:
                # Re-issue token for returning member
                member_token = _generate_member_token(str(session["_id"]), m["memberId"])
                return {
                    "sessionId": str(session["_id"]),
                    "memberId": m["memberId"],
                    "memberToken": member_token,
                    "role": m.get("role", "GUEST"),
                    "tableId": str(t_oid),
                    "tableNumber": table.get("tableNumber"),
                    "tableLabel": table.get("label"),
                    "storeName": store_name,
                    "restored": True,
                }

        now = datetime.now(timezone.utc)
        b_oid = ObjectId(business_id) if ObjectId.is_valid(business_id) else business_id

        # Upsert customer
        await self._upsert_customer(b_oid, phone, name)

        member_id = str(uuid.uuid4())
        member_token = _generate_member_token(str(session["_id"]), member_id)

        new_member = {
            "memberId": member_id,
            "phone": phone,
            "name": name,
            "role": "GUEST",
            "joinedAt": now,
            "memberToken": member_token,
        }

        await self.db.table_sessions.update_one(
            {"_id": session["_id"]},
            {
                "$push": {"members": new_member},
                "$inc": {"guestCount": 1},
                "$set": {"updatedAt": now}
            }
        )

        return {
            "sessionId": str(session["_id"]),
            "memberId": member_id,
            "memberToken": member_token,
            "role": "GUEST",
            "tableId": str(t_oid),
            "tableNumber": table.get("tableNumber"),
            "tableLabel": table.get("label"),
            "storeName": store_name,
            "restored": False,
        }

    async def _upsert_customer(self, b_oid: Any, phone: str, name: Optional[str]) -> None:
        """Create or update a customer record by phone number."""
        try:
            now = datetime.now(timezone.utc)
            await self.db.parties.update_one(
                {"phone": phone, "businessId": b_oid, "type": "CUSTOMER"},
                {
                    "$setOnInsert": {
                        "businessId": b_oid,
                        "phone": phone,
                        "type": "CUSTOMER",
                        "createdAt": now,
                    },
                    "$set": {
                        "updatedAt": now,
                        **({"name": name} if name else {}),
                    }
                },
                upsert=True
            )
        except Exception:
            # Non-fatal — customer upsert failure should not block ordering
            pass

    # ------------------------------------------------------------------
    # Public order submission
    # ------------------------------------------------------------------

    async def submit_public_order(self, business_id: str, payload: PublicOrderSubmitRequest) -> Dict[str, Any]:
        t_oid = ObjectId(payload.table_id) if ObjectId.is_valid(payload.table_id) else None
        if not t_oid:
            raise HTTPException(status_code=404, detail="Table not found")

        table = await self.db.tables.find_one({"_id": t_oid, **self._b_query(business_id), "isActive": True})
        if not table:
            table = await self.db.tables.find_one({"_id": t_oid, "isActive": True})
        if not table:
            raise HTTPException(status_code=404, detail="Active table not found")

        # Verify HMAC QR token
        if not is_table_qr_valid(table, payload.qr_token, business_id):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid or expired table QR token")

        # If memberToken provided, resolve member identity from the active session
        member_phone = payload.customer_phone
        member_name = payload.customer_name
        if payload.member_token:
            active_session = await self.db.table_sessions.find_one({
                "tableId": t_oid,
                "sessionStatus": "ACTIVE"
            })
            if active_session:
                if active_session.get("sessionStatus") == "SETTLED":
                    raise HTTPException(status_code=410, detail="Table session is already closed. Please ask for a new QR code.")
                for m in active_session.get("members", []):
                    if verify_member_token(payload.member_token, str(active_session["_id"]), m["memberId"]):
                        member_phone = m.get("phone")
                        member_name = m.get("name")
                        break

        now = datetime.now(timezone.utc)
        b_oid = ObjectId(business_id) if ObjectId.is_valid(business_id) else business_id
        session_oid = table.get("activeSessionId")

        # Resolve live item details and prices
        resolved_items = []
        order_subtotal = 0.0
        for it in payload.items:
            it_oid = ObjectId(it.item_id) if ObjectId.is_valid(it.item_id) else None
            it_query = (
                {"$and": [self._b_query(business_id), {"_id": it_oid}]}
                if it_oid
                else {"$and": [self._b_query(business_id), {"publicItemId": it.item_id}]}
            )
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
            "customerName": member_name or table.get("label"),
            "customerPhone": member_phone,
            "memberToken": payload.member_token,
            "notes": payload.notes,
            "items": resolved_items,
            "orderSubtotal": round(order_subtotal, 2)
        }

        if not session_oid:
            # Create new table session (no host flow — direct QR scan without registration)
            new_session_oid = ObjectId()
            session_doc = {
                "_id": new_session_oid,
                "businessId": b_oid,
                "locationId": table.get("locationId"),
                "tableId": t_oid,
                "tableNumber": table.get("tableNumber"),
                "sessionStatus": "ACTIVE",
                "joinCode": _generate_join_code(),
                "members": [],
                "guestCount": 1,
                "customerName": member_name,
                "customerPhone": member_phone,
                "orders": [new_order_entry],
                "subtotal": round(order_subtotal, 2),
                "taxTotal": round(order_subtotal * 0.05, 2),
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

    # ------------------------------------------------------------------
    # Order approval / rejection
    # ------------------------------------------------------------------

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

        # Format KOT number: KOT-YYYYMMDD-001
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
        target_order["kotId"] = str(kot_oid)
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

    async def update_session_order(
        self,
        business_id: str,
        session_id: str,
        order_id: str,
        items: List[Dict[str, Any]],
        notes: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Staff updates an order within a table session (modifying quantities, adding/deleting items, notes).
        Recalculates item line totals, order subtotal, and table session subtotal/grandTotal.
        """
        s_oid = ObjectId(session_id) if ObjectId.is_valid(session_id) else None
        if not s_oid:
            raise HTTPException(status_code=404, detail="Table session not found")

        session = await self.db.table_sessions.find_one({"_id": s_oid, **self._b_query(business_id)})
        if not session:
            raise HTTPException(status_code=404, detail="Table session not found")

        orders = session.get("orders", [])
        target_order = next((o for o in orders if o.get("orderId") == order_id), None)
        if not target_order:
            raise HTTPException(status_code=404, detail="Order not found in session")

        resolved_items = []
        new_order_subtotal = 0.0
        for it in items:
            q = float(it.get("quantity", 1))
            if q <= 0:
                continue
            up = float(it.get("unitPrice", 0.0))
            lt = round(q * up, 2)
            new_order_subtotal += lt
            resolved_items.append({
                "itemId": it.get("itemId"),
                "name": it.get("name") or "Item",
                "variantId": it.get("variantId"),
                "variantName": it.get("variantName"),
                "unitPrice": up,
                "quantity": q,
                "notes": it.get("notes"),
                "taxRate": float(it.get("taxRate", 5.0)),
                "lineTotal": lt
            })

        if not resolved_items:
            raise HTTPException(
                status_code=400,
                detail="Order must contain at least one item. To cancel the order, please use reject."
            )

        target_order["items"] = resolved_items
        target_order["orderSubtotal"] = round(new_order_subtotal, 2)
        if notes is not None:
            target_order["notes"] = notes

        now = datetime.now(timezone.utc)
        target_order["updatedAt"] = now

        # Recalculate totals across all ACCEPTED orders
        accepted_subtotal = 0.0
        tax_rate_effective = 0.05
        for o in orders:
            if o.get("approvalStatus") == "ACCEPTED":
                accepted_subtotal += float(o.get("orderSubtotal", 0.0))

        tot_tax = round(accepted_subtotal * tax_rate_effective, 2)
        tot_grand = round(accepted_subtotal + tot_tax, 2)

        # If order already has a KOT, update KOT items as well
        kot_id = target_order.get("kotId")
        if kot_id:
            k_oid = ObjectId(kot_id) if ObjectId.is_valid(str(kot_id)) else None
            if k_oid:
                await self.db.kots.update_one(
                    {"_id": k_oid},
                    {"$set": {"items": resolved_items, "specialInstructions": notes or target_order.get("notes"), "updatedAt": now}}
                )

        await self.db.table_sessions.update_one(
            {"_id": s_oid},
            {
                "$set": {
                    "orders": orders,
                    "subtotal": round(accepted_subtotal, 2),
                    "taxTotal": tot_tax,
                    "grandTotal": tot_grand,
                    "updatedAt": now
                }
            }
        )

        return {
            "success": True,
            "orderId": order_id,
            "order": target_order,
            "subtotal": round(accepted_subtotal, 2),
            "grandTotal": tot_grand
        }

    async def get_public_table_orders(
        self, business_id: str, table_number: str, qr_token: str
    ) -> Dict[str, Any]:
        """
        Public: Real-time orders breakdown for diners sitting at table_number.
        Validates table QR token and returns pending, accepted, and rejected orders.
        """
        table = await resolve_table_by_number_and_token(self.db, business_id, table_number, qr_token)
        if not table:
            raise HTTPException(status_code=404, detail="Table not found")

        if not is_table_qr_valid(table, qr_token, business_id):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid or expired table QR token")

        session = await self.db.table_sessions.find_one({
            "tableId": table["_id"],
            "sessionStatus": {"$in": ["ACTIVE", "BILLING"]}
        })

        if not session:
            return {
                "sessionId": "",
                "tableId": str(table["_id"]),
                "tableNumber": table.get("tableNumber"),
                "tableLabel": table.get("label"),
                "sessionStatus": "NONE",
                "subtotal": 0.0,
                "taxTotal": 0.0,
                "grandTotal": 0.0,
                "pendingOrders": [],
                "acceptedOrders": [],
                "rejectedOrders": [],
                "allOrders": []
            }

        orders = session.get("orders", [])
        pending = []
        accepted = []
        rejected = []

        for o in orders:
            o_clean = copy.deepcopy(o)
            if "kotId" in o_clean and o_clean["kotId"]:
                o_clean["kotId"] = str(o_clean["kotId"])
            if "placedAt" in o_clean and isinstance(o_clean["placedAt"], datetime):
                o_clean["placedAt"] = o_clean["placedAt"].isoformat()
            if "acceptedAt" in o_clean and isinstance(o_clean["acceptedAt"], datetime):
                o_clean["acceptedAt"] = o_clean["acceptedAt"].isoformat()
            if "updatedAt" in o_clean and isinstance(o_clean["updatedAt"], datetime):
                o_clean["updatedAt"] = o_clean["updatedAt"].isoformat()

            st = o_clean.get("approvalStatus", "SUBMITTED")
            if st == "SUBMITTED":
                pending.append(o_clean)
            elif st == "ACCEPTED":
                accepted.append(o_clean)
            elif st == "REJECTED":
                rejected.append(o_clean)

        return {
            "sessionId": str(session["_id"]),
            "tableId": str(table["_id"]),
            "tableNumber": table.get("tableNumber"),
            "tableLabel": table.get("label"),
            "sessionStatus": session.get("sessionStatus", "ACTIVE"),
            "subtotal": float(session.get("subtotal", 0.0)),
            "taxTotal": float(session.get("taxTotal", 0.0)),
            "grandTotal": float(session.get("grandTotal", 0.0)),
            "pendingOrders": pending,
            "acceptedOrders": accepted,
            "rejectedOrders": rejected,
            "allOrders": pending + accepted + rejected
        }

    # ------------------------------------------------------------------
    # Force-close session (admin/cashier)
    # ------------------------------------------------------------------

    async def force_close_session(self, business_id: str, session_id: str, user_id: str) -> Dict[str, Any]:
        """
        Admin/cashier force-closes an active table session.
        Invalidates the joinCode so no new members/orders can be submitted.
        Table is set to CLEANING.
        """
        s_oid = ObjectId(session_id) if ObjectId.is_valid(session_id) else None
        if not s_oid:
            raise HTTPException(status_code=404, detail="Table session not found")

        session = await self.db.table_sessions.find_one({"_id": s_oid, **self._b_query(business_id)})
        if not session:
            raise HTTPException(status_code=404, detail="Table session not found")
        if session.get("sessionStatus") in ("SETTLED", "CLOSED"):
            raise HTTPException(status_code=400, detail=f"Session is already {session.get('sessionStatus').lower()}")

        now = datetime.now(timezone.utc)
        await self.db.table_sessions.update_one(
            {"_id": s_oid},
            {
                "$set": {
                    "sessionStatus": "CLOSED",
                    "joinCode": None,
                    "closedAt": now,
                    "closedByUserId": user_id,
                    "updatedAt": now,
                }
            }
        )

        # Release table
        table_oid = session.get("tableId")
        if table_oid:
            await self.db.tables.update_one(
                {"_id": table_oid},
                {"$set": {"currentStatus": "CLEANING", "activeSessionId": None, "updatedAt": now}}
            )

        return {"success": True, "sessionId": session_id, "tableStatus": "CLEANING"}

    # ------------------------------------------------------------------
    # KOT management
    # ------------------------------------------------------------------

    async def list_kots(self, business_id: str, location_id: Optional[str] = None, kitchen_status: Optional[str] = None) -> List[Dict[str, Any]]:
        cond = [self._b_query(business_id)]
        if location_id and location_id != "ALL":
            cond.append({"$or": [{"locationId": location_id}, {"locationId": None}]})
        if kitchen_status and kitchen_status != "ALL":
            cond.append({"kitchenStatus": kitchen_status})
        else:
            # Active KOTs by default (exclude SERVED)
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

    # ------------------------------------------------------------------
    # Bill settlement
    # ------------------------------------------------------------------

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

        # Resolve customer name/phone — prefer payload, then session host member, then session-level field
        customer_name = payload.customer_name or session.get("customerName")
        customer_phone = payload.customer_phone or session.get("customerPhone")
        if not customer_name:
            members = session.get("members", [])
            host = next((m for m in members if m.get("role") == "HOST"), members[0] if members else None)
            if host:
                customer_name = host.get("name") or f"Table {session.get('tableNumber')} Guest"
                customer_phone = customer_phone or host.get("phone")
        customer_name = customer_name or f"Table {session.get('tableNumber')} Guest"

        disc_type = payload.discount_type
        disc_val = Decimal(str(payload.discount_value)) if payload.discount_value else None
        if disc_val is None and payload.discount_amount is not None:
            disc_type = "FIXED"
            disc_val = Decimal(str(payload.discount_amount))

        sale_service = SaleService(self.db)
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
        # Mark table session SETTLED and invalidate join code
        await self.db.table_sessions.update_one(
            {"_id": s_oid},
            {
                "$set": {
                    "sessionStatus": "SETTLED",
                    "joinCode": None,
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
