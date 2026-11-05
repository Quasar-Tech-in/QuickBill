import io
import hashlib
from decimal import Decimal
from datetime import datetime
from typing import Optional, Dict, Any, List

# Compatibility fix for Python OpenSSL md5 on Windows where usedforsecurity is rejected
_orig_md5 = hashlib.md5
def _safe_md5(*args, **kwargs):
    kwargs.pop("usedforsecurity", None)
    return _orig_md5(*args, **kwargs)
hashlib.md5 = _safe_md5

from reportlab.lib.pagesizes import A4, mm
from reportlab.pdfgen import canvas
from reportlab.lib import colors


class InvoicePdfService:
    @staticmethod
    def _prepare_metrics(sale: Dict[str, Any]) -> Dict[str, Any]:
        """
        Extracts and normalizes invoice line items, discounts, returns,
        subtotals, taxes, and settlement amounts with full parity to the POS Billing Engine.
        """
        raw_items = sale.get("items", []) or []
        items: List[Dict[str, Any]] = []
        total_qty = Decimal("0")
        ret_qty_sum = Decimal("0")
        computed_line_discounts = Decimal("0")

        for it in raw_items:
            qty = Decimal(str(it.get("quantity", 1) or 1))
            ret_qty = Decimal(str(it.get("returnedQuantity", 0) or 0))
            active_qty = max(Decimal("0"), qty - ret_qty)
            unit_price = Decimal(str(it.get("unitPrice", 0) or 0))
            
            # Line total & original total
            raw_line_total = it.get("total") if it.get("total") is not None else it.get("lineTotal")
            line_total = Decimal(str(raw_line_total if raw_line_total is not None else (unit_price * qty)))
            orig_total = Decimal(str(it.get("originalTotal") if it.get("originalTotal") is not None else (unit_price * qty)))

            # Discount values
            disc_val = Decimal(str(it.get("discountValue", 0) or 0))
            disc_pct = Decimal(str(it.get("discountPercent", 0) or 0))
            disc_amt = Decimal(str(it.get("discountAmount", it.get("discount", 0)) or 0))
            disc_type = str(it.get("discountType", "FLAT") or "FLAT").upper()

            # Deduce discount if not explicitly provided
            if disc_amt == Decimal("0"):
                if disc_type == "PERCENT" and disc_pct > 0 and orig_total > 0:
                    disc_amt = (orig_total * disc_pct) / Decimal("100")
                elif disc_type == "FLAT" and disc_val > 0:
                    disc_amt = disc_val
                elif orig_total > line_total and (orig_total - line_total) > Decimal("0.01"):
                    disc_amt = orig_total - line_total

            is_100_free = disc_pct >= Decimal("100") or (disc_amt > 0 and orig_total > 0 and disc_amt >= orig_total)
            has_disc = is_100_free or disc_amt > 0 or disc_pct > 0 or (orig_total > line_total and (orig_total - line_total) > Decimal("0.01"))

            if is_100_free:
                disc_label = "Disc: 100% OFF (FREE)"
            elif disc_type == "FLAT" or disc_pct == Decimal("0"):
                disc_label = f"Disc: -Rs.{disc_amt:.2f}"
            else:
                disc_label = f"Disc: {disc_pct:g}% (-Rs.{disc_amt:.2f})"

            computed_line_discounts += disc_amt
            total_qty += qty
            ret_qty_sum += ret_qty

            items.append({
                "name": it.get("nameSnapshot") or it.get("name") or "Item",
                "quantity": qty,
                "returned_quantity": ret_qty,
                "active_quantity": active_qty,
                "unit_price": unit_price,
                "line_total": line_total,
                "orig_total": orig_total,
                "discount_amount": disc_amt,
                "has_discount": has_disc,
                "discount_label": disc_label,
                "return_reason": it.get("returnReason")
            })

        # Summary Totals
        explicit_item_disc = Decimal(str(sale.get("itemDiscountTotal", 0) or 0))
        item_discounts_total = explicit_item_disc if explicit_item_disc > 0 else computed_line_discounts

        explicit_order_disc = Decimal(str(sale.get("orderDiscountAmount", sale.get("orderDiscountTotal", sale.get("invoiceDiscount", 0))) or 0))
        discount_total = Decimal(str(sale.get("discountTotal", 0) or 0))
        if explicit_order_disc > 0:
            order_discount = explicit_order_disc
        elif discount_total > item_discounts_total:
            order_discount = discount_total - item_discounts_total
        else:
            order_discount = Decimal("0")

        return_total = Decimal(str(sale.get("returnTotal", 0) or 0))
        grand_total = Decimal(str(sale.get("grandTotal", sale.get("total", 0)) or 0))

        explicit_orig_grand = Decimal(str(sale.get("originalGrandTotal", 0) or 0))
        if explicit_orig_grand > 0:
            orig_grand_total = explicit_orig_grand
        elif item_discounts_total > 0 or order_discount > 0 or return_total > 0:
            orig_grand_total = grand_total + item_discounts_total + order_discount + return_total
        else:
            orig_grand_total = Decimal("0")

        subtotal = Decimal(str(sale.get("subtotal", sale.get("taxableAmount", sale.get("grossTotal", 0))) or 0))
        tax_total = Decimal(str(sale.get("taxTotal", sale.get("tax_total", sale.get("gst", 0))) or 0))
        round_off = Decimal(str(sale.get("roundOff", 0) or 0))
        paid_amount = Decimal(str(sale.get("paidAmount", grand_total) if sale.get("paidAmount") is not None else grand_total))
        balance_due = Decimal(str(sale.get("balanceDue", sale.get("balanceAmount", 0)) or 0))

        return {
            "items": items,
            "total_qty": total_qty,
            "ret_qty_sum": ret_qty_sum,
            "item_discounts_total": item_discounts_total,
            "order_discount": order_discount,
            "return_total": return_total,
            "orig_grand_total": orig_grand_total,
            "subtotal": subtotal,
            "tax_total": tax_total,
            "round_off": round_off,
            "grand_total": grand_total,
            "paid_amount": paid_amount,
            "balance_due": balance_due,
            "payment_mode": str(sale.get("paymentMode", "CASH"))
        }

    @staticmethod
    def generate_pdf(sale_data: Dict[str, Any], tenant_data: Optional[Dict[str, Any]] = None, format_type: str = "A4") -> bytes:
        """
        Generates a professional tax invoice PDF using ReportLab.
        Supports standard A4 and compact thermal roll format.
        """
        buf = io.BytesIO()
        metrics = InvoicePdfService._prepare_metrics(sale_data)

        if format_type.upper() == "THERMAL":
            # 80mm thermal receipt height dynamically calculated
            items_count = len(metrics["items"])
            # base header/footer + 14mm per item + totals lines
            page_h = max(190, 110 + (items_count * 15) + 90) * mm
            page_w = 80 * mm
            c = canvas.Canvas(buf, pagesize=(page_w, page_h))
            InvoicePdfService._render_thermal(c, sale_data, tenant_data, metrics, page_w, page_h)
        else:
            # Standard A4 Tax Invoice
            c = canvas.Canvas(buf, pagesize=A4)
            InvoicePdfService._render_a4(c, sale_data, tenant_data, metrics)

        c.save()
        buf.seek(0)
        return buf.getvalue()

    @staticmethod
    def _render_a4(c: canvas.Canvas, sale: Dict[str, Any], tenant: Optional[Dict[str, Any]], m_data: Dict[str, Any]):
        w, h = A4
        m = 15 * mm  # Margin

        # Store Info
        store_name = (tenant.get("name") if tenant else None) or sale.get("locationName") or "QUICKBILL STORE"
        store_tagline = (tenant.get("tagline") if tenant else None) or ""
        branch_name = sale.get("locationName") or (tenant.get("name") if tenant else "Main Branch")
        store_address = sale.get("locationAddress") or (tenant.get("address") if tenant else "") or ""
        store_phone = sale.get("locationPhone") or (tenant.get("phone") if tenant else "") or ""
        store_gstin = sale.get("locationGstin") or (tenant.get("gstin") if tenant else "") or ""
        receipt_footer = (tenant.get("receiptFooterNote") if tenant else None) or "Thank you for shopping with us please visit again."

        # Top Header Banner
        c.setFillColor(colors.HexColor("#0f172a"))
        c.rect(m, h - 38 * mm, w - 2 * m, 28 * mm, fill=1, stroke=0)

        c.setFillColor(colors.white)
        c.setFont("Helvetica-Bold", 15)
        c.drawString(m + 5 * mm, h - 18 * mm, store_name.upper())

        c.setFont("Helvetica-Oblique", 8)
        if store_tagline:
            c.drawString(m + 5 * mm, h - 23 * mm, store_tagline)

        c.setFont("Helvetica", 8)
        header_sub = []
        if branch_name:
            header_sub.append(branch_name)
        if store_address:
            header_sub.append(store_address)
        if store_phone:
            header_sub.append(f"Tel: {store_phone}")
        if store_gstin:
            header_sub.append(f"GSTIN: {store_gstin}")
        
        c.drawString(m + 5 * mm, h - 28 * mm, " | ".join(header_sub[:2]))
        if len(header_sub) > 2:
            c.drawString(m + 5 * mm, h - 33 * mm, " | ".join(header_sub[2:]))

        # Title on right
        c.setFont("Helvetica-Bold", 14)
        c.drawRightString(w - m - 5 * mm, h - 20 * mm, "TAX INVOICE")
        c.setFont("Helvetica", 8.5)
        c.drawRightString(w - m - 5 * mm, h - 26 * mm, "ORIGINAL FOR RECIPIENT")

        # Invoice Metadata Box
        box_top = h - 42 * mm
        c.setFillColor(colors.HexColor("#f8fafc"))
        c.setStrokeColor(colors.HexColor("#cbd5e1"))
        c.setLineWidth(0.5)
        c.rect(m, box_top - 24 * mm, w - 2 * m, 24 * mm, fill=1, stroke=1)

        c.setFillColor(colors.HexColor("#0f172a"))
        # Left: Bill To
        c.setFont("Helvetica-Bold", 9)
        c.drawString(m + 4 * mm, box_top - 6 * mm, "BILLED TO (CUSTOMER):")
        
        cust_name = sale.get("consumerName") or sale.get("partyNameSnapshot") or "Walk-in Customer"
        cust_phone = sale.get("consumerPhone") or sale.get("partyPhoneSnapshot") or ""
        
        c.setFont("Helvetica", 9)
        c.drawString(m + 4 * mm, box_top - 12 * mm, f"Name: {cust_name}")
        if cust_phone:
            c.drawString(m + 4 * mm, box_top - 17 * mm, f"Mobile: {cust_phone}")

        # Right: Invoice Details
        inv_no = sale.get("invoiceNumber", "N/A")
        inv_date = sale.get("createdAt") or sale.get("date") or datetime.now()
        if isinstance(inv_date, str):
            try:
                inv_date = datetime.fromisoformat(inv_date.replace("Z", "+00:00"))
            except Exception:
                inv_date = datetime.now()
        date_str = inv_date.strftime("%d-%b-%Y %I:%M %p") if isinstance(inv_date, datetime) else str(inv_date)

        c.setFont("Helvetica-Bold", 9)
        c.drawRightString(w - m - 60 * mm, box_top - 6 * mm, "Invoice No:")
        c.drawRightString(w - m - 60 * mm, box_top - 12 * mm, "Invoice Date:")
        c.drawRightString(w - m - 60 * mm, box_top - 17 * mm, "Payment Mode:")

        c.setFont("Helvetica", 9)
        c.drawString(w - m - 56 * mm, box_top - 6 * mm, inv_no)
        c.drawString(w - m - 56 * mm, box_top - 12 * mm, date_str)
        c.drawString(w - m - 56 * mm, box_top - 17 * mm, m_data["payment_mode"])

        # Items Table
        table_top = box_top - 29 * mm
        c.setFillColor(colors.HexColor("#0f172a"))
        c.rect(m, table_top - 7 * mm, w - 2 * m, 7 * mm, fill=1, stroke=0)

        c.setFillColor(colors.white)
        c.setFont("Helvetica-Bold", 8)
        c.drawString(m + 3 * mm, table_top - 5 * mm, "S.N")
        c.drawString(m + 14 * mm, table_top - 5 * mm, "ITEM DESCRIPTION")
        c.drawRightString(m + 110 * mm, table_top - 5 * mm, "QTY")
        c.drawRightString(m + 135 * mm, table_top - 5 * mm, "PRICE")
        c.drawRightString(m + 158 * mm, table_top - 5 * mm, "DISC")
        c.drawRightString(w - m - 4 * mm, table_top - 5 * mm, "AMOUNT")

        # Item Rows
        y = table_top - 13 * mm
        items = m_data["items"]
        
        for idx, it in enumerate(items, 1):
            if y < 65 * mm:
                break  # Protect from colliding with bottom summary box
            
            # Row height is dynamic: if has discount or returns, give 8.5mm, else 6.5mm
            row_h = 8.5 * mm if (it["has_discount"] or it["returned_quantity"] > 0) else 6.5 * mm

            # Alternating background
            if idx % 2 == 0:
                c.setFillColor(colors.HexColor("#f8fafc"))
                c.rect(m, y - 2 * mm, w - 2 * m, row_h, fill=1, stroke=0)

            c.setFillColor(colors.HexColor("#1e293b"))
            c.setFont("Helvetica", 8)
            c.drawString(m + 3 * mm, y, str(idx))
            
            name = it["name"]
            if len(name) > 42:
                name = name[:39] + "..."
            c.drawString(m + 14 * mm, y, name)

            # Sub-badges for discount and returns
            sub_y = y - 3.5 * mm
            if it["has_discount"]:
                c.setFont("Helvetica-Bold", 6.8)
                c.setFillColor(colors.HexColor("#047857"))
                c.drawString(m + 14 * mm, sub_y, it["discount_label"])
            if it["returned_quantity"] > 0:
                c.setFont("Helvetica-Bold", 6.8)
                c.setFillColor(colors.HexColor("#b91c1c"))
                reason_tag = "DEFECTIVE" if it.get("return_reason") == "DEFECTIVE_DAMAGED" else "RETURN"
                ret_text = f"[RET: {it['returned_quantity']:g} {reason_tag}]"
                c.drawString(m + 55 * mm, sub_y, ret_text)

            c.setFillColor(colors.HexColor("#1e293b"))
            c.setFont("Helvetica", 8)

            qty_str = f"{it['active_quantity']:g}/{it['quantity']:g}" if it["returned_quantity"] > 0 else f"{it['quantity']:g}"
            c.drawRightString(m + 110 * mm, y, qty_str)

            c.drawRightString(m + 135 * mm, y, f"{it['unit_price']:.2f}")

            # Discount column
            if it["has_discount"]:
                c.setFillColor(colors.HexColor("#047857"))
                c.drawRightString(m + 158 * mm, y, f"-{it['discount_amount']:.2f}")
            else:
                c.drawRightString(m + 158 * mm, y, "-")

            c.setFillColor(colors.HexColor("#0f172a"))
            c.setFont("Helvetica-Bold", 8)
            c.drawRightString(w - m - 4 * mm, y, f"{it['line_total']:.2f}")

            # If discounted, show crossed out / original total above or next
            if it["has_discount"] and it["orig_total"] > it["line_total"]:
                c.setFont("Helvetica", 6.5)
                c.setFillColor(colors.HexColor("#64748b"))
                c.drawRightString(w - m - 4 * mm, sub_y, f"({it['orig_total']:.2f})")

            y -= row_h

        # Horizontal Divider
        c.setStrokeColor(colors.HexColor("#cbd5e1"))
        c.setLineWidth(0.5)
        c.line(m, y + 1 * mm, w - m, y + 1 * mm)

        # Summary Breakdown Box (Bottom Right)
        sum_w = 84 * mm
        sum_x = w - m - sum_w
        sum_y = max(y - 4 * mm, 62 * mm)

        c.setFont("Helvetica", 8)
        c.setFillColor(colors.HexColor("#334155"))

        # Total Qty
        tot_qty_label = f"{m_data['total_qty']:g}" + (f" (Ret: {m_data['ret_qty_sum']:g})" if m_data['ret_qty_sum'] > 0 else "")
        c.drawString(sum_x, sum_y, "Total Qty:")
        c.drawRightString(w - m - 4 * mm, sum_y, tot_qty_label)
        sum_y -= 4.5 * mm

        # Original Total
        if m_data["orig_grand_total"] > 0 and m_data["orig_grand_total"] != m_data["grand_total"]:
            c.drawString(sum_x, sum_y, "Original Total:")
            c.drawRightString(w - m - 4 * mm, sum_y, f"Rs. {m_data['orig_grand_total']:.2f}")
            sum_y -= 4.5 * mm

        # Less Returns
        if m_data["return_total"] > 0:
            c.setFont("Helvetica-Bold", 8)
            c.setFillColor(colors.HexColor("#b91c1c"))
            c.drawString(sum_x, sum_y, "Less Returns:")
            c.drawRightString(w - m - 4 * mm, sum_y, f"-Rs. {m_data['return_total']:.2f}")
            c.setFont("Helvetica", 8)
            c.setFillColor(colors.HexColor("#334155"))
            sum_y -= 4.5 * mm

        # Item Discounts
        if m_data["item_discounts_total"] > 0:
            c.setFillColor(colors.HexColor("#047857"))
            c.drawString(sum_x, sum_y, "Item Discounts:")
            c.drawRightString(w - m - 4 * mm, sum_y, f"-Rs. {m_data['item_discounts_total']:.2f}")
            c.setFillColor(colors.HexColor("#334155"))
            sum_y -= 4.5 * mm

        # Order Discount
        if m_data["order_discount"] > 0:
            c.setFont("Helvetica-Bold", 8)
            c.setFillColor(colors.HexColor("#047857"))
            c.drawString(sum_x, sum_y, "Order Discount:")
            c.drawRightString(w - m - 4 * mm, sum_y, f"-Rs. {m_data['order_discount']:.2f}")
            c.setFont("Helvetica", 8)
            c.setFillColor(colors.HexColor("#334155"))
            sum_y -= 4.5 * mm

        # Taxable Value
        c.drawString(sum_x, sum_y, "Taxable Value:")
        c.drawRightString(w - m - 4 * mm, sum_y, f"Rs. {m_data['subtotal']:.2f}")
        sum_y -= 4.5 * mm

        # GST / Tax
        c.drawString(sum_x, sum_y, "GST / Tax:")
        c.drawRightString(w - m - 4 * mm, sum_y, f"Rs. {m_data['tax_total']:.2f}")
        sum_y -= 4.5 * mm

        # Round Off
        if m_data["round_off"] != 0:
            c.drawString(sum_x, sum_y, "Round Off:")
            sign = "+" if m_data["round_off"] > 0 else "-"
            c.drawRightString(w - m - 4 * mm, sum_y, f"{sign}Rs. {abs(m_data['round_off']):.2f}")
            sum_y -= 4.5 * mm

        # Grand Total Bar
        sum_y -= 2 * mm
        c.setFillColor(colors.HexColor("#0f172a"))
        c.rect(sum_x - 2 * mm, sum_y - 2 * mm, sum_w + 2 * mm, 7 * mm, fill=1, stroke=0)
        c.setFillColor(colors.white)
        c.setFont("Helvetica-Bold", 9.5)
        c.drawString(sum_x + 2 * mm, sum_y + 0.5 * mm, "GRAND TOTAL:")
        c.drawRightString(w - m - 4 * mm, sum_y + 0.5 * mm, f"Rs. {m_data['grand_total']:.2f}")

        # Settlement Info
        sum_y -= 6 * mm
        c.setFillColor(colors.HexColor("#334155"))
        c.setFont("Helvetica", 8)
        c.drawString(sum_x, sum_y, "Paid Amount:")
        c.drawRightString(w - m - 4 * mm, sum_y, f"Rs. {m_data['paid_amount']:.2f}")

        if m_data["balance_due"] > 0:
            sum_y -= 4.5 * mm
            c.setFont("Helvetica-Bold", 8)
            c.setFillColor(colors.HexColor("#dc2626"))
            c.drawString(sum_x, sum_y, "Balance Due:")
            c.drawRightString(w - m - 4 * mm, sum_y, f"Rs. {m_data['balance_due']:.2f}")

        # Footer Notice
        c.setFont("Helvetica", 8)
        c.setFillColor(colors.HexColor("#64748b"))
        c.drawString(m, 18 * mm, receipt_footer)
        c.drawString(m, 14 * mm, "*** THANK YOU FOR SHOPPING WITH US! ***")
        c.drawRightString(w - m, 14 * mm, "Authorised Signatory")

    @staticmethod
    def _render_thermal(c: canvas.Canvas, sale: Dict[str, Any], tenant: Optional[Dict[str, Any]], m_data: Dict[str, Any], w: float, h: float):
        m = 3 * mm
        y = h - 7 * mm

        store_name = (tenant.get("name") if tenant else None) or sale.get("locationName") or "QUICKBILL STORE"
        store_tagline = (tenant.get("tagline") if tenant else None) or ""
        branch_name = sale.get("locationName") or (tenant.get("name") if tenant else "")
        store_address = sale.get("locationAddress") or (tenant.get("address") if tenant else "") or ""
        store_phone = sale.get("locationPhone") or (tenant.get("phone") if tenant else "") or ""
        store_gstin = sale.get("locationGstin") or (tenant.get("gstin") if tenant else "") or ""
        receipt_footer = (tenant.get("receiptFooterNote") if tenant else None) or "Thank you for shopping with us please visit again."

        # Header
        c.setFont("Helvetica-Bold", 11)
        c.drawCentredString(w / 2, y, store_name.upper())

        if store_tagline:
            y -= 3.5 * mm
            c.setFont("Helvetica-Oblique", 7)
            c.drawCentredString(w / 2, y, store_tagline)

        if branch_name:
            y -= 3.5 * mm
            c.setFont("Helvetica-Bold", 7.5)
            c.drawCentredString(w / 2, y, branch_name)

        if store_address:
            y -= 3.5 * mm
            c.setFont("Helvetica", 6.5)
            c.drawCentredString(w / 2, y, store_address[:35])

        if store_phone:
            y -= 3.2 * mm
            c.setFont("Helvetica", 6.5)
            c.drawCentredString(w / 2, y, f"Tel: {store_phone}")

        if store_gstin:
            y -= 3.2 * mm
            c.setFont("Helvetica-Bold", 6.5)
            c.drawCentredString(w / 2, y, f"GSTIN: {store_gstin}")

        y -= 3.5 * mm
        c.setLineWidth(0.5)
        c.setDash(2, 2)
        c.line(m, y, w - m, y)
        c.setDash()

        # Receipt Number & Date Strip
        y -= 3.5 * mm
        c.setFont("Helvetica-Bold", 7)
        c.drawString(m, y, f"Receipt: {sale.get('invoiceNumber', 'N/A')}")
        inv_date = sale.get("createdAt") or sale.get("date") or datetime.now()
        if isinstance(inv_date, str):
            try:
                inv_date = datetime.fromisoformat(inv_date.replace("Z", "+00:00"))
            except Exception:
                inv_date = datetime.now()
        date_str = inv_date.strftime("%d/%m/%Y") if isinstance(inv_date, datetime) else str(inv_date)
        c.drawRightString(w - m, y, f"Date: {date_str}")

        # Billed To Customer
        cust_name = sale.get("consumerName") or sale.get("partyNameSnapshot")
        cust_phone = sale.get("consumerPhone") or sale.get("partyPhoneSnapshot")
        if cust_name or cust_phone:
            y -= 3.2 * mm
            c.setFont("Helvetica", 6.5)
            c.drawString(m, y, f"Cust: {cust_name or 'Walk-in'}")
            if cust_phone:
                c.drawRightString(w - m, y, f"Ph: {cust_phone}")

        y -= 3.5 * mm
        c.setDash(2, 2)
        c.line(m, y, w - m, y)
        c.setDash()

        # Items Header Table
        y -= 3.5 * mm
        c.setFont("Helvetica-Bold", 7)
        c.drawString(m, y, "ITEM")
        c.drawRightString(m + 32 * mm, y, "QTY")
        c.drawRightString(m + 48 * mm, y, "PRICE")
        c.drawRightString(w - m, y, "AMT")

        # Items Rows
        c.setFont("Helvetica", 6.5)
        for it in m_data["items"]:
            y -= 3.5 * mm
            name = it["name"]
            if len(name) > 17:
                name = name[:15] + ".."
            c.drawString(m, y, name)

            qty_str = f"{it['active_quantity']:g}/{it['quantity']:g}" if it["returned_quantity"] > 0 else f"{it['quantity']:g}"
            c.drawRightString(m + 32 * mm, y, qty_str)
            c.drawRightString(m + 48 * mm, y, f"{it['unit_price']:.2f}")

            # Original total strike/note if discounted
            if it["has_discount"] and it["orig_total"] > it["line_total"]:
                c.drawRightString(w - m, y, f"{it['line_total']:.2f}")
            else:
                c.drawRightString(w - m, y, f"{it['line_total']:.2f}")

            # Discount / Return sub-line
            if it["has_discount"] or it["returned_quantity"] > 0:
                y -= 2.8 * mm
                c.setFont("Helvetica-Bold", 5.8)
                sub_tags = []
                if it["has_discount"]:
                    sub_tags.append(it["discount_label"])
                if it["returned_quantity"] > 0:
                    sub_tags.append(f"[RET: {it['returned_quantity']:g}]")
                c.drawString(m + 2 * mm, y, " ".join(sub_tags))
                if it["has_discount"] and it["orig_total"] > it["line_total"]:
                    c.setFont("Helvetica", 5.8)
                    c.drawRightString(w - m, y, f"({it['orig_total']:.2f})")
                c.setFont("Helvetica", 6.5)

        # Totals Breakdown
        y -= 3.5 * mm
        c.setDash(2, 2)
        c.line(m, y, w - m, y)
        c.setDash()

        c.setFont("Helvetica", 6.5)
        y -= 3.2 * mm
        tot_qty_label = f"{m_data['total_qty']:g}" + (f" (Ret: {m_data['ret_qty_sum']:g})" if m_data['ret_qty_sum'] > 0 else "")
        c.drawString(m, y, "Total Qty:")
        c.drawRightString(w - m, y, tot_qty_label)

        if m_data["orig_grand_total"] > 0 and m_data["orig_grand_total"] != m_data["grand_total"]:
            y -= 3.2 * mm
            c.drawString(m, y, "Original Total:")
            c.drawRightString(w - m, y, f"Rs. {m_data['orig_grand_total']:.2f}")

        if m_data["return_total"] > 0:
            y -= 3.2 * mm
            c.drawString(m, y, "Less Returns:")
            c.drawRightString(w - m, y, f"-Rs. {m_data['return_total']:.2f}")

        if m_data["item_discounts_total"] > 0:
            y -= 3.2 * mm
            c.drawString(m, y, "Item Discounts:")
            c.drawRightString(w - m, y, f"-Rs. {m_data['item_discounts_total']:.2f}")

        if m_data["order_discount"] > 0:
            y -= 3.2 * mm
            c.drawString(m, y, "Order Discount:")
            c.drawRightString(w - m, y, f"-Rs. {m_data['order_discount']:.2f}")

        y -= 3.2 * mm
        c.drawString(m, y, "Taxable Value:")
        c.drawRightString(w - m, y, f"Rs. {m_data['subtotal']:.2f}")

        y -= 3.2 * mm
        c.drawString(m, y, "GST:")
        c.drawRightString(w - m, y, f"Rs. {m_data['tax_total']:.2f}")

        if m_data["round_off"] != 0:
            y -= 3.2 * mm
            sign = "+" if m_data["round_off"] > 0 else "-"
            c.drawString(m, y, "Round Off:")
            c.drawRightString(w - m, y, f"{sign}Rs. {abs(m_data['round_off']):.2f}")

        # Grand Total Bar
        y -= 4 * mm
        c.setLineWidth(1)
        c.line(m, y, w - m, y)
        y -= 3.5 * mm
        c.setFont("Helvetica-Bold", 8.5)
        c.drawString(m, y, "GRAND TOTAL:")
        c.drawRightString(w - m, y, f"Rs. {m_data['grand_total']:.2f}")
        y -= 1.5 * mm
        c.line(m, y, w - m, y)

        # Payment Mode & Settlement
        y -= 3.5 * mm
        c.setFont("Helvetica", 6.5)
        c.drawString(m, y, f"Payment Mode: {m_data['payment_mode']}")
        c.drawRightString(w - m, y, f"Paid: Rs. {m_data['paid_amount']:.2f}")

        if m_data["balance_due"] > 0:
            y -= 3.2 * mm
            c.setFont("Helvetica-Bold", 6.5)
            c.drawString(m, y, "Balance Due:")
            c.drawRightString(w - m, y, f"Rs. {m_data['balance_due']:.2f}")

        # Footer
        y -= 5 * mm
        c.setDash(2, 2)
        c.line(m, y, w - m, y)
        c.setDash()

        y -= 3.5 * mm
        c.setFont("Helvetica-Bold", 6.5)
        c.drawCentredString(w / 2, y, "*** THANK YOU FOR SHOPPING WITH US! ***")

        y -= 3.2 * mm
        c.setFont("Helvetica", 6)
        c.drawCentredString(w / 2, y, receipt_footer[:40])
