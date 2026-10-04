from typing import List, Optional
from datetime import datetime, timezone
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from app.core.security import TokenPayload, get_current_user
from app.core.database import get_database, get_tenant_db

router = APIRouter(prefix="/locations", tags=["Store Locations & Branches"])

class LocationCreateRequest(BaseModel):
    name: str
    code: str
    address: Optional[str] = None
    phone: Optional[str] = None
    gstin: Optional[str] = None
    isDefault: bool = False

class LocationUpdateRequest(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    gstin: Optional[str] = None
    isActive: Optional[bool] = None
    isDefault: Optional[bool] = None

class LocationResponse(BaseModel):
    id: str
    businessId: str
    name: str
    code: str
    address: Optional[str] = None
    phone: Optional[str] = None
    gstin: Optional[str] = None
    isDefault: bool = False
    isActive: bool = True
    createdAt: str

class LocationSyncInventoryRequest(BaseModel):
    mode: str = "ALL_ENABLED"  # "ALL_ENABLED" | "ALL_DISABLED" | "SELECTIVE"
    itemIds: Optional[List[str]] = None
    defaultStock: Optional[float] = 0.0

class LocationSyncResponse(BaseModel):
    success: bool
    message: str
    syncedCount: int
    locationId: str
    mode: str

async def _sync_location_to_items(primary_db, tenant_id: str, new_loc_id: str, new_loc_name: str, new_loc_code: str):
    """
    Ensure all items for tenant have entries for:
    1. Default location (isListed: True, inheriting item stock/prices if missing).
    2. The new location (isListed: False, currentStock: 0.0, inheriting item prices).
    """
    if not tenant_id:
        return

    tenant_db = await get_tenant_db(tenant_id)
    default_loc = await primary_db.locations.find_one({"businessId": tenant_id, "isDefault": True})
    if not default_loc:
        default_loc = await tenant_db.locations.find_one({"businessId": tenant_id, "isDefault": True})
    if not default_loc:
        default_loc = await primary_db.locations.find_one({"businessId": tenant_id})
    if not default_loc:
        default_loc = await tenant_db.locations.find_one({"businessId": tenant_id})
    default_loc_id = str(default_loc["_id"]) if default_loc else "MAIN-01"
    default_loc_name = default_loc.get("name", "Main Flagship Counter") if default_loc else "Main Flagship Counter"

    b_queries = [{"businessId": tenant_id}]
    if ObjectId.is_valid(tenant_id):
        b_queries.append({"businessId": ObjectId(tenant_id)})

    dbs = [tenant_db]
    if primary_db.name != tenant_db.name:
        dbs.append(primary_db)

    for target_db in dbs:
        cursor = target_db.items.find({"$or": b_queries})
        count_chk = await target_db.items.count_documents({"$or": b_queries})
        if count_chk == 0:
            cursor = target_db.items.find({})

        async for item in cursor:
            item_locations = list(item.get("locations") or [])
            loc_ids = {str(l.get("locationId")) for l in item_locations if l.get("locationId")}
            
            modified = False
            
            # 1. Guarantee default location entity
            if default_loc_id not in loc_ids and (default_loc and default_loc.get("code") not in loc_ids):
                item_locations.append({
                    "locationId": default_loc_id,
                    "locationName": default_loc_name,
                    "mrp": float(item.get("mrp", item.get("salePrice", 0.0))),
                    "salePrice": float(item.get("salePrice", 0.0)),
                    "purchasePrice": float(item.get("purchasePrice", 0.0)),
                    "currentStock": float(item.get("currentStock", 0.0)),
                    "minStockAlert": float(item.get("minStockAlert", 5.0)),
                    "isListed": True,
                    "hasDiscount": bool(item.get("hasDiscount", False)),
                    "discountType": item.get("discountType", "PERCENT"),
                    "discountValue": float(item.get("discountValue", 0.0))
                })
                modified = True
                
            # 2. Append new location entity as deactivated/unlisted with stock 0.0
            if new_loc_id not in loc_ids and new_loc_code not in loc_ids:
                item_locations.append({
                    "locationId": new_loc_id,
                    "locationName": new_loc_name,
                    "mrp": float(item.get("mrp", item.get("salePrice", 0.0))),
                    "salePrice": float(item.get("salePrice", 0.0)),
                    "purchasePrice": float(item.get("purchasePrice", 0.0)),
                    "currentStock": 0.0,
                    "minStockAlert": float(item.get("minStockAlert", 5.0)),
                    "isListed": False, # Tagged as deactivated / unlisted for new branch
                    "hasDiscount": bool(item.get("hasDiscount", False)),
                    "discountType": item.get("discountType", "PERCENT"),
                    "discountValue": float(item.get("discountValue", 0.0))
                })
                modified = True
                
            if modified:
                await target_db.items.update_one(
                    {"_id": item["_id"]},
                    {"$set": {"locations": item_locations, "updatedAt": datetime.now(timezone.utc)}}
                )

def _build_id_query(location_id: str, tenant_id: Optional[str] = None):
    or_clauses = [{"_id": location_id}, {"id": location_id}, {"code": location_id}]
    if ObjectId.is_valid(location_id):
        or_clauses.append({"_id": ObjectId(location_id)})
    
    query = {"$or": or_clauses}
    if tenant_id:
        return {"$and": [{"businessId": tenant_id}, query]}
    return query

@router.get("", response_model=List[LocationResponse])
async def list_locations(
    user: TokenPayload = Depends(get_current_user)
):
    primary_db = get_database()
    tenant_id = user.default_business_id


    filter_query = {}
    if "SUPER_ADMIN" not in user.roles and tenant_id:
        b_queries = [{"businessId": str(tenant_id)}]
        if ObjectId.is_valid(tenant_id):
            b_queries.append({"businessId": ObjectId(tenant_id)})
        filter_query = {"$or": b_queries}

    cursor = primary_db.locations.find(filter_query).sort("createdAt", 1)
    results = []
    async for loc in cursor:
        results.append(LocationResponse(
            id=str(loc["_id"]),
            businessId=str(loc.get("businessId", "")),
            name=loc.get("name", ""),
            code=loc.get("code", ""),
            address=loc.get("address"),
            phone=loc.get("phone"),
            gstin=loc.get("gstin"),
            isDefault=loc.get("isDefault", False),
            isActive=loc.get("isActive", True),
            createdAt=loc.get("createdAt", datetime.now(timezone.utc)).isoformat() if isinstance(loc.get("createdAt"), datetime) else str(loc.get("createdAt", ""))
        ))
    return results

@router.post("", response_model=LocationResponse, status_code=status.HTTP_201_CREATED)
async def create_location(
    req: LocationCreateRequest,
    current_user: TokenPayload = Depends(get_current_user)
):
    if "SUPER_ADMIN" not in current_user.roles and "TENANT_ADMIN" not in current_user.roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Store Administrators can add new store locations."
        )

    primary_db = get_database()
    tenant_id = current_user.default_business_id
    if not tenant_id and "SUPER_ADMIN" not in current_user.roles:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User does not have an associated store tenant."
        )
    clean_code = req.code.strip().upper()

    # Check subscription maxLocations quota (unless Super Admin)
    if "SUPER_ADMIN" not in current_user.roles and tenant_id:
        t_oid = ObjectId(tenant_id) if ObjectId.is_valid(tenant_id) else None
        tenant_doc = await primary_db.tenants.find_one({"_id": t_oid}) if t_oid else None
        if tenant_doc:
            sub = tenant_doc.get("subscription", {})
            max_locs = sub.get("maxLocations", 3)
            current_locs_count = await primary_db.locations.count_documents({
                "businessId": str(tenant_id),
                "isActive": True
            })
            if current_locs_count >= max_locs:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Subscription branch limit reached ({current_locs_count}/{max_locs} locations). Please contact Super Admin to upgrade your subscription plan."
                )

    existing = await primary_db.locations.find_one({"businessId": tenant_id, "code": clean_code})
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Location code '{clean_code}' already exists in this store."
        )

    now = datetime.now(timezone.utc)
    new_doc = {
        "businessId": tenant_id,
        "name": req.name.strip(),
        "code": clean_code,
        "address": req.address,
        "phone": req.phone,
        "gstin": req.gstin.strip().upper() if req.gstin else None,
        "isDefault": req.isDefault,
        "isActive": True,
        "createdAt": now
    }

    insert_res = await primary_db.locations.insert_one(new_doc)
    new_loc_id = str(insert_res.inserted_id)

    # Perform automated migration: sync all existing items to include this new branch location
    await _sync_location_to_items(
        primary_db=primary_db,
        tenant_id=tenant_id,
        new_loc_id=new_loc_id,
        new_loc_name=req.name.strip(),
        new_loc_code=clean_code
    )

    return LocationResponse(
        id=new_loc_id,
        businessId=tenant_id,
        name=req.name.strip(),
        code=clean_code,
        address=req.address,
        phone=req.phone,
        gstin=new_doc["gstin"],
        isDefault=req.isDefault,
        isActive=True,
        createdAt=now.isoformat()
    )

@router.put("/{location_id}", response_model=LocationResponse)
async def update_location(
    location_id: str,
    req: LocationUpdateRequest,
    current_user: TokenPayload = Depends(get_current_user)
):
    if "SUPER_ADMIN" not in current_user.roles and "TENANT_ADMIN" not in current_user.roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Store Administrators can update store locations."
        )

    primary_db = get_database()
    tenant_id = current_user.default_business_id
    query = _build_id_query(location_id, tenant_id if "SUPER_ADMIN" not in current_user.roles else None)
    loc_doc = await primary_db.locations.find_one(query)

    if not loc_doc:
        # Fallback search by ID or code across all
        loc_doc = await primary_db.locations.find_one(_build_id_query(location_id))

    if not loc_doc:
        raise HTTPException(status_code=404, detail="Location not found.")

    update_fields = {}
    if req.name is not None:
        update_fields["name"] = req.name.strip()
    if req.code is not None:
        update_fields["code"] = req.code.strip().upper()
    if req.address is not None:
        update_fields["address"] = req.address.strip()
    if req.phone is not None:
        update_fields["phone"] = req.phone.strip()
    if req.gstin is not None:
        update_fields["gstin"] = req.gstin.strip().upper() if req.gstin.strip() else None
    if req.isActive is not None:
        update_fields["isActive"] = req.isActive
    if req.isDefault is not None:
        update_fields["isDefault"] = req.isDefault

    if update_fields:
        await primary_db.locations.update_one({"_id": loc_doc["_id"]}, {"$set": update_fields})
        loc_doc = await primary_db.locations.find_one({"_id": loc_doc["_id"]})

    return LocationResponse(
        id=str(loc_doc["_id"]),
        businessId=str(loc_doc.get("businessId", "")),
        name=loc_doc.get("name", ""),
        code=loc_doc.get("code", ""),
        address=loc_doc.get("address"),
        phone=loc_doc.get("phone"),
        gstin=loc_doc.get("gstin"),
        isDefault=loc_doc.get("isDefault", False),
        isActive=loc_doc.get("isActive", True),
        createdAt=loc_doc.get("createdAt", datetime.now(timezone.utc)).isoformat() if isinstance(loc_doc.get("createdAt"), datetime) else str(loc_doc.get("createdAt", ""))
    )

@router.delete("/{location_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_location(
    location_id: str,
    current_user: TokenPayload = Depends(get_current_user)
):
    if "SUPER_ADMIN" not in current_user.roles and "TENANT_ADMIN" not in current_user.roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Store Administrators can delete store locations."
        )

    primary_db = get_database()
    query = _build_id_query(location_id, current_user.default_business_id if "SUPER_ADMIN" not in current_user.roles else None)

    loc_doc = await primary_db.locations.find_one(query)
    if not loc_doc:
        loc_doc = await primary_db.locations.find_one(_build_id_query(location_id))
    
    if not loc_doc:
        raise HTTPException(status_code=404, detail="Location not found.")

    tenant_id = loc_doc.get("businessId") or current_user.default_business_id or ""

    if loc_doc.get("isDefault"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete default flagship branch location. Please designate another branch as default first."
        )

    loc_id_str = str(loc_doc["_id"])
    loc_code = loc_doc.get("code", "")
    tenant_db = await get_tenant_db(tenant_id)

    # 1. Delete the location document from primary and tenant databases
    await primary_db.locations.delete_one({"_id": loc_doc["_id"]})
    await tenant_db.locations.delete_one({"_id": loc_doc["_id"]})

    # 2. Cleanup: Pull this location entity from all items of this tenant
    b_queries = [{"businessId": tenant_id}]
    if ObjectId.is_valid(tenant_id):
        b_queries.append({"businessId": ObjectId(tenant_id)})

    target_keys = [loc_id_str, location_id]
    if loc_code:
        target_keys.append(loc_code)

    for target_db in [tenant_db, primary_db]:
        await target_db.items.update_many(
            {"$or": b_queries},
            {"$pull": {"locations": {"locationId": {"$in": target_keys}}}}
        )

    # 3. Cleanup: Pull this location assignment from all staff users
    await primary_db.users.update_many(
        {"$or": b_queries},
        {"$pull": {"assignedLocationIds": {"$in": target_keys}}}
    )

@router.post("/{location_id}/sync-inventory", response_model=LocationSyncResponse)
async def sync_location_inventory(
    location_id: str,
    req: LocationSyncInventoryRequest,
    current_user: TokenPayload = Depends(get_current_user)
):
    if "SUPER_ADMIN" not in current_user.roles and "TENANT_ADMIN" not in current_user.roles and "MANAGER" not in current_user.roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to sync inventory across branches."
        )

    primary_db = get_database()
    query = _build_id_query(location_id, current_user.default_business_id if "SUPER_ADMIN" not in current_user.roles else None)

    loc_doc = await primary_db.locations.find_one(query)
    if not loc_doc:
        loc_doc = await primary_db.locations.find_one(_build_id_query(location_id))
    
    tenant_id = (loc_doc.get("businessId") if loc_doc else None) or current_user.default_business_id or ""
    tenant_db = await get_tenant_db(tenant_id) if tenant_id else primary_db
    
    if not loc_doc and tenant_db:
        loc_doc = await tenant_db.locations.find_one(query)
    if not loc_doc and tenant_db:
        loc_doc = await tenant_db.locations.find_one(_build_id_query(location_id))
    
    if not loc_doc:
        raise HTTPException(status_code=404, detail="Location not found.")

    loc_id_str = str(loc_doc["_id"])
    loc_name = loc_doc.get("name", "Branch Outlet")
    loc_code = loc_doc.get("code", "")

    # Default flagship location
    default_loc = await primary_db.locations.find_one({"businessId": tenant_id, "isDefault": True})
    if not default_loc:
        default_loc = await tenant_db.locations.find_one({"businessId": tenant_id, "isDefault": True})
    if not default_loc:
        default_loc = await primary_db.locations.find_one({"businessId": tenant_id})
    if not default_loc:
        default_loc = await tenant_db.locations.find_one({"businessId": tenant_id})
    default_loc_id = str(default_loc["_id"]) if default_loc else "MAIN-01"
    default_loc_name = default_loc.get("name", "Main Flagship Counter") if default_loc else "Main Flagship Counter"

    b_queries = [{"businessId": tenant_id}]
    if ObjectId.is_valid(tenant_id):
        b_queries.append({"businessId": ObjectId(tenant_id)})

    selected_ids = set(req.itemIds or [])
    synced_count = 0
    now = datetime.now(timezone.utc)

    dbs_to_sync = [tenant_db]
    if primary_db.name != tenant_db.name:
        dbs_to_sync.append(primary_db)

    for target_db in dbs_to_sync:
        cursor = target_db.items.find({"$or": b_queries})
        count_chk = await target_db.items.count_documents({"$or": b_queries})
        if count_chk == 0:
            cursor = target_db.items.find({})

        async for item in cursor:
            synced_count += 1
            item_locations = list(item.get("locations") or [])
            item_id_str = str(item["_id"])
            public_id = str(item.get("publicItemId") or "")
            sku = str(item.get("sku") or "")
            
            # Decide if this item should be listed for target location
            if req.mode == "ALL_ENABLED":
                is_listed = True
            elif req.mode == "ALL_DISABLED":
                is_listed = False
            else:  # SELECTIVE
                is_listed = (item_id_str in selected_ids or public_id in selected_ids or sku in selected_ids)

            # 1. Guarantee default location entity is present with isListed=True
            loc_ids = {str(l.get("locationId")) for l in item_locations if l.get("locationId")}
            if default_loc_id not in loc_ids and (default_loc and default_loc.get("code") not in loc_ids):
                item_locations.append({
                    "locationId": default_loc_id,
                    "locationName": default_loc_name,
                    "mrp": float(item.get("mrp", item.get("salePrice", 0.0))),
                    "salePrice": float(item.get("salePrice", 0.0)),
                    "purchasePrice": float(item.get("purchasePrice", 0.0)),
                    "currentStock": float(item.get("currentStock", 0.0)),
                    "minStockAlert": float(item.get("minStockAlert", 5.0)),
                    "isListed": True,
                    "hasDiscount": bool(item.get("hasDiscount", False)),
                    "discountType": item.get("discountType", "PERCENT"),
                    "discountValue": float(item.get("discountValue", 0.0))
                })

            # 2. Update or insert target location entity
            found_target = False
            for loc_entry in item_locations:
                if loc_entry.get("locationId") in (loc_id_str, loc_code, location_id):
                    loc_entry["locationName"] = loc_name
                    loc_entry["isListed"] = is_listed
                    if req.defaultStock is not None and req.defaultStock > 0 and float(loc_entry.get("currentStock", 0.0)) == 0.0:
                        loc_entry["currentStock"] = float(req.defaultStock)
                    found_target = True
                    break

            if not found_target:
                item_locations.append({
                    "locationId": loc_id_str,
                    "locationName": loc_name,
                    "mrp": float(item.get("mrp", item.get("salePrice", 0.0))),
                    "salePrice": float(item.get("salePrice", 0.0)),
                    "purchasePrice": float(item.get("purchasePrice", 0.0)),
                    "currentStock": float(req.defaultStock or 0.0),
                    "minStockAlert": float(item.get("minStockAlert", 5.0)),
                    "isListed": is_listed,
                    "hasDiscount": bool(item.get("hasDiscount", False)),
                    "discountType": item.get("discountType", "PERCENT"),
                    "discountValue": float(item.get("discountValue", 0.0))
                })

            await target_db.items.update_one(
                {"_id": item["_id"]},
                {"$set": {"locations": item_locations, "updatedAt": now}}
            )

    return LocationSyncResponse(
        success=True,
        message=f"Successfully synchronized {synced_count} items to branch '{loc_name}' ({loc_code}).",
        syncedCount=synced_count,
        locationId=loc_id_str,
        mode=req.mode
    )


