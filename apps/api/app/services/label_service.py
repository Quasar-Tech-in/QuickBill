from io import BytesIO
from decimal import Decimal
from typing import Optional, List
from reportlab.graphics.barcode import code128, qr
from reportlab.graphics.shapes import Drawing
from reportlab.lib.pagesizes import A4, mm
from reportlab.pdfgen import canvas
from app.schemas.label import LabelPrintConfig, LabelStyle, PaperSize

class LabelService:

    @staticmethod
    def generate_single_thermal_50x30(
        config: LabelPrintConfig, store_name: str
    ) -> bytes:
        """Generates a 50mm x 30mm standard product thermal sticker PDF."""
        buffer = BytesIO()
        width, height = 50 * mm, 30 * mm
        c = canvas.Canvas(buffer, pagesize=(width, height))

        for _ in range(config.quantity):
            # Border / Margins
            display_store = config.store_name or store_name or "QuickBill Store"
            
            # Header - Store Name
            if config.show_store_name:
                c.setFont("Helvetica-Bold", 7)
                c.drawCentredString(25 * mm, 26 * mm, display_store[:30])

            # Item Name
            c.setFont("Helvetica-Bold", 8)
            c.drawCentredString(25 * mm, 22.5 * mm, config.item_name[:26])

            # Barcode or QR Code
            barcode_payload = config.public_item_id or config.barcode or config.sku or "ITEM-1001"
            if not barcode_payload.startswith("ITEM:"):
                barcode_payload = f"ITEM:{barcode_payload}"

            # Render Code128 barcode
            try:
                bc = code128.Code128(barcode_payload.replace("ITEM:", ""), barHeight=9 * mm, barWidth=0.85)
                bc.drawOn(c, 7 * mm, 11 * mm)
            except Exception:
                c.setFont("Helvetica", 6)
                c.drawCentredString(25 * mm, 14 * mm, barcode_payload)

            # Footer: SKU and Prices
            c.setFont("Helvetica", 6.5)
            footer_parts = []
            if config.show_sku and config.sku:
                footer_parts.append(f"SKU: {config.sku[:12]}")
            if config.show_mrp and config.mrp:
                footer_parts.append(f"MRP: ₹{config.mrp:,.2f}")
            
            if footer_parts:
                c.drawString(4 * mm, 5.5 * mm, " | ".join(footer_parts))

            if config.show_price and config.sale_price:
                c.setFont("Helvetica-Bold", 9)
                c.drawRightString(46 * mm, 5 * mm, f"₹{config.sale_price:,.2f}")

            c.showPage()

        c.save()
        buffer.seek(0)
        return buffer.getvalue()

    @staticmethod
    def generate_jewelry_dumbbell_tag(
        config: LabelPrintConfig, store_name: str
    ) -> bytes:
        """
        Generates 70mm x 12mm Dumbbell / Jewelry String Tag PDF.
        Left Wing (0 - 28mm): Store, Product Name, Bold Price.
        Middle Bridge (28 - 42mm): Thin non-adhesive bridge outline.
        Right Wing (42 - 70mm): Barcode + SKU.
        """
        buffer = BytesIO()
        width, height = 70 * mm, 12 * mm
        c = canvas.Canvas(buffer, pagesize=(width, height))

        display_store = config.store_name or store_name or "QuickBill"

        for _ in range(config.quantity):
            # --- LEFT WING (0mm to 28mm) ---
            if config.show_store_name:
                c.setFont("Helvetica-Bold", 5.5)
                c.drawString(2 * mm, 8.5 * mm, display_store[:18])

            c.setFont("Helvetica", 5.5)
            c.drawString(2 * mm, 5.5 * mm, config.item_name[:20])

            if config.show_price and config.sale_price:
                c.setFont("Helvetica-Bold", 7.5)
                c.drawString(2 * mm, 2 * mm, f"₹{config.sale_price:,.2f}")

            # --- MIDDLE BRIDGE MARKER (28mm to 42mm) ---
            c.setLineWidth(0.3)
            c.setStrokeColorRGB(0.7, 0.7, 0.7)
            c.rect(28 * mm, 3.5 * mm, 14 * mm, 5 * mm) # Bridge visual guide

            # --- RIGHT WING (42mm to 70mm) ---
            raw_code = config.barcode or config.sku or "ITM-01"
            try:
                bc = code128.Code128(raw_code, barHeight=6 * mm, barWidth=0.7)
                bc.drawOn(c, 44 * mm, 4.5 * mm)
            except Exception:
                c.setFont("Helvetica", 5)
                c.drawString(44 * mm, 5 * mm, raw_code)

            if config.show_sku and config.sku:
                c.setFont("Helvetica-Bold", 5)
                c.drawString(44 * mm, 1.5 * mm, f"SKU: {config.sku[:14]}")

            c.showPage()

        c.save()
        buffer.seek(0)
        return buffer.getvalue()

    @staticmethod
    def generate_a4_sticker_grid(
        configs: List[LabelPrintConfig], store_name: str, paper_size: PaperSize
    ) -> bytes:
        """Generates multi-page A4 sticker sheet (24-up, 40-up, or 65-up)."""
        buffer = BytesIO()
        c = canvas.Canvas(buffer, pagesize=A4)
        page_w, page_h = A4

        # Configure Grid Layout
        if paper_size == PaperSize.A4_GRID_65:
            cols, rows = 5, 13
        elif paper_size == PaperSize.A4_GRID_40:
            cols, rows = 4, 10
        else: # Default 24-up
            cols, rows = 3, 8

        margin_x, margin_y = 10 * mm, 10 * mm
        usable_w = page_w - (2 * margin_x)
        usable_h = page_h - (2 * margin_y)
        cell_w = usable_w / cols
        cell_h = usable_h / rows

        # Expand configurations by quantity
        all_labels: List[LabelPrintConfig] = []
        for cfg in configs:
            for _ in range(cfg.quantity):
                all_labels.append(cfg)

        if not all_labels:
            all_labels.append(LabelPrintConfig(item_name="Sample Item"))

        index = 0
        for cfg in all_labels:
            if index > 0 and index % (cols * rows) == 0:
                c.showPage()

            slot_on_page = index % (cols * rows)
            col = slot_on_page % cols
            row = slot_on_page // cols

            # Calculate top-left of cell (ReportLab origin is bottom-left)
            cell_x = margin_x + (col * cell_w)
            cell_y = page_h - margin_y - ((row + 1) * cell_h)

            # Draw Cell Border (Dashed Guide)
            c.setLineWidth(0.2)
            c.setStrokeColorRGB(0.85, 0.85, 0.85)
            c.rect(cell_x, cell_y, cell_w, cell_h)

            # Render Label Content Inside Cell
            display_store = cfg.store_name or store_name or "QuickBill"
            cx = cell_x + (cell_w / 2)

            # Title & Price
            c.setFont("Helvetica-Bold", 7 if cols >= 4 else 8)
            c.drawCentredString(cx, cell_y + cell_h - (4 * mm), display_store[:25])
            c.setFont("Helvetica", 7 if cols >= 4 else 8)
            c.drawCentredString(cx, cell_y + cell_h - (7.5 * mm), cfg.item_name[:24])

            # Barcode
            raw_code = cfg.barcode or cfg.public_item_id or cfg.sku or "ITEM-101"
            try:
                bar_h = 7 * mm if cols >= 4 else 9 * mm
                bc = code128.Code128(raw_code, barHeight=bar_h, barWidth=0.6 if cols >= 4 else 0.75)
                bc.drawOn(c, cell_x + (4 * mm), cell_y + (6 * mm))
            except Exception:
                c.setFont("Helvetica", 6)
                c.drawCentredString(cx, cell_y + (8 * mm), raw_code)

            if cfg.show_price and cfg.sale_price:
                c.setFont("Helvetica-Bold", 8)
                c.drawCentredString(cx, cell_y + (2 * mm), f"₹ {cfg.sale_price:,.2f}")

            index += 1

        c.showPage()
        c.save()
        buffer.seek(0)
        return buffer.getvalue()

    @staticmethod
    def generate_shipping_label_4x6(
        order_id: str,
        customer_name: str,
        customer_address: str,
        customer_phone: str,
        items_summary: List[str],
        store_name: str,
        store_address: str,
    ) -> bytes:
        """Generates 4" x 6" (101.6mm x 152.4mm) Thermal Courier Shipping Label."""
        buffer = BytesIO()
        width, height = 101.6 * mm, 152.4 * mm
        c = canvas.Canvas(buffer, pagesize=(width, height))

        # Header Box (Courier & Return Info)
        c.setFont("Helvetica-Bold", 12)
        c.drawString(6 * mm, 144 * mm, f"SHIP TO: {customer_name[:30]}")
        c.setFont("Helvetica", 10)
        c.drawString(6 * mm, 138 * mm, customer_phone[:20])

        # Address Box
        c.setFont("Helvetica", 9)
        c.drawString(6 * mm, 131 * mm, customer_address[:50])

        c.setLineWidth(1)
        c.line(4 * mm, 124 * mm, 97.6 * mm, 124 * mm)

        # Tracking Barcode (SHIP:<order_id>)
        ship_payload = f"SHIP:{order_id}"
        c.setFont("Helvetica-Bold", 10)
        c.drawString(6 * mm, 118 * mm, f"TRACKING / ORDER ID: {order_id}")

        try:
            bc = code128.Code128(ship_payload, barHeight=18 * mm, barWidth=1.1)
            bc.drawOn(c, 10 * mm, 95 * mm)
        except Exception:
            c.setFont("Helvetica", 8)
            c.drawCentredString(50 * mm, 105 * mm, ship_payload)

        c.line(4 * mm, 90 * mm, 97.6 * mm, 90 * mm)

        # Order Items Manifest
        c.setFont("Helvetica-Bold", 10)
        c.drawString(6 * mm, 83 * mm, "PACKAGE CONTENTS:")
        c.setFont("Helvetica", 8.5)
        y_pos = 76 * mm
        for line in items_summary[:6]:
            c.drawString(8 * mm, y_pos, f"- {line[:45]}")
            y_pos -= 5.5 * mm

        c.line(4 * mm, 40 * mm, 97.6 * mm, 40 * mm)

        # Sender Info (From)
        c.setFont("Helvetica-Bold", 9)
        c.drawString(6 * mm, 33 * mm, f"RETURN / SENDER: {store_name[:35]}")
        c.setFont("Helvetica", 8)
        c.drawString(6 * mm, 27 * mm, store_address[:50])

        # Verification QR Code
        qr_obj = qr.QrCodeWidget(ship_payload)
        bounds = qr_obj.getBounds()
        w = bounds[2] - bounds[0]
        h = bounds[3] - bounds[1]
        drawing = Drawing(20 * mm, 20 * mm, transform=[20 * mm / w, 0, 0, 20 * mm / h, 0, 0])
        drawing.add(qr_obj)
        drawing.drawOn(c, 74 * mm, 8 * mm)

        c.showPage()
        c.save()
        buffer.seek(0)
        return buffer.getvalue()
