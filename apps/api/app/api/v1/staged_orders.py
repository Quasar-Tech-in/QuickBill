from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from app.core.database import get_tenant_db
from app.core.security import get_current_user, get_current_business_id, TokenPayload
from app.schemas.staged_order import StagedOrderCreateRequest, StagedOrderUpdateRequest, StagedOrderResponse
from app.services.staged_order_service import StagedOrderService

router = APIRouter(prefix="/staged-orders", tags=["POS Staged & Held Orders"])

@router.get("", response_model=List[StagedOrderResponse], response_model_by_alias=True)
async def list_staged_orders(
    location_id: Optional[str] = Query(None, alias="locationId"),
    business_id: str = Depends(get_current_business_id),
):
    """
    List all active staged/held orders for the current tenant and branch location.
    """
    db = await get_tenant_db(business_id)
    service = StagedOrderService(db)
    docs = await service.list_staged_orders(business_id=business_id, location_id=location_id)
    return [StagedOrderResponse(**d) for d in docs]

@router.post("", response_model=StagedOrderResponse, status_code=status.HTTP_201_CREATED, response_model_by_alias=True)
async def create_or_save_staged_order(
    payload: StagedOrderCreateRequest,
    user: TokenPayload = Depends(get_current_user),
    business_id: str = Depends(get_current_business_id),
):
    """
    Create a new staged/held order or update an existing one in-place.
    """
    db = await get_tenant_db(business_id)
    service = StagedOrderService(db)
    user_name = getattr(user, "name", None) or getattr(user, "email", "Cashier")
    doc = await service.create_or_update_staged_order(
        business_id=business_id,
        user_id=user.sub,
        user_name=user_name,
        payload=payload,
        order_id=payload.id
    )
    return StagedOrderResponse(**doc)

@router.put("/{order_id}", response_model=StagedOrderResponse, response_model_by_alias=True)
async def update_staged_order(
    order_id: str,
    payload: StagedOrderCreateRequest,
    user: TokenPayload = Depends(get_current_user),
    business_id: str = Depends(get_current_business_id),
):
    """
    Update a specific staged/held order by ID.
    """
    db = await get_tenant_db(business_id)
    service = StagedOrderService(db)
    user_name = getattr(user, "name", None) or getattr(user, "email", "Cashier")
    doc = await service.create_or_update_staged_order(
        business_id=business_id,
        user_id=user.sub,
        user_name=user_name,
        payload=payload,
        order_id=order_id
    )
    return StagedOrderResponse(**doc)

@router.delete("/{order_id}", status_code=status.HTTP_200_OK)
async def delete_staged_order(
    order_id: str,
    user: TokenPayload = Depends(get_current_user),
    business_id: str = Depends(get_current_business_id),
):
    """
    Delete / purge a staged order when completed or discarded.
    """
    db = await get_tenant_db(business_id)
    service = StagedOrderService(db)
    deleted = await service.delete_staged_order(business_id=business_id, order_id=order_id)
    return {"success": True, "deleted": deleted, "orderId": order_id}
