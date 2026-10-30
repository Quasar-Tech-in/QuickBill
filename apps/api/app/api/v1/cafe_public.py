from typing import Optional, List, Dict, Any
from bson import ObjectId
from fastapi import APIRouter, HTTPException, Query, status
from app.core.database import db_manager, get_tenant_db
from app.schemas.cafe import PublicOrderSubmitRequest
from app.services.cafe_session_service import CafeSessionService, verify_table_qr_token

router = APIRouter(prefix="/public/cafe", tags=["Public Customer Digital Menu & Ordering"])

async def _resolve_tenant_and_db(business_slug_or_id: str):
    primary_db = db_manager.get_primary_database()
    b_oid = ObjectId(business_slug_or_id) if ObjectId.is_valid(business_slug_or_id) else None
    q = {"_id": b_oid} if b_oid else {"slug": business_slug_or_id}
    tenant = await primary_db.tenants.find_one(q)
    if not tenant:
        raise HTTPException(status_code=404, detail="Store not found")

    tenant_id_str = str(tenant["_id"])
    db = await db_manager.get_tenant_database(tenant_id_str)
    return tenant, tenant_id_str, db

@router.get("/{business_slug}/menu")
async def get_public_menu(
    business_slug: str,
    category: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    table_id: Optional[str] = Query(None, alias="tableId"),
    token: Optional[str] = Query(None),
):
    """
    Public digital menu endpoint for walk-in diners.
    Returns café categories and menu items (filtering out raw materials and unlisted items).
    """
    tenant, tenant_id, db = await _resolve_tenant_and_db(business_slug)

    # Optional table info if table_id is provided
    table_info = None
    if table_id:
        t_oid = ObjectId(table_id) if ObjectId.is_valid(table_id) else None
        if t_oid:
            table_doc = await db.tables.find_one({"_id": t_oid, "isActive": True})
            if table_doc:
                is_valid_token = verify_table_qr_token(token, tenant_id, str(t_oid)) if token else False
                table_info = {
                    "id": str(table_doc["_id"]),
                    "tableNumber": table_doc.get("tableNumber"),
                    "label": table_doc.get("label"),
                    "section": table_doc.get("section"),
                    "isValidToken": is_valid_token
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

    # Extract distinct categories
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
        "storeLogo": tenant.get("logoUrl"),
        "table": table_info,
        "categories": sorted(list(cats)),
        "items": cleaned_items
    }

@router.post("/orders", status_code=status.HTTP_201_CREATED)
async def submit_public_order(
    payload: PublicOrderSubmitRequest,
    business_id: Optional[str] = Query(None, alias="businessId"),
):
    """
    Public order submission endpoint for diners scanning table QR.
    Requires valid HMAC QR token.
    """
    if not business_id:
        # Fallback: resolve table in primary or default tenant database
        primary_db = db_manager.get_primary_database()
        t_oid = ObjectId(payload.table_id) if ObjectId.is_valid(payload.table_id) else None
        if not t_oid:
            raise HTTPException(status_code=400, detail="Invalid tableId")
        table = await primary_db.tables.find_one({"_id": t_oid})
        if not table:
            first_t = await primary_db.tenants.find_one({})
            if not first_t:
                raise HTTPException(status_code=404, detail="Store not found")
            business_id = str(first_t["_id"])
        else:
            business_id = str(table.get("businessId"))

    tenant, resolved_biz_id, db = await _resolve_tenant_and_db(business_id)
    service = CafeSessionService(db)
    return await service.submit_public_order(resolved_biz_id, payload)

@router.get("/orders/{order_id}/status")
async def check_order_status(
    order_id: str,
    business_id: str = Query(..., alias="businessId")
):
    """
    Real-time status check for diners waiting for order confirmation.
    """
    tenant, resolved_biz_id, db = await _resolve_tenant_and_db(business_id)
    session = await db.table_sessions.find_one({
        "orders.orderId": order_id
    })
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

