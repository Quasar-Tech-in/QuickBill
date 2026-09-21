from typing import Optional, Dict, Any
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.repositories.base_repository import BaseTenantRepository

class ItemRepository(BaseTenantRepository):
    def __init__(self, db: AsyncIOMotorDatabase):
        super().__init__(db, "items")

    async def find_by_public_id(self, business_id: str, public_item_id: str) -> Optional[Dict[str, Any]]:
        return await self.collection.find_one({
            "businessId": self._to_object_id(business_id),
            "publicItemId": public_item_id
        })

    async def find_by_sku(self, business_id: str, sku: str) -> Optional[Dict[str, Any]]:
        return await self.collection.find_one({
            "businessId": self._to_object_id(business_id),
            "sku": sku
        })
