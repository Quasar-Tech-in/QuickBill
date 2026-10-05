from decimal import Decimal
from typing import Dict, Any, List, Optional
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.schemas.report import DashboardSummaryResponse, ProfitAndLossResponse, StockSummaryResponse, StockSummaryItem

class ReportService:
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db

    def _build_date_query(self, field_name: str, from_date: Optional[str], to_date: Optional[str]) -> Optional[Dict[str, Any]]:
        if not from_date and not to_date:
            return None
        cond: Dict[str, Any] = {}
        if from_date:
            cond["$gte"] = from_date
        if to_date:
            cond["$lte"] = f"{to_date}T23:59:59.999Z" if "T" not in to_date else to_date
        return {field_name: cond}

    async def get_dashboard_summary(self, business_id: str, from_date: Optional[str] = None, to_date: Optional[str] = None) -> DashboardSummaryResponse:
        b_oid = ObjectId(business_id) if ObjectId.is_valid(business_id) else ObjectId()

        # 1. Total Sales
        sales_match: Dict[str, Any] = {"businessId": b_oid, "status": "CONFIRMED"}
        date_q = self._build_date_query("createdAt", from_date, to_date)
        if date_q:
            sales_match.update(date_q)

        sales_cursor = self.db.invoices.aggregate([
            {"$match": sales_match},
            {"$group": {"_id": None, "total": {"$sum": "$grandTotal"}, "count": {"$sum": 1}}}
        ])
        sales_res = await sales_cursor.to_list(length=1)
        total_sales = Decimal(str(sales_res[0]["total"])) if sales_res else Decimal("0.00")
        total_orders = sales_res[0]["count"] if sales_res else 0

        # 2. Money In / Out
        pay_in_match: Dict[str, Any] = {"businessId": b_oid, "direction": "IN"}
        if date_q:
            pay_in_match.update(date_q)
        money_in_cursor = self.db.payments.aggregate([
            {"$match": pay_in_match},
            {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
        ])
        money_in_res = await money_in_cursor.to_list(length=1)
        money_in = Decimal(str(money_in_res[0]["total"])) if money_in_res else Decimal("0.00")

        pay_out_match: Dict[str, Any] = {"businessId": b_oid, "direction": "OUT"}
        if date_q:
            pay_out_match.update(date_q)
        money_out_cursor = self.db.payments.aggregate([
            {"$match": pay_out_match},
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

    async def get_profit_and_loss(self, business_id: str, from_date: Optional[str] = None, to_date: Optional[str] = None) -> ProfitAndLossResponse:
        b_oid = ObjectId(business_id) if ObjectId.is_valid(business_id) else ObjectId()

        inv_match: Dict[str, Any] = {"businessId": b_oid, "status": "CONFIRMED"}
        date_q = self._build_date_query("createdAt", from_date, to_date)
        if date_q:
            inv_match.update(date_q)

        # 1. Aggregate Invoices for Gross Sales, Taxable Base (Net Sales), and GST
        inv_pipeline = [
            {"$match": inv_match},
            {
                "$group": {
                    "_id": None,
                    "grossSales": {"$sum": "$grandTotal"},
                    "taxTotal": {"$sum": "$taxTotal"},
                    "subtotal": {"$sum": "$subtotal"},
                    "returnTotal": {"$sum": "$returnTotal"}
                }
            }
        ]
        inv_res = await self.db.invoices.aggregate(inv_pipeline).to_list(length=1)
        gross_sales = Decimal(str(inv_res[0]["grossSales"])) if inv_res else Decimal("0.00")
        tax_total = Decimal(str(inv_res[0]["taxTotal"])) if inv_res else Decimal("0.00")
        returns = Decimal(str(inv_res[0].get("returnTotal", 0))) if inv_res else Decimal("0.00")
        net_sales = max(Decimal("0.00"), gross_sales - tax_total - returns)

        # 2. Aggregate COGS from inventory ledger / item purchase prices
        cogs_pipeline = [
            {"$match": inv_match},
            {"$unwind": "$items"},
            {
                "$lookup": {
                    "from": "items",
                    "let": {"item_id_str": "$items.itemId"},
                    "pipeline": [
                        {
                            "$match": {
                                "$expr": {
                                    "$or": [
                                        {"$eq": ["$_id", {"$toObjectId": "$$item_id_str"}]},
                                        {"$eq": ["$id", "$$item_id_str"]},
                                        {"$eq": ["$publicItemId", "$$item_id_str"]}
                                    ]
                                }
                            }
                        }
                    ],
                    "as": "catalog_item"
                }
            },
            {
                "$project": {
                    "qty": "$items.quantity",
                    "ret_qty": {"$ifNull": ["$items.returnedQuantity", 0]},
                    "purchase_price": {
                        "$ifNull": [
                            {"$arrayElemAt": ["$catalog_item.purchasePrice", 0]},
                            {"$multiply": ["$items.unitPrice", 0.70]}
                        ]
                    }
                }
            },
            {
                "$group": {
                    "_id": None,
                    "totalCogs": {
                        "$sum": {
                            "$multiply": [
                                {"$subtract": ["$qty", "$ret_qty"]},
                                "$purchase_price"
                            ]
                        }
                    }
                }
            }
        ]
        try:
            cogs_res = await self.db.invoices.aggregate(cogs_pipeline).to_list(length=1)
            cogs = Decimal(str(round(cogs_res[0]["totalCogs"], 2))) if cogs_res else (net_sales * Decimal("0.70"))
        except Exception:
            cogs = net_sales * Decimal("0.70")

        # 3. Aggregate operating expenses
        exp_match: Dict[str, Any] = {"businessId": b_oid}
        if date_q:
            exp_match.update(date_q)
        exp_res = await self.db.expenses.aggregate([
            {"$match": exp_match},
            {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
        ]).to_list(length=1)
        expenses = Decimal(str(exp_res[0]["total"])) if exp_res else Decimal("0.00")

        gross_profit = net_sales - cogs
        net_profit = gross_profit - expenses

        return ProfitAndLossResponse(
            gross_sales=gross_sales,
            sales_returns=returns,
            net_sales=net_sales,
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
