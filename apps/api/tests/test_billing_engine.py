import pytest
from decimal import Decimal
from app.services.billing_engine import BillingEngine, LineItemCalcInput

def test_single_item_no_tax_no_discount():
    items = [
        LineItemCalcInput(
            item_id="1",
            name_snapshot="Product A",
            quantity=Decimal("3"),
            unit_price=Decimal("100.00"),
            discount=Decimal("0.00"),
            tax_rate=Decimal("0.0")
        )
    ]
    totals = BillingEngine.calculate(items=items, enable_round_off=True)
    assert totals.subtotal == Decimal("300.00")
    assert totals.tax_total == Decimal("0.00")
    assert totals.grand_total == Decimal("300.00")
    assert totals.balance_due == Decimal("300.00")

def test_multi_item_gst_and_roundoff():
    items = [
        LineItemCalcInput(
            item_id="1",
            name_snapshot="Almond Milk",
            quantity=Decimal("2"),
            unit_price=Decimal("150.00"),  # 300.00
            discount=Decimal("0.00"),
            tax_rate=Decimal("18.0")       # 54.00
        ),
        LineItemCalcInput(
            item_id="2",
            name_snapshot="Lavender Soap",
            quantity=Decimal("1"),
            unit_price=Decimal("99.90"),   # 99.90
            discount=Decimal("10.00"),     # 89.90
            tax_rate=Decimal("5.0")        # 4.50
        )
    ]
    # Taxable: 300 + 89.90 = 389.90
    # Tax: 54.00 + 4.50 = 58.50
    # Total before round: 389.90 + 58.50 = 448.40
    # Rounded: 448.00, RoundOff: -0.40
    totals = BillingEngine.calculate(items=items, enable_round_off=True)
    assert totals.subtotal == Decimal("389.90")
    assert totals.tax_total == Decimal("58.50")
    assert totals.grand_total == Decimal("448.00")
    assert totals.round_off == Decimal("-0.40")

def test_partial_payment_balance_due():
    items = [
        LineItemCalcInput(
            item_id="1",
            name_snapshot="Item X",
            quantity=Decimal("1"),
            unit_price=Decimal("500.00"),
            discount=Decimal("0.00"),
            tax_rate=Decimal("0.0")
        )
    ]
    totals = BillingEngine.calculate(
        items=items,
        paid_amount=Decimal("200.00"),
        enable_round_off=False
    )
    assert totals.grand_total == Decimal("500.00")
    assert totals.paid_amount == Decimal("200.00")
    assert totals.balance_due == Decimal("300.00")
