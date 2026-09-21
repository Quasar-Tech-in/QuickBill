from datetime import datetime, timezone
from decimal import Decimal
from typing import Dict, Any, List
from bson import ObjectId
from fastapi import HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.schemas.sale import SaleCreateRequest
from app.services.billing_engine import BillingEngine, LineItemCalcInput

class SaleService:
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db

    async def create_sale(self, business_id: str, user_id: str, request: SaleCreateRequest) -> Dict[str, Any]:
        b_oid = ObjectId(business_id) if ObjectId.is_valid(business_id) else ObjectId()
        
        # 1. Fetch live item masters for snapshotting and calculation
        calc_inputs: List[LineItemCalcInput] = []
        item_docs = {}

        for it in request.items:
            it_oid = ObjectId(it.item_id) if ObjectId.is_valid(it.item_id) else ObjectId()
            item_doc = await self.db.items.find_one({"_id": it_oid, "businessId": b_oid})
            if not item_doc:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Item '{it.item_id}' not found in business catalog."
                )
            
            # Enforce non-negative stock if desired
            if item_doc["currentStock"] < int(it.quantity):
                # Warning / error depending on inventory mode
                pass

            item_docs[it.item_id] = item_doc
            calc_inputs.append(LineItemCalcInput(
                item_id=it.item_id,
                name_snapshot=item_doc["name"],
                sku_snapshot=item_doc.get("sku", ""),
                quantity=it.quantity,
                unit_price=it.unit_price,
                discount=it.discount,
                tax_rate=Decimal(str(item_doc.get("taxRate", "0.0")))
            ))

        # 2. Run authoritative calculation engine
        totals = BillingEngine.calculate(
            items=calc_inputs,
            invoice_discount=request.invoice_discount,
            additional_charges=request.additional_charges,
            paid_amount=request.paid_amount,
            enable_round_off=request.enable_round_off
        )

        # 3. Generate sequential invoice number
        count = await self.db.invoices.count_documents({"businessId": b_oid})
        invoice_number = f"INV-{datetime.now().year}-{count + 1:06d}"

        # 4. Resolve party snapshots
        party_name_snapshot = request.party_name_input
        party_phone_snapshot = request.party_phone_input
        party_oid = None

        if request.party_id:
            p_oid = ObjectId(request.party_id) if ObjectId.is_valid(request.party_id) else None
            if p_oid:
                party_doc = await self.db.parties.find_one({"_id": p_oid, "businessId": b_oid})
                if party_doc:
                    party_oid = p_oid
                    party_name_snapshot = party_doc["name"]
                    party_phone_snapshot = party_doc.get("phone")

        payment_status = "PAID" if totals.balance_due == Decimal("0.00") else ("PARTIAL" if totals.paid_amount > 0 else "UNPAID")

        # 5. Construct invoice document
        now = datetime.now(timezone.utc)
        invoice_doc = {
            "businessId": b_oid,
            "invoiceNumber": invoice_number,
            "partyId": party_oid,
            "partyNameSnapshot": party_name_snapshot,
            "partyPhoneSnapshot": party_phone_snapshot,
            "status": "CONFIRMED",
            "paymentStatus": payment_status,
            "items": [
                {
                    "itemId": it.item_id,
                    "nameSnapshot": it.name_snapshot,
                    "skuSnapshot": it.sku_snapshot,
                    "quantity": float(it.quantity),
                    "unitPrice": float(it.unit_price),
                    "discount": float(it.discount),
                    "taxableAmount": float(it.taxable_amount),
                    "taxRate": float(it.tax_rate),
                    "taxAmount": float(it.tax_amount),
                    "lineTotal": float(it.line_total)
                }
                for it in totals.items
            ],
            "subtotal": float(totals.subtotal),
            "taxTotal": float(totals.tax_total),
            "discountTotal": float(totals.item_discount_total + totals.invoice_discount),
            "additionalCharges": float(totals.additional_charges),
            "roundOff": float(totals.round_off),
            "grandTotal": float(totals.grand_total),
            "paidAmount": float(totals.paid_amount),
            "balanceDue": float(totals.balance_due),
            "notes": request.notes,
            "createdByUserId": user_id,
            "createdAt": now
        }

        # 6. Save Invoice & Update Inventory Movements
        res = await self.db.invoices.insert_one(invoice_doc)
        invoice_id = res.inserted_id

        # Record stock decrements
        for it in totals.items:
            qty_sold = int(it.quantity)
            await self.db.items.update_one(
                {"_id": ObjectId(it.item_id), "businessId": b_oid},
                {"$inc": {"currentStock": -qty_sold}}
            )
            movement_doc = {
                "businessId": b_oid,
                "itemId": ObjectId(it.item_id),
                "type": "SALE",
                "referenceType": "INVOICE",
                "referenceId": invoice_id,
                "referenceNumber": invoice_number,
                "quantityChange": -qty_sold,
                "unitCost": float(item_docs[it.item_id].get("purchasePrice", 0)),
                "createdAt": now
            }
            await self.db.inventory_movements.insert_one(movement_doc)

        # Record payment if paid amount > 0
        if totals.paid_amount > Decimal("0.00"):
            p_count = await self.db.payments.count_documents({"businessId": b_oid})
            payment_doc = {
                "businessId": b_oid,
                "paymentNumber": f"PAY-{datetime.now().year}-{p_count + 1:06d}",
                "direction": "IN",
                "partyId": party_oid,
                "partyNameSnapshot": party_name_snapshot,
                "invoiceId": invoice_id,
                "invoiceNumber": invoice_number,
                "amount": float(totals.paid_amount),
                "paymentMode": request.payment_mode,
                "referenceNumber": request.payment_reference,
                "paidAt": now,
                "createdAt": now
            }
            await self.db.payments.insert_one(payment_doc)

        # Update customer receivable balance if credit exists
        if party_oid and totals.balance_due > Decimal("0.00"):
            await self.db.parties.update_one(
                {"_id": party_oid, "businessId": b_oid},
                {"$inc": {"currentReceivable": float(totals.balance_due)}}
            )

        invoice_doc["_id"] = str(invoice_id)
        invoice_doc["businessId"] = str(b_oid)
        if party_oid:
            invoice_doc["partyId"] = str(party_oid)
        return invoice_doc
