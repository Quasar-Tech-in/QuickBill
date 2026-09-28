from typing import Optional, Dict
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from fastapi import HTTPException, status
from app.core.config import settings

class MultiTenantDatabaseManager:
    def __init__(self):
        self.primary_client: Optional[AsyncIOMotorClient] = None
        self.primary_db: Optional[AsyncIOMotorDatabase] = None
        self._custom_clients: Dict[str, AsyncIOMotorClient] = {}

    async def connect(self):
        self.primary_client = AsyncIOMotorClient(
            settings.MONGODB_URI,
            maxPoolSize=50,
            minPoolSize=10
        )
        self.primary_db = self.primary_client[settings.DATABASE_NAME]
        await self.primary_db.command("ping")
        print(f"Connected to Primary Database: {settings.DATABASE_NAME}")

    async def close(self):
        if self.primary_client:
            self.primary_client.close()
        for client in self._custom_clients.values():
            client.close()
        self._custom_clients.clear()
        print("Closed all MongoDB connections.")

    def get_primary_database(self) -> AsyncIOMotorDatabase:
        if self.primary_db is None:
            raise RuntimeError("Primary database is not initialized. Ensure connect_to_mongo was called.")
        return self.primary_db

    async def get_tenant_database(self, business_id: str) -> AsyncIOMotorDatabase:
        primary = self.get_primary_database()
        
        # 1. Query tenant registration in Primary DB
        b_oid = ObjectId(business_id) if ObjectId.is_valid(business_id) else None
        tenant_filter = {"_id": b_oid} if b_oid else {"slug": business_id}
        tenant = await primary.tenants.find_one(tenant_filter)
        
        if not tenant:
            # If tenant not found or default store, return primary DB
            return primary
            
        # 2. Dynamic Database Resolution based on onboarding database_config
        db_config = tenant.get("databaseConfig", {})
        isolation_mode = db_config.get("isolationMode", "SHARED")
        target_db_name = db_config.get("databaseName", settings.DATABASE_NAME)
        custom_uri = db_config.get("mongodbUri")

        if isolation_mode == "CUSTOM_CLUSTER" and custom_uri:
            if custom_uri not in self._custom_clients:
                self._custom_clients[custom_uri] = AsyncIOMotorClient(custom_uri, maxPoolSize=20)
            return self._custom_clients[custom_uri][target_db_name]
        elif isolation_mode == "DEDICATED_DATABASE" and target_db_name:
            return self.primary_client[target_db_name]
        else:
            return self.primary_client[target_db_name or settings.DATABASE_NAME]

db_manager = MultiTenantDatabaseManager()

async def connect_to_mongo():
    await db_manager.connect()

async def close_mongo_connection():
    await db_manager.close()

def get_database() -> AsyncIOMotorDatabase:
    return db_manager.get_primary_database()

async def get_tenant_db(business_id: str) -> AsyncIOMotorDatabase:
    return await db_manager.get_tenant_database(business_id)
