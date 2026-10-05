from typing import Optional
from fastapi import APIRouter, Depends, Query
from app.core.database import get_database
from app.core.security import get_current_business_id
from app.schemas.report import DashboardSummaryResponse, ProfitAndLossResponse, StockSummaryResponse
from app.services.report_service import ReportService

router = APIRouter(prefix="/reports", tags=["Reports & Financial Intelligence"])

@router.get("/dashboard", response_model=DashboardSummaryResponse)
async def get_dashboard(
    from_date: Optional[str] = Query(None, alias="fromDate"),
    to_date: Optional[str] = Query(None, alias="toDate"),
    business_id: str = Depends(get_current_business_id),
    db = Depends(get_database)
):
    service = ReportService(db)
    return await service.get_dashboard_summary(business_id, from_date=from_date, to_date=to_date)

@router.get("/profit-loss", response_model=ProfitAndLossResponse)
async def get_profit_and_loss(
    from_date: Optional[str] = Query(None, alias="fromDate"),
    to_date: Optional[str] = Query(None, alias="toDate"),
    business_id: str = Depends(get_current_business_id),
    db = Depends(get_database)
):
    service = ReportService(db)
    return await service.get_profit_and_loss(business_id, from_date=from_date, to_date=to_date)

@router.get("/stock-summary", response_model=StockSummaryResponse)
async def get_stock_summary(
    business_id: str = Depends(get_current_business_id),
    db = Depends(get_database)
):
    service = ReportService(db)
    return await service.get_stock_summary(business_id)
