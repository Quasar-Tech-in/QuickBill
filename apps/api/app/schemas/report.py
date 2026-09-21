from decimal import Decimal
from typing import List, Optional
from pydantic import BaseModel
from app.schemas.common import BaseSchema

class DashboardSummaryResponse(BaseSchema):
    total_sales: Decimal
    total_purchases: Decimal
    money_in: Decimal
    money_out: Decimal
    total_receivables: Decimal
    total_payables: Decimal
    low_stock_count: int
    total_orders_count: int
    total_customers_count: int

class ProfitAndLossResponse(BaseSchema):
    gross_sales: Decimal
    sales_returns: Decimal
    net_sales: Decimal
    cost_of_goods_sold: Decimal
    gross_profit: Decimal
    operating_expenses: Decimal
    net_profit: Decimal

class StockSummaryItem(BaseSchema):
    item_id: str
    name: str
    sku: Optional[str]
    current_stock: int
    unit: str
    unit_cost: Decimal
    valuation: Decimal
    status: str  # IN_STOCK, LOW_STOCK, OUT_OF_STOCK

class StockSummaryResponse(BaseSchema):
    items: List[StockSummaryItem]
    total_items: int
    total_quantity: int
    total_valuation: Decimal
