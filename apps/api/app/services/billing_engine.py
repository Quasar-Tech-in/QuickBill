from decimal import Decimal, ROUND_HALF_UP
from typing import List
from pydantic import BaseModel, Field

def quantize_currency(val: Decimal) -> Decimal:
    return val.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

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
        subtotal = Decimal("0.00")
        tax_total = Decimal("0.00")
        item_discount_total = Decimal("0.00")

        for item in items:
            gross = quantize_currency(item.quantity * item.unit_price)
            discount = quantize_currency(min(item.discount, gross))
            taxable = quantize_currency(gross - discount)
            tax = quantize_currency(taxable * (item.tax_rate / Decimal("100.00")))
            line_total = quantize_currency(taxable + tax)

            subtotal += taxable
            tax_total += tax
            item_discount_total += discount

            calculated_items.append(LineItemCalcOutput(
                item_id=item.item_id,
                name_snapshot=item.name_snapshot,
                sku_snapshot=item.sku_snapshot,
                quantity=item.quantity,
                unit_price=item.unit_price,
                gross_amount=gross,
                discount=discount,
                taxable_amount=taxable,
                tax_rate=item.tax_rate,
                tax_amount=tax,
                line_total=line_total
            ))

        total_before_round = subtotal + tax_total + additional_charges - invoice_discount
        
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
