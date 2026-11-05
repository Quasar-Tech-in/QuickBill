import pytest
from httpx import AsyncClient, ASGITransport
import secrets
from unittest.mock import AsyncMock, MagicMock, patch
from app.main import app
from app.services.invoice_pdf_service import InvoicePdfService

@pytest.mark.asyncio
async def test_invoice_pdf_service_generation():
    mock_sale = {
        "invoiceNumber": "INV-TEST-0001",
        "date": "2026-11-05",
        "consumerName": "Aarav Sharma",
        "consumerPhone": "+919876543210",
        "items": [
            {
                "nameSnapshot": "Basmati Rice 5kg",
                "quantity": 2,
                "unitPrice": 450.0,
                "discount": 50.0,
                "lineTotal": 850.0
            },
            {
                "nameSnapshot": "Sunflower Oil 1L",
                "quantity": 3,
                "unitPrice": 180.0,
                "discount": 0.0,
                "lineTotal": 540.0
            }
        ],
        "subtotal": 1300.0,
        "taxTotal": 90.0,
        "roundOff": 0.0,
        "grandTotal": 1390.0,
        "paidAmount": 1390.0,
        "balanceDue": 0.0,
        "paymentMode": "CASH"
    }

    mock_tenant = {
        "name": "Lumora Store",
        "tagline": "Quality You Trust",
        "address": "Main Market Road",
        "phone": "+91 7764075041",
        "gstin": "27AABCL1234F1Z5"
    }

    # Test A4 PDF generation
    a4_pdf = InvoicePdfService.generate_pdf(mock_sale, mock_tenant, format_type="A4")
    assert isinstance(a4_pdf, bytes)
    assert len(a4_pdf) > 500
    assert a4_pdf.startswith(b"%PDF-")

    # Test Thermal PDF generation
    thermal_pdf = InvoicePdfService.generate_pdf(mock_sale, mock_tenant, format_type="THERMAL")
    assert isinstance(thermal_pdf, bytes)
    assert len(thermal_pdf) > 500
    assert thermal_pdf.startswith(b"%PDF-")

@pytest.mark.asyncio
async def test_public_sales_invalid_token_protection():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # Test invalid token format (too short) - rejected before touching DB
        res = await ac.get("/api/v1/public/invoices/short/pdf")
        assert res.status_code == 404

@pytest.mark.asyncio
async def test_public_sales_mocked_db_lookup():
    mock_doc = {
        "_id": "507f1f77bcf86cd799439011",
        "invoiceNumber": "INV-2026-000011",
        "businessId": "507f1f77bcf86cd799439012",
        "shareToken": "test_token_256bit_secure_abcdef12345",
        "items": [],
        "grandTotal": 500.0,
        "subtotal": 480.0,
        "taxTotal": 20.0
    }

    mock_db = MagicMock()
    mock_db.invoices.find_one = AsyncMock(return_value=mock_doc)
    mock_db.tenants.find_one = AsyncMock(return_value={"name": "Lumora Store"})

    with patch("app.api.v1.public_sales.db_manager") as mock_mgr:
        mock_mgr.get_primary_database.return_value = mock_db
        mock_mgr.primary_client = {"quickbill": mock_db}

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            # Valid token returns 200 with sanitized data
            res = await ac.get("/api/v1/public/invoices/test_token_256bit_secure_abcdef12345")
            assert res.status_code == 200
            data = res.json()
            assert data["invoice"]["invoiceNumber"] == "INV-2026-000011"
            assert data["store"]["name"] == "Lumora Store"

            # Valid token PDF download returns 200 with application/pdf
            pdf_res = await ac.get("/api/v1/public/invoices/test_token_256bit_secure_abcdef12345/pdf")
            assert pdf_res.status_code == 200
            assert pdf_res.headers["content-type"] == "application/pdf"
            assert pdf_res.content.startswith(b"%PDF-")

            # Non-existent token returns 404
            mock_db.invoices.find_one = AsyncMock(return_value=None)
            res_404 = await ac.get("/api/v1/public/invoices/non_existent_token_1234567890abcdef")
            assert res_404.status_code == 404
