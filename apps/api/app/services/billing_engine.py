from decimal import Decimal, ROUND_HALF_UP
from typing import List
from pydantic import BaseModel, Field

def quantize_currency(val: Decimal) -> Decimal:
    return val.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

def quantize_qty(val: Decimal) -> Decimal:
    return val.quantize(Decimal("0.001"), rounding=ROUND_HALF_UP)


class LineItemCalcInput(BaseModel):
    item_id: str
    name_snapshot: str
    sku_snapshot: str = ""
    quantity: Decimal = Field(..., gt=0)
    unit_price: Decimal = Field(..., ge=0)
    discount: Decimal = Field(default=Decimal("0.00"), ge=0)
    tax_rate: Decimal = Field(default=Decimal("0.00"), ge=0, le=100)

class LineItemCalcOutput(BaseModel):
    item_id: str
    name_snapshot: str
    sku_snapshot: str
    quantity: Decimal
    unit_price: Decimal
    gross_amount: Decimal
    discount: Decimal
    taxable_amount: Decimal
    tax_rate: Decimal
    tax_amount: Decimal
    line_total: Decimal

class InvoiceTotals(BaseModel):
    items: List[LineItemCalcOutput]
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
    def calculate(
        items: List[LineItemCalcInput],
        invoice_discount: Decimal = Decimal("0.00"),
        additional_charges: Decimal = Decimal("0.00"),
        paid_amount: Decimal = Decimal("0.00"),
        enable_round_off: bool = True
    ) -> InvoiceTotals:
        calculated_items: List[LineItemCalcOutput] = []
        item_discount_total = Decimal("0.00")
        gross_total = Decimal("0.00")

        # 1. First pass: compute line items gross and item discount
        item_intermediates = []
        for item in items:
            q_qty = quantize_qty(item.quantity)
            gross = quantize_currency(q_qty * item.unit_price)
            discount = quantize_currency(min(item.discount, gross))
            net_line_inclusive = quantize_currency(gross - discount)
            
            gross_total += net_line_inclusive
            item_discount_total += discount
            item_intermediates.append((item, q_qty, gross, discount, net_line_inclusive))

        # 2. Compute proportional order/invoice discount factor
        discount_factor = Decimal("1.00")
        if gross_total > Decimal("0.00") and invoice_discount > Decimal("0.00"):
            discount_factor = max(Decimal("0.00"), (gross_total - invoice_discount) / gross_total)

        subtotal = Decimal("0.00")
        tax_total = Decimal("0.00")

        # 3. Second pass: inclusive tax extraction & line totals
        for item, q_qty, gross, discount, net_line_inclusive in item_intermediates:
            effective_line = quantize_currency(net_line_inclusive * discount_factor)
            
            # Taxable base extracted from inclusive amount: Base = Effective / (1 + Rate/100)
            tax_rate = item.tax_rate
            if tax_rate > Decimal("0.00"):
                taxable = quantize_currency(effective_line * (Decimal("100.00") / (Decimal("100.00") + tax_rate)))
                tax = quantize_currency(effective_line - taxable)
            else:
                taxable = effective_line
                tax = Decimal("0.00")

            line_total = quantize_currency(taxable + tax)
            subtotal += taxable
            tax_total += tax

            calculated_items.append(LineItemCalcOutput(
                item_id=item.item_id,
                name_snapshot=item.name_snapshot,
                sku_snapshot=item.sku_snapshot,
                quantity=q_qty,
                unit_price=item.unit_price,
                gross_amount=gross,
                discount=discount,
                taxable_amount=taxable,
                tax_rate=item.tax_rate,
                tax_amount=tax,
                line_total=line_total
            ))

        total_before_round = subtotal + tax_total + additional_charges
        
        if enable_round_off:
            grand_total = total_before_round.quantize(Decimal("1"), rounding=ROUND_HALF_UP).quantize(Decimal("0.01"))
            round_off = quantize_currency(grand_total - total_before_round)
        else:
            grand_total = quantize_currency(total_before_round)
            round_off = Decimal("0.00")

        safe_paid = quantize_currency(min(paid_amount, grand_total))
        balance_due = quantize_currency(max(Decimal("0.00"), grand_total - safe_paid))

        return InvoiceTotals(
            items=calculated_items,
            subtotal=quantize_currency(subtotal),
            tax_total=quantize_currency(tax_total),
            item_discount_total=quantize_currency(item_discount_total),
            invoice_discount=quantize_currency(invoice_discount),
            additional_charges=quantize_currency(additional_charges),
            round_off=round_off,
            grand_total=grand_total,
            paid_amount=safe_paid,
            balance_due=balance_due
        )
