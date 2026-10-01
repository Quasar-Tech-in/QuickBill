"""
QuickBill - Primary Super Admin Database Startup Initializer
============================================================
Ensures that the Primary/Root MongoDB database has the required
Super Admin collections (users, tenants, subscriptions), indexes,
and a root SuperAdmin account on startup without any dummy/preseeded data.
"""

import logging
from datetime import datetime, timezone
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.core.config import settings
from app.core.security import get_password_hash

logger = logging.getLogger("quickbill.init_db")

async def init_primary_superadmin_database(db: AsyncIOMotorDatabase) -> None:
    """
    Idempotent initialization for the Primary Super Admin Database.
    Ensures required platform collections, indexes, and root SuperAdmin user.
    """
    logger.info("Verifying Primary Super Admin Database collections & indexes...")

    # 1. Ensure Primary Indexes
    try:
        # users collection indexes
        await db.users.create_index("email", unique=True)
        await db.users.create_index("tenantId")
        await db.users.create_index("roles")
        await db.users.create_index("isSystemRoot")

        # tenants collection indexes
        await db.tenants.create_index("slug", unique=True)
        await db.tenants.create_index("adminEmail")
        await db.tenants.create_index("status")
        await db.tenants.create_index("createdAt")

        # subscriptions collection indexes
        await db.subscriptions.create_index("businessId")
        await db.subscriptions.create_index("status")

        print("[DB Init] Primary DB collections and indexes verified.")
    except Exception as e:
        print(f"[DB Init] Note on creating indexes: {e}")

    # 2. Check and provision default SuperAdmin account if none exists
    try:
        clean_email = settings.SUPERADMIN_EMAIL.strip().lower()
        existing_superadmin = await db.users.find_one({
            "$or": [
                {"roles": {"$in": ["SUPER_ADMIN", "SUPERADMIN"]}},
                {"email": clean_email}
            ]
        })

        if not existing_superadmin:
            now = datetime.now(timezone.utc)
            hashed_pw = get_password_hash(settings.SUPERADMIN_PASSWORD)

            superadmin_doc = {
                "email": clean_email,
                "passwordHash": hashed_pw,
                "hashedPassword": hashed_pw,
                "name": settings.SUPERADMIN_NAME,
                "roles": ["SUPER_ADMIN"],
                "isSystemRoot": True,
                "tenantId": None,
                "isActive": True,
                "isTotpEnabled": False,
                "totpSecret": None,
                "backupCodes": [],
                "createdAt": now,
                "updatedAt": now
            }

            await db.users.insert_one(superadmin_doc)
            print(f"[DB Init] Initial SuperAdmin account created successfully ({clean_email}).")
        else:
            print(f"[DB Init] SuperAdmin account already exists ({existing_superadmin.get('email')}).")
    except Exception as e:
        print(f"[DB Init] Error verifying/creating SuperAdmin account: {e}")
