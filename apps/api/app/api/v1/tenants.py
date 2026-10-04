from typing import List, Optional, Any, Dict
from datetime import datetime, timezone, timedelta
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from motor.motor_asyncio import AsyncIOMotorClient
from app.core.security import TokenPayload, get_current_user, get_password_hash
from app.core.config import settings
from app.core.database import get_database

router = APIRouter(prefix="/tenants", tags=["Super Admin Multi-Tenancy"])

def is_super_admin(user: TokenPayload) -> bool:
    normalized_roles = [r.upper() for r in user.roles]
    return "SUPER_ADMIN" in normalized_roles or "SUPERADMIN" in normalized_roles

def is_tenant_admin(user: TokenPayload) -> bool:
    normalized_roles = [r.upper() for r in user.roles]
    return "TENANT_ADMIN" in normalized_roles or is_super_admin(user)

# Default Plan Quotas
PLAN_DEFAULTS = {
    "STARTER": {"max_users": 2, "max_locations": 1, "features": ["pos", "inventory", "ledger"]},
    "PROFESSIONAL": {"max_users": 5, "max_locations": 3, "features": ["pos", "inventory", "ledger", "purchase_orders", "reports", "multi_location"]},
    "ENTERPRISE": {"max_users": 25, "max_locations": 10, "features": ["pos", "inventory", "ledger", "purchase_orders", "reports", "multi_location", "custom_db", "barcode_labels", "export_data"]},
    "CUSTOM": {"max_users": 50, "max_locations": 20, "features": ["pos", "inventory", "ledger", "purchase_orders", "reports", "multi_location", "custom_db", "barcode_labels", "export_data"]}
}

class DatabaseConfig(BaseModel):
    isolation_mode: str = Field(default="SHARED", description="SHARED | DEDICATED_DATABASE | CUSTOM_CLUSTER")
    mongodb_uri: Optional[str] = None
    database_name: str = "quickbill_db"

class SubscriptionRenewalHistoryItem(BaseModel):
    date: Optional[str] = None
    extended_until: Optional[str] = Field(default=None, alias="extendedUntil")
    renewed_by: Optional[str] = Field(default="Super Administrator", alias="renewedBy")
    amount: Optional[float] = None
    billing_cycle: Optional[str] = Field(default=None, alias="billingCycle")
    notes: Optional[str] = None
    previous_end_date: Optional[str] = Field(default=None, alias="previousEndDate")

    class Config:
        populate_by_name = True

class TenantSubscriptionModel(BaseModel):
    plan_id: str = "PROFESSIONAL"
    plan_name: str = "Professional Tier"
    status: str = "ACTIVE"  # ACTIVE | EXPIRING_SOON | GRACE_PERIOD | EXPIRED | SUSPENDED | TRIAL
    max_users: int = 5
    max_locations: int = 3
    billing_cycle: str = "ANNUAL"  # MONTHLY | QUARTERLY | ANNUAL | LIFETIME | CUSTOM
    start_date: str
    end_date: str
    days_remaining: int = 365
    grace_period_days: int = 7
    price_per_cycle: Optional[float] = None
    currency: str = "₹"
    auto_renew: bool = False
    features: List[str] = []
    renewal_history: Optional[List[SubscriptionRenewalHistoryItem]] = []
    notes: Optional[str] = None

class TenantCreateRequest(BaseModel):
    name: str
    slug: str
    admin_email: str
    admin_password: str
    plan: str = "PROFESSIONAL"  # STARTER, PROFESSIONAL, ENTERPRISE, CUSTOM
    gstin: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    max_users: Optional[int] = None
    max_locations: Optional[int] = None
    billing_cycle: Optional[str] = "ANNUAL"
    duration_days: Optional[int] = 365
    database_config: DatabaseConfig

class TenantResponse(BaseModel):
    id: str
    name: str
    slug: str
    plan: str
    status: str
    admin_email: str
    phone: Optional[str] = None
    gstin: Optional[str] = None
    address: Optional[str] = None
    logo_url: Optional[str] = None
    tagline: Optional[str] = None
    receipt_footer: Optional[str] = None
    created_at: str
    database_config: DatabaseConfig
    subscription: TenantSubscriptionModel
    stats: Dict[str, Any]

class TestConnectionRequest(BaseModel):
    mongodb_uri: str
    database_name: Optional[str] = "quickbill_db"

class SubscriptionRenewRequest(BaseModel):
    extend_days: Optional[int] = None
    new_end_date: Optional[str] = None
    plan: Optional[str] = None
    max_users: Optional[int] = None
    max_locations: Optional[int] = None
    amount: Optional[float] = None
    billing_cycle: Optional[str] = None
    notes: Optional[str] = None

class TenantStatusUpdateRequest(BaseModel):
    status: str  # ACTIVE | SUSPENDED

class ResetPasswordRequest(BaseModel):
    new_password: str

def calculate_subscription_status(end_date_str: str, base_status: str = "ACTIVE", grace_days: int = 7) -> (str, int):
    try:
        # Normalize ISO string
        clean_str = end_date_str.replace("Z", "+00:00")
        end_dt = datetime.fromisoformat(clean_str)
        if end_dt.tzinfo is None:
            end_dt = end_dt.replace(tzinfo=timezone.utc)
    except Exception:
        return base_status, 365

    now = datetime.now(timezone.utc)
    delta_days = (end_dt.date() - now.date()).days

    if base_status == "SUSPENDED":
        return "SUSPENDED", delta_days
    if delta_days < -grace_days:
        return "EXPIRED", delta_days
    elif delta_days < 0:
        return "GRACE_PERIOD", delta_days
    elif delta_days <= 14:
        return "EXPIRING_SOON", delta_days
    else:
        return "ACTIVE", delta_days

def build_tenant_response(t: dict) -> TenantResponse:
    now = datetime.now(timezone.utc)
    tid_str = str(t.get("_id", t.get("id", "")))
    plan_str = t.get("plan", "PROFESSIONAL").upper()
    
    # Pull or build subscription
    sub_doc = t.get("subscription", {})
    sub_plan = sub_doc.get("planId") or sub_doc.get("plan") or plan_str
    default_limits = PLAN_DEFAULTS.get(sub_plan, PLAN_DEFAULTS["PROFESSIONAL"])
    
    sub_end_date = sub_doc.get("endDate") or (now + timedelta(days=365)).isoformat()
    sub_start_date = sub_doc.get("startDate") or t.get("createdAt", now.isoformat())
    if isinstance(sub_start_date, datetime):
        sub_start_date = sub_start_date.isoformat()
    if isinstance(sub_end_date, datetime):
        sub_end_date = sub_end_date.isoformat()

    calculated_status, days_left = calculate_subscription_status(
        sub_end_date,
        base_status=t.get("status", "ACTIVE")
    )

    # Determine max_users and max_locations directly from DB sub_doc, only falling back if absent
    max_u = sub_doc.get("maxUsers") if sub_doc.get("maxUsers") is not None else (
        sub_doc.get("max_users") if sub_doc.get("max_users") is not None else default_limits["max_users"]
    )
    max_l = sub_doc.get("maxLocations") if sub_doc.get("maxLocations") is not None else (
        sub_doc.get("max_locations") if sub_doc.get("max_locations") is not None else default_limits["max_locations"]
    )

    subscription_model = TenantSubscriptionModel(
        plan_id=sub_plan,
        plan_name=sub_doc.get("planName", f"{sub_plan.title()} Tier"),
        status=calculated_status,
        max_users=max_u,
        max_locations=max_l,
        billing_cycle=sub_doc.get("billingCycle", "ANNUAL"),
        start_date=sub_start_date,
        end_date=sub_end_date,
        days_remaining=days_left,
        grace_period_days=sub_doc.get("gracePeriodDays", 7),
        price_per_cycle=sub_doc.get("pricePerCycle", 999.0),
        currency="₹",
        auto_renew=sub_doc.get("autoRenew", False),
        features=sub_doc.get("features", default_limits["features"]),
        renewal_history=sub_doc.get("renewalHistory", []),
        notes=sub_doc.get("notes")
    )

from app.core.database import get_database, db_manager

async def get_live_tenant_stats(primary_db, tid_str: str, db_config: Optional[dict] = None) -> dict:
    t_oid = ObjectId(tid_str) if ObjectId.is_valid(tid_str) else None
    
    # 1. Staff users from primary_db.users
    u_queries = [{"tenantId": tid_str}, {"authorizedTenantIds": tid_str}]
    if t_oid:
        u_queries.append({"tenantId": t_oid})
    users_count = await primary_db.users.count_documents({"$or": u_queries})
    
    # Get tenant DB
    try:
        tdb = await db_manager.get_tenant_database(tid_str)
    except Exception:
        tdb = primary_db

    # 2. Store Locations
    loc_queries = [{"businessId": tid_str}]
    if t_oid:
        loc_queries.append({"businessId": t_oid})
    locations_count = await tdb.locations.count_documents({"$or": loc_queries})
    
    # 3. Items/Products
    items_count = await tdb.items.count_documents({"$or": loc_queries})
    
    # 4. Invoices
    invoices_count = await tdb.invoices.count_documents({"$or": loc_queries})
    
    # 5. Monthly GMV
    gmv_pipeline = [
        {"$match": {"$or": loc_queries}},
        {"$group": {"_id": None, "totalGmv": {"$sum": "$grandTotal"}}}
    ]
    try:
        gmv_res = await tdb.invoices.aggregate(gmv_pipeline).to_list(1)
        monthly_gmv = float(gmv_res[0]["totalGmv"]) if gmv_res and gmv_res[0].get("totalGmv") else 0.0
    except Exception:
        monthly_gmv = 0.0

    return {
        "productsCount": items_count,
        "invoicesCount": invoices_count,
        "monthlyGmv": monthly_gmv,
        "usersCount": users_count,
        "locationsCount": locations_count
    }

def build_tenant_response(t: dict, stats_override: Optional[dict] = None) -> TenantResponse:
    now = datetime.now(timezone.utc)
    tid_str = str(t.get("_id", t.get("id", "")))
    plan_str = t.get("plan", "PROFESSIONAL").upper()
    
    # Pull or build subscription
    sub_doc = t.get("subscription", {})
    sub_plan = sub_doc.get("planId") or sub_doc.get("plan") or plan_str
    default_limits = PLAN_DEFAULTS.get(sub_plan, PLAN_DEFAULTS["PROFESSIONAL"])
    
    sub_end_date = sub_doc.get("endDate") or (now + timedelta(days=365)).isoformat()
    sub_start_date = sub_doc.get("startDate") or t.get("createdAt", now.isoformat())
    if isinstance(sub_start_date, datetime):
        sub_start_date = sub_start_date.isoformat()
    if isinstance(sub_end_date, datetime):
        sub_end_date = sub_end_date.isoformat()

    calculated_status, days_left = calculate_subscription_status(
        sub_end_date,
        base_status=t.get("status", "ACTIVE")
    )

    # Determine max_users and max_locations directly from DB sub_doc, only falling back if absent
    max_u = sub_doc.get("maxUsers") if sub_doc.get("maxUsers") is not None else (
        sub_doc.get("max_users") if sub_doc.get("max_users") is not None else default_limits["max_users"]
    )
    max_l = sub_doc.get("maxLocations") if sub_doc.get("maxLocations") is not None else (
        sub_doc.get("max_locations") if sub_doc.get("max_locations") is not None else default_limits["max_locations"]
    )

    subscription_model = TenantSubscriptionModel(
        plan_id=sub_plan,
        plan_name=sub_doc.get("planName", f"{sub_plan.title()} Tier"),
        status=calculated_status,
        max_users=max_u,
        max_locations=max_l,
        billing_cycle=sub_doc.get("billingCycle", "ANNUAL"),
        start_date=sub_start_date,
        end_date=sub_end_date,
        days_remaining=days_left,
        grace_period_days=sub_doc.get("gracePeriodDays", 7),
        price_per_cycle=sub_doc.get("pricePerCycle", 999.0),
        currency="₹",
        auto_renew=sub_doc.get("autoRenew", False),
        features=sub_doc.get("features", default_limits["features"]),
        renewal_history=sub_doc.get("renewalHistory", []),
        notes=sub_doc.get("notes")
    )

    db_cfg = t.get("databaseConfig", {})
    db_config_model = DatabaseConfig(
        isolation_mode=db_cfg.get("isolationMode", db_cfg.get("isolation_mode", "SHARED")),
        mongodb_uri=db_cfg.get("mongodbUri", db_cfg.get("mongodb_uri", settings.MONGODB_URI)),
        database_name=db_cfg.get("databaseName", db_cfg.get("database_name", "quickbill_db"))
    )

    stats_doc = stats_override or t.get("stats") or {
        "productsCount": 0,
        "invoicesCount": 0,
        "monthlyGmv": 0.0,
        "usersCount": 0,
        "locationsCount": 0
    }

    return TenantResponse(
        id=tid_str,
        name=t.get("name", "Untitled Store"),
        slug=t.get("slug", "store"),
        plan=sub_plan,
        status=t.get("status", "ACTIVE"),
        admin_email=t.get("adminEmail", t.get("admin_email", "")),
        phone=t.get("phone"),
        gstin=t.get("gstin"),
        address=t.get("address"),
        logo_url=t.get("logoUrl") or t.get("logo_url"),
        tagline=t.get("tagline"),
        receipt_footer=t.get("receiptFooter") or t.get("receipt_footer"),
        created_at=str(t.get("createdAt", now.isoformat())),
        database_config=db_config_model,
        subscription=subscription_model,
        stats=stats_doc
    )

@router.get("", response_model=List[TenantResponse])
async def list_tenants(user: TokenPayload = Depends(get_current_user)):
    primary_db = get_database()
    
    # Query all tenants strictly from DB
    cursor = primary_db.tenants.find({})
    db_tenants = await cursor.to_list(length=100)
    
    results = []
    for t in db_tenants:
        tid_str = str(t.get("_id", t.get("id", "")))
        try:
            stats = await get_live_tenant_stats(primary_db, tid_str, t.get("databaseConfig"))
        except Exception:
            stats = {
                "productsCount": 0,
                "invoicesCount": 0,
                "monthlyGmv": 0.0,
                "usersCount": 0,
                "locationsCount": 0
            }
        results.append(build_tenant_response(t, stats_override=stats))
    return results

@router.get("/current", response_model=TenantResponse)
async def get_current_tenant(user: TokenPayload = Depends(get_current_user)):
    primary_db = get_database()
    
    tenant_id = user.default_business_id
    if not tenant_id or tenant_id == "system_platform":
        first_t = await primary_db.tenants.find_one({})
        if not first_t:
            raise HTTPException(status_code=404, detail="No tenants configured.")
        tid_str = str(first_t.get("_id", first_t.get("id", "")))
        stats = await get_live_tenant_stats(primary_db, tid_str, first_t.get("databaseConfig"))
        return build_tenant_response(first_t, stats_override=stats)

    t_oid = ObjectId(tenant_id) if ObjectId.is_valid(tenant_id) else None
    q = {"_id": t_oid} if t_oid else {"slug": tenant_id}
    tenant = await primary_db.tenants.find_one(q)
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant store profile not found.")

    tid_str = str(tenant.get("_id", tenant.get("id", "")))
    stats = await get_live_tenant_stats(primary_db, tid_str, tenant.get("databaseConfig"))
    return build_tenant_response(tenant, stats_override=stats)

@router.get("/{tenant_id}", response_model=TenantResponse)
async def get_tenant_by_id(tenant_id: str, user: TokenPayload = Depends(get_current_user)):
    if not is_super_admin(user) and user.default_business_id != tenant_id:
        raise HTTPException(status_code=403, detail="Unauthorized access to this store.")

    primary_db = get_database()
    t_oid = ObjectId(tenant_id) if ObjectId.is_valid(tenant_id) else None
    q = {"_id": t_oid} if t_oid else {"slug": tenant_id}
    tenant = await primary_db.tenants.find_one(q)
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found.")

    tid_str = str(tenant.get("_id", tenant.get("id", "")))
    stats = await get_live_tenant_stats(primary_db, tid_str, tenant.get("databaseConfig"))
    return build_tenant_response(tenant, stats_override=stats)


@router.post("/test-db-connection")
async def test_db_connection(req: TestConnectionRequest, user: TokenPayload = Depends(get_current_user)):
    if not is_super_admin(user):
        raise HTTPException(status_code=403, detail="Super Admin authorization required to test database connections.")

    clean_uri = req.mongodb_uri.strip() if req.mongodb_uri else ""
    if not clean_uri or not (clean_uri.startswith("mongodb://") or clean_uri.startswith("mongodb+srv://")):
        return {
            "success": False,
            "message": "Invalid connection URI. URI must start with mongodb:// or mongodb+srv://",
            "status": "INVALID_URI"
        }

    client = None
    try:
        client = AsyncIOMotorClient(clean_uri, serverSelectionTimeoutMS=4000)
        target_db = req.database_name.strip() if req.database_name and req.database_name.strip() else "quickbill_db"
        db = client[target_db]
        start_time = datetime.now()
        await db.command("ping")
        latency_ms = round((datetime.now() - start_time).total_seconds() * 1000, 1)
        return {
            "success": True,
            "message": f"Successfully connected to MongoDB cluster and verified database '{target_db}' (Latency: {latency_ms}ms)!",
            "status": "HEALTHY",
            "latencyMs": latency_ms
        }
    except Exception as e:
        err_msg = str(e)
        if "Authentication failed" in err_msg or "auth" in err_msg.lower():
            hint = "Authentication failed. Please verify the username, password, and authSource in your connection string."
        elif "ServerSelectionTimeoutError" in err_msg or "timed out" in err_msg.lower():
            hint = "Connection timed out. Please check your network connection, cluster hostname, and ensure IP Access List (e.g. 0.0.0.0/0) is enabled in MongoDB Atlas."
        elif "ConfigurationError" in err_msg:
            hint = "Configuration error in URI parameters. Please ensure special characters in passwords are URL-encoded."
        else:
            hint = f"Database unreachable: {err_msg}"
        return {
            "success": False,
            "message": hint,
            "status": "UNREACHABLE",
            "rawError": err_msg
        }
    finally:
        if client:
            client.close()

class TenantUpdateRequest(BaseModel):
    name: Optional[str] = None
    gstin: Optional[str] = None
    phone: Optional[str] = None
    admin_email: Optional[str] = None
    address: Optional[str] = None
    logo_url: Optional[str] = None
    tagline: Optional[str] = None
    receipt_footer: Optional[str] = None
    status: Optional[str] = None
    plan: Optional[str] = None
    database_config: Optional[DatabaseConfig] = None

@router.put("/{tenant_id}")
async def update_tenant_profile(
    tenant_id: str,
    req: TenantUpdateRequest,
    user: TokenPayload = Depends(get_current_user)
):
    if not is_tenant_admin(user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Store Administrators or Super Admins can update the business profile."
        )

    if not is_super_admin(user) and user.default_business_id != tenant_id:
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
        update_data["adminEmail"] = req.admin_email.strip().lower()
    if req.address is not None:
        update_data["address"] = req.address.strip()
    if req.logo_url is not None:
        update_data["logoUrl"] = req.logo_url.strip()
    if req.tagline is not None:
        update_data["tagline"] = req.tagline.strip()
    if req.receipt_footer is not None:
        update_data["receiptFooter"] = req.receipt_footer.strip()
    if req.status is not None and is_super_admin(user):
        clean_status = req.status.strip().upper()
        update_data["status"] = clean_status
        update_data["subscription.status"] = clean_status
    if req.plan is not None and is_super_admin(user):
        update_data["plan"] = req.plan.upper()
        update_data["subscription.planId"] = req.plan.upper()
        update_data["subscription.planName"] = f"{req.plan.upper().title()} Tier"
    if req.database_config is not None and is_super_admin(user):
        update_data["databaseConfig"] = {
            "isolationMode": req.database_config.isolation_mode,
            "mongodbUri": req.database_config.mongodb_uri,
            "databaseName": req.database_config.database_name
        }

    if update_data:
        query = {"_id": t_oid} if t_oid else {"slug": tenant_id}
        await primary_db.tenants.update_one(query, {"$set": update_data})

    return {
        "success": True,
        "message": "Store profile updated successfully",
        "tenantId": tenant_id,
        "profile": update_data
    }

@router.patch("/{tenant_id}/status")
async def update_tenant_status(
    tenant_id: str,
    req: TenantStatusUpdateRequest,
    user: TokenPayload = Depends(get_current_user)
):
    if not is_super_admin(user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Super Admin authorization required to modify store status."
        )

    clean_status = req.status.strip().upper()
    if clean_status not in ("ACTIVE", "SUSPENDED"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Status must be either ACTIVE or SUSPENDED."
        )

    primary_db = get_database()
    t_oid = ObjectId(tenant_id) if ObjectId.is_valid(tenant_id) else None
    query = {"_id": t_oid} if t_oid else {"slug": tenant_id}

    update_payload = {
        "status": clean_status,
        "subscription.status": clean_status,
        "updatedAt": datetime.now(timezone.utc)
    }

    result = await primary_db.tenants.update_one(query, {"$set": update_payload})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Tenant store not found.")

    return {
        "success": True,
        "message": f"Store status updated to {clean_status}",
        "tenantId": tenant_id,
        "status": clean_status
    }

@router.post("/{tenant_id}/renew-subscription")
async def renew_tenant_subscription(
    tenant_id: str,
    req: SubscriptionRenewRequest,
    user: TokenPayload = Depends(get_current_user)
):
    if not is_super_admin(user):
        raise HTTPException(status_code=403, detail="Super Admin authorization required to renew subscriptions.")

    primary_db = get_database()
    t_oid = ObjectId(tenant_id) if ObjectId.is_valid(tenant_id) else None
    
    tenant = await primary_db.tenants.find_one({"_id": t_oid}) if t_oid else None
    now = datetime.now(timezone.utc)
    
    current_sub = tenant.get("subscription", {}) if tenant else {}
    current_end_str = current_sub.get("endDate")
    
    # Calculate new end date
    if req.new_end_date:
        new_end_date = req.new_end_date
    elif req.extend_days:
        try:
            cur_end = datetime.fromisoformat(current_end_str.replace("Z", "+00:00")) if current_end_str else now
            base_date = max(now, cur_end)
            new_end_date = (base_date + timedelta(days=req.extend_days)).isoformat()
        except Exception:
            new_end_date = (now + timedelta(days=req.extend_days)).isoformat()
    else:
        new_end_date = (now + timedelta(days=365)).isoformat()

    plan_name = (req.plan or (tenant.get("plan") if tenant else "PROFESSIONAL")).upper()
    defaults = PLAN_DEFAULTS.get(plan_name, PLAN_DEFAULTS["PROFESSIONAL"])
    
    max_u = req.max_users if req.max_users is not None else current_sub.get("maxUsers", defaults["max_users"])
    max_l = req.max_locations if req.max_locations is not None else current_sub.get("maxLocations", defaults["max_locations"])

    renewal_record = {
        "date": now.isoformat(),
        "extendedUntil": new_end_date,
        "renewedBy": user.email,
        "amount": req.amount,
        "billingCycle": req.billing_cycle or current_sub.get("billingCycle", "ANNUAL"),
        "notes": req.notes
    }

    sub_update = {
        "subscription.planId": plan_name,
        "subscription.planName": f"{plan_name.title()} Tier",
        "subscription.status": "ACTIVE",
        "subscription.endDate": new_end_date,
        "subscription.maxUsers": max_u,
        "subscription.maxLocations": max_l,
        "status": "ACTIVE"
    }

    if t_oid:
        await primary_db.tenants.update_one(
            {"_id": t_oid},
            {
                "$set": sub_update,
                "$push": {"subscription.renewalHistory": renewal_record}
            }
        )

    return {
        "success": True,
        "message": f"Tenant subscription renewed until {new_end_date} successfully!",
        "tenantId": tenant_id,
        "newEndDate": new_end_date,
        "status": "ACTIVE",
        "maxUsers": max_u,
        "maxLocations": max_l
    }

@router.post("/{tenant_id}/reset-password")
async def reset_tenant_password(
    tenant_id: str,
    req: ResetPasswordRequest,
    user: TokenPayload = Depends(get_current_user)
):
    if not is_super_admin(user):
        raise HTTPException(status_code=403, detail="Super Admin authorization required to reset credentials.")

    if len(req.new_password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters.")

    primary_db = get_database()
    t_oid = ObjectId(tenant_id) if ObjectId.is_valid(tenant_id) else None
    
    hashed = get_password_hash(req.new_password)
    
    # Update admin user for this tenant
    res = await primary_db.users.update_many(
        {"$or": [{"tenantId": t_oid}, {"tenantId": tenant_id}], "roles": "TENANT_ADMIN"},
        {"$set": {"passwordHash": hashed, "hashedPassword": hashed}}
    )

    return {
        "success": True,
        "message": "Tenant administrator credentials have been successfully updated.",
        "matchedUsers": res.matched_count
    }

@router.post("", response_model=TenantResponse, status_code=status.HTTP_201_CREATED)
async def create_tenant(req: TenantCreateRequest, user: TokenPayload = Depends(get_current_user)):
    if not is_super_admin(user):
        raise HTTPException(status_code=403, detail="Super Admin authorization required to provision new tenants.")

    primary_db = get_database()
    now = datetime.now(timezone.utc)
    clean_email = req.admin_email.strip().lower()
    
    plan_tier = req.plan.upper()
    defaults = PLAN_DEFAULTS.get(plan_tier, PLAN_DEFAULTS["PROFESSIONAL"])
    max_u = req.max_users if req.max_users is not None else defaults["max_users"]
    max_l = req.max_locations if req.max_locations is not None else defaults["max_locations"]
    duration = req.duration_days if req.duration_days else 365
    end_date = (now + timedelta(days=duration)).isoformat()

    sub_doc = {
        "planId": plan_tier,
        "planName": f"{plan_tier.title()} Tier",
        "status": "ACTIVE",
        "maxUsers": max_u,
        "maxLocations": max_l,
        "billingCycle": req.billing_cycle or "ANNUAL",
        "startDate": now.isoformat(),
        "endDate": end_date,
        "gracePeriodDays": 7,
        "pricePerCycle": 1999.0 if plan_tier == "PROFESSIONAL" else (4999.0 if plan_tier == "ENTERPRISE" else 999.0),
        "features": defaults["features"],
        "renewalHistory": [{
            "date": now.isoformat(),
            "extendedUntil": end_date,
            "renewedBy": user.email,
            "notes": "Initial provisioning"
        }]
    }

    # Validate database configuration
    db_mode = req.database_config.isolation_mode.upper() if req.database_config else "SHARED"
    custom_uri = req.database_config.mongodb_uri.strip() if req.database_config and req.database_config.mongodb_uri else None
    target_db_name = req.database_config.database_name.strip() if req.database_config and req.database_config.database_name else f"quickbill_{req.slug.strip().lower().replace('-', '_')}_db"

    if db_mode == "CUSTOM_CLUSTER":
        if not custom_uri or not (custom_uri.startswith("mongodb://") or custom_uri.startswith("mongodb+srv://")):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="A valid MongoDB connection URI (starting with mongodb:// or mongodb+srv://) is required for Dedicated MongoDB Cluster mode."
            )

    new_tenant_doc = {
        "name": req.name.strip(),
        "slug": req.slug.strip().lower(),
        "plan": plan_tier,
        "status": "ACTIVE",
        "adminEmail": clean_email,
        "phone": req.phone,
        "gstin": req.gstin,
        "address": req.address,
        "createdAt": now,
        "databaseConfig": {
            "isolationMode": db_mode,
            "mongodbUri": custom_uri if db_mode == "CUSTOM_CLUSTER" else settings.MONGODB_URI,
            "databaseName": target_db_name if db_mode != "SHARED" else "quickbill_db"
        },
        "subscription": sub_doc,
        "stats": {
            "productsCount": 0,
            "invoicesCount": 0,
            "monthlyGmv": 0.0,
            "usersCount": 1,
            "locationsCount": 1
        }
    }

    insert_res = await primary_db.tenants.insert_one(new_tenant_doc)
    new_tenant_id = str(insert_res.inserted_id)

    # Provision default location for new tenant
    default_loc_doc = {
        "businessId": new_tenant_id,
        "name": "Main Store Outlet",
        "code": "MAIN-01",
        "address": req.address or "Main Branch Counter",
        "phone": req.phone,
        "isDefault": True,
        "isActive": True,
        "createdAt": now
    }
    loc_res = await primary_db.locations.insert_one(default_loc_doc)
    default_loc_id = str(loc_res.inserted_id)

    # Provision tenant admin user
    hashed_pw = get_password_hash(req.admin_password)
    admin_user_doc = {
        "email": clean_email,
        "name": f"{req.name.strip()} Administrator",
        "passwordHash": hashed_pw,
        "hashedPassword": hashed_pw,
        "roles": ["TENANT_ADMIN"],
        "isSystemRoot": False,
        "tenantId": ObjectId(new_tenant_id),
        "authorizedTenantIds": [new_tenant_id],
        "assignedLocationIds": [default_loc_id],
        "isActive": True,
        "createdAt": now
    }
    await primary_db.users.insert_one(admin_user_doc)

    return TenantResponse(
        id=new_tenant_id,
        name=req.name,
        slug=req.slug,
        plan=plan_tier,
        status="ACTIVE",
        admin_email=clean_email,
        phone=req.phone,
        gstin=req.gstin,
        address=req.address,
        created_at=now.isoformat(),
        database_config=req.database_config,
        subscription=TenantSubscriptionModel(
            plan_id=plan_tier,
            plan_name=f"{plan_tier.title()} Tier",
            status="ACTIVE",
            max_users=max_u,
            max_locations=max_l,
            billing_cycle=req.billing_cycle or "ANNUAL",
            start_date=now.isoformat(),
            end_date=end_date,
            days_remaining=duration,
            grace_period_days=7,
            features=defaults["features"]
        ),
        stats={
            "productsCount": 0,
            "invoicesCount": 0,
            "monthlyGmv": 0.0,
            "usersCount": 1,
            "locationsCount": 1
        }
    )
