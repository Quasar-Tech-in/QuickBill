---
name: payments-and-ledger
description: >-
  Standards for processing Payment In & Payment Out, handling multi-payment allocations,
  managing party balances (customer receivables, supplier payables), cash/bank ledgers, and reconciliation.
---

# Payments, Balances & Party Ledger Management

## 1. Core Principles

1. **SEPARATION OF PAYMENTS FROM INVOICES**:
   - An invoice defines the financial claim and tax event.
   - Payments are recorded as discrete transaction documents in `payments`.
   - A single invoice can be settled by multiple partial payments across different dates and payment methods (Cash, UPI, Card, Bank Transfer).
2. **DOUBLE-ENTRY LEDGER INTEGRITY**:
   - Every payment modifies two accounts:
     1. **Party Account Balance** (reduces customer receivable or supplier payable).
     2. **Financial Asset Account** (increases/decreases Cash in Hand or Bank Account balance).
3. **NO SILENT TRANSACTION DELETIONS**:
   - Financial adjustments require an explicit reverse transaction (e.g., `PAYMENT_REVERSED` / `REFUND`).

---

## 2. Payment Models & Directions

### 2.1. Payment In (Money Received)
- **Source**: Customer or debtor.
- **Effect**:
  - Decreases Customer Receivable ($\text{Receivable} \leftarrow \text{Receivable} - \text{Amount}$).
  - Increases Business Cash / Bank balance.
  - Updates linked Invoice `paidAmount` and transitions `paymentStatus` (`PAID` | `PARTIAL` | `UNPAID`).

### 2.2. Payment Out (Money Paid)
- **Source**: Paid to Supplier, Vendor, or Expense Payee.
- **Effect**:
  - Decreases Supplier Payable ($\text{Payable} \leftarrow \text{Payable} - \text{Amount}$).
  - Decreases Business Cash / Bank balance.
  - Updates linked Purchase Bill balance.

---

## 3. Data Schema: `payments` Collection

```json
{
  "_id": ObjectId("65f2a1b9p10..."),
  "businessId": ObjectId("65f2a1b9a00..."),
  "paymentNumber": "PAY-2026-000089",
  "direction": "IN",
  "partyId": ObjectId("65f2a1b9d11..."),
  "partyNameSnapshot": "Aarav Sharma",
  "invoiceId": ObjectId("65f2a1b9e99..."),
  "invoiceNumber": "INV-2026-000142",
  "amount": Decimal128("300.00"),
  "paymentMode": "UPI",
  "referenceNumber": "UPI/428392819283",
  "accountId": ObjectId("65f2a1b9b01..."),
  "accountName": "HDFC Current Account",
  "notes": "Advance via QR scan at counter",
  "paidAt": ISODate("2026-09-20T10:15:00Z"),
  "createdByUserId": ObjectId("65f2a1b9u01..."),
  "createdAt": ISODate("2026-09-20T10:15:00Z")
}
```

---

## 4. Party Statement / Ledger Query Pattern

The party statement provides an auditable running balance:

$$\text{Running Balance}_t = \text{Opening Balance} + \sum \text{Sales} - \sum \text{Payments In} - \sum \text{Sale Returns}$$

```python
async def get_party_statement(db, business_id: str, party_id: str, start_date: datetime, end_date: datetime):
    # Aggregation combines Invoices, Returns, and Payments for the party
    pipeline = [
        {
            "$match": {
                "businessId": ObjectId(business_id),
                "partyId": ObjectId(party_id),
                "createdAt": {"$gte": start_date, "$lte": end_date}
            }
        },
        {"$sort": {"createdAt": 1}}
    ]
    # Reconcile transactions into chronologically ordered ledger entries
```

---

## 5. Payment Modes Supported
- `CASH`: Cash in hand register.
- `UPI`: Google Pay, PhonePe, Paytm, BHIM UPI.
- `CARD`: Credit/Debit Card POS machine.
- `BANK_TRANSFER`: NEFT / RTGS / IMPS.
- `CHEQUE`: Bank cheque clearing.
- `OTHER`: Store credit / loyalty adjustments.

---

## 6. Verification Checklist
- [ ] Multiple payments on a single invoice accurately decrement `balanceDue`.
- [ ] Invoice status transitions automatically: `UNPAID` $\rightarrow$ `PARTIAL` $\rightarrow$ `PAID`.
- [ ] Cash/Bank account balances update in sync with payment transactions.
- [ ] Party statements accurately show debit, credit, and running balance totals.
