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
            unit_price=Decimal("150.00"),  # 300.00 inclusive of 18% GST
            discount=Decimal("0.00"),
            tax_rate=Decimal("18.0")       # Taxable: 254.24, Tax: 45.76
        ),
        LineItemCalcInput(
            item_id="2",
            name_snapshot="Lavender Soap",
            quantity=Decimal("1"),
            unit_price=Decimal("99.90"),   # 99.90
            discount=Decimal("10.00"),     # 89.90 inclusive of 5% GST
            tax_rate=Decimal("5.0")        # Taxable: 85.62, Tax: 4.28
        )
    ]
    totals = BillingEngine.calculate(items=items, enable_round_off=True)
    assert totals.subtotal == Decimal("339.86")
    assert totals.tax_total == Decimal("50.04")
    assert totals.grand_total == Decimal("390.00")
    assert totals.round_off == Decimal("0.10")


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

def test_fractional_partial_quantity_calculation():
    # 1.506 kg of Basmati Rice at ₹120.00 / kg with 5% inclusive GST
    items = [
        LineItemCalcInput(
            item_id="1",
            name_snapshot="Basmati Rice Loose",
            quantity=Decimal("1.506"),
            unit_price=Decimal("120.00"),
            discount=Decimal("0.00"),
            tax_rate=Decimal("5.0")
        )
    ]
    # Gross = 1.506 * 120 = 180.72
    # Taxable = 180.72 * (100 / 105) = 172.11
    # Tax = 180.72 - 172.11 = 8.61
    totals = BillingEngine.calculate(items=items, enable_round_off=True)
    assert totals.items[0].gross_amount == Decimal("180.72")
    assert totals.items[0].line_total == Decimal("180.72")
    assert totals.subtotal == Decimal("172.11")
    assert totals.tax_total == Decimal("8.61")
    assert totals.grand_total == Decimal("181.00")
    assert totals.round_off == Decimal("0.28")

def test_fraction_quantization_three_decimals():
    # 4 eggs from 30-egg tray at 180.00 / tray: 4/30 = 0.13333333333...
    items = [
        LineItemCalcInput(
            item_id="egg-1",
            name_snapshot="Farm Eggs (Tray of 30)",
            quantity=Decimal("4") / Decimal("30"),  # 0.1333333333333333333333333333
            unit_price=Decimal("180.00"),
            discount=Decimal("0.00"),
            tax_rate=Decimal("0.0")
        )
    ]
    totals = BillingEngine.calculate(items=items, enable_round_off=False)
    # 0.133 * 180.00 = 23.94
    assert totals.items[0].quantity == Decimal("0.133")
    assert totals.items[0].gross_amount == Decimal("23.94")
    assert totals.grand_total == Decimal("23.94")

def test_item_discount_combined_with_invoice_discount():
    # Item 1: price ₹100, flat discount ₹20 -> line net = ₹80
    # Item 2: price ₹100, 10% discount -> line net = ₹90
    # Gross after item discounts = 80 + 90 = 170.00
    # Order discount = ₹17.00 (10% invoice discount)
    # Net Grand Total = 170 - 17 = 153.00
    items = [
        LineItemCalcInput(
            item_id="item-1",
            name_snapshot="Product 1",
            quantity=Decimal("1"),
            unit_price=Decimal("100.00"),
            discount=Decimal("20.00"),
            discount_type="FLAT",
            discount_value=Decimal("20.00"),
            tax_rate=Decimal("0.0")
        ),
        LineItemCalcInput(
            item_id="item-2",
            name_snapshot="Product 2",
            quantity=Decimal("1"),
            unit_price=Decimal("100.00"),
            discount=Decimal("0.00"),
            discount_type="PERCENT",
            discount_value=Decimal("10.00"),
            discount_percent=Decimal("10.00"),
            tax_rate=Decimal("0.0")
        )
    ]
    totals = BillingEngine.calculate(
        items=items,
        invoice_discount=Decimal("17.00"),
        enable_round_off=False
    )
    assert totals.items[0].discount == Decimal("20.00")
    assert totals.items[0].line_total == Decimal("80.00")
    assert totals.items[1].discount == Decimal("10.00")
    assert totals.items[1].line_total == Decimal("90.00")
    assert totals.item_discount_total == Decimal("30.00")
    assert totals.invoice_discount == Decimal("17.00")
    assert totals.grand_total == Decimal("153.00")



