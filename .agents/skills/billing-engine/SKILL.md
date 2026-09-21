---
name: billing-engine
description: >-
  Authoritative server-side calculation engine for invoice line totals, item & invoice
  discounts, tax/GST rates, round-offs, grand totals, payments, and balance calculations.
---

# Billing & Financial Calculation Engine

## 1. Core Principles

1. **Server Authoritative**:
   - The client (mobile/web) may compute preview totals for UI responsiveness.
   - The backend API **recalculates every single line item and total from scratch** based on authoritative database records.
   - Client-supplied totals are strictly ignored or validated against server results.
2. **Fixed Decimal Precision**:
   - All arithmetic operations use Python `Decimal` with `ROUND_HALF_UP` rounding to 2 decimal places.
   - Never use standard IEEE-754 floating point (`float`) in billing arithmetic.

---

## 2. Line Item & Invoice Calculation Formulas

### 2.1. Line Item Computation
For each line item $i$:
1. $\text{Gross Amount}_i = \text{Quantity}_i \times \text{UnitPrice}_i$
2. $\text{Taxable Value}_i = \max(0, \text{Gross Amount}_i - \text{ItemDiscount}_i)$
3. $\text{Tax Amount}_i = \text{round}\left(\text{Taxable Value}_i \times \frac{\text{TaxRate}_i}{100}, 2\right)$
4. $\text{Line Total}_i = \text{Taxable Value}_i + \text{Tax Amount}_i$

### 2.2. Invoice Grand Total & Balances
1. $\text{Subtotal} = \sum \text{Taxable Value}_i$
2. $\text{Tax Total} = \sum \text{Tax Amount}_i$
3. $\text{Total Before Rounding} = \text{Subtotal} + \text{Tax Total} + \text{AdditionalCharges} - \text{InvoiceDiscount}$
4. $\text{Grand Total} = \text{round}(\text{Total Before Rounding}, 0) \quad \text{(or 2 decimal places if rounding disabled)}$
5. $\text{Round Off} = \text{Grand Total} - \text{Total Before Rounding}$
6. $\text{Balance Due} = \max(0, \text{Grand Total} - \text{PaidAmount})$

---

## 3. Reference Python Calculation Engine Implementation

```python
from decimal import Decimal, ROUND_HALF_UP
from typing import List
from pydantic import BaseModel, Field

def quantize_money(val: Decimal) -> Decimal:
    return val.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

class CartItemInput(BaseModel):
    item_id: str
    quantity: Decimal = Field(..., gt=0)
    unit_price: Decimal = Field(..., ge=0)
    item_discount: Decimal = Field(default=Decimal("0.00"), ge=0)
    tax_rate: Decimal = Field(default=Decimal("0.00"), ge=0, le=100)

class CalculatedLineItem(BaseModel):
    item_id: str
    quantity: Decimal
    unit_price: Decimal
    gross_amount: Decimal
    item_discount: Decimal
    taxable_amount: Decimal
    tax_rate: Decimal
    tax_amount: Decimal
    line_total: Decimal

class InvoiceCalculationResult(BaseModel):
    items: List[CalculatedLineItem]
    subtotal: Decimal
    tax_total: Decimal
    item_discount_total: Decimal
    invoice_discount: Decimal
    additional_charges: Decimal
    round_off: Decimal
    grand_total: Decimal
    paid_amount: Decimal
    balance_due: Decimal

class BillingEngine:
    @staticmethod
    def calculate_invoice(
        items: List[CartItemInput],
        invoice_discount: Decimal = Decimal("0.00"),
        additional_charges: Decimal = Decimal("0.00"),
        paid_amount: Decimal = Decimal("0.00"),
        enable_round_off: bool = True
    ) -> InvoiceCalculationResult:
        calc_items = []
        subtotal = Decimal("0.00")
        tax_total = Decimal("0.00")
        item_discount_total = Decimal("0.00")

        for item in items:
            gross = quantize_money(item.quantity * item.unit_price)
            discount = quantize_money(min(item.item_discount, gross))
            taxable = quantize_money(gross - discount)
            tax = quantize_money(taxable * (item.tax_rate / Decimal("100.00")))
            line_total = quantize_money(taxable + tax)

            subtotal += taxable
            tax_total += tax
            item_discount_total += discount

            calc_items.append(CalculatedLineItem(
                item_id=item.item_id,
                quantity=item.quantity,
                unit_price=item.unit_price,
                gross_amount=gross,
                item_discount=discount,
                taxable_amount=taxable,
                tax_rate=item.tax_rate,
                tax_amount=tax,
                line_total=line_total
            ))

        total_before_round = subtotal + tax_total + additional_charges - invoice_discount
        
        if enable_round_off:
            grand_total = total_before_round.quantize(Decimal("1.00"), rounding=ROUND_HALF_UP)
            round_off = quantize_money(grand_total - total_before_round)
        else:
            grand_total = quantize_money(total_before_round)
            round_off = Decimal("0.00")

        paid_safe = quantize_money(min(paid_amount, grand_total))
        balance_due = quantize_money(max(Decimal("0.00"), grand_total - paid_safe))

        return InvoiceCalculationResult(
            items=calc_items,
            subtotal=quantize_money(subtotal),
            tax_total=quantize_money(tax_total),
            item_discount_total=quantize_money(item_discount_total),
            invoice_discount=quantize_money(invoice_discount),
            additional_charges=quantize_money(additional_charges),
            round_off=round_off,
            grand_total=grand_total,
            paid_amount=paid_safe,
            balance_due=balance_due
        )
```

---

## 4. Edge Cases & Validation Rules

1. **Item Discount exceeds Gross**: Cap discount at line gross amount ($ItemDiscount \le Gross$).
2. **Paid Amount exceeds Grand Total**: Prevent overpayment on billing unless explicitly marked as party credit/advance.
3. **Negative Line Items**: Negative quantity or negative prices are strictly forbidden in sale billing (use Sale Returns / Credit Notes instead).
4. **GST Splitting**: If Indian GST applies, automatically split `tax_amount` equally into CGST (50%) and SGST (50%) for intra-state sales, or IGST (100%) for inter-state sales.

---

## 5. Verification Checklist
- [ ] Round-off math matches standard Indian retail accounting rules ($0.50+$ rounds up).
- [ ] Zero floating-point drift in unit test calculations over 10,000 randomized orders.
- [ ] Grand total = Subtotal + Taxes + Additional Charges - Discounts + RoundOff.
