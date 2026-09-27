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
from app.core.security import get_current_business_id
from app.schemas.common import PaginatedResponse
from app.schemas.item import ItemCreate, ItemUpdate, ItemResponse
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
    business_id: str = Depends(get_current_business_id),
):
    db = await get_tenant_db(business_id)
    repo = ItemRepository(db)
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
    business_id: str = Depends(get_current_business_id),
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

    # Float conversion for monetary / numeric fields
    for float_field in ["purchasePrice", "salePrice", "mrp", "taxRate", "minStockAlert", "currentStock", "discountValue"]:
        if float_field in update_data and update_data[float_field] is not None:
            update_data[float_field] = float(update_data[float_field])

    if "locations" in update_data and update_data["locations"]:
        for loc in update_data["locations"]:
            for float_field in ["mrp", "salePrice", "purchasePrice", "currentStock", "minStockAlert", "discountValue"]:
                if float_field in loc and loc[float_field] is not None:
                    loc[float_field] = float(loc[float_field])

    update_data["updatedAt"] = datetime.now(timezone.utc)

    success = await repo.update_by_id(business_id, item_id, update_data)
    if not success:
        raise HTTPException(status_code=400, detail="Failed to update item")

    updated = await repo.get_by_id(business_id, item_id)
    updated["_id"] = str(updated["_id"])
    updated["businessId"] = str(updated["businessId"])
    return ItemResponse(**updated)

@router.post("/{item_id}/adjust-stock", response_model=ItemResponse)
async def adjust_item_stock(
    item_id: str,
    payload: dict,
    business_id: str = Depends(get_current_business_id),
):
    db = await get_tenant_db(business_id)
    repo = ItemRepository(db)
    existing = await repo.get_by_id(business_id, item_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Item not found in current business catalog")

    delta = float(payload.get("delta", 0))
    location_id = payload.get("locationId")

    current_stock = max(0.0, float(existing.get("currentStock", 0)) + delta)
    update_fields: dict = {
        "currentStock": current_stock,
        "updatedAt": datetime.now(timezone.utc)
    }

    if location_id and existing.get("locations"):
        locs = list(existing["locations"])
        found = False
        for loc in locs:
            if loc.get("locationId") == location_id:
                loc["currentStock"] = max(0.0, float(loc.get("currentStock", 0)) + delta)
                found = True
                break
        if not found:
            locs.append({
                "locationId": location_id,
                "currentStock": max(0.0, delta),
                "salePrice": float(existing.get("salePrice", 0)),
                "purchasePrice": float(existing.get("purchasePrice", 0)),
                "minStockAlert": float(existing.get("minStockAlert", 5)),
                "isListed": True,
            })
        update_fields["locations"] = locs

    await repo.update_by_id(business_id, item_id, update_fields)
    updated = await repo.get_by_id(business_id, item_id)
    updated["_id"] = str(updated["_id"])
    updated["businessId"] = str(updated["businessId"])
    return ItemResponse(**updated)

@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_item(
    item_id: str,
    business_id: str = Depends(get_current_business_id),
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



