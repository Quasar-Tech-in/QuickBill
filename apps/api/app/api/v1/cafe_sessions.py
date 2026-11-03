from typing import List, Optional
from pydantic import BaseModel
from fastapi import APIRouter, Depends, Query, status, HTTPException
from app.core.database import get_tenant_db
from app.core.security import get_current_business_id, get_current_user, TokenPayload, enforce_active_store_operations, resolve_user_name
from app.schemas.cafe import TableSessionResponse, KOTResponse, TableSettleRequest, UpdateSessionOrderRequest
from app.services.cafe_session_service import CafeSessionService

router = APIRouter(prefix="/cafe/sessions", tags=["Café Sessions & Kitchen Tickets"])

class RejectOrderRequest(BaseModel):
    reason: str = "Out of stock / dish unavailable"

class UpdateKOTStatusRequest(BaseModel):
    status: str  # QUEUED | PREPARING | READY | SERVED

@router.get("/active", response_model=List[TableSessionResponse], response_model_by_alias=True)
async def list_active_sessions(
    location_id: Optional[str] = Query(None, alias="locationId"),
    business_id: str = Depends(get_current_business_id),
):
    """
    List active or billing table sessions for floor plan & cashier incoming queue.
    """
    db = await get_tenant_db(business_id)
    service = CafeSessionService(db)
    return await service.get_active_sessions(business_id, location_id)

@router.post("/{session_id}/orders/{order_id}/accept")
async def accept_order(
    session_id: str,
    order_id: str,
    user: TokenPayload = Depends(get_current_user),
    business_id: str = Depends(enforce_active_store_operations),
):
    """
    Accept an incoming diner order and dispatch an incremental Kitchen Order Ticket (KOT).
    """
    db = await get_tenant_db(business_id)
    service = CafeSessionService(db)
    user_name = await resolve_user_name(db, user)
    return await service.accept_session_order(business_id, session_id, order_id, user_name)

@router.post("/{session_id}/orders/{order_id}/reject")
async def reject_order(
    session_id: str,
    order_id: str,
    req: RejectOrderRequest,
    user: TokenPayload = Depends(get_current_user),
    business_id: str = Depends(enforce_active_store_operations),
):
    """
    Reject an incoming customer order with a specified reason.
    """
    db = await get_tenant_db(business_id)
    service = CafeSessionService(db)
    return await service.reject_session_order(business_id, session_id, order_id, req.reason)

@router.patch("/{session_id}/orders/{order_id}")
async def update_order(
    session_id: str,
    order_id: str,
    req: UpdateSessionOrderRequest,
    user: TokenPayload = Depends(get_current_user),
    business_id: str = Depends(enforce_active_store_operations),
):
    """
    Staff edits an order within an active session (modify quantities, items, notes).
    Recalculates item line totals, order subtotal, and table running totals.
    """
    db = await get_tenant_db(business_id)
    service = CafeSessionService(db)
    items_raw = [it.model_dump(by_alias=True) for it in req.items]
    return await service.update_session_order(
        business_id=business_id,
        session_id=session_id,
        order_id=order_id,
        items=items_raw,
        notes=req.notes,
    )

@router.post("/{session_id}/force-close")
async def force_close_session(
    session_id: str,
    user: TokenPayload = Depends(get_current_user),
    business_id: str = Depends(enforce_active_store_operations),
):
    """
    Admin/cashier force-closes a table session, invalidating the joinCode
    and releasing the table to CLEANING status.
    """
    db = await get_tenant_db(business_id)
    service = CafeSessionService(db)
    return await service.force_close_session(business_id, session_id, user.sub)

@router.get("/kots", response_model=List[KOTResponse], response_model_by_alias=True)
async def list_kots(
    location_id: Optional[str] = Query(None, alias="locationId"),
    status: Optional[str] = Query(None),
    business_id: str = Depends(get_current_business_id),
):
    """
    List KOT slips for kitchen staff / Kitchen Display System (KDS).
    """
    db = await get_tenant_db(business_id)
    service = CafeSessionService(db)
    return await service.list_kots(business_id, location_id, status)

@router.patch("/kots/{kot_id}/status")
async def update_kot_status(
    kot_id: str,
    req: UpdateKOTStatusRequest,
    user: TokenPayload = Depends(get_current_user),
    business_id: str = Depends(enforce_active_store_operations),
):
    """
    Update KOT status (QUEUED, PREPARING, READY, SERVED).
    """
    db = await get_tenant_db(business_id)
    service = CafeSessionService(db)
    return await service.update_kot_status(business_id, kot_id, req.status)

@router.post("/{session_id}/settle")
async def settle_table_bill(
    session_id: str,
    payload: TableSettleRequest,
    user: TokenPayload = Depends(get_current_user),
    business_id: str = Depends(enforce_active_store_operations),
):
    """
    Consolidate all accepted table rounds into an authoritative tax invoice,
    record payment, update inventory, and mark table for cleaning.
    """
    db = await get_tenant_db(business_id)
    service = CafeSessionService(db)
    user_name = await resolve_user_name(db, user)
    return await service.settle_session_bill(
        business_id=business_id,
        session_id=session_id,
        user_id=user.sub,
        user_name=user_name,
        payload=payload
    )

