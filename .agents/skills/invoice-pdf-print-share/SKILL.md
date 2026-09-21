---
name: invoice-pdf-print-share
description: >-
  Standards for generating clean, professional invoice PDFs, supporting A4 and thermal
  POS formats, mobile native share sheets (WhatsApp/Email), and snapshotting invoice metadata.
---

# Invoice PDF Generation, Printing & Sharing

## 1. Core Principles

1. **HISTORICAL IMMUTABILITY (SNAPSHOTS)**:
   - When generating an invoice PDF, use **only** the snapshot data stored inside the invoice document (`partyNameSnapshot`, `partyAddressSnapshot`, `items[].nameSnapshot`, etc.).
   - Never re-query the live `items` or `parties` collections during PDF rendering, ensuring historical invoices never change even if a product or customer is subsequently edited or deleted.
2. **MULTI-FORMAT COMPATIBILITY**:
   - **A4 / Letter Format**: Clean standard invoice for full-page printing, GST filing, and PDF downloads.
   - **3-inch (80mm) / 2-inch (58mm) Thermal POS Receipt**: Compact layout for Bluetooth/USB receipt printers at checkout counters.
3. **MOBILE SHARE CAPABILITY**:
   - Direct integration with native device share sheets (`expo-sharing` / `react-native-share`) for instant WhatsApp messaging, email attachments, and AirPrint/Google Cloud Print.

---

## 2. Standard Invoice Layout Specification (A4 Format)

```text
+-------------------------------------------------------------------------------+
| [STORE LOGO]   COSMETIC SOLUTION RETAIL & WHOLESALE                           |
|                123 MG Road, Bengaluru, Karnataka - 560001                    |
|                Phone: +91 98765 43210 | GSTIN: 29AAAAA0000A1Z5                 |
+-------------------------------------------------------------------------------+
| TAX INVOICE                                                                   |
| Invoice No: INV-2026-000142               Date: 20-Sep-2026 10:15 AM          |
| Due Date:   20-Sep-2026                   Payment Status: PARTIAL             |
+-------------------------------------------------------------------------------+
| BILL TO:                                                                      |
| Aarav Sharma (+91 98765 43210)                                                |
| 45 Indiranagar, Bengaluru - 560038                                            |
+-----+-------------------------------+-----+--------+--------+-------+---------+
| S.N | Item Description              | HSN | Qty    | Rate   | GST%  | Amount  |
+-----+-------------------------------+-----+--------+--------+-------+---------+
| 1   | Organic Almond Milk 1L        | 0402| 2 pcs  | 240.00 | 5%    |  504.00 |
| 2   | Lavender Body Wash 250ml      | 3307| 1 pcs  | 350.00 | 18%   |  413.00 |
+-----+-------------------------------+-----+--------+--------+-------+---------+
| Total Items: 2 | Total Qty: 3             | Subtotal:               |  776.27 |
|                                           | CGST (2.5% + 9%):       |   70.36 |
|                                           | SGST (2.5% + 9%):       |   70.37 |
|                                           | Round Off:              |   -0.00 |
|                                           +-------------------------+---------+
|                                           | GRAND TOTAL:            | ₹917.00 |
|                                           | Received Amount:        | ₹500.00 |
|                                           | BALANCE DUE:            | ₹417.00 |
+-------------------------------------------+-------------------------+---------+
| Amount in Words: Nine Hundred Seventeen Rupees Only.                          |
| Terms & Conditions: Goods once sold will not be taken back after 7 days.      |
|                                                    Authorised Signatory       |
+-------------------------------------------------------------------------------+
```

---

## 3. Server-Side PDF Generation (FastAPI / ReportLab or WeasyPrint)

```python
from weasyprint import HTML, CSS
from jinja2 import Environment, FileSystemLoader

jinja_env = Environment(loader=FileSystemLoader("app/templates/invoices"))

def generate_invoice_pdf_bytes(invoice_data: dict, business_data: dict) -> bytes:
    template = jinja_env.get_template("invoice_a4_template.html")
    html_out = template.render(
        invoice=invoice_data,
        business=business_data,
        amount_in_words=convert_number_to_words(invoice_data["grandTotal"])
    )
    pdf_bytes = HTML(string=html_out).write_pdf()
    return pdf_bytes
```

---

## 4. Mobile Native Sharing (React Native / Expo)

```typescript
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

export async function downloadAndShareInvoicePDF(invoiceId: string, invoiceNumber: string, authToken: string) {
  const fileUri = `${FileSystem.documentDirectory}Invoice_${invoiceNumber}.pdf`;
  
  const downloadRes = await FileSystem.downloadAsync(
    `https://api.yourdomain.com/api/v1/sales/${invoiceId}/pdf`,
    fileUri,
    { headers: { Authorization: `Bearer ${authToken}` } }
  );

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(downloadRes.uri, {
      mimeType: 'application/pdf',
      dialogTitle: `Share Invoice ${invoiceNumber}`,
      UTI: 'com.adobe.pdf'
    });
  }
}
```

---

## 5. Verification Checklist
- [ ] Invoice PDF generates in < 1.5 seconds.
- [ ] Tax breakdown (CGST, SGST, IGST) accurately represented.
- [ ] Currency symbols and Amount in Words are properly formatted.
- [ ] Mobile share sheet launches with the correct PDF attachment.
