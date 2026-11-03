from typing import List, Optional
from bson import ObjectId
from fastapi import APIRouter, Depends, Query, status
from app.core.database import get_tenant_db, db_manager
from app.core.security import get_current_business_id, get_current_user, TokenPayload, enforce_active_store_operations
from app.schemas.cafe import TableCreate, TableUpdate, TableResponse, TableStatusUpdate
from app.services.cafe_session_service import CafeSessionService

router = APIRouter(prefix="/cafe/tables", tags=["Café Tables & Floor Plan"])

@router.get("", response_model=List[TableResponse], response_model_by_alias=True)
async def list_tables(
    location_id: Optional[str] = Query(None, alias="locationId"),
    business_id: str = Depends(get_current_business_id),
):
    """
    List all active dining tables for the store / branch location.
    """
    db = await get_tenant_db(business_id)
    service = CafeSessionService(db)
    return await service.list_tables(business_id, location_id)

@router.post("", response_model=TableResponse, status_code=status.HTTP_201_CREATED, response_model_by_alias=True)
async def create_table(
    payload: TableCreate,
    user: TokenPayload = Depends(get_current_user),
    business_id: str = Depends(enforce_active_store_operations),
):
    """
    Create a new dining table with unique table number per branch.
    QR URL uses the tenant slug + table number for a clean, human-readable format.
    """
    db = await get_tenant_db(business_id)

    # Fetch business slug from primary DB for clean QR URL generation
    slug = business_id  # fallback
    try:
        primary_db = db_manager.get_primary_database()
        b_oid = ObjectId(business_id) if ObjectId.is_valid(business_id) else None
        if b_oid:
            tenant_doc = await primary_db.tenants.find_one({"_id": b_oid})
            if tenant_doc and tenant_doc.get("slug"):
                slug = tenant_doc["slug"]
    except Exception:
        pass  # Non-fatal — fallback to business_id

    service = CafeSessionService(db)
    return await service.create_table(business_id, payload, business_slug=slug)

@router.put("/{table_id}", response_model=TableResponse, response_model_by_alias=True)
async def update_table(
    table_id: str,
    payload: TableUpdate,
    user: TokenPayload = Depends(get_current_user),
    business_id: str = Depends(enforce_active_store_operations),
):
    """
    Update table metadata (label, section, capacity, etc.).
    """
    db = await get_tenant_db(business_id)
    service = CafeSessionService(db)
    return await service.update_table(business_id, table_id, payload)

@router.patch("/{table_id}/status", response_model=TableResponse, response_model_by_alias=True)
async def update_table_status(
    table_id: str,
    payload: TableStatusUpdate,
    user: TokenPayload = Depends(get_current_user),
    business_id: str = Depends(enforce_active_store_operations),
):
    """
    Quick status transition (AVAILABLE, OCCUPIED, ORDERING, BILLING, CLEANING).
    """
    db = await get_tenant_db(business_id)
    service = CafeSessionService(db)
    return await service.update_table_status(business_id, table_id, payload.status)

@router.delete("/{table_id}", status_code=status.HTTP_200_OK)
async def delete_table(
    table_id: str,
    user: TokenPayload = Depends(get_current_user),
    business_id: str = Depends(enforce_active_store_operations),
):
    """
    Soft-delete / deactivate dining table.
    """
    db = await get_tenant_db(business_id)
    service = CafeSessionService(db)
    deleted = await service.delete_table(business_id, table_id)
    return {"success": deleted, "tableId": table_id}
