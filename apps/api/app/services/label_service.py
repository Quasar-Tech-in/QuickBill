import hashlib

# Compatibility shim for ReportLab on Python <= 3.8 where openssl_md5 does not support usedforsecurity
try:
    hashlib.md5(usedforsecurity=False)
except TypeError:
    _orig_md5 = hashlib.md5
    hashlib.md5 = lambda *args, **kwargs: _orig_md5(*args, **{k: v for k, v in kwargs.items() if k != "usedforsecurity"})

from io import BytesIO
from decimal import Decimal
from typing import Optional, List
from reportlab.graphics.barcode import code128, qr
from reportlab.graphics.shapes import Drawing
from reportlab.lib.pagesizes import A4, mm
from reportlab.pdfgen import canvas
from app.schemas.label import LabelPrintConfig, LabelStyle, PaperSize, CodeType

class LabelService:

    @staticmethod
    def _draw_qr(c: canvas.Canvas, payload: str, x: float, y: float, size: float) -> None:
        """Helper to render scalable ReportLab QR Code drawing at given canvas coordinates."""
        qr_obj = qr.QrCodeWidget(payload)
        bounds = qr_obj.getBounds()
        w = max(bounds[2] - bounds[0], 1)
        h = max(bounds[3] - bounds[1], 1)
        drawing = Drawing(size, size, transform=[size / w, 0, 0, size / h, 0, 0])
        drawing.add(qr_obj)
        drawing.drawOn(c, x, y)

    @staticmethod
    def _resolve_font_and_text(
        elem_id: str,
        base_size: float,
        default_bold: bool,
        text: str,
        element_styles: Optional[dict] = None,
        is_monospace: bool = False,
    ):
        styles = element_styles or {}
        elem_style = styles.get(elem_id, {})
        size_multiplier = 1.0
        bold = default_bold
        italic = False
        uppercase = False
        if isinstance(elem_style, dict):
            try:
                size_multiplier = float(elem_style.get("size", 1.0))
            except (ValueError, TypeError):
                size_multiplier = 1.0
            bold = bool(elem_style.get("bold", default_bold))
            italic = bool(elem_style.get("italic", False))
            uppercase = bool(elem_style.get("uppercase", False))

        font_size = max(2.5, min(24.0, base_size * size_multiplier))

        family = "Courier" if is_monospace else "Helvetica"
        if bold and italic:
            font_name = f"{family}-BoldOblique"
        elif bold:
            font_name = f"{family}-Bold"
        elif italic:
            font_name = f"{family}-Oblique"
        else:
            font_name = family

        final_text = text.upper() if uppercase else text
        return font_name, font_size, final_text

    @staticmethod
    def generate_single_thermal_50x30(
        config: LabelPrintConfig, store_name: str
    ) -> bytes:
        """
        Generates standard product thermal sticker PDF (50x30mm, 40x40mm, or 38x25mm).
        Supports both 1D Code128 Barcode and 2D QR Code based on config.code_type.
        """
        buffer = BytesIO()
        if config.paper_size == PaperSize.THERMAL_40x40:
            width, height = 40 * mm, 40 * mm
        elif config.paper_size == PaperSize.THERMAL_38x25:
            width, height = 38 * mm, 25 * mm
        else:
            width, height = 50 * mm, 30 * mm

        c = canvas.Canvas(buffer, pagesize=(width, height))
        cx = width / 2

        display_store = config.store_name or store_name or "QuickBill Store"
        is_qr = config.code_type == CodeType.QR
        
        # QR payload uses official ITEM:<publicItemId> prefix for POS scanning; Barcode uses raw alphanumeric
        if is_qr:
            code_payload = f"ITEM:{config.public_item_id}" if config.public_item_id else (config.barcode or config.sku or "ITM-1001")
            display_code = (config.public_item_id or config.barcode or config.sku or "ITM-1001").replace("ITEM:", "").strip()
        else:
            code_payload = (config.barcode or config.sku or config.public_item_id or "ITM-1001").replace("ITEM:", "").strip()
            display_code = code_payload

        if config.custom_barcode_text and config.custom_barcode_text.strip():
            display_code = config.custom_barcode_text.strip()
            if not is_qr:
                code_payload = display_code

        cp = config.custom_positions or {}
        use_custom = bool(cp)
        scale = getattr(config, 'code_scale', 1.0) or 1.0
        try:
            scale = max(0.3, min(2.5, float(scale)))
        except (ValueError, TypeError):
            scale = 1.0

        for _ in range(config.quantity):
            # Outer boundary line guide
            c.setLineWidth(0.3)
            c.setStrokeColorRGB(0.85, 0.85, 0.85)
            c.rect(1 * mm, 1 * mm, width - (2 * mm), height - (2 * mm))

            if use_custom:
                # 1. Custom Store Name
                if config.show_store_name and "storeName" in cp:
                    fn, fs, txt = LabelService._resolve_font_and_text("storeName", 7 if height >= 30 * mm else 6, True, display_store[:28], config.element_styles)
                    c.setFont(fn, fs)
                    sx = (cp["storeName"]["x"] / 100.0) * width
                    sy = ((100.0 - cp["storeName"]["y"]) / 100.0) * height
                    if abs(cp["storeName"]["x"] - 50) < 15:
                        c.drawCentredString(sx, sy - 1.5 * mm, txt)
                    else:
                        c.drawString(sx, sy - 1.5 * mm, txt)

                # 2. Custom Item Name
                if "productName" in cp:
                    fn, fs, txt = LabelService._resolve_font_and_text("productName", 7.5 if height >= 30 * mm else 6.5, True, config.item_name[:26], config.element_styles)
                    c.setFont(fn, fs)
                    px = (cp["productName"]["x"] / 100.0) * width
                    py = ((100.0 - cp["productName"]["y"]) / 100.0) * height
                    if abs(cp["productName"]["x"] - 50) < 15:
                        c.drawCentredString(px, py - 1.5 * mm, txt)
                    else:
                        c.drawString(px, py - 1.5 * mm, txt)

                # 3. Custom Code Generation
                if is_qr:
                    qr_size = min(16 * mm, max(6 * mm, 14 * mm * scale))
                    if "code" in cp:
                        cx_pos = (cp["code"]["x"] / 100.0) * width - (qr_size / 2)
                        cy_pos = ((100.0 - cp["code"]["y"]) / 100.0) * height - (qr_size / 2)
                        LabelService._draw_qr(c, code_payload, cx_pos, cy_pos, qr_size)
                    else:
                        LabelService._draw_qr(c, code_payload, cx - (qr_size / 2), 7 * mm, qr_size)

                    if "barcodeText" in cp:
                        bx = (cp["barcodeText"]["x"] / 100.0) * width
                        by = ((100.0 - cp["barcodeText"]["y"]) / 100.0) * height
                        fn, fs, txt = LabelService._resolve_font_and_text("barcodeText", 5.5, False, display_code, config.element_styles, is_monospace=True)
                        c.setFont(fn, fs)
                        c.drawCentredString(bx, by - 1.5 * mm, txt)
                else:
                    bc_h = (7 * mm if height >= 30 * mm else 5.5 * mm) * scale
                    bw = max(0.20, 0.42 * scale)
                    if "code" in cp:
                        cx_pos = (cp["code"]["x"] / 100.0) * width - (14 * mm * scale)
                        cy_pos = ((100.0 - cp["code"]["y"]) / 100.0) * height - (bc_h / 2)
                    else:
                        cx_pos, cy_pos = cx - (14 * mm * scale), 9 * mm
                    try:
                        bc = code128.Code128(code_payload, barHeight=bc_h, barWidth=bw)
                        bc.drawOn(c, cx_pos, cy_pos)
                    except Exception:
                        pass
                    if "barcodeText" in cp:
                        bx = (cp["barcodeText"]["x"] / 100.0) * width
                        by = ((100.0 - cp["barcodeText"]["y"]) / 100.0) * height
                        c.setFont("Helvetica", 5.5)
                        c.drawCentredString(bx, by - 1.5 * mm, display_code)

                # 4. Custom SKU & Price
                if config.show_sku and config.sku:
                    c.setFont("Helvetica", 5.5)
                    if "sku" in cp:
                        skx = (cp["sku"]["x"] / 100.0) * width
                        sky = ((100.0 - cp["sku"]["y"]) / 100.0) * height
                        c.drawString(skx, sky - 1.5 * mm, f"SKU: {config.sku[:12]}")
                    else:
                        c.drawString(2.5 * mm, 2.5 * mm, f"SKU: {config.sku[:12]}")

                if config.show_price and config.sale_price:
                    c.setFont("Helvetica-Bold", 8)
                    if "price" in cp:
                        prx = (cp["price"]["x"] / 100.0) * width
                        pry = ((100.0 - cp["price"]["y"]) / 100.0) * height
                        c.drawString(prx, pry - 1.5 * mm, f"Rs. {config.sale_price:,.2f}")
                    else:
                        c.drawRightString(width - (2.5 * mm), 2.5 * mm, f"Rs. {config.sale_price:,.2f}")
            else:
                # Standard Default Layout (with full typography style support)
                if config.show_store_name:
                    fn, fs, txt = LabelService._resolve_font_and_text("storeName", 7 if height >= 30 * mm else 6, True, display_store[:28], config.element_styles)
                    c.setFont(fn, fs)
                    c.drawCentredString(cx, height - (4.5 * mm), txt)

                fn, fs, txt = LabelService._resolve_font_and_text("productName", 7.5 if height >= 30 * mm else 6.5, True, config.item_name[:26], config.element_styles)
                c.setFont(fn, fs)
                c.drawCentredString(cx, height - (8.5 * mm), txt)

                if is_qr:
                    qr_size = min(14 * mm, height - (16 * mm))
                    LabelService._draw_qr(c, code_payload, cx - (qr_size / 2), 7 * mm, qr_size)
                    fn, fs, txt = LabelService._resolve_font_and_text("barcodeText", 5.5, False, display_code, config.element_styles, is_monospace=True)
                    c.setFont(fn, fs)
                    c.drawCentredString(cx, 5.5 * mm, txt)
                else:
                    try:
                        bc_h = 7 * mm if height >= 30 * mm else 5.5 * mm
                        bc = code128.Code128(code_payload, barHeight=bc_h, barWidth=0.42)
                        bc.drawOn(c, cx - (14 * mm), 9 * mm)
                        fn, fs, txt = LabelService._resolve_font_and_text("barcodeText", 5.5, False, display_code, config.element_styles, is_monospace=True)
                        c.setFont(fn, fs)
                        c.drawCentredString(cx, 6.5 * mm, txt)
                    except Exception:
                        fn, fs, txt = LabelService._resolve_font_and_text("barcodeText", 5.5, False, display_code, config.element_styles, is_monospace=True)
                        c.setFont(fn, fs)
                        c.drawCentredString(cx, 9 * mm, txt)

                if config.show_sku and config.sku:
                    fn, fs, txt = LabelService._resolve_font_and_text("sku", 5.5, False, f"SKU: {config.sku[:12]}", config.element_styles)
                    c.setFont(fn, fs)
                    c.drawString(2.5 * mm, 2.5 * mm, txt)

                if config.show_price and config.sale_price:
                    fn, fs, txt = LabelService._resolve_font_and_text("price", 8, True, f"Rs. {config.sale_price:,.2f}", config.element_styles)
                    c.setFont(fn, fs)
                    c.drawRightString(width - (2.5 * mm), 2.5 * mm, txt)

            c.showPage()

        c.save()
        buffer.seek(0)
        return buffer.getvalue()

    @staticmethod
    def generate_jewelry_rattail_tag(
        config: LabelPrintConfig, store_name: str
    ) -> bytes:
        """
        Generates 76mm x 12mm Jewelry Rat-Tail Tag PDF (Dual Foldable Flaps + Right Tail).
        Matches physical jewelry roll stickers:
        - Flap 1 (0mm to 26mm): Store Header, Item Name, Sale Price, MRP
        - Fold Crease (26mm): Dashed fold boundary
        - Flap 2 (26mm to 52mm): 2D QR Code or 1D Barcode, Public Code, SKU
        - Tail (52mm to 76mm): Narrow looping strap
        """
        buffer = BytesIO()
        width, height = 76 * mm, 12 * mm
        c = canvas.Canvas(buffer, pagesize=(width, height))

        display_store = config.store_name or store_name or "QuickBill Jewelers"
        is_qr = config.code_type == CodeType.QR

        if is_qr:
            code_payload = f"ITEM:{config.public_item_id}" if config.public_item_id else (config.barcode or config.sku or "ITM-01")
            raw_code = (config.public_item_id or config.barcode or config.sku or "ITM-01").replace("ITEM:", "").strip()
        else:
            code_payload = (config.barcode or config.sku or "ITM-01").replace("ITEM:", "").strip()
            raw_code = code_payload

        cp = config.custom_positions or {}
        use_custom = bool(cp)
        scale = getattr(config, 'code_scale', 1.0) or 1.0
        try:
            scale = max(0.3, min(2.5, float(scale)))
        except (ValueError, TypeError):
            scale = 1.0

        for _ in range(config.quantity):
            # --- FLAP 1 (Left Wing: 0mm to 26mm) ---
            c.setLineWidth(0.2)
            c.setStrokeColorRGB(0.85, 0.85, 0.85)
            c.rect(0.5 * mm, 0.5 * mm, 25 * mm, 11 * mm)

            if use_custom:
                if config.show_store_name and "storeName" in cp:
                    fn, fs, txt = LabelService._resolve_font_and_text("storeName", 5, True, display_store[:16], config.element_styles)
                    c.setFont(fn, fs)
                    sx = (cp["storeName"]["x"] / 100.0) * width
                    sy = ((100.0 - cp["storeName"]["y"]) / 100.0) * height
                    c.drawString(sx, sy - 1.2 * mm, txt)
                elif config.show_store_name:
                    fn, fs, txt = LabelService._resolve_font_and_text("storeName", 5, True, display_store[:16], config.element_styles)
                    c.setFont(fn, fs)
                    c.drawString(1.5 * mm, 8.8 * mm, txt)

                if "productName" in cp:
                    fn, fs, txt = LabelService._resolve_font_and_text("productName", 5, False, config.item_name[:18], config.element_styles)
                    c.setFont(fn, fs)
                    px = (cp["productName"]["x"] / 100.0) * width
                    py = ((100.0 - cp["productName"]["y"]) / 100.0) * height
                    c.drawString(px, py - 1.2 * mm, txt)
                else:
                    fn, fs, txt = LabelService._resolve_font_and_text("productName", 5, False, config.item_name[:18], config.element_styles)
                    c.setFont(fn, fs)
                    c.drawString(1.5 * mm, 5.8 * mm, txt)

                if config.show_price and config.sale_price:
                    fn, fs, txt = LabelService._resolve_font_and_text("price", 7, True, f"Rs. {config.sale_price:,.2f}", config.element_styles)
                    c.setFont(fn, fs)
                    if "price" in cp:
                        prx = (cp["price"]["x"] / 100.0) * width
                        pry = ((100.0 - cp["price"]["y"]) / 100.0) * height
                        c.drawString(prx, pry - 1.2 * mm, txt)
                    else:
                        c.drawString(1.5 * mm, 2 * mm, txt)
            else:
                if config.show_store_name:
                    c.setFont("Helvetica-Bold", 5)
                    c.drawString(1.5 * mm, 8.8 * mm, display_store[:16])

                c.setFont("Helvetica", 5)
                c.drawString(1.5 * mm, 5.8 * mm, config.item_name[:18])

                if config.show_price and config.sale_price:
                    c.setFont("Helvetica-Bold", 7)
                    c.drawString(1.5 * mm, 2 * mm, f"Rs. {config.sale_price:,.2f}")

            # --- FOLD CREASE / SEAM (26mm) ---
            c.setLineWidth(0.3)
            c.setStrokeColorRGB(0.65, 0.65, 0.65)
            c.setDash(1, 1)
            c.line(26 * mm, 0.5 * mm, 26 * mm, 11.5 * mm)
            c.setDash()

            # --- FLAP 2 (Middle Wing: 26mm to 52mm) ---
            c.setLineWidth(0.2)
            c.setStrokeColorRGB(0.85, 0.85, 0.85)
            c.rect(26.5 * mm, 0.5 * mm, 25 * mm, 11 * mm)

            if use_custom:
                if is_qr:
                    qr_size = min(10 * mm, max(4 * mm, 8.5 * mm * scale))
                    if "code" in cp:
                        cx = (cp["code"]["x"] / 100.0) * width - (qr_size / 2)
                        cy = ((100.0 - cp["code"]["y"]) / 100.0) * height - (qr_size / 2)
                        LabelService._draw_qr(c, code_payload, cx, cy, qr_size)
                    else:
                        LabelService._draw_qr(c, code_payload, 28 * mm, 1.8 * mm, qr_size)

                    if "barcodeText" in cp:
                        bx = (cp["barcodeText"]["x"] / 100.0) * width
                        by = ((100.0 - cp["barcodeText"]["y"]) / 100.0) * height
                        fn, fs, txt = LabelService._resolve_font_and_text("barcodeText", 4.8, True, raw_code[:12], config.element_styles, is_monospace=True)
                        c.setFont(fn, fs)
                        c.drawString(bx, by - 1.2 * mm, txt)
                    else:
                        fn, fs, txt = LabelService._resolve_font_and_text("barcodeText", 4.8, True, raw_code[:12], config.element_styles, is_monospace=True)
                        c.setFont(fn, fs)
                        c.drawString(38 * mm, 7.5 * mm, txt)

                    if config.show_sku and config.sku:
                        fn, fs, txt = LabelService._resolve_font_and_text("sku", 4.2, False, f"SKU:{config.sku[:10]}", config.element_styles)
                        c.setFont(fn, fs)
                        if "sku" in cp:
                            skx = (cp["sku"]["x"] / 100.0) * width
                            sky = ((100.0 - cp["sku"]["y"]) / 100.0) * height
                            c.drawString(skx, sky - 1.2 * mm, txt)
                        else:
                            c.drawString(38 * mm, 3.8 * mm, txt)
                else:
                    bc_h = min(8 * mm, max(3 * mm, 5.5 * mm * scale))
                    bw = max(0.16, 0.22 * scale)
                    if "code" in cp:
                        cx = (cp["code"]["x"] / 100.0) * width - (12 * mm * scale)
                        cy = ((100.0 - cp["code"]["y"]) / 100.0) * height - (bc_h / 2)
                    else:
                        cx, cy = 27.5 * mm, 4.5 * mm
                    try:
                        bc = code128.Code128(raw_code, barHeight=bc_h, barWidth=bw)
                        bc.drawOn(c, cx, cy)
                    except Exception:
                        c.setFont("Helvetica", 5)
                        c.drawString(cx, cy, raw_code)

                    if "barcodeText" in cp:
                        bx = (cp["barcodeText"]["x"] / 100.0) * width
                        by = ((100.0 - cp["barcodeText"]["y"]) / 100.0) * height
                        fn, fs, txt = LabelService._resolve_font_and_text("barcodeText", 4.5, False, raw_code[:14], config.element_styles, is_monospace=True)
                        c.setFont(fn, fs)
                        c.drawString(bx, by - 1.2 * mm, txt)
                    else:
                        fn, fs, txt = LabelService._resolve_font_and_text("barcodeText", 4.5, False, raw_code[:14], config.element_styles, is_monospace=True)
                        c.setFont(fn, fs)
                        c.drawString(27.5 * mm, 1.5 * mm, txt)
            else:
                if is_qr:
                    qr_size = 8.5 * mm
                    LabelService._draw_qr(c, code_payload, 28 * mm, 1.8 * mm, qr_size)
                    c.setFont("Helvetica-Bold", 4.8)
                    c.drawString(38 * mm, 7.5 * mm, raw_code[:12])
                    if config.show_sku and config.sku:
                        c.setFont("Helvetica", 4.2)
                        c.drawString(38 * mm, 3.8 * mm, f"SKU:{config.sku[:10]}")
                else:
                    try:
                        bc = code128.Code128(raw_code, barHeight=5.5 * mm, barWidth=0.22)
                        bc.drawOn(c, 27.5 * mm, 4.5 * mm)
                        c.setFont("Helvetica", 4.5)
                        c.drawString(27.5 * mm, 1.5 * mm, raw_code[:14])
                    except Exception:
                        c.setFont("Helvetica", 5)
                        c.drawString(27.5 * mm, 4.5 * mm, raw_code)

            # --- TAIL (Right Wing: 52mm to 76mm) ---
            tail_y = (12 * mm - 2.5 * mm) / 2
            c.setLineWidth(0.3)
            c.setStrokeColorRGB(0.7, 0.7, 0.7)
            c.rect(52 * mm, tail_y, 23.5 * mm, 2.5 * mm)

            c.showPage()

        c.save()
        buffer.seek(0)
        return buffer.getvalue()

    @staticmethod
    def generate_seznik_jewelry_tag(
        config: LabelPrintConfig, store_name: str
    ) -> bytes:
        """
        Generates 100mm x 15mm Seznik Jewellery Rat-Tail Tag PDF (Dual Foldable Flaps + Right Tail).
        Matches physical Seznik 14.3mm x 100mm jewelry roll labels:
        - Flap 1 (0mm to 32mm): Store Header, Item Name, Sale Price, MRP
        - Fold Crease (32mm): Dashed fold boundary
        - Flap 2 (32mm to 64mm): 2D QR Code or 1D Barcode, Public Code, SKU
        - Tail (64mm to 100mm): 36mm narrow looping strap
        """
        buffer = BytesIO()
        width, height = 100 * mm, 15 * mm
        c = canvas.Canvas(buffer, pagesize=(width, height))

        display_store = config.store_name or store_name or "QuickBill Jewelers"
        is_qr = config.code_type == CodeType.QR

        if is_qr:
            code_payload = f"ITEM:{config.public_item_id}" if config.public_item_id else (config.barcode or config.sku or "ITM-01")
            raw_code = (config.public_item_id or config.barcode or config.sku or "ITM-01").replace("ITEM:", "").strip()
        else:
            code_payload = (config.barcode or config.sku or "ITM-01").replace("ITEM:", "").strip()
            raw_code = code_payload

        cp = config.custom_positions or {}
        use_custom = bool(cp)
        scale = getattr(config, 'code_scale', 1.0) or 1.0
        try:
            scale = max(0.3, min(2.5, float(scale)))
        except (ValueError, TypeError):
            scale = 1.0

        for _ in range(config.quantity):
            # --- FLAP 1 (Left Wing: 0mm to 32mm) ---
            c.setLineWidth(0.2)
            c.setStrokeColorRGB(0.85, 0.85, 0.85)
            c.rect(0.5 * mm, 0.5 * mm, 31 * mm, 14 * mm)

            if use_custom:
                if config.show_store_name and "storeName" in cp:
                    fn, fs, txt = LabelService._resolve_font_and_text("storeName", 6, True, display_store[:20], config.element_styles)
                    c.setFont(fn, fs)
                    sx = (cp["storeName"]["x"] / 100.0) * width
                    sy = ((100.0 - cp["storeName"]["y"]) / 100.0) * height
                    c.drawString(sx, sy - 1.2 * mm, txt)
                elif config.show_store_name:
                    fn, fs, txt = LabelService._resolve_font_and_text("storeName", 6, True, display_store[:20], config.element_styles)
                    c.setFont(fn, fs)
                    c.drawString(2 * mm, 11 * mm, txt)

                if "productName" in cp:
                    fn, fs, txt = LabelService._resolve_font_and_text("productName", 6, False, config.item_name[:22], config.element_styles)
                    c.setFont(fn, fs)
                    px = (cp["productName"]["x"] / 100.0) * width
                    py = ((100.0 - cp["productName"]["y"]) / 100.0) * height
                    c.drawString(px, py - 1.2 * mm, txt)
                else:
                    fn, fs, txt = LabelService._resolve_font_and_text("productName", 6, False, config.item_name[:22], config.element_styles)
                    c.setFont(fn, fs)
                    c.drawString(2 * mm, 7.5 * mm, txt)

                if config.show_price and config.sale_price:
                    fn, fs, txt = LabelService._resolve_font_and_text("price", 8, True, f"Rs. {config.sale_price:,.2f}", config.element_styles)
                    c.setFont(fn, fs)
                    if "price" in cp:
                        prx = (cp["price"]["x"] / 100.0) * width
                        pry = ((100.0 - cp["price"]["y"]) / 100.0) * height
                        c.drawString(prx, pry - 1.2 * mm, txt)
                    else:
                        c.drawString(2 * mm, 2.5 * mm, txt)
            else:
                if config.show_store_name:
                    c.setFont("Helvetica-Bold", 6)
                    c.drawString(2 * mm, 11 * mm, display_store[:20])

                c.setFont("Helvetica", 6)
                c.drawString(2 * mm, 7.5 * mm, config.item_name[:22])

                if config.show_price and config.sale_price:
                    c.setFont("Helvetica-Bold", 8)
                    c.drawString(2 * mm, 2.5 * mm, f"Rs. {config.sale_price:,.2f}")

            # --- FOLD CREASE / SEAM (32mm) ---
            c.setLineWidth(0.3)
            c.setStrokeColorRGB(0.65, 0.65, 0.65)
            c.setDash(1, 1)
            c.line(32 * mm, 0.5 * mm, 32 * mm, 14.5 * mm)
            c.setDash()

            # --- FLAP 2 (Middle Wing: 32mm to 64mm) ---
            c.setLineWidth(0.2)
            c.setStrokeColorRGB(0.85, 0.85, 0.85)
            c.rect(32.5 * mm, 0.5 * mm, 31 * mm, 14 * mm)

            if use_custom:
                if is_qr:
                    qr_size = min(12 * mm, max(5 * mm, 10 * mm * scale))
                    if "code" in cp:
                        cx = (cp["code"]["x"] / 100.0) * width - (qr_size / 2)
                        cy = ((100.0 - cp["code"]["y"]) / 100.0) * height - (qr_size / 2)
                        LabelService._draw_qr(c, code_payload, cx, cy, qr_size)
                    else:
                        LabelService._draw_qr(c, code_payload, 34 * mm, 2.5 * mm, qr_size)

                    if "barcodeText" in cp:
                        bx = (cp["barcodeText"]["x"] / 100.0) * width
                        by = ((100.0 - cp["barcodeText"]["y"]) / 100.0) * height
                        fn, fs, txt = LabelService._resolve_font_and_text("barcodeText", 5.5, True, raw_code[:14], config.element_styles, is_monospace=True)
                        c.setFont(fn, fs)
                        c.drawString(bx, by - 1.2 * mm, txt)
                    else:
                        fn, fs, txt = LabelService._resolve_font_and_text("barcodeText", 5.5, True, raw_code[:14], config.element_styles, is_monospace=True)
                        c.setFont(fn, fs)
                        c.drawString(46 * mm, 9.5 * mm, txt)

                    if config.show_sku and config.sku:
                        fn, fs, txt = LabelService._resolve_font_and_text("sku", 5, False, f"SKU:{config.sku[:12]}", config.element_styles)
                        c.setFont(fn, fs)
                        if "sku" in cp:
                            skx = (cp["sku"]["x"] / 100.0) * width
                            sky = ((100.0 - cp["sku"]["y"]) / 100.0) * height
                            c.drawString(skx, sky - 1.2 * mm, txt)
                        else:
                            c.drawString(46 * mm, 4.5 * mm, txt)
                else:
                    bc_h = min(10 * mm, max(4 * mm, 7 * mm * scale))
                    bw = max(0.18, 0.26 * scale)
                    if "code" in cp:
                        cx = (cp["code"]["x"] / 100.0) * width - (14 * mm * scale)
                        cy = ((100.0 - cp["code"]["y"]) / 100.0) * height - (bc_h / 2)
                    else:
                        cx, cy = 34 * mm, 5.5 * mm
                    try:
                        bc = code128.Code128(raw_code, barHeight=bc_h, barWidth=bw)
                        bc.drawOn(c, cx, cy)
                    except Exception:
                        c.setFont("Helvetica", 5.5)
                        c.drawString(cx, cy, raw_code)

                    if "barcodeText" in cp:
                        bx = (cp["barcodeText"]["x"] / 100.0) * width
                        by = ((100.0 - cp["barcodeText"]["y"]) / 100.0) * height
                        fn, fs, txt = LabelService._resolve_font_and_text("barcodeText", 5.2, False, raw_code[:16], config.element_styles, is_monospace=True)
                        c.setFont(fn, fs)
                        c.drawString(bx, by - 1.2 * mm, txt)
                    else:
                        fn, fs, txt = LabelService._resolve_font_and_text("barcodeText", 5.2, False, raw_code[:16], config.element_styles, is_monospace=True)
                        c.setFont(fn, fs)
                        c.drawString(34 * mm, 1.8 * mm, txt)
            else:
                if is_qr:
                    qr_size = 10 * mm
                    LabelService._draw_qr(c, code_payload, 34 * mm, 2.5 * mm, qr_size)
                    c.setFont("Helvetica-Bold", 5.5)
                    c.drawString(46 * mm, 9.5 * mm, raw_code[:14])
                    if config.show_sku and config.sku:
                        c.setFont("Helvetica", 5)
                        c.drawString(46 * mm, 4.5 * mm, f"SKU:{config.sku[:12]}")
                else:
                    try:
                        bc = code128.Code128(raw_code, barHeight=7 * mm, barWidth=0.26)
                        bc.drawOn(c, 34 * mm, 5.5 * mm)
                        c.setFont("Helvetica", 5.2)
                        c.drawString(34 * mm, 1.8 * mm, raw_code[:16])
                    except Exception:
                        c.setFont("Helvetica", 5.5)
                        c.drawString(34 * mm, 5.5 * mm, raw_code)

            # --- TAIL STRAP (Right Wing: 64mm to 100mm) ---
            tail_y = (15 * mm - 4 * mm) / 2
            c.setLineWidth(0.3)
            c.setStrokeColorRGB(0.7, 0.7, 0.7)
            c.rect(64 * mm, tail_y, 35.5 * mm, 4 * mm)

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
        Supports both Code128 Barcode and compact QR Code on the right wing.
        """
        buffer = BytesIO()
        width, height = 70 * mm, 12 * mm
        c = canvas.Canvas(buffer, pagesize=(width, height))

        display_store = config.store_name or store_name or "QuickBill"
        is_qr = config.code_type == CodeType.QR
        
        if is_qr:
            code_payload = f"ITEM:{config.public_item_id}" if config.public_item_id else (config.barcode or config.sku or "ITM-01")
            raw_code = (config.public_item_id or config.barcode or config.sku or "ITM-01").replace("ITEM:", "").strip()
        else:
            code_payload = (config.barcode or config.sku or "ITM-01").replace("ITEM:", "").strip()
            raw_code = code_payload

        cp = config.custom_positions or {}
        use_custom = bool(cp)
        scale = getattr(config, 'code_scale', 1.0) or 1.0
        try:
            scale = max(0.3, min(2.5, float(scale)))
        except (ValueError, TypeError):
            scale = 1.0

        for _ in range(config.quantity):
            # --- LEFT WING (0mm to 28mm) ---
            if use_custom:
                if config.show_store_name and "storeName" in cp:
                    fn, fs, txt = LabelService._resolve_font_and_text("storeName", 5.5, True, display_store[:18], config.element_styles)
                    c.setFont(fn, fs)
                    sx = (cp["storeName"]["x"] / 100.0) * width
                    sy = ((100.0 - cp["storeName"]["y"]) / 100.0) * height
                    c.drawString(sx, sy - 1.2 * mm, txt)
                elif config.show_store_name:
                    fn, fs, txt = LabelService._resolve_font_and_text("storeName", 5.5, True, display_store[:18], config.element_styles)
                    c.setFont(fn, fs)
                    c.drawString(2 * mm, 8.5 * mm, txt)

                if "productName" in cp:
                    fn, fs, txt = LabelService._resolve_font_and_text("productName", 5.5, False, config.item_name[:20], config.element_styles)
                    c.setFont(fn, fs)
                    px = (cp["productName"]["x"] / 100.0) * width
                    py = ((100.0 - cp["productName"]["y"]) / 100.0) * height
                    c.drawString(px, py - 1.2 * mm, txt)
                else:
                    fn, fs, txt = LabelService._resolve_font_and_text("productName", 5.5, False, config.item_name[:20], config.element_styles)
                    c.setFont(fn, fs)
                    c.drawString(2 * mm, 5.5 * mm, txt)

                if config.show_price and config.sale_price:
                    fn, fs, txt = LabelService._resolve_font_and_text("price", 7, True, f"Rs. {config.sale_price:,.2f}", config.element_styles)
                    c.setFont(fn, fs)
                    if "price" in cp:
                        prx = (cp["price"]["x"] / 100.0) * width
                        pry = ((100.0 - cp["price"]["y"]) / 100.0) * height
                        c.drawString(prx, pry - 1.2 * mm, txt)
                    else:
                        c.drawString(2 * mm, 2 * mm, txt)
            else:
                if config.show_store_name:
                    c.setFont("Helvetica-Bold", 5.5)
                    c.drawString(2 * mm, 8.5 * mm, display_store[:18])

                c.setFont("Helvetica", 5.5)
                c.drawString(2 * mm, 5.5 * mm, config.item_name[:20])

                if config.show_price and config.sale_price:
                    c.setFont("Helvetica-Bold", 7)
                    c.drawString(2 * mm, 2 * mm, f"Rs. {config.sale_price:,.2f}")

            # --- MIDDLE BRIDGE MARKER (28mm to 42mm) ---
            c.setLineWidth(0.3)
            c.setStrokeColorRGB(0.7, 0.7, 0.7)
            c.rect(28 * mm, 3.5 * mm, 14 * mm, 5 * mm) # Bridge cutout guide

            # --- RIGHT WING (42mm to 70mm) ---
            if use_custom:
                if is_qr:
                    qr_size = min(10 * mm, max(4 * mm, 8 * mm * scale))
                    if "code" in cp:
                        cx = (cp["code"]["x"] / 100.0) * width - (qr_size / 2)
                        cy = ((100.0 - cp["code"]["y"]) / 100.0) * height - (qr_size / 2)
                        LabelService._draw_qr(c, code_payload, cx, cy, qr_size)
                    else:
                        LabelService._draw_qr(c, code_payload, 58 * mm, 2 * mm, qr_size)

                    if "barcodeText" in cp:
                        bx = (cp["barcodeText"]["x"] / 100.0) * width
                        by = ((100.0 - cp["barcodeText"]["y"]) / 100.0) * height
                        fn, fs, txt = LabelService._resolve_font_and_text("barcodeText", 5, True, raw_code[:12], config.element_styles, is_monospace=True)
                        c.setFont(fn, fs)
                        c.drawString(bx, by - 1.2 * mm, txt)
                    else:
                        fn, fs, txt = LabelService._resolve_font_and_text("barcodeText", 5, True, raw_code[:12], config.element_styles, is_monospace=True)
                        c.setFont(fn, fs)
                        c.drawString(44 * mm, 6.5 * mm, txt)

                    if config.show_sku and config.sku:
                        fn, fs, txt = LabelService._resolve_font_and_text("sku", 4.5, False, f"SKU:{config.sku[:10]}", config.element_styles)
                        c.setFont(fn, fs)
                        if "sku" in cp:
                            skx = (cp["sku"]["x"] / 100.0) * width
                            sky = ((100.0 - cp["sku"]["y"]) / 100.0) * height
                            c.drawString(skx, sky - 1.2 * mm, txt)
                        else:
                            c.drawString(44 * mm, 2.5 * mm, txt)
                else:
                    bc_h = min(8 * mm, max(3 * mm, 5.5 * mm * scale))
                    bw = max(0.16, 0.23 * scale)
                    if "code" in cp:
                        cx = (cp["code"]["x"] / 100.0) * width - (12 * mm * scale)
                        cy = ((100.0 - cp["code"]["y"]) / 100.0) * height - (bc_h / 2)
                    else:
                        cx, cy = 44 * mm, 4.5 * mm
                    try:
                        bc = code128.Code128(raw_code, barHeight=bc_h, barWidth=bw)
                        bc.drawOn(c, cx, cy)
                    except Exception:
                        c.setFont("Helvetica", 5)
                        c.drawString(cx, cy, raw_code)

                    if "barcodeText" in cp:
                        bx = (cp["barcodeText"]["x"] / 100.0) * width
                        by = ((100.0 - cp["barcodeText"]["y"]) / 100.0) * height
                        fn, fs, txt = LabelService._resolve_font_and_text("barcodeText", 5, True, raw_code[:12], config.element_styles, is_monospace=True)
                        c.setFont(fn, fs)
                        c.drawString(bx, by - 1.2 * mm, txt)

                    if config.show_sku and config.sku:
                        fn, fs, txt = LabelService._resolve_font_and_text("sku", 5, True, f"SKU: {config.sku[:14]}", config.element_styles)
                        c.setFont(fn, fs)
                        if "sku" in cp:
                            skx = (cp["sku"]["x"] / 100.0) * width
                            sky = ((100.0 - cp["sku"]["y"]) / 100.0) * height
                            c.drawString(skx, sky - 1.2 * mm, txt)
                        else:
                            c.drawString(44 * mm, 1.5 * mm, txt)
            else:
                if is_qr:
                    qr_size = 8 * mm
                    LabelService._draw_qr(c, code_payload, 60 * mm, 2 * mm, qr_size)
                    c.setFont("Helvetica-Bold", 5)
                    c.drawString(44 * mm, 6.5 * mm, raw_code[:12])
                    if config.show_sku and config.sku:
                        c.setFont("Helvetica", 4.5)
                        c.drawString(44 * mm, 2.5 * mm, f"SKU:{config.sku[:10]}")
                else:
                    try:
                        bc = code128.Code128(raw_code, barHeight=5.5 * mm, barWidth=0.23)
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
        """Generates multi-page A4 sticker sheet (24-up, 40-up, or 65-up) with dynamic Code128/QR."""
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

            cell_x = margin_x + (col * cell_w)
            cell_y = page_h - margin_y - ((row + 1) * cell_h)

            # Draw Cell Border
            c.setLineWidth(0.2)
            c.setStrokeColorRGB(0.8, 0.8, 0.8)
            c.rect(cell_x, cell_y, cell_w, cell_h)

            display_store = cfg.store_name or store_name or "QuickBill"
            cx = cell_x + (cell_w / 2)
            is_qr = cfg.code_type == CodeType.QR

            # Title & Price
            c.setFont("Helvetica-Bold", 7 if cols >= 4 else 8)
            c.drawCentredString(cx, cell_y + cell_h - (4 * mm), display_store[:25])
            c.setFont("Helvetica", 7 if cols >= 4 else 8)
            c.drawCentredString(cx, cell_y + cell_h - (7.5 * mm), cfg.item_name[:24])

            # Code Generation (QR vs 1D Barcode)
            if is_qr:
                qr_payload = f"ITEM:{cfg.public_item_id}" if cfg.public_item_id else (cfg.barcode or cfg.sku or "ITEM-101")
                qr_s = 8 * mm if cols >= 4 else 10 * mm
                LabelService._draw_qr(c, qr_payload, cx - (qr_s / 2), cell_y + (5 * mm), qr_s)
            else:
                raw_code = (cfg.barcode or cfg.public_item_id or cfg.sku or "ITEM-101").replace("ITEM:", "")
                try:
                    bar_h = 7 * mm if cols >= 4 else 9 * mm
                    bc = code128.Code128(raw_code, barHeight=bar_h, barWidth=0.45 if cols >= 4 else 0.55)
                    bc.drawOn(c, cell_x + (4 * mm), cell_y + (6 * mm))
                except Exception:
                    c.setFont("Helvetica", 6)
                    c.drawCentredString(cx, cell_y + (8 * mm), raw_code)

            if cfg.show_price and cfg.sale_price:
                c.setFont("Helvetica-Bold", 8)
                c.drawCentredString(cx, cell_y + (2 * mm), f"Rs. {cfg.sale_price:,.2f}")

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
            bc = code128.Code128(ship_payload, barHeight=18 * mm, barWidth=0.85)
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
