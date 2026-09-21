from decimal import Decimal
from typing import Dict, Any, List
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.schemas.report import DashboardSummaryResponse, ProfitAndLossResponse, StockSummaryResponse, StockSummaryItem

class ReportService:
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db

    async def get_dashboard_summary(self, business_id: str) -> DashboardSummaryResponse:
        b_oid = ObjectId(business_id) if ObjectId.is_valid(business_id) else ObjectId()

        # 1. Total Sales
        sales_cursor = self.db.invoices.aggregate([
            {"$match": {"businessId": b_oid, "status": "CONFIRMED"}},
            {"$group": {"_id": None, "total": {"$sum": "$grandTotal"}, "count": {"$sum": 1}}}
        ])
        sales_res = await sales_cursor.to_list(length=1)
        total_sales = Decimal(str(sales_res[0]["total"])) if sales_res else Decimal("0.00")
        total_orders = sales_res[0]["count"] if sales_res else 0

        # 2. Money In / Out
        money_in_cursor = self.db.payments.aggregate([
            {"$match": {"businessId": b_oid, "direction": "IN"}},
            {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
        ])
        money_in_res = await money_in_cursor.to_list(length=1)
        money_in = Decimal(str(money_in_res[0]["total"])) if money_in_res else Decimal("0.00")

        money_out_cursor = self.db.payments.aggregate([
            {"$match": {"businessId": b_oid, "direction": "OUT"}},
            {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
        ])
        money_out_res = await money_out_cursor.to_list(length=1)
        money_out = Decimal(str(money_out_res[0]["total"])) if money_out_res else Decimal("0.00")

        # 3. Low stock count
        low_stock_count = await self.db.items.count_documents({
            "businessId": b_oid,
            "isActive": True,
            "$expr": {"$lte": ["$currentStock", "$minStockAlert"]}
        })

        # 4. Total Customers
        total_customers = await self.db.parties.count_documents({
            "businessId": b_oid,
            "type": "customer"
        })

        # 5. Total Receivables
        rec_cursor = self.db.parties.aggregate([
            {"$match": {"businessId": b_oid}},
            {"$group": {"_id": None, "rec": {"$sum": "$currentReceivable"}, "pay": {"$sum": "$currentPayable"}}}
        ])
        rec_res = await rec_cursor.to_list(length=1)
        receivables = Decimal(str(rec_res[0]["rec"])) if rec_res else Decimal("0.00")
        payables = Decimal(str(rec_res[0]["pay"])) if rec_res else Decimal("0.00")

        return DashboardSummaryResponse(
            total_sales=total_sales,
            total_purchases=Decimal("0.00"),
            money_in=money_in,
            money_out=money_out,
            total_receivables=receivables,
            total_payables=payables,
            low_stock_count=low_stock_count,
            total_orders_count=total_orders,
            total_customers_count=total_customers
        )

    async def get_profit_and_loss(self, business_id: str) -> ProfitAndLossResponse:
        b_oid = ObjectId(business_id) if ObjectId.is_valid(business_id) else ObjectId()

        # Aggregate Sales & COGS
        pipeline = [
            {"$match": {"businessId": b_oid, "status": "CONFIRMED"}},
            {"$unwind": "$items"},
            {
                "$group": {
                    "_id": None,
                    "grossSales": {"$sum": "$items.lineTotal"},
                    "cogs": {"$sum": {"$multiply": ["$items.quantity", {"$ifNull": ["$items.unitPrice", 0]}]}}
                }
            }
        ]
        res = await self.db.invoices.aggregate(pipeline).to_list(length=1)
        gross_sales = Decimal(str(res[0]["grossSales"])) if res else Decimal("0.00")
        cogs = Decimal(str(res[0]["cogs"] * 0.75)) if res else Decimal("0.00")  # Sample standard margin calculation

        # Aggregate expenses
        exp_res = await self.db.expenses.aggregate([
            {"$match": {"businessId": b_oid}},
            {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
        ]).to_list(length=1)
        expenses = Decimal(str(exp_res[0]["total"])) if exp_res else Decimal("0.00")

        gross_profit = gross_sales - cogs
        net_profit = gross_profit - expenses

        return ProfitAndLossResponse(
            gross_sales=gross_sales,
            sales_returns=Decimal("0.00"),
            net_sales=gross_sales,
            cost_of_goods_sold=cogs,
            gross_profit=gross_profit,
            operating_expenses=expenses,
            net_profit=net_profit
        )

    async def get_stock_summary(self, business_id: str) -> StockSummaryResponse:
        b_oid = ObjectId(business_id) if ObjectId.is_valid(business_id) else ObjectId()
        items = await self.db.items.find({"businessId": b_oid, "isActive": True}).to_list(length=500)

        summary_items: List[StockSummaryItem] = []
        total_qty = 0
        total_val = Decimal("0.00")

        for doc in items:
            stock = doc.get("currentStock", 0)
            cost = Decimal(str(doc.get("purchasePrice", "0.00")))
            val = Decimal(stock) * cost
            status_str = "OUT_OF_STOCK" if stock <= 0 else ("LOW_STOCK" if stock <= doc.get("minStockAlert", 5) else "IN_STOCK")

            summary_items.append(StockSummaryItem(
                item_id=str(doc["_id"]),
                name=doc["name"],
                sku=doc.get("sku"),
                current_stock=stock,
                unit=doc.get("unit", "pcs"),
                unit_cost=cost,
                valuation=val,
                status=status_str
            ))
            total_qty += stock
            total_val += val

        return StockSummaryResponse(
            items=summary_items,
            total_items=len(summary_items),
            total_quantity=total_qty,
            total_valuation=total_val
        )
