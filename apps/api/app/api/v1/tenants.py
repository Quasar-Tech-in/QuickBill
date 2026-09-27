from typing import List, Optional
from datetime import datetime, timezone
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from motor.motor_asyncio import AsyncIOMotorClient
from app.core.security import TokenPayload, get_current_user
from app.core.config import settings
from app.core.database import get_database

router = APIRouter(prefix="/tenants", tags=["Super Admin Multi-Tenancy"])

class DatabaseConfig(BaseModel):
    isolation_mode: str = Field(default="SHARED", description="SHARED | DEDICATED_DATABASE | CUSTOM_CLUSTER")
    mongodb_uri: Optional[str] = None
    database_name: str = "quickbill_db"

class TenantCreateRequest(BaseModel):
    name: str
    slug: str
    admin_email: str
    admin_password: str
    plan: str = "PROFESSIONAL"  # STARTER, PROFESSIONAL, ENTERPRISE
    gstin: Optional[str] = None
    phone: Optional[str] = None
    database_config: DatabaseConfig

class TenantResponse(BaseModel):
    id: str
    name: str
    slug: str
    plan: str
    status: str
    created_at: str
    database_config: DatabaseConfig
    stats: dict

class TestConnectionRequest(BaseModel):
    mongodb_uri: str
    database_name: Optional[str] = "quickbill_db"

@router.get("", response_model=List[TenantResponse])
async def list_tenants(user: TokenPayload = Depends(get_current_user)):
    # Demonstration seed tenants
    return [
        TenantResponse(
            id="65f2a1b9a000000000000001",
            name="QuickBill Enterprise Main Store",
            slug="main-store-01",
            plan="ENTERPRISE",
            status="ACTIVE",
            created_at="2026-01-15T10:00:00Z",
            database_config=DatabaseConfig(
                isolation_mode="SHARED",
                mongodb_uri=settings.MONGODB_URI,
                database_name="quickbill_db"
            ),
            stats={
                "productsCount": 6,
                "invoicesCount": 2,
                "monthlyGmv": 6149.0,
                "usersCount": 4
            }
        ),
        TenantResponse(
            id="65f2a1b9a000000000000002",
            name="Apex Retail Supermart",
            slug="apex-retail-west",
            plan="PROFESSIONAL",
            status="ACTIVE",
            created_at="2026-02-01T14:30:00Z",
            database_config=DatabaseConfig(
                isolation_mode="DEDICATED_DATABASE",
                mongodb_uri=settings.MONGODB_URI,
                database_name="quickbill_apex_db"
            ),
            stats={
                "productsCount": 142,
                "invoicesCount": 89,
                "monthlyGmv": 128450.0,
                "usersCount": 8
            }
        ),
        TenantResponse(
            id="65f2a1b9a000000000000003",
            name="Metro Tech Hardware & Spares",
            slug="metro-tech-spares",
            plan="ENTERPRISE",
            status="ACTIVE",
            created_at="2026-02-18T09:15:00Z",
            database_config=DatabaseConfig(
                isolation_mode="CUSTOM_CLUSTER",
                mongodb_uri="mongodb://admin:secretpassword@localhost:27017/quickbill_metrotech_db?authSource=admin",
                database_name="quickbill_metrotech_db"
            ),
            stats={
                "productsCount": 320,
                "invoicesCount": 210,
                "monthlyGmv": 349800.0,
                "usersCount": 12
            }
        )
    ]

@router.post("/test-db-connection")
async def test_db_connection(req: TestConnectionRequest):
    try:
        client = AsyncIOMotorClient(req.mongodb_uri, serverSelectionTimeoutMS=2000)
        db = client[req.database_name or "quickbill_db"]
        await db.command("ping")
        client.close()
        return {
            "success": True,
            "message": f"Successfully connected to MongoDB database '{req.database_name}'!",
            "status": "HEALTHY"
        }
    except Exception as e:
        return {
            "success": False,
            "message": f"Connection failed: {str(e)}",
            "status": "UNREACHABLE"
        }

class TenantUpdateRequest(BaseModel):
    name: Optional[str] = None
    gstin: Optional[str] = None
    phone: Optional[str] = None
    admin_email: Optional[str] = None
    address: Optional[str] = None

@router.put("/{tenant_id}")
async def update_tenant_profile(
    tenant_id: str,
    req: TenantUpdateRequest,
    user: TokenPayload = Depends(get_current_user)
):
    if "SUPER_ADMIN" not in user.roles and "TENANT_ADMIN" not in user.roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Store Administrators can update the business profile."
        )

    # If not Super Admin, ensure tenant user can only update their own tenant
    if "SUPER_ADMIN" not in user.roles and user.default_business_id != tenant_id:
        raise HTTPException(status_code=403, detail="Unauthorized access to modify this store profile.")

    primary_db = get_database()
    t_oid = ObjectId(tenant_id) if ObjectId.is_valid(tenant_id) else None
    
    update_data = {}
    if req.name is not None:
        update_data["name"] = req.name.strip()
    if req.gstin is not None:
        update_data["gstin"] = req.gstin.strip()
    if req.phone is not None:
        update_data["phone"] = req.phone.strip()
    if req.admin_email is not None:
        update_data["adminEmail"] = req.admin_email.strip()
    if req.address is not None:
        update_data["address"] = req.address.strip()

    if update_data and t_oid:
        await primary_db.tenants.update_one({"_id": t_oid}, {"$set": update_data})

    return {
        "success": True,
        "message": "Store profile updated successfully",
        "tenantId": tenant_id,
        "profile": update_data
    }

@router.post("", response_model=TenantResponse, status_code=status.HTTP_201_CREATED)
async def create_tenant(req: TenantCreateRequest, user: TokenPayload = Depends(get_current_user)):
    new_tenant_id = f"tenant_{int(datetime.now().timestamp())}"
    return TenantResponse(
        id=new_tenant_id,
        name=req.name,
        slug=req.slug,
        plan=req.plan,
        status="ACTIVE",
        created_at=datetime.utcnow().isoformat() + "Z",
        database_config=req.database_config,
        stats={
            "productsCount": 0,
            "invoicesCount": 0,
            "monthlyGmv": 0.0,
            "usersCount": 1
        }
    )
