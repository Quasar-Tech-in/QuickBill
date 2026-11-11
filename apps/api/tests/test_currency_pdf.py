import pytest
from app.core.pdf_fonts import register_pdf_unicode_fonts
from app.services.invoice_pdf_service import InvoicePdfService
from app.services.label_service import LabelService
from app.schemas.label import LabelPrintConfig, PaperSize, CodeType


def test_pdf_font_registration_and_rupee_symbol():
    reg, bold, italic, sym = register_pdf_unicode_fonts()
    assert reg is not None
    assert bold is not None
    assert italic is not None
    # On environments with standard fonts (Windows, Linux with DejaVu/Liberation/FreeSans), sym is ₹
    assert sym in ("₹", "Rs.")


def test_invoice_pdf_contains_rupee_and_no_legacy_rs():
    mock_sale = {
        "invoiceNumber": "INV-2026-9999",
        "date": "2026-11-08",
        "consumerName": "Rohan Mehra",
        "consumerPhone": "+919876543210",
        "items": [
            {
                "nameSnapshot": "Premium Tea 500g",
                "quantity": 2,
                "unitPrice": 350.0,
                "discount": 50.0,
                "lineTotal": 650.0,
            }
        ],
        "subtotal": 600.0,
        "taxTotal": 50.0,
        "roundOff": 0.0,
        "grandTotal": 650.0,
        "paidAmount": 650.0,
        "balanceDue": 0.0,
        "paymentMode": "UPI",
    }

    mock_tenant = {
        "name": "QuickBill Mart",
        "tagline": "Fast & Reliable",
        "address": "Connaught Place, New Delhi",
        "phone": "+91 9999988888",
        "gstin": "07AAAAA0000A1Z5",
    }

    # Verify prepared metrics discount label
    metrics = InvoicePdfService._prepare_metrics(mock_sale)
    assert len(metrics["items"]) == 1
    # Check that discount label does not contain legacy 'Rs.'
    assert "Rs." not in metrics["items"][0]["discount_label"]
    assert "₹" in metrics["items"][0]["discount_label"]

    # Generate A4 PDF
    a4_pdf = InvoicePdfService.generate_pdf(mock_sale, mock_tenant, format_type="A4")
    assert isinstance(a4_pdf, bytes)
    assert a4_pdf.startswith(b"%PDF-")
    # Verify legacy Rs. is not present in PDF content
    assert b"Rs." not in a4_pdf

    # Generate Thermal PDF
    thermal_pdf = InvoicePdfService.generate_pdf(mock_sale, mock_tenant, format_type="THERMAL")
    assert isinstance(thermal_pdf, bytes)
    assert thermal_pdf.startswith(b"%PDF-")
    assert b"Rs." not in thermal_pdf


def test_label_pdf_generation_with_rupee_symbol():
    cfg = LabelPrintConfig(
        item_name="Smart Fitness Watch",
        sale_price=2499.00,
        sku="SFW-001",
        barcode="890123456789",
        paper_size=PaperSize.THERMAL_50x30,
        code_type=CodeType.BARCODE,
        quantity=1,
        show_price=True,
    )

    pdf_bytes = LabelService.generate_single_thermal_50x30(cfg, store_name="TechZone")
    assert isinstance(pdf_bytes, bytes)
    assert pdf_bytes.startswith(b"%PDF-")
    assert b"Rs." not in pdf_bytes

