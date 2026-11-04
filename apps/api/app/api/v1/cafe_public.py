from typing import Optional, List, Dict, Any
from bson import ObjectId
from fastapi import APIRouter, HTTPException, Query, status
from app.core.database import db_manager, get_tenant_db
from app.schemas.cafe import (
    PublicOrderSubmitRequest,
    TableSessionStartRequest,
    TableSessionJoinRequest,
)
from app.services.cafe_session_service import (
    CafeSessionService,
    verify_table_qr_token,
    is_table_qr_valid,
    resolve_table_by_number_and_token,
)

router = APIRouter(prefix="/public/cafe", tags=["Public Customer Digital Menu & Ordering"])


async def _resolve_tenant_and_db(business_slug_or_id: str):
    """Resolve tenant from slug or ObjectId, return (tenant_doc, tenant_id_str, tenant_db)."""
    primary_db = db_manager.get_primary_database()
    b_oid = ObjectId(business_slug_or_id) if ObjectId.is_valid(business_slug_or_id) else None
    q = {"_id": b_oid} if b_oid else {"slug": business_slug_or_id}
    tenant = await primary_db.tenants.find_one(q)
    if not tenant:
        raise HTTPException(status_code=404, detail="Store not found")

    tenant_id_str = str(tenant["_id"])
    db = await db_manager.get_tenant_database(tenant_id_str)
    return tenant, tenant_id_str, db


# ---------------------------------------------------------------------------
# Menu endpoint
# ---------------------------------------------------------------------------

@router.get("/{business_slug}/menu")
async def get_public_menu(
    business_slug: str,
    category: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    # Accept table by ID (legacy) or by number (new clean-URL flow)
    table_num: Optional[str] = Query(None, alias="tableNum"),
    table_id: Optional[str] = Query(None, alias="tableId"),
    # Accept token as 't' (short) or 'token' (legacy)
    token: Optional[str] = Query(None, alias="t"),
    token_long: Optional[str] = Query(None, alias="token"),
):
    """
    Public digital menu endpoint for walk-in diners.
    Returns café categories and menu items (filtering out raw materials and unlisted items).
    Accepts both clean-URL (tableNum) and legacy (tableId) parameters.
    """
    resolved_token = token or token_long
    tenant, tenant_id, db = await _resolve_tenant_and_db(business_slug)

    # Resolve table info — prefer tableNum (clean URL), fall back to tableId (legacy)
    table_info = None
    if table_num:
        table_doc = await resolve_table_by_number_and_token(db, tenant_id, table_num, resolved_token)
        if table_doc:
            is_valid_token = is_table_qr_valid(table_doc, resolved_token, tenant_id) if resolved_token else False
            table_info = {
                "id": str(table_doc["_id"]),
                "tableNumber": table_doc.get("tableNumber"),
                "label": table_doc.get("label"),
                "section": table_doc.get("section"),
                "isValidToken": is_valid_token,
            }
    elif table_id:
        t_oid = ObjectId(table_id) if ObjectId.is_valid(table_id) else None
        if t_oid:
            table_doc = await db.tables.find_one({"_id": t_oid, "isActive": True})
            if table_doc:
                is_valid_token = is_table_qr_valid(table_doc, resolved_token, tenant_id) if resolved_token else False
                table_info = {
                    "id": str(table_doc["_id"]),
                    "tableNumber": table_doc.get("tableNumber"),
                    "label": table_doc.get("label"),
                    "section": table_doc.get("section"),
                    "isValidToken": is_valid_token,
                }

    b_oid = ObjectId(tenant_id)
    b_query = {"$or": [{"businessId": b_oid}, {"businessId": tenant_id}]}

    # Query items: only sellable items, not raw materials
    item_cond = [
        b_query,
        {"isActive": True},
        {"itemType": {"$ne": "RAW_MATERIAL"}},
        {"isCustomerVisible": {"$ne": False}}
    ]

    if category and category != "ALL":
        item_cond.append({"category": category})

    if search and search.strip():
        s = search.strip()
        item_cond.append({
            "$or": [
                {"name": {"$regex": s, "$options": "i"}},
                {"category": {"$regex": s, "$options": "i"}},
                {"description": {"$regex": s, "$options": "i"}}
            ]
        })

    items_cursor = db.items.find({"$and": item_cond}).sort("name", 1)
    item_docs = await items_cursor.to_list(length=300)

    cats = set()
    cleaned_items = []
    for d in item_docs:
        cat_name = d.get("category") or "Menu"
        cats.add(cat_name)
        cleaned_items.append({
            "id": str(d.get("_id", "")),
            "name": d.get("name", "Dish"),
            "category": cat_name,
            "salePrice": float(d.get("salePrice", 0.0)),
            "mrp": float(d.get("mrp", d.get("salePrice", 0.0))) if d.get("mrp") else float(d.get("salePrice", 0.0)),
            "taxRate": float(d.get("taxRate", 5.0)),
            "unit": d.get("unit", "portion"),
            "description": d.get("description"),
            "imageUrl": d.get("imageUrl") or (d.get("images", [{}])[0].get("url") if d.get("images") else None),
            "dietaryFlags": d.get("dietaryFlags", {"isVeg": True}),
            "variants": d.get("variants", []),
            "modifiers": d.get("modifiers", [])
        })

    return {
        "storeName": tenant.get("name", "QuickBill Café"),
        "storeSlug": tenant.get("slug"),
        "storeLogo": tenant.get("logoUrl"),
        "table": table_info,
        "categories": sorted(list(cats)),
        "items": cleaned_items
    }


# ---------------------------------------------------------------------------
# Session check (public — no auth required)
# ---------------------------------------------------------------------------

@router.get("/{business_slug}/table/{table_num}/session")
async def check_table_session(
    business_slug: str,
    table_num: str,
    t: Optional[str] = Query(None),
    token: Optional[str] = Query(None),
):
    """
    Public: Check whether a table has an active session.
    Returns session status and whether the QR token is valid.
    Used by the customer landing page to decide which screen to show.
    """
    resolved_token = t or token or ""
    tenant, tenant_id, db = await _resolve_tenant_and_db(business_slug)
    service = CafeSessionService(db)
    result = await service.check_table_session_by_number(tenant_id, table_num, resolved_token)
    result["storeName"] = tenant.get("name", "QuickBill Café")
    result["storeSlug"] = tenant.get("slug")
    result["storeLogo"] = tenant.get("logoUrl")
    return result


# ---------------------------------------------------------------------------
# Start session as HOST (public — no auth required)
# ---------------------------------------------------------------------------

@router.post("/{business_slug}/table/{table_num}/session/start", status_code=status.HTTP_201_CREATED)
async def start_table_session(
    business_slug: str,
    table_num: str,
    body: TableSessionStartRequest,
    t: Optional[str] = Query(None),
    token: Optional[str] = Query(None),
):
    """
    Public: First scanner provides their phone number and becomes the HOST.
    Creates a new table session and returns a memberToken + joinCode.
    The joinCode allows others to join the same table session.
    """
    resolved_token = t or token or ""
    tenant, tenant_id, db = await _resolve_tenant_and_db(business_slug)

    # Resolve table by number and token to ensure correct table is matched
    table = await resolve_table_by_number_and_token(db, tenant_id, table_num, resolved_token)
    if not table:
        raise HTTPException(status_code=404, detail="Table not found")

    service = CafeSessionService(db)
    return await service.start_table_session(
        business_id=tenant_id,
        table_id_str=str(table["_id"]),
        qr_token=resolved_token,
        phone=body.phone.strip(),
        name=body.name.strip() if body.name else None,
        store_name=tenant.get("name", "QuickBill Café"),
    )


# ---------------------------------------------------------------------------
# Join existing session as GUEST (public — no auth required)
# ---------------------------------------------------------------------------

@router.post("/{business_slug}/table/{table_num}/session/join", status_code=status.HTTP_200_OK)
async def join_table_session(
    business_slug: str,
    table_num: str,
    body: TableSessionJoinRequest,
    t: Optional[str] = Query(None),
    token: Optional[str] = Query(None),
):
    """
    Public: Subsequent scanners join an existing table session using the joinCode.
    Returns a memberToken for the joining member.
    """
    resolved_token = t or token or ""
    tenant, tenant_id, db = await _resolve_tenant_and_db(business_slug)

    table = await resolve_table_by_number_and_token(db, tenant_id, table_num, resolved_token)
    if not table:
        raise HTTPException(status_code=404, detail="Table not found")

    service = CafeSessionService(db)
    return await service.join_table_session(
        business_id=tenant_id,
        table_id_str=str(table["_id"]),
        qr_token=resolved_token,
        phone=body.phone.strip(),
        name=body.name.strip() if body.name else None,
        join_code=body.join_code.strip().upper(),
        store_name=tenant.get("name", "QuickBill Café"),
    )


# ---------------------------------------------------------------------------
# Submit order (public — identified by memberToken)
# ---------------------------------------------------------------------------

@router.post("/orders", status_code=status.HTTP_201_CREATED)
async def submit_public_order(
    payload: PublicOrderSubmitRequest,
    business_id: Optional[str] = Query(None, alias="businessId"),
):
    """
    Public order submission endpoint for diners scanning table QR.
    Requires valid HMAC QR token. MemberToken identifies the ordering member.
    """
    if not business_id:
        # Fallback: resolve business from table
        primary_db = db_manager.get_primary_database()
        t_oid = ObjectId(payload.table_id) if ObjectId.is_valid(payload.table_id) else None
        if not t_oid:
            raise HTTPException(status_code=400, detail="Invalid tableId")
        first_t = await primary_db.tenants.find_one({})
        if not first_t:
            raise HTTPException(status_code=404, detail="Store not found")
        business_id = str(first_t["_id"])

    tenant, resolved_biz_id, db = await _resolve_tenant_and_db(business_id)
    service = CafeSessionService(db)
    return await service.submit_public_order(resolved_biz_id, payload)


# ---------------------------------------------------------------------------
# Order status check (public)
# ---------------------------------------------------------------------------

@router.get("/orders/{order_id}/status")
async def check_order_status(
    order_id: str,
    business_id: str = Query(..., alias="businessId")
):
    """
    Real-time status check for diners waiting for order confirmation.
    """
    tenant, resolved_biz_id, db = await _resolve_tenant_and_db(business_id)
    session = await db.table_sessions.find_one({"orders.orderId": order_id})
    if not session:
        raise HTTPException(status_code=404, detail="Order not found")

    target_order = next((o for o in session.get("orders", []) if o.get("orderId") == order_id), None)
    if not target_order:
        raise HTTPException(status_code=404, detail="Order not found")

    return {
        "orderId": order_id,
        "tableNumber": session.get("tableNumber"),
        "status": target_order.get("approvalStatus", "SUBMITTED"),
        "kotNumber": target_order.get("kotNumber"),
        "rejectionReason": target_order.get("rejectionReason")
    }


@router.get("/{business_slug}/table/{table_num}/orders")
async def get_public_table_orders(
    business_slug: str,
    table_num: str,
    t: Optional[str] = Query(None),
    token: Optional[str] = Query(None),
):
    """
    Public: Real-time orders breakdown for diners sitting at table_num.
    Requires valid table QR token (?t=...).
    Returns pending orders, accepted/kitchen orders, rejected orders, and running bill totals.
    """
    resolved_token = t or token or ""
    tenant, tenant_id, db = await _resolve_tenant_and_db(business_slug)
    service = CafeSessionService(db)
    result = await service.get_public_table_orders(tenant_id, table_num, resolved_token)
    result["storeName"] = tenant.get("name", "QuickBill Café")
    result["storeSlug"] = tenant.get("slug")
    return result
