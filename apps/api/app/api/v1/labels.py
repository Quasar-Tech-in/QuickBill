from fastapi import APIRouter, Depends, HTTPException, status, Response
from app.core.security import get_current_business_id
from app.schemas.label import LabelPrintConfig, BatchLabelPrintRequest, LabelStyle, PaperSize
from app.services.label_service import LabelService

router = APIRouter(prefix="/labels", tags=["Label Printing"])

@router.post("/custom-pdf", summary="Generate single product thermal label PDF")
async def generate_custom_label_pdf(
    config: LabelPrintConfig,
    business_id: str = Depends(get_current_business_id),
):
    """
    Generates customized label PDF for thermal printers or sticker rolls.
    Supports Standard 50x30mm, Jewelry Dumbbell 70x12mm String Tags, and custom sizes.
    """
    store_name = config.store_name or "QuickBill Store"
    
    if config.paper_size == PaperSize.DUMBBELL_70x12 or config.style == LabelStyle.JEWELRY_STRING_TAG:
        pdf_bytes = LabelService.generate_jewelry_dumbbell_tag(config=config, store_name=store_name)
        filename = f"Jewelry_Tag_{config.sku or 'Item'}.pdf"
    elif config.paper_size in (PaperSize.A4_GRID_24, PaperSize.A4_GRID_40, PaperSize.A4_GRID_65):
        pdf_bytes = LabelService.generate_a4_sticker_grid(configs=[config], store_name=store_name, paper_size=config.paper_size)
        filename = f"A4_Sticker_Grid_{config.sku or 'Item'}.pdf"
    else:
        pdf_bytes = LabelService.generate_single_thermal_50x30(config=config, store_name=store_name)
        filename = f"Product_Label_{config.sku or 'Item'}.pdf"

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="{filename}"'}
    )

@router.post("/batch-pdf", summary="Generate A4 batch sticker sheet PDF")
async def generate_batch_label_pdf(
    request: BatchLabelPrintRequest,
    business_id: str = Depends(get_current_business_id),
):
    """Generates multi-page A4 sticker sheet PDF (24-up, 40-up, or 65-up)."""
    pdf_bytes = LabelService.generate_a4_sticker_grid(
        configs=request.items,
        store_name="QuickBill Store",
        paper_size=request.paper_size
    )
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": 'inline; filename="Batch_Sticker_Sheet.pdf"'}
    )

@router.get("/shipping/{order_id}/pdf", summary="Generate 4x6 inch shipping courier label")
async def generate_shipping_label_pdf(
    order_id: str,
    business_id: str = Depends(get_current_business_id),
):
    """Generates 4" x 6" thermal courier shipping label with tracking barcode."""
    pdf_bytes = LabelService.generate_shipping_label_4x6(
        order_id=order_id,
        customer_name="Aarav Sharma",
        customer_address="45 Indiranagar 10th Main, Bengaluru, KA - 560038",
        customer_phone="+91 98765 43210",
        items_summary=["Basmati Rice 5kg (x1)", "Sunflower Oil 1L (x2)"],
        store_name="Retail Store & Supermarket",
        store_address="123 MG Road, Bengaluru, KA - 560001"
    )
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="Shipping_Label_{order_id}.pdf"'}
    )
