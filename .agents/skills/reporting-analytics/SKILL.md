---
name: reporting-analytics
description: >-
  Guidelines for generating financial and operational reports: Profit & Loss statements,
  simplified Balance Sheet, Sales/Purchase summaries, inventory valuation, and CSV/PDF data exports.
---

# Reporting, Analytics & Financial Intelligence

## 1. Core Principles

1. **TIMEZONE-AWARE QUERYING**:
   - All report queries must translate date ranges (e.g., "Today", "This Month") using the business's configured timezone (e.g., `Asia/Kolkata` / UTC+05:30) before constructing MongoDB UTC timestamps.
2. **PERFORMANCE AGGREGATIONS**:
   - Use MongoDB aggregation pipelines with pre-filtering `$match` clauses utilizing compound tenant indexes.
3. **RECONCILIATION AGAINST TRANSACTION LOGS**:
   - Summary figures in reports must mathematically reconcile with individual invoice, payment, and inventory ledger records.

---

## 2. Profit & Loss (P&L) Calculation Logic

### 2.1. Formulas
1. $\text{Gross Sales} = \sum \text{Sales Invoices Grand Total}$
2. $\text{Sales Returns} = \sum \text{Credit Notes / Returns}$
3. $\text{Net Sales} = \text{Gross Sales} - \text{Sales Returns}$
4. $\text{Cost of Goods Sold (COGS)} = \sum_{\text{Sales}} (\text{Quantity Sold} \times \text{Item Purchase Price / Unit Cost})$
5. $\text{Gross Profit} = \text{Net Sales} - \text{COGS}$
6. $\text{Total Operating Expenses} = \sum \text{Business Expenses}$
7. $\text{Net Profit} = \text{Gross Profit} + \text{Other Income} - \text{Total Operating Expenses}$

### 2.2. MongoDB Aggregation Pipeline for P&L
```python
async def compute_profit_and_loss(db, business_id: str, start_utc: datetime, end_utc: datetime):
    # 1. Aggregate Sales & COGS
    sales_pipeline = [
        {
            "$match": {
                "businessId": ObjectId(business_id),
                "createdAt": {"$gte": start_utc, "$lte": end_utc},
                "status": "CONFIRMED"
            }
        },
        {"$unwind": "$items"},
        {
            "$group": {
                "_id": None,
                "netSales": {"$sum": "$items.lineTotal"},
                "totalCOGS": {
                    "$sum": {
                        "$multiply": ["$items.quantity", {"$ifNull": ["$items.purchasePriceSnapshot", 0]}]
                    }
                }
            }
        }
    ]
    # 2. Aggregate Expenses
    # 3. Combine into Profit & Loss Response
```

---

## 3. Simplified Balance Sheet Structure

### 3.1. Assets
- **Current Assets**:
  - Cash in Hand (`accounts` where type = CASH)
  - Bank Account Balances (`accounts` where type = BANK)
  - Accounts Receivable (Sum of `parties.currentReceivable` for customers)
  - Inventory Stock Value ($\sum \text{Current Stock} \times \text{Purchase Price}$)
- **Total Assets** = $\text{Cash} + \text{Bank} + \text{Receivables} + \text{Inventory}$

### 3.2. Liabilities & Equity
- **Liabilities**:
  - Accounts Payable (Sum of `parties.currentPayable` to suppliers)
  - Taxes Payable (GST collected minus GST paid input tax credit)
- **Equity**:
  - Owner's Capital + Retained Earnings / Current Period Net Profit
- **Balance Sheet Check**: $\text{Total Assets} = \text{Total Liabilities} + \text{Total Equity}$

---

## 4. Key Operational Reports

1. **Day Book**: Chronological stream of all cash, bank, invoice, and expense events for a selected single date.
2. **Stock Summary & Valuation Report**:
   - Item Name, SKU, Category, Current Quantity, Unit Purchase Cost, Total Inventory Valuation ($\text{Quantity} \times \text{Cost}$).
3. **Party Balances Summary (Receivables & Payables)**:
   - Breakdown of all parties with outstanding credit/debit balances, days past due, and last payment date.
4. **GST / Tax Report**:
   - Taxable turnover, CGST, SGST, IGST totals split by tax slabs (0%, 5%, 12%, 18%, 28%).

---

## 5. Verification Checklist
- [ ] P&L calculations reconcile against individual invoices and expense receipts.
- [ ] Date boundaries respect business local timezones (no UTC date mismatch).
- [ ] Export to CSV/PDF delivers well-formatted columns.
