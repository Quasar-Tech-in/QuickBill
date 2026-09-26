from typing import Generic, TypeVar, Optional, List, Any, Dict
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import BaseModel

T = TypeVar("T", bound=BaseModel)

class BaseTenantRepository:
    def __init__(self, db: AsyncIOMotorDatabase, collection_name: str):
        self.db = db
        self.collection = db[collection_name]

    def _to_object_id(self, id_val: str) -> ObjectId:
        return ObjectId(id_val) if ObjectId.is_valid(id_val) else ObjectId()

    def _id_query(self, doc_id: str) -> Dict[str, Any]:
        if ObjectId.is_valid(doc_id):
            return {"$or": [{"_id": ObjectId(doc_id)}, {"_id": doc_id}]}
        return {"_id": doc_id}

    def _biz_query(self, business_id: str) -> Dict[str, Any]:
        if ObjectId.is_valid(business_id):
            return {"$or": [{"businessId": ObjectId(business_id)}, {"businessId": business_id}]}
        return {"businessId": business_id}

    async def get_by_id(self, business_id: str, document_id: str) -> Optional[Dict[str, Any]]:
        return await self.collection.find_one({
            "$and": [self._id_query(document_id), self._biz_query(business_id)]
        })

    async def list_paginated(
        self,
        business_id: str,
        filter_query: Optional[Dict[str, Any]] = None,
        page: int = 1,
        page_size: int = 20,
        sort_by: str = "createdAt",
        sort_dir: int = -1
    ) -> (List[Dict[str, Any]], int):
        query = filter_query or {}
        query["$and"] = [self._biz_query(business_id)]

        skip = (page - 1) * page_size
        total = await self.collection.count_documents(query)
        cursor = self.collection.find(query).sort(sort_by, sort_dir).skip(skip).limit(page_size)
        items = await cursor.to_list(length=page_size)
        return items, total

    async def insert(self, business_id: str, document: Dict[str, Any], session=None) -> str:
        document["businessId"] = ObjectId(business_id) if ObjectId.is_valid(business_id) else business_id
        result = await self.collection.insert_one(document, session=session)
        return str(result.inserted_id)

    async def update_by_id(self, business_id: str, document_id: str, update_fields: Dict[str, Any], session=None) -> bool:
        result = await self.collection.update_one(
            {"$and": [self._id_query(document_id), self._biz_query(business_id)]},
            {"$set": update_fields},
            session=session
        )
        return result.modified_count > 0

    async def delete_by_id(self, business_id: str, document_id: str, session=None) -> bool:
        result = await self.collection.delete_one(
            {"$and": [self._id_query(document_id), self._biz_query(business_id)]},
            session=session
        )
        return result.deleted_count > 0
