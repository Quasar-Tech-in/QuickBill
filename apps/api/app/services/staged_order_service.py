from datetime import datetime
from typing import List, Optional, Dict, Any
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.schemas.staged_order import StagedOrderCreateRequest, StagedOrderUpdateRequest

class StagedOrderService:
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db

    async def list_staged_orders(
        self,
        business_id: str,
        location_id: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        b_oid = ObjectId(business_id) if ObjectId.is_valid(business_id) else business_id
        conditions: list = [
            {"$or": [{"businessId": b_oid}, {"businessId": business_id}]},
            {"status": {"$ne": "DELETED"}}
        ]

        if location_id and location_id != "ALL":
            conditions.append({"locationId": location_id})

        query = {"$and": conditions}
        cursor = self.db.staged_orders.find(query).sort("updatedAt", -1)
        docs = await cursor.to_list(length=200)

        results = []
        for d in docs:
            d["_id"] = str(d["_id"])
            d["businessId"] = str(d["businessId"])
            if d.get("locationId") and isinstance(d["locationId"], ObjectId):
                d["locationId"] = str(d["locationId"])
            results.append(d)
        return results

    async def create_or_update_staged_order(
        self,
        business_id: str,
        user_id: Optional[str],
        user_name: Optional[str],
        payload: StagedOrderCreateRequest,
        order_id: Optional[str] = None
    ) -> Dict[str, Any]:
        target_id_str = order_id or payload.id
        target_oid = ObjectId(target_id_str) if (target_id_str and ObjectId.is_valid(target_id_str)) else None
        b_oid = ObjectId(business_id) if ObjectId.is_valid(business_id) else business_id
        now = datetime.utcnow()

        existing_doc = None
        if target_oid:
            existing_doc = await self.db.staged_orders.find_one({
                "_id": target_oid,
                "$or": [{"businessId": b_oid}, {"businessId": business_id}]
            })

        order_data = payload.model_dump(by_alias=True, exclude_unset=False, exclude={"id"})

        if existing_doc:
            update_data = {
                **order_data,
                "updatedAt": now,
                "updatedById": user_id,
                "updatedByName": user_name,
            }
            # Preserve original created info
            update_data["createdAt"] = existing_doc.get("createdAt", now)
            update_data["createdById"] = existing_doc.get("createdById", user_id)
            update_data["createdByName"] = existing_doc.get("createdByName", user_name)
            update_data["status"] = "ACTIVE"

            await self.db.staged_orders.update_one(
                {"_id": existing_doc["_id"]},
                {"$set": update_data}
            )
            updated_doc = await self.db.staged_orders.find_one({"_id": existing_doc["_id"]})
            updated_doc["_id"] = str(updated_doc["_id"])
            updated_doc["businessId"] = str(updated_doc["businessId"])
            return updated_doc
        else:
            new_oid = target_oid or ObjectId()
            new_doc = {
                "_id": new_oid,
                "businessId": b_oid,
                **order_data,
                "status": "ACTIVE",
                "createdAt": now,
                "updatedAt": now,
                "createdById": user_id,
                "createdByName": user_name,
            }
            await self.db.staged_orders.insert_one(new_doc)
            new_doc["_id"] = str(new_doc["_id"])
            new_doc["businessId"] = str(new_doc["businessId"])
            return new_doc

    async def delete_staged_order(
        self,
        business_id: str,
        order_id: str
    ) -> bool:
        target_oid = ObjectId(order_id) if ObjectId.is_valid(order_id) else None
        b_oid = ObjectId(business_id) if ObjectId.is_valid(business_id) else business_id

        if not target_oid:
            # Check string match if non-OID
            res = await self.db.staged_orders.delete_one({
                "_id": order_id,
                "$or": [{"businessId": b_oid}, {"businessId": business_id}]
            })
            return res.deleted_count > 0

        res = await self.db.staged_orders.delete_one({
            "_id": target_oid,
            "$or": [{"businessId": b_oid}, {"businessId": business_id}]
        })
        return res.deleted_count > 0
