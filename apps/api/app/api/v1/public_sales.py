from bson import ObjectId
from fastapi import APIRouter, HTTPException, Query, Response, status
from app.core.config import settings
from app.core.database import db_manager
from app.services.invoice_pdf_service import InvoicePdfService

router = APIRouter(prefix="/public/invoices", tags=["Public Invoices"])

async def _resolve_public_sale(share_token: str):
    """
    Looks up a sale by its cryptographic 256-bit unguessable share token,
    or invoiceNumber / _id fallback.
    Safe against brute force and enumeration attacks.
    """
    if not share_token:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invalid share token")

    try:
        primary = db_manager.get_primary_database()
    except Exception:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Database service temporarily unavailable")

    token_filter = {
        "$or": [
            {"shareToken": share_token},
            {"invoiceNumber": share_token}
        ]
    }
    if ObjectId.is_valid(share_token):
        token_filter["$or"].append({"_id": ObjectId(share_token)})

    doc = None
    target_tenant_doc = None

    # 1. Search in primary DB
    try:
        doc = await primary.invoices.find_one(token_filter)
    except Exception:
        pass

    # 2. Search in default tenant operational database
    if not doc and db_manager.primary_client is not None:
        try:
            default_db = db_manager.primary_client[settings.DEFAULT_TENANT_DATABASE_NAME]
            doc = await default_db.invoices.find_one(token_filter)
        except Exception:
            pass

    # 3. Search across all tenant databases defined in tenants collection
    if not doc and db_manager.primary_client is not None:
        try:
            tenants_cursor = primary.tenants.find({})
            async for t_doc in tenants_cursor:
                db_cfg = t_doc.get("databaseConfig", {})
                target_db_name = db_cfg.get("databaseName")
                if target_db_name and target_db_name not in [settings.DATABASE_NAME, settings.DEFAULT_TENANT_DATABASE_NAME]:
                    try:
                        t_db = db_manager.primary_client[target_db_name]
                        doc = await t_db.invoices.find_one(token_filter)
                        if doc:
                            target_tenant_doc = t_doc
                            break
                    except Exception:
                        continue
        except Exception:
            pass

    # 4. Fallback search all quickbill collections on cluster
    if not doc and db_manager.primary_client is not None:
        try:
            db_names = await db_manager.primary_client.list_database_names()
            for d_name in db_names:
                if d_name.startswith("quickbill") and d_name not in [settings.DATABASE_NAME, settings.DEFAULT_TENANT_DATABASE_NAME]:
                    try:
                        c_db = db_manager.primary_client[d_name]
                        doc = await c_db.invoices.find_one(token_filter)
                        if doc:
                            break
                    except Exception:
                        continue
        except Exception:
            pass

    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invoice not found or link has expired")

    # Fetch tenant branding metadata if not already found
    b_id = doc.get("businessId")
    b_oid = ObjectId(b_id) if (b_id and ObjectId.is_valid(str(b_id))) else None
    tenant = target_tenant_doc
    if not tenant and b_id:
        tenant_filter = {"$or": [{"_id": b_oid}, {"slug": str(b_id)}]} if b_oid else {"slug": str(b_id)}
        tenant = await primary.tenants.find_one(tenant_filter)

    return doc, tenant

@router.get("/{share_token}/pdf")
async def get_public_invoice_pdf(
    share_token: str,
    format_type: str = Query("A4", pattern="^(A4|THERMAL)$")
):
    """
    Public unauthenticated endpoint to download an official Tax Invoice PDF.
    Protected by 256-bit cryptographic URL-safe share token (anti-bruteforce).
    """
    doc, tenant = await _resolve_public_sale(share_token)
    pdf_bytes = InvoicePdfService.generate_pdf(doc, tenant, format_type=format_type)
    inv_no = doc.get("invoiceNumber", "Invoice").replace(" ", "_")

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"inline; filename=Invoice_{inv_no}.pdf",
            "Cache-Control": "public, max-age=3600"
        }
    )

@router.get("/{share_token}")
async def get_public_invoice_data(share_token: str):
    """
    Public unauthenticated endpoint returning sanitized invoice data
    for the responsive mobile web bill viewer.
    """
    doc, tenant = await _resolve_public_sale(share_token)

    # Sanitize document for public consumption (remove internal hashes/notes if needed)
    doc["_id"] = str(doc["_id"])
    if doc.get("businessId"):
        doc["businessId"] = str(doc["businessId"])
    if doc.get("partyId"):
        doc["partyId"] = str(doc["partyId"])

    tenant_info = {
        "name": (tenant.get("name") if tenant else None) or doc.get("locationName") or "STORE COUNTER",
        "logoUrl": tenant.get("logoUrl") if tenant else None,
        "tagline": tenant.get("tagline") if tenant else None,
        "branchName": doc.get("locationName") or (tenant.get("name") if tenant else "Main Branch"),
        "address": doc.get("locationAddress") or (tenant.get("address") if tenant else "") or "",
        "phone": doc.get("locationPhone") or (tenant.get("phone") if tenant else "") or "",
        "gstin": doc.get("locationGstin") or (tenant.get("gstin") if tenant else "") or "",
        "receiptFooterNote": (tenant.get("receiptFooterNote") if tenant else None) or "Thank you for shopping with us please visit again."
    }

    return {
        "invoice": doc,
        "store": tenant_info
    }
