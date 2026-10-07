from datetime import datetime, timezone
from typing import Optional, List
from bson import ObjectId
from fastapi import APIRouter, Depends, Query, status, HTTPException
from app.core.database import get_tenant_db, get_database
from app.core.security import get_current_business_id
from app.schemas.common import PaginatedResponse
from app.schemas.inventory import InventoryMovementResponse

router = APIRouter(prefix="/inventory", tags=["Inventory Ledger & Movements"])


def _to_movement_response(doc: dict) -> InventoryMovementResponse:
    item_name = doc.get("itemName") or doc.get("item_name") or doc.get("name") or "Product"
    sku = doc.get("sku") or ""
    item_id = str(doc.get("itemId") or doc.get("item_id") or "")
    m_type = str(doc.get("type") or doc.get("movementType") or "MANUAL_ADJUSTMENT")
    
    qty_change = float(doc.get("quantityChange") if doc.get("quantityChange") is not None else (doc.get("quantity_change") if doc.get("quantity_change") is not None else (doc.get("quantity") or 0.0)))
    qty_before = float(doc.get("quantityBefore") if doc.get("quantityBefore") is not None else (doc.get("quantity_before") or 0.0))
    qty_after = float(doc.get("quantityAfter") if doc.get("quantityAfter") is not None else (doc.get("quantity_after") or 0.0))
    unit_cost = float(doc.get("unitCost") if doc.get("unitCost") is not None else (doc.get("unit_cost") or 0.0))
    total_cost = float(doc.get("totalCost") if doc.get("totalCost") is not None else (doc.get("total_cost") or (abs(qty_change) * unit_cost)))

    created_at = doc.get("createdAt")
    if isinstance(created_at, str):
        try:
            created_at = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
        except Exception:
            created_at = datetime.now(timezone.utc)
    elif not isinstance(created_at, datetime):
        created_at = datetime.now(timezone.utc)

    return InventoryMovementResponse(
        _id=str(doc.get("_id", "")),
        businessId=str(doc.get("businessId", "")),
        itemId=item_id,
        publicItemId=doc.get("publicItemId") or doc.get("public_item_id"),
        itemName=item_name,
        sku=sku,
        locationId=str(doc.get("locationId")) if doc.get("locationId") else None,
        locationName=doc.get("locationName") or doc.get("location_name"),
        type=m_type,
        referenceType=doc.get("referenceType") or doc.get("reference_type"),
        referenceId=str(doc.get("referenceId")) if doc.get("referenceId") else None,
        referenceNumber=doc.get("referenceNumber") or doc.get("reference_number"),
        quantityChange=qty_change,
        quantityBefore=qty_before,
        quantityAfter=qty_after,
        unitCost=unit_cost,
        totalCost=total_cost,
        reason=doc.get("reason"),
        notes=doc.get("notes"),
        createdByUserId=str(doc.get("createdByUserId")) if doc.get("createdByUserId") else None,
        createdByName=doc.get("createdByName") or doc.get("created_by_name"),
        createdAt=created_at
    )



@router.get("/movements", response_model=PaginatedResponse[InventoryMovementResponse])
async def list_inventory_movements(
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=500),
    item_id: Optional[str] = Query(None, alias="itemId"),
    location_id: Optional[str] = Query(None, alias="locationId"),
    type: Optional[str] = None,
    movement_type: Optional[str] = Query(None, alias="movementType"),
    search: Optional[str] = None,
    from_date: Optional[str] = Query(None, alias="fromDate"),
    to_date: Optional[str] = Query(None, alias="toDate"),
    business_id: str = Depends(get_current_business_id),
):

    db = await get_tenant_db(business_id)
    b_oid = ObjectId(business_id) if ObjectId.is_valid(business_id) else business_id
    skip = (page - 1) * page_size

    conditions: list = [
        {"$or": [{"businessId": b_oid}, {"businessId": business_id}]}
    ]

    if item_id and item_id != "ALL":
        raw_items = [x.strip() for x in item_id.split(",") if x.strip()]
        if len(raw_items) > 1:
            item_conditions = []
            for it in raw_items:
                i_oid = ObjectId(it) if ObjectId.is_valid(it) else it
                item_conditions.extend([
                    {"itemId": i_oid},
                    {"itemId": it},
                    {"publicItemId": it},
                    {"sku": it}
                ])
            conditions.append({"$or": item_conditions})
        elif len(raw_items) == 1:
            it = raw_items[0]
            i_oid = ObjectId(it) if ObjectId.is_valid(it) else it
            conditions.append({
                "$or": [
                    {"itemId": i_oid},
                    {"itemId": it},
                    {"publicItemId": it},
                    {"sku": it}
                ]
            })

    if location_id and location_id != "ALL":
        conditions.append({"locationId": location_id})

    effective_type = movement_type or type
    if effective_type and effective_type != "ALL":
        types = [t.strip() for t in effective_type.split(",") if t.strip()]
        if len(types) > 1:
            conditions.append({"type": {"$in": types}})
        elif len(types) == 1:
            conditions.append({"type": types[0]})

    if search and search.strip():
        terms = [t.strip() for t in search.split(",") if t.strip()]
        if len(terms) > 1:
            terms_or = []
            for s in terms:
                terms_or.extend([
                    {"itemName": {"$regex": s, "$options": "i"}},
                    {"sku": {"$regex": s, "$options": "i"}},
                    {"publicItemId": {"$regex": s, "$options": "i"}},
                    {"referenceNumber": {"$regex": s, "$options": "i"}},
                    {"reason": {"$regex": s, "$options": "i"}},
                    {"notes": {"$regex": s, "$options": "i"}},
                    {"createdByName": {"$regex": s, "$options": "i"}}
                ])
            conditions.append({"$or": terms_or})
        elif len(terms) == 1:
            s = terms[0]
            conditions.append({
                "$or": [
                    {"itemName": {"$regex": s, "$options": "i"}},
                    {"sku": {"$regex": s, "$options": "i"}},
                    {"publicItemId": {"$regex": s, "$options": "i"}},
                    {"referenceNumber": {"$regex": s, "$options": "i"}},
                    {"reason": {"$regex": s, "$options": "i"}},
                    {"notes": {"$regex": s, "$options": "i"}},
                    {"createdByName": {"$regex": s, "$options": "i"}}
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

        if from_dt:
            created_dt_match["$gte"] = from_dt
        if to_dt:
            created_dt_match["$lte"] = to_dt

        if from_date:
            clean_f = from_date.split("T")[0]
            created_str_match["$gte"] = clean_f
        if to_date:
            clean_t = to_date.split("T")[0]
            created_str_match["$lte"] = f"{clean_t}T23:59:59.999Z"

        date_or = []
        if created_dt_match:
            date_or.append({"createdAt": created_dt_match})
        if created_str_match:
            date_or.append({"createdAt": created_str_match})

        if date_or:
            conditions.append({"$or": date_or})

    query = {"$and": conditions}

    total = await db.inventory_movements.count_documents(query)
    cursor = db.inventory_movements.find(query).sort("createdAt", -1).skip(skip).limit(page_size)
    docs = await cursor.to_list(length=page_size)

    results = [_to_movement_response(d) for d in docs]

    return PaginatedResponse(
        data=results,
        page=page,
        page_size=page_size,
        total=total,
        total_pages=(total + page_size - 1) // page_size if page_size else 1
    )
