import os
import io
import logging
import secrets
import urllib.request
import urllib.error
import json
from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional, List
from pydantic import BaseModel
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, status, UploadFile, File, Form
from app.core.config import settings
from app.core.database import get_tenant_db
from app.core.security import get_current_business_id, enforce_active_store_operations, get_current_user, TokenPayload, resolve_user_name
from app.schemas.common import PaginatedResponse
from app.schemas.item import ItemCreate, ItemUpdate, ItemResponse, StockAdjustmentRequest
from app.repositories.item_repository import ItemRepository

logger = logging.getLogger("quickbill.items")
router = APIRouter(prefix="/items", tags=["Items"])

@router.get("", response_model=PaginatedResponse[ItemResponse])
async def list_items(
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=500),
    search: Optional[str] = None,
    category: Optional[str] = None,
    location_id: Optional[str] = Query(None, alias="locationId"),
    business_id: str = Depends(get_current_business_id),
):
    db = await get_tenant_db(business_id)
    repo = ItemRepository(db)
    b_oid = repo._to_object_id(business_id)

    conditions: list = [
        {"isActive": True},
        {"$or": [{"businessId": b_oid}, {"businessId": business_id}]}
    ]

    if location_id and location_id != "ALL":
        conditions.append({
            "$or": [
                {"locations.locationId": location_id},
                {"locationId": location_id}
            ]
        })

    if category and category != "ALL":
        cats = [c.strip() for c in category.split(",") if c.strip()]
        if len(cats) > 1:
            conditions.append({"category": {"$in": cats}})
        elif len(cats) == 1:
            conditions.append({"category": cats[0]})

    if search and search.strip():
        s = search.strip()
        conditions.append({
            "$or": [
                {"name": {"$regex": s, "$options": "i"}},
                {"sku": {"$regex": s, "$options": "i"}},
                {"barcode": {"$regex": s, "$options": "i"}},
                {"publicItemId": {"$regex": s, "$options": "i"}}
            ]
        })

    query = {"$and": conditions}
    
    docs, total = await repo.list_paginated(
        business_id=business_id,
        filter_query=query,
        page=page,
        page_size=page_size
    )

    items = []
    for d in docs:
        d["_id"] = str(d["_id"])
        d["businessId"] = str(d["businessId"])
        items.append(ItemResponse(**d))

    return PaginatedResponse(
        data=items,
        page=page,
        page_size=page_size,
        total=total,
        total_pages=(total + page_size - 1) // page_size if page_size else 1
    )

@router.post("", response_model=ItemResponse, status_code=status.HTTP_201_CREATED)
async def create_item(
    payload: ItemCreate,
    business_id: str = Depends(enforce_active_store_operations),
    current_user: TokenPayload = Depends(get_current_user),
):
    db = await get_tenant_db(business_id)
    repo = ItemRepository(db)
    # Validate Barcode uniqueness within tenant if provided
    if payload.barcode and payload.barcode.strip():
        clean_barcode = payload.barcode.strip()
        b_filter = {"$in": [business_id, ObjectId(business_id)]} if ObjectId.is_valid(business_id) else business_id
        existing_barcode_item = await db.items.find_one({"businessId": b_filter, "barcode": clean_barcode})
        if existing_barcode_item:
            dup_name = existing_barcode_item.get("name", "Unknown Item")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Barcode '{clean_barcode}' is already assigned to product '{dup_name}'."
            )

    public_id = f"itm_{secrets.token_hex(6)}"
    now = datetime.now(timezone.utc)

    # Determine initial stock
    initial_stock = payload.current_stock if payload.current_stock is not None else (payload.opening_stock or Decimal("0.0"))

    # Convert locations or auto-populate from tenant locations
    locations_data = []
    if payload.locations:
        for loc in payload.locations:
            loc_dict = loc.model_dump(by_alias=True)
            for float_field in ["mrp", "salePrice", "purchasePrice", "currentStock", "minStockAlert", "discountValue"]:
                if float_field in loc_dict and loc_dict[float_field] is not None:
                    loc_dict[float_field] = float(loc_dict[float_field])
            locations_data.append(loc_dict)
    else:
        # Auto-populate all tenant locations when no explicit location list is passed
        try:
            b_queries = [{"businessId": business_id}]
            if ObjectId.is_valid(business_id):
                b_queries.append({"businessId": ObjectId(business_id)})
            loc_cursor = db.locations.find({"$or": b_queries})
            async for t_loc in loc_cursor:
                t_loc_id = str(t_loc["_id"])
                is_default_branch = bool(t_loc.get("isDefault", False))
                locations_data.append({
                    "locationId": t_loc_id,
                    "locationName": t_loc.get("name", "Branch Outlet"),
                    "mrp": float(payload.mrp) if payload.mrp is not None else float(payload.sale_price),
                    "salePrice": float(payload.sale_price),
                    "purchasePrice": float(payload.purchase_price),
                    "currentStock": float(initial_stock) if is_default_branch else 0.0,
                    "minStockAlert": float(payload.min_stock_alert),
                    "isListed": True if is_default_branch else False,
                    "hasDiscount": bool(payload.has_discount),
                    "discountType": payload.discount_type or "PERCENT",
                    "discountValue": float(payload.discount_value or 0)
                })
        except Exception as e:
            logger.warning(f"Could not auto-populate location configs for new item: {e}")

    # Convert images
    images_data = []
    if payload.images:
        for img in payload.images:
            images_data.append(img.model_dump(by_alias=True))

    item_doc = {
        "businessId": ObjectId(business_id),
        "publicItemId": public_id,
        "name": payload.name,
        "sku": payload.sku,
        "barcode": payload.barcode,
        "category": payload.category or "General",
        "unit": payload.unit,
        "purchasePrice": float(payload.purchase_price),
        "averageCostPrice": float(payload.purchase_price),
        "salePrice": float(payload.sale_price),
        "mrp": float(payload.mrp) if payload.mrp is not None else float(payload.sale_price),
        "taxRate": float(payload.tax_rate),
        "categoryId": payload.category_id,
        "currentStock": float(initial_stock),
        "minStockAlert": float(payload.min_stock_alert),
        "allowParts": bool(payload.allow_parts),
        "description": payload.description,
        "hasDiscount": bool(payload.has_discount),
        "discountType": payload.discount_type or "PERCENT",
        "discountValue": float(payload.discount_value or 0),
        "locations": locations_data,
        "images": images_data,
        "imageUrl": payload.image_url,
        "qrPayload": f"ITEM:{public_id}",
        "isActive": True,
        "createdAt": now,
        "updatedAt": now
    }

    doc_id = await repo.insert(business_id, item_doc)
    item_doc["_id"] = doc_id
    item_doc["businessId"] = business_id

    if float(initial_stock) > 0:
        movement_doc = {
            "businessId": ObjectId(business_id),
            "itemId": ObjectId(doc_id) if ObjectId.is_valid(str(doc_id)) else doc_id,
            "publicItemId": public_id,
            "itemName": payload.name,
            "sku": payload.sku,
            "locationId": locations_data[0].get("locationId") if locations_data else None,
            "locationName": locations_data[0].get("locationName") if locations_data else "Default Branch",
            "type": "OPENING_STOCK",
            "referenceType": "INITIAL_STOCK",
            "referenceId": str(doc_id),
            "referenceNumber": "OPEN-STOCK",
            "quantityChange": float(initial_stock),
            "quantityBefore": 0.0,
            "quantityAfter": float(initial_stock),
            "unitCost": float(payload.purchase_price),
            "totalCost": round(float(initial_stock) * float(payload.purchase_price), 2),
            "reason": "Initial Opening Stock on Product Creation",
            "notes": "System initialized product stock",
            "createdByUserId": str(current_user.sub) if current_user and current_user.sub else None,
            "createdByName": await resolve_user_name(db, current_user) if current_user else "Admin",
            "createdAt": now
        }
        await db.inventory_movements.insert_one(movement_doc)

    return ItemResponse(**item_doc)

@router.get("/lookup/qr/{public_item_id}", response_model=ItemResponse)
async def lookup_item_by_qr(
    public_item_id: str,
    business_id: str = Depends(get_current_business_id),
):
    db = await get_tenant_db(business_id)
    repo = ItemRepository(db)
    item = await repo.find_by_public_id(business_id, public_item_id)
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Item not found in current business catalog."
        )
    item["_id"] = str(item["_id"])
    item["businessId"] = str(item["businessId"])
    return ItemResponse(**item)

@router.get("/{item_id}", response_model=ItemResponse)
async def get_item(
    item_id: str,
    business_id: str = Depends(get_current_business_id),
):
    db = await get_tenant_db(business_id)
    repo = ItemRepository(db)
    item = await repo.get_by_id(business_id, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    item["_id"] = str(item["_id"])
    item["businessId"] = str(item["businessId"])
    return ItemResponse(**item)

@router.put("/{item_id}", response_model=ItemResponse)
async def update_item(
    item_id: str,
    payload: ItemUpdate,
    business_id: str = Depends(enforce_active_store_operations),
    current_user: TokenPayload = Depends(get_current_user),
):
    db = await get_tenant_db(business_id)
    repo = ItemRepository(db)
    existing = await repo.get_by_id(business_id, item_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Item not found in current business catalog")

    update_data = {}
    dumped = payload.model_dump(by_alias=True, exclude_unset=True)
    for k, v in dumped.items():
        if v is not None:
            if isinstance(v, Decimal):
                update_data[k] = float(v)
            else:
                update_data[k] = v

    # Disallow direct stock alterations in update_item to preserve audit ledger integrity
    update_data.pop("currentStock", None)

    # Validate Barcode uniqueness within tenant if barcode is being updated
    if "barcode" in update_data and update_data["barcode"]:
        clean_barcode = str(update_data["barcode"]).strip()
        if clean_barcode:
            b_filter = {"$in": [business_id, ObjectId(business_id)]} if ObjectId.is_valid(business_id) else business_id
            target_oid = ObjectId(item_id) if ObjectId.is_valid(item_id) else item_id
            existing_barcode_item = await db.items.find_one({
                "businessId": b_filter,
                "barcode": clean_barcode,
                "_id": {"$ne": target_oid}
            })
            if existing_barcode_item:
                dup_name = existing_barcode_item.get("name", "Unknown Item")
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Barcode '{clean_barcode}' is already assigned to product '{dup_name}'."
                )

    # Float conversion for monetary / numeric fields
    for float_field in ["purchasePrice", "averageCostPrice", "salePrice", "mrp", "taxRate", "minStockAlert", "discountValue"]:
        if float_field in update_data and update_data[float_field] is not None:
            update_data[float_field] = float(update_data[float_field])

    # Detect price and configuration changes across branch and master levels
    audit_records = []
    now = datetime.now(timezone.utc)
    b_oid = ObjectId(business_id) if ObjectId.is_valid(business_id) else business_id
    item_oid = existing.get("_id") if isinstance(existing.get("_id"), ObjectId) else (ObjectId(item_id) if ObjectId.is_valid(item_id) else item_id)

    if "locations" in update_data and update_data["locations"]:
        # Preserve existing location currentStock counts
        existing_loc_map = {str(l.get("locationId")): float(l.get("currentStock", 0.0) or 0.0) for l in (existing.get("locations") or [])}
        existing_loc_full = {str(l.get("locationId")): l for l in (existing.get("locations") or [])}
        for loc in update_data["locations"]:
            loc_id_str = str(loc.get("locationId"))
            if loc_id_str in existing_loc_map:
                loc["currentStock"] = existing_loc_map[loc_id_str]
            for float_field in ["mrp", "salePrice", "purchasePrice", "minStockAlert", "discountValue"]:
                if float_field in loc and loc[float_field] is not None:
                    loc[float_field] = float(loc[float_field])

            # Check branch-level differences
            old_loc = existing_loc_full.get(loc_id_str)
            if old_loc:
                loc_stock = float(old_loc.get("currentStock", 0.0) or 0.0)
                loc_name = loc.get("locationName") or old_loc.get("locationName") or "Store Branch"

                # 1. Branch price & discount differences
                old_sp = float(old_loc.get("salePrice") or 0.0)
                new_sp = float(loc.get("salePrice", old_sp))
                old_mrp = float(old_loc.get("mrp") or 0.0)
                new_mrp = float(loc.get("mrp", old_mrp))
                old_pp = float(old_loc.get("purchasePrice") or 0.0)
                new_pp = float(loc.get("purchasePrice", old_pp))

                old_has_disc = bool(old_loc.get("hasDiscount"))
                new_has_disc = bool(loc.get("hasDiscount", old_has_disc))
                old_disc_type = str(old_loc.get("discountType") or "PERCENT")
                new_disc_type = str(loc.get("discountType") or old_disc_type)
                old_disc_val = float(old_loc.get("discountValue") or 0.0)
                new_disc_val = float(loc.get("discountValue", old_disc_val))

                price_diffs = []
                if abs(new_sp - old_sp) > 0.001:
                    price_diffs.append(f"Selling Price: ₹{old_sp:.2f} → ₹{new_sp:.2f}")
                if abs(new_mrp - old_mrp) > 0.001:
                    price_diffs.append(f"MRP: ₹{old_mrp:.2f} → ₹{new_mrp:.2f}")
                if abs(new_pp - old_pp) > 0.001:
                    price_diffs.append(f"Purchase Cost: ₹{old_pp:.2f} → ₹{new_pp:.2f}")

                if old_has_disc != new_has_disc:
                    if new_has_disc:
                        u = "%" if new_disc_type == "PERCENT" else " Flat"
                        price_diffs.append(f"Discount: Enabled ({new_disc_val:g}{u})")
                    else:
                        price_diffs.append("Discount: Disabled")
                elif new_has_disc and (abs(new_disc_val - old_disc_val) > 0.001 or old_disc_type != new_disc_type):
                    old_u = "%" if old_disc_type == "PERCENT" else " Flat"
                    new_u = "%" if new_disc_type == "PERCENT" else " Flat"
                    price_diffs.append(f"Discount: {old_disc_val:g}{old_u} → {new_disc_val:g}{new_u}")

                branch_unit_cost = new_pp if new_pp > 0 else (new_sp if new_sp > 0 else float(existing.get("purchasePrice") or 0.0))

                if price_diffs:
                    audit_records.append({
                        "locationId": loc_id_str,
                        "locationName": loc_name,
                        "stock": loc_stock,
                        "unitCost": branch_unit_cost,
                        "type": "PRICE_CHANGE",
                        "reason": f"Branch Price Revision ({' | '.join(price_diffs)})"
                    })

                # 2. Branch settings differences (Alerts & Listing Status)
                setting_diffs = []
                old_min_alert = float(old_loc.get("minStockAlert") if old_loc.get("minStockAlert") is not None else (existing.get("minStockAlert") or 5.0))
                new_min_alert = float(loc.get("minStockAlert", old_min_alert))
                if abs(new_min_alert - old_min_alert) > 0.001:
                    setting_diffs.append(f"Low Stock Alert: {old_min_alert:g} → {new_min_alert:g}")

                old_listed = bool(old_loc.get("isListed", True))
                new_listed = bool(loc.get("isListed", old_listed))
                if old_listed != new_listed:
                    prev_str = "Listed" if old_listed else "Unlisted"
                    curr_str = "Listed for Sale" if new_listed else "Unlisted (Hidden in POS)"
                    setting_diffs.append(f"Store Status: {prev_str} → {curr_str}")

                if setting_diffs:
                    audit_records.append({
                        "locationId": loc_id_str,
                        "locationName": loc_name,
                        "stock": loc_stock,
                        "unitCost": branch_unit_cost,
                        "type": "PRODUCT_UPDATE",
                        "reason": f"Branch Settings ({' | '.join(setting_diffs)})"
                    })

    # Master-level checks
    master_stock = float(existing.get("currentStock", 0.0) or 0.0)
    master_unit_cost = float(update_data.get("purchasePrice") or existing.get("purchasePrice") or existing.get("salePrice") or 0.0)

    # Master price differences
    old_m_sp = float(existing.get("salePrice") or 0.0)
    new_m_sp = float(update_data.get("salePrice", old_m_sp))
    old_m_mrp = float(existing.get("mrp") or 0.0)
    new_m_mrp = float(update_data.get("mrp", old_m_mrp))
    old_m_pp = float(existing.get("purchasePrice") or 0.0)
    new_m_pp = float(update_data.get("purchasePrice", old_m_pp))

    master_price_diffs = []
    if abs(new_m_sp - old_m_sp) > 0.001:
        master_price_diffs.append(f"Master Sale Price: ₹{old_m_sp:.2f} → ₹{new_m_sp:.2f}")
    if abs(new_m_mrp - old_m_mrp) > 0.001:
        master_price_diffs.append(f"Master MRP: ₹{old_m_mrp:.2f} → ₹{new_m_mrp:.2f}")
    if abs(new_m_pp - old_m_pp) > 0.001:
        master_price_diffs.append(f"Master Cost Price: ₹{old_m_pp:.2f} → ₹{new_m_pp:.2f}")

    # Only record master-level price revision if no branch-level price change was recorded
    has_branch_price_change = any(r.get("type") == "PRICE_CHANGE" and r.get("locationId") for r in audit_records)
    if not has_branch_price_change and master_price_diffs:
        audit_records.append({
            "locationId": None,
            "locationName": "All Branches / Master",
            "stock": master_stock,
            "unitCost": new_m_pp if new_m_pp > 0 else (new_m_sp if new_m_sp > 0 else master_unit_cost),
            "type": "PRICE_CHANGE",
            "reason": f"Master Price Revision ({' | '.join(master_price_diffs)})"
        })

    # Master product / catalog attribute differences
    master_catalog_diffs = []
    old_name = (existing.get("name") or "").strip()
    new_name = (update_data.get("name") or old_name).strip()
    if old_name != new_name:
        master_catalog_diffs.append(f"Name: '{old_name}' → '{new_name}'")

    if "sku" in update_data:
        old_sku = (existing.get("sku") or "").strip()
        new_sku = (update_data.get("sku") or "").strip()
        if old_sku != new_sku:
            master_catalog_diffs.append(f"SKU: '{old_sku or 'None'}' → '{new_sku or 'None'}'")

    if "barcode" in update_data:
        old_bar = (existing.get("barcode") or "").strip()
        new_bar = (update_data.get("barcode") or "").strip()
        if old_bar != new_bar:
            master_catalog_diffs.append(f"Barcode: '{old_bar or 'None'}' → '{new_bar or 'None'}'")

    if "category" in update_data:
        old_cat = (existing.get("category") or "").strip()
        new_cat = (update_data.get("category") or old_cat).strip()
        if old_cat != new_cat:
            master_catalog_diffs.append(f"Category: '{old_cat}' → '{new_cat}'")

    if "taxRate" in update_data:
        old_tax = float(existing.get("taxRate") or 0.0)
        new_tax = float(update_data.get("taxRate", old_tax))
        if abs(new_tax - old_tax) > 0.001:
            master_catalog_diffs.append(f"GST / Tax Rate: {old_tax:g}% → {new_tax:g}%")

    if "unit" in update_data:
        old_unit = (existing.get("unit") or "pcs").strip()
        new_unit = (update_data.get("unit") or "").strip()
        if old_unit != new_unit:
            master_catalog_diffs.append(f"Unit: '{old_unit}' → '{new_unit}'")

    if "allowParts" in update_data:
        old_parts = bool(existing.get("allowParts"))
        new_parts = bool(update_data.get("allowParts"))
        if old_parts != new_parts:
            master_catalog_diffs.append(f"Fractional Parts: {'Enabled' if new_parts else 'Disabled'}")

    has_branch_alert_change = any(
        r.get("type") == "PRODUCT_UPDATE" and r.get("locationId") and "Low Stock Alert" in r.get("reason", "")
        for r in audit_records
    )
    if not has_branch_alert_change and "minStockAlert" in update_data:
        old_m_alert = float(existing.get("minStockAlert") or 5.0)
        new_m_alert = float(update_data.get("minStockAlert", old_m_alert))
        if abs(new_m_alert - old_m_alert) > 0.001:
            master_catalog_diffs.append(f"Master Low Stock Alert: {old_m_alert:g} → {new_m_alert:g}")

    if "description" in update_data:
        old_desc = (existing.get("description") or "").strip()
        new_desc = (update_data.get("description") or "").strip()
        if old_desc != new_desc:
            master_catalog_diffs.append("Description updated")

    if "images" in update_data:
        old_imgs = existing.get("images") or []
        new_imgs = update_data.get("images") or []
        if len(old_imgs) != len(new_imgs):
            master_catalog_diffs.append(f"Gallery Images updated ({len(new_imgs)} images)")

    if master_catalog_diffs:
        audit_records.append({
            "locationId": None,
            "locationName": "All Branches / Master",
            "stock": master_stock,
            "unitCost": master_unit_cost,
            "type": "PRODUCT_UPDATE",
            "reason": f"Product Master ({' | '.join(master_catalog_diffs)})"
        })

    update_data["updatedAt"] = now

    success = await repo.update_by_id(business_id, item_id, update_data)
    if not success:
        raise HTTPException(status_code=400, detail="Failed to update item")

    # Insert immutable inventory movement audit records for price & configuration changes
    if audit_records:
        user_id = str(current_user.sub) if current_user and current_user.sub else None
        user_name = await resolve_user_name(db, current_user)
        for rec in audit_records:
            movement_doc = {
                "businessId": b_oid,
                "itemId": item_oid,
                "publicItemId": existing.get("publicItemId"),
                "itemName": update_data.get("name") or existing.get("name", "Product"),
                "sku": update_data.get("sku") or existing.get("sku"),
                "locationId": rec["locationId"],
                "locationName": rec["locationName"],
                "type": rec["type"],
                "referenceType": "PRODUCT_UPDATE",
                "referenceId": str(existing["_id"]),
                "referenceNumber": f"REV-{now.strftime('%y%m%d%H%M')}",
                "quantityChange": 0.0,
                "quantityBefore": rec["stock"],
                "quantityAfter": rec["stock"],
                "unitCost": rec["unitCost"],
                "totalCost": round(rec["stock"] * rec["unitCost"], 2),
                "reason": rec["reason"],
                "notes": f"Product settings updated by {user_name}",
                "createdByUserId": user_id,
                "createdByName": user_name,
                "createdAt": now
            }
            await db.inventory_movements.insert_one(movement_doc)

    updated = await repo.get_by_id(business_id, item_id)
    updated["_id"] = str(updated["_id"])
    updated["businessId"] = str(updated["businessId"])
    return ItemResponse(**updated)

@router.post("/{item_id}/adjust-stock", response_model=ItemResponse)
async def adjust_item_stock(
    item_id: str,
    payload: StockAdjustmentRequest,
    business_id: str = Depends(enforce_active_store_operations),
    current_user: TokenPayload = Depends(get_current_user),
):
    db = await get_tenant_db(business_id)
    repo = ItemRepository(db)
    existing = await repo.get_by_id(business_id, item_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Item not found in current business catalog")

    delta = float(payload.delta)
    location_id = payload.location_id
    reason = payload.reason or ("Manual Stock Addition" if delta > 0 else "Stock Reduction / Shrinkage")
    notes = payload.notes or "Manual inventory audit adjustment"

    prev_stock = float(existing.get("currentStock", 0.0) or 0.0)
    current_stock = max(0.0, prev_stock + delta)
    now = datetime.now(timezone.utc)
    b_oid = ObjectId(business_id) if ObjectId.is_valid(business_id) else business_id
    item_oid = existing.get("_id") if isinstance(existing.get("_id"), ObjectId) else (ObjectId(item_id) if ObjectId.is_valid(item_id) else item_id)

    old_avg_cost = float(existing.get("averageCostPrice") or existing.get("purchasePrice") or 0.0)

    update_fields: dict = {
        "currentStock": round(current_stock, 3),
        "updatedAt": now
    }

    # Custom Unit Cost & Weighted Average Cost Recalculation on Inward Stock Addition
    if delta > 0:
        inward_unit_cost = float(payload.unit_cost) if payload.unit_cost is not None else old_avg_cost
        movement_unit_cost = inward_unit_cost
        movement_total_cost = round(delta * inward_unit_cost, 2)

        # Weighted average costing formula
        effective_old_stock = max(0.0, prev_stock)
        if (effective_old_stock + delta) > 0:
            new_avg_cost = ((effective_old_stock * old_avg_cost) + (delta * inward_unit_cost)) / (effective_old_stock + delta)
        else:
            new_avg_cost = inward_unit_cost

        # Directly update averageCostPrice AND purchasePrice to keep catalog and bookkeeping in sync
        update_fields["averageCostPrice"] = round(new_avg_cost, 2)
        update_fields["purchasePrice"] = round(new_avg_cost, 2)
    else:
        movement_unit_cost = old_avg_cost
        movement_total_cost = round(abs(delta) * old_avg_cost, 2)

    location_name = None
    if location_id and existing.get("locations"):
        locs = list(existing["locations"])
        found = False
        for loc in locs:
            if str(loc.get("locationId")) == str(location_id):
                loc["currentStock"] = max(0.0, float(loc.get("currentStock", 0)) + delta)
                if delta > 0 and "purchasePrice" in update_fields:
                    loc["purchasePrice"] = update_fields["purchasePrice"]
                location_name = loc.get("locationName")
                found = True
                break
        if not found:
            locs.append({
                "locationId": location_id,
                "locationName": "Store Branch",
                "currentStock": max(0.0, delta),
                "salePrice": float(existing.get("salePrice", 0)),
                "purchasePrice": update_fields.get("purchasePrice", float(existing.get("purchasePrice", 0))),
                "minStockAlert": float(existing.get("minStockAlert", 5)),
                "isListed": True,
            })
            location_name = "Store Branch"
        update_fields["locations"] = locs

    await repo.update_by_id(business_id, item_id, update_fields)

    # User Tagging from Authenticated User Credentials
    user_id = current_user.sub
    user_name = await resolve_user_name(db, current_user)

    # Insert immutable inventory movement audit entry
    movement_doc = {
        "businessId": b_oid,
        "itemId": item_oid,
        "publicItemId": existing.get("publicItemId"),
        "itemName": existing.get("name", "Product"),
        "sku": existing.get("sku"),
        "locationId": location_id,
        "locationName": location_name,
        "type": "MANUAL_ADJUSTMENT",
        "referenceType": "MANUAL",
        "referenceId": None,
        "referenceNumber": "AUDIT-ADJUST",
        "quantityChange": delta,
        "quantityBefore": prev_stock,
        "quantityAfter": round(current_stock, 3),
        "unitCost": movement_unit_cost,
        "totalCost": movement_total_cost,
        "reason": reason,
        "notes": notes,
        "createdByUserId": user_id,
        "createdByName": user_name,
        "createdAt": now
    }
    await db.inventory_movements.insert_one(movement_doc)

    updated = await repo.get_by_id(business_id, item_id)
    updated["_id"] = str(updated["_id"])
    updated["businessId"] = str(updated["businessId"])
    return ItemResponse(**updated)

@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_item(
    item_id: str,
    business_id: str = Depends(enforce_active_store_operations),
):
    db = await get_tenant_db(business_id)
    repo = ItemRepository(db)
    existing = await repo.get_by_id(business_id, item_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Item not found in current business catalog")
    
    await repo.update_by_id(business_id, item_id, {
        "isActive": False,
        "updatedAt": datetime.now(timezone.utc)
    })
    return None

@router.get("/storage/status", status_code=status.HTTP_200_OK)
async def check_storage_status(
    business_id: str = Depends(get_current_business_id),
):
    """
    Diagnostic endpoint to check Supabase bucket connectivity, permissions, and local media folder.
    """
    supabase_buckets_url = f"{settings.SUPABASE_URL}/storage/v1/bucket"
    status_info = {
        "supabaseUrl": settings.SUPABASE_URL,
        "supabaseBucket": settings.SUPABASE_BUCKET,
        "supabaseProjectRef": settings.SUPABASE_PROJECT_REF,
        "supabaseReachable": False,
        "bucketFound": False,
        "bucketIsPublic": None,
        "bucketsList": [],
        "localMediaRoot": os.path.abspath("uploads"),
        "localMediaExists": os.path.exists("uploads/item-images"),
        "error": None,
    }

    try:
        req = urllib.request.Request(
            supabase_buckets_url,
            headers={
                "apikey": settings.SUPABASE_KEY,
                "Authorization": f"Bearer {settings.SUPABASE_KEY}",
            },
            method="GET"
        )
        with urllib.request.urlopen(req, timeout=8) as resp:
            import json
            body = resp.read().decode("utf-8")
            buckets = json.loads(body)
            status_info["supabaseReachable"] = True
            status_info["bucketsList"] = [b.get("name") for b in buckets if isinstance(b, dict)]
            target = next((b for b in buckets if isinstance(b, dict) and b.get("name") == settings.SUPABASE_BUCKET), None)
            if target:
                status_info["bucketFound"] = True
                status_info["bucketIsPublic"] = target.get("public", False)
    except urllib.error.HTTPError as he:
        status_info["error"] = f"HTTP {he.code}: {he.read().decode('utf-8', errors='ignore')}"
    except Exception as ex:
        status_info["error"] = str(ex)

    print("\n" + "="*70)
    print("📦 [QUICKBILL STORAGE DIAGNOSTIC]")
    print(f"  • Supabase URL: {status_info['supabaseUrl']}")
    print(f"  • Target Bucket: {status_info['supabaseBucket']}")
    print(f"  • Reachable: {status_info['supabaseReachable']}")
    print(f"  • Bucket Found: {status_info['bucketFound']} (Public: {status_info['bucketIsPublic']})")
    print(f"  • Available Buckets: {status_info['bucketsList']}")
    if status_info["error"]:
        print(f"  • Error: {status_info['error']}")
    print(f"  • Local Media Directory: {status_info['localMediaRoot']} (Exists: {status_info['localMediaExists']})")
    print("="*70 + "\n", flush=True)

    return status_info


@router.post("/upload-image", status_code=status.HTTP_200_OK)
async def upload_item_image(
    file: UploadFile = File(...),
    item_id: Optional[str] = Form(None),
    order: int = Form(0),
    is_primary: bool = Form(False),
    business_id: str = Depends(get_current_business_id),
):
    """
    Step 1: Compresses uploaded image (max 1000px, WebP, quality=82).
    Step 2: Uploads to Supabase Storage bucket 'item-images' with detailed logging.
    Step 3: Falls back to local static media serving if Supabase is unreachable or RLS blocked.
    """
    print("\n" + "─"*70)
    print(f"📸 [IMAGE_UPLOAD] Incoming upload request:")
    print(f"   • Filename:     {file.filename}")
    print(f"   • Content-Type: {file.content_type}")
    print(f"   • Business ID:  {business_id}")
    print(f"   • Item ID:      {item_id or 'new_item'}")
    print(f"   • Gallery Slot: #{order + 1} (isPrimary={is_primary})")
    print("─"*70, flush=True)

    raw_bytes = await file.read()
    original_size = len(raw_bytes)
    image_id = f"img_{int(datetime.now(timezone.utc).timestamp())}_{secrets.token_hex(4)}"

    # Step 1: Compress with Pillow
    try:
        pil_image = Image.open(io.BytesIO(raw_bytes))
        # Convert RGBA / P to RGB if saving to WebP / JPEG without alpha issues
        if pil_image.mode in ('RGBA', 'LA') and file.filename and file.filename.lower().endswith(('.jpg', '.jpeg')):
            background = Image.new('RGB', pil_image.size, (255, 255, 255))
            background.paste(pil_image, mask=pil_image.split()[-1])
            pil_image = background
        elif pil_image.mode not in ('RGB', 'RGBA'):
            pil_image = pil_image.convert('RGB')

        # Resize keeping aspect ratio
        max_dim = 1000
        if pil_image.width > max_dim or pil_image.height > max_dim:
            pil_image.thumbnail((max_dim, max_dim), Image.Resampling.LANCZOS)

        out_buffer = io.BytesIO()
        pil_image.save(out_buffer, format='WEBP', quality=82, method=6)
        compressed_bytes = out_buffer.getvalue()
        compressed_size = len(compressed_bytes)

        savings_pct = round(((original_size - compressed_size) / original_size) * 100) if original_size > 0 else 0
        print(f"⚡ [IMAGE_COMPRESS] Pillow WebP compression completed:")
        print(f"   • Original Size:   {original_size:,} bytes")
        print(f"   • Compressed Size: {compressed_size:,} bytes")
        print(f"   • Saved:           {savings_pct}% ({pil_image.width}x{pil_image.height} px)", flush=True)
    except Exception as e:
        print(f"⚠️ [IMAGE_COMPRESS] Pillow compression skipped/failed ({e}), using uploaded raw bytes.", flush=True)
        compressed_bytes = raw_bytes
        compressed_size = original_size

    # Step 2: Upload to Supabase Storage
    sanitized_name = "".join(c if c.isalnum() or c in "._-" else "_" for c in (file.filename or "image.webp"))
    if not sanitized_name.lower().endswith(".webp"):
        sanitized_name = f"{os.path.splitext(sanitized_name)[0]}.webp"

    target_item_id = item_id or "new_item"
    storage_path = f"{business_id}/{target_item_id}/{order}_{image_id}_{sanitized_name}"
    supabase_url = f"{settings.SUPABASE_URL}/storage/v1/object/{settings.SUPABASE_BUCKET}/{storage_path}"
    public_cdn_url = f"{settings.SUPABASE_URL}/storage/v1/object/public/{settings.SUPABASE_BUCKET}/{storage_path}"

    print(f"☁️ [SUPABASE_STORAGE] Uploading to Supabase Cloud Storage:")
    print(f"   • Bucket:   {settings.SUPABASE_BUCKET}")
    print(f"   • Key Path: {storage_path}")
    print(f"   • Endpoint: {supabase_url}", flush=True)

    supabase_success = False
    supabase_status_code = None
    supabase_error_msg = None

    auth_key = settings.SUPABASE_SERVICE_ROLE_KEY if settings.SUPABASE_SERVICE_ROLE_KEY else settings.SUPABASE_KEY

    try:
        req = urllib.request.Request(
            supabase_url,
            data=compressed_bytes,
            headers={
                "apikey": auth_key,
                "Authorization": f"Bearer {auth_key}",
                "Content-Type": "image/webp",
                "x-upsert": "true",
            },
            method="POST"
        )
        with urllib.request.urlopen(req, timeout=10) as response:
            supabase_status_code = response.getcode()
            res_body = response.read().decode("utf-8", errors="ignore")
            print(f"✅ [SUPABASE_STORAGE] Upload SUCCESSFUL! HTTP {supabase_status_code}")
            print(f"   • Public CDN URL: {public_cdn_url}", flush=True)
            supabase_success = True
    except urllib.error.HTTPError as he:
        supabase_status_code = he.code
        supabase_error_msg = he.read().decode("utf-8", errors="ignore")
        print(f"⚠️ [SUPABASE_STORAGE] Supabase returned HTTP {he.code}: {supabase_error_msg}", flush=True)
        if he.code in (401, 403):
            print("   💡 NOTE: Check Supabase Dashboard -> Storage -> 'item-images' -> Policies. Ensure INSERT permissions are enabled for anon/authenticated roles, or toggle bucket to Public.", flush=True)
        elif he.code == 404:
            print(f"   💡 NOTE: Bucket '{settings.SUPABASE_BUCKET}' was not found in project '{settings.SUPABASE_PROJECT_REF}'. Create bucket '{settings.SUPABASE_BUCKET}' in Supabase Dashboard.", flush=True)
    except Exception as ex:
        supabase_error_msg = str(ex)
        print(f"⚠️ [SUPABASE_STORAGE] Network/Connection error connecting to Supabase: {ex}", flush=True)

    # Save local copy in uploads/ directory as resilient backup
    local_rel_path = f"uploads/item-images/{storage_path}"
    os.makedirs(os.path.dirname(local_rel_path), exist_ok=True)
    with open(local_rel_path, "wb") as f:
        f.write(compressed_bytes)

    local_url = f"/uploads/item-images/{storage_path}"
    final_url = public_cdn_url if supabase_success else local_url

    print(f"📁 [STORAGE_SUMMARY] Image storage resolution:")
    print(f"   • Active Provider: {'Supabase Storage CDN ☁️' if supabase_success else 'Local FastAPI Server (/uploads) 🖥️'}")
    print(f"   • Resolved URL:    {final_url}")
    print("─"*70 + "\n", flush=True)

    return {
        "id": image_id,
        "url": final_url,
        "order": order,
        "isPrimary": is_primary,
        "name": file.filename,
        "sizeBytes": compressed_size,
        "originalSizeBytes": original_size,
        "storageProvider": "supabase" if supabase_success else "local_media",
        "supabaseStatus": supabase_status_code,
        "supabaseError": supabase_error_msg,
    }


class DeleteImagesRequest(BaseModel):
    image_urls: List[str]


@router.post("/delete-images", status_code=status.HTTP_200_OK)
async def delete_item_images(
    payload: DeleteImagesRequest,
    business_id: str = Depends(get_current_business_id),
):
    """
    Deletes specified images from Supabase Storage bucket 'item-images' and local media files.
    Only triggered when product is saved or product is deleted, preserving images during edit sessions until confirmed.
    """
    if not payload.image_urls:
        return {"deleted": [], "failed": [], "message": "No URLs provided"}

    # Extract storage paths
    storage_paths = []
    for raw_url in payload.image_urls:
        if not raw_url or raw_url.startswith("data:"):
            continue
        # Extract relative path inside item-images bucket
        if "/item-images/" in raw_url:
            path = raw_url.split("/item-images/")[1].split("?")[0]
            storage_paths.append(path)
        elif raw_url.startswith("/uploads/item-images/"):
            path = raw_url.replace("/uploads/item-images/", "").split("?")[0]
            storage_paths.append(path)
        else:
            clean = raw_url.lstrip("/").split("?")[0]
            storage_paths.append(clean)

    if not storage_paths:
        return {"deleted": [], "failed": [], "message": "No remote storage paths found to delete"}

    print("\n" + "─"*70)
    print(f"🗑️ [IMAGE_DELETE] Deleting images upon saving/deleting product:")
    print(f"   • Business ID:  {business_id}")
    print(f"   • Image Count:  {len(storage_paths)}")
    for p in storage_paths:
        print(f"   • Target Path:  {p}")
    print("─"*70, flush=True)

    # 1. Delete from Supabase Storage
    supabase_deleted = []
    supabase_failed = []
    auth_key = settings.SUPABASE_SERVICE_ROLE_KEY if settings.SUPABASE_SERVICE_ROLE_KEY else settings.SUPABASE_KEY
    supabase_delete_url = f"{settings.SUPABASE_URL}/storage/v1/object/{settings.SUPABASE_BUCKET}"

    try:
        delete_payload = json.dumps({"prefixes": storage_paths}).encode("utf-8")
        req = urllib.request.Request(
            supabase_delete_url,
            data=delete_payload,
            headers={
                "apikey": auth_key,
                "Authorization": f"Bearer {auth_key}",
                "Content-Type": "application/json",
            },
            method="DELETE"
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            resp_code = resp.getcode()
            resp_body = resp.read().decode("utf-8", errors="ignore")
            print(f"✅ [SUPABASE_DELETE] Successfully requested deletion from Supabase! HTTP {resp_code}: {resp_body}", flush=True)
            supabase_deleted.extend(storage_paths)
    except urllib.error.HTTPError as he:
        err_msg = he.read().decode("utf-8", errors="ignore")
        print(f"⚠️ [SUPABASE_DELETE_HTTP_ERROR] Supabase DELETE returned HTTP {he.code}: {err_msg}", flush=True)
        supabase_failed.extend(storage_paths)
    except Exception as ex:
        print(f"⚠️ [SUPABASE_DELETE_ERROR] Network error contacting Supabase for deletion: {ex}", flush=True)
        supabase_failed.extend(storage_paths)

    # 2. Delete local static backup files if present
    for p in storage_paths:
        local_path = os.path.join("uploads", "item-images", p.replace("/", os.sep))
        if os.path.exists(local_path):
            try:
                os.remove(local_path)
                print(f"🖥️ [LOCAL_DELETE] Removed local file: {local_path}", flush=True)
            except Exception as e:
                print(f"⚠️ [LOCAL_DELETE] Could not remove local file {local_path}: {e}", flush=True)

    print("─"*70 + "\n", flush=True)

    return {
        "deletedPaths": storage_paths,
        "supabaseDeleted": supabase_deleted,
        "supabaseFailed": supabase_failed,
    }



