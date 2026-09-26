import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from app.core.config import settings

async def inspect():
    client = AsyncIOMotorClient(settings.MONGODB_URI)
    dbs = await client.list_database_names()
    print("Databases:", dbs)
    for db_name in dbs:
        if db_name in ["admin", "config", "local"]:
            continue
        db = client[db_name]
        cols = await db.list_collection_names()
        print(f"\n================ Database: {db_name} ================")
        for c in cols:
            count = await db[c].count_documents({})
            print(f"  • {c}: {count} docs")
            if c == "items":
                docs = await db[c].find({}).to_list(length=100)
                for i, d in enumerate(docs):
                    print(f"    [{i+1}] _id={d.get('_id')} | biz={d.get('businessId')} | name={d.get('name')} | sku={d.get('sku')} | active={d.get('isActive')}")

if __name__ == "__main__":
    asyncio.run(inspect())
