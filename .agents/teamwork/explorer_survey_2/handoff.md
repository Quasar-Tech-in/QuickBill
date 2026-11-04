# Backend Business Persona API & RBAC Enforcement Investigation

## Executive Summary
This report analyzes backend business persona (`RETAIL`, `CAFE`, `HYBRID`) management, tenant/store settings endpoints, RBAC enforcement, and test coverage. Currently, regular tenant administrators are able to modify `business_persona` because `PUT /api/v1/tenants/{tenant_id}` sets `settings.businessPersona` without checking for Super Admin privileges. To satisfy the business requirements, the backend must be hardened to strictly reject any persona modification attempt by non-superadmin accounts with HTTP 403 Forbidden, allow Super Admins to assign valid personas (`RETAIL`, `CAFE`, `HYBRID`) with 400 validation for invalid personas, ensure regular store profile updates by tenant admins continue seamlessly, and update existing tests to prevent regression.

---

## 1. Observations

### 1.1 Backend Schemas, Models, and Enums
- **File**: `apps/api/app/schemas/cafe.py`
  - **Lines 15–22**:
    ```python
    class TenantSettings(BaseSchema):
        business_persona: str = Field(default="RETAIL", alias="businessPersona") # RETAIL | CAFE | HYBRID
        cafe_config: Optional[CafeConfig] = Field(default=None, alias="cafeConfig")
        currency: str = "INR"
        currency_symbol: str = Field(default="₹", alias="currencySymbol")
        enable_round_off: bool = Field(default=True, alias="enableRoundOff")
        default_tax_rate: float = Field(default=5.0, alias="defaultTaxRate")
    ```
  - **Observation**: There is no formal Python `Enum` for `BusinessPersona`. The field is defined as `str` with a comment `# RETAIL | CAFE | HYBRID`.
  - Contrast with frontend (`apps/web/src/types/index.ts:379`): `export type BusinessPersona = 'RETAIL' | 'CAFE' | 'HYBRID';`.

- **File**: `apps/api/app/api/v1/tenants.py`
  - **Lines 64–77 (`TenantCreateRequest`)**:
    ```python
    class TenantCreateRequest(BaseModel):
        name: str
        slug: str
        admin_email: str
        admin_password: str
        plan: str = "PROFESSIONAL"
        gstin: Optional[str] = None
        phone: Optional[str] = None
        address: Optional[str] = None
        max_users: Optional[int] = None
        max_locations: Optional[int] = None
        billing_cycle: Optional[str] = "ANNUAL"
        duration_days: Optional[int] = 365
        database_config: DatabaseConfig
    ```
    `TenantCreateRequest` lacks a `business_persona` field. When Super Admin provisions a new tenant (`create_tenant`, lines 710–733), `"settings"` is omitted, defaulting in `build_tenant_response` to `{"businessPersona": "RETAIL"}`.
  - **Lines 79–97 (`TenantResponse`)**:
    ```python
    class TenantResponse(BaseModel):
        id: str
        name: str
        slug: str
        plan: str
        status: str
        ...
        settings: Optional[Dict[str, Any]] = None
    ```
  - **Lines 320 (`build_tenant_response`)**:
    ```python
    settings=t.get("settings", {"businessPersona": "RETAIL"})
    ```
  - **Lines 434–449 (`TenantUpdateRequest`)**:
    ```python
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
        settings: Optional[Dict[str, Any]] = None
        business_persona: Optional[str] = Field(None, alias="businessPersona")
        cafe_config: Optional[Dict[str, Any]] = Field(None, alias="cafeConfig")
    ```

### 1.2 Endpoints Reading or Updating Settings
- **File**: `apps/api/app/api/v1/tenants.py`
  - **Endpoint 1: `GET /api/v1/tenants` (lines 323–345)**:
    - Lists all tenants with `settings` (including `businessPersona`).
    - Uses `user: TokenPayload = Depends(get_current_user)`.
  - **Endpoint 2: `GET /api/v1/tenants/current` (lines 347–368)**:
    - Resolves `user.default_business_id` and returns `TenantResponse` with `settings`.
    - Used by frontend stores on login and navigation.
  - **Endpoint 3: `GET /api/v1/tenants/{tenant_id}` (lines 370–385)**:
    - Verifies `if not is_super_admin(user) and user.default_business_id != tenant_id: raise HTTPException(status_code=403, detail="Unauthorized access to this store.")`.
    - Returns `TenantResponse`.
  - **Endpoint 4: `PUT /api/v1/tenants/{tenant_id}` (lines 450–516)**:
    - Used for all tenant profile and store settings updates.
    - Lines 456–464:
      ```python
      if not is_tenant_admin(user):
          raise HTTPException(
              status_code=status.HTTP_403_FORBIDDEN,
              detail="Only Store Administrators or Super Admins can update the business profile."
          )

      if not is_super_admin(user) and user.default_business_id != tenant_id:
          raise HTTPException(status_code=403, detail="Unauthorized access to modify this store profile.")
      ```
    - Lines 485–498 (Super Admin restricted fields):
      ```python
      if req.status is not None and is_super_admin(user):
          ...
      if req.plan is not None and is_super_admin(user):
          ...
      if req.database_config is not None and is_super_admin(user):
          ...
      ```
    - Lines 499–506 (Unrestricted persona & settings update):
      ```python
      if req.business_persona is not None:
          update_data["settings.businessPersona"] = req.business_persona.strip().upper()
      if req.cafe_config is not None:
          update_data["settings.cafeConfig"] = req.cafe_config
      if req.settings is not None:
          for k, v in req.settings.items():
              update_data[f"settings.{k}"] = v
      ```

### 1.3 RBAC and Authentication System
- **File**: `apps/api/app/core/security.py`
  - **Lines 12–24 (`TokenPayload`)**:
    ```python
    class TokenPayload(BaseModel):
        sub: str  # userId
        email: str
        name: Optional[str] = None
        roles: List[str] = ["admin"]
        permissions: List[str] = []
        default_business_id: Optional[str] = None
        authorized_business_ids: List[str] = []
        assigned_location_ids: List[str] = []
        store_status: Optional[str] = "ACTIVE"
        is_store_locked: Optional[bool] = False
        lockout_reason: Optional[str] = None
    ```
- **File**: `apps/api/app/api/v1/tenants.py`
  - **Lines 13–19**:
    ```python
    def is_super_admin(user: TokenPayload) -> bool:
        normalized_roles = [r.upper() for r in user.roles]
        return "SUPER_ADMIN" in normalized_roles or "SUPERADMIN" in normalized_roles

    def is_tenant_admin(user: TokenPayload) -> bool:
        normalized_roles = [r.upper() for r in user.roles]
        return "TENANT_ADMIN" in normalized_roles or is_super_admin(user)
    ```

### 1.4 Existing Tests
- **File**: `apps/api/tests/test_cafe_mvp.py`
  - **Lines 53–78 (`test_tenant_persona_configuration`)**:
    ```python
    @pytest.mark.asyncio
    async def test_tenant_persona_configuration(auth_headers_tenant_a):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            update_payload = {
                "businessPersona": "CAFE",
                "cafeConfig": { ... }
            }
            res = await client.put(f"/api/v1/tenants/{TENANT_A}", json=update_payload, headers=auth_headers_tenant_a)
            assert res.status_code == 200
    ```
    - **Observation**: `auth_headers_tenant_a` has `roles=["TENANT_ADMIN"]`. The existing test explicitly asserts that a `TENANT_ADMIN` CAN change `businessPersona` to `"CAFE"`.
    - Once the 403 restriction is implemented, this test will fail unless updated to expect 403 or use a Super Admin token.
- **File**: `apps/api/tests/test_multi_tenant_isolation.py`
  - **Lines 86–96 (`superadmin_token`)**:
    ```python
    @pytest.fixture
    def superadmin_token():
        payload = TokenPayload(
            sub="usr_superadmin",
            email="superadmin@quickbill.local",
            roles=["super_admin", "admin"],
            permissions=["all"],
            default_business_id=TENANT_A_ID,
            authorized_business_ids=[TENANT_A_ID, TENANT_B_ID]
        )
        return create_access_token(payload)
    ```
    - Tests Super Admin quota and subscription renewals, but does not test persona modification or persona RBAC.

---

## 2. Logic Chain

1. **Current Vulnerability (Observation 1.1, 1.2)**:
   In `apps/api/app/api/v1/tenants.py:499-506`, `req.business_persona` and `req.settings` are processed for any caller where `is_tenant_admin(user)` is true. There is no check `if is_super_admin(user)` around `req.business_persona` or persona keys in `req.settings`. Therefore, any regular store admin can freely switch persona between RETAIL, CAFE, or HYBRID.

2. **Required RBAC Enforcement Contract (Original Request R1)**:
   The requirement mandates: "Enforce the restriction at the backend API/RBAC level so that store settings update endpoints reject persona modifications attempted by non-superadmin accounts" with HTTP 403 Forbidden.
   To prevent bypasses, the check must evaluate both:
   a. Direct field: `req.business_persona is not None`
   b. Embedded field: `req.settings is not None` and any persona key (`"businessPersona"` or `"business_persona"`) is present in `req.settings`.
   If a caller is NOT a Super Admin (`not is_super_admin(user)`), the endpoint must raise:
   `HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only Super Administrators are authorized to configure business persona.")`.

3. **Super Admin Persona Modification Contract**:
   When caller IS a Super Admin (`is_super_admin(user) == True`):
   a. Persona changes are authorized.
   b. The input value must be validated against `{"RETAIL", "CAFE", "HYBRID"}`.
   c. If an invalid string is provided (e.g. `"INVALID"`), the endpoint must raise HTTP 400 Bad Request with a clear message: `"Invalid business persona '...'. Valid personas are: RETAIL, CAFE, HYBRID."`.
   d. The valid value is normalized to uppercase and saved into `update_data["settings.businessPersona"]`.

4. **Tenant Admin Regular Updates Isolation Contract**:
   When a tenant admin updates their profile (`name`, `phone`, `gstin`, `address`, `logo_url`, `tagline`, `receipt_footer`, `cafe_config`, or general `settings` without persona keys):
   - The endpoint must NOT reject the request.
   - The persona in the database remains completely untouched.
   - The response returns `200 OK`.

5. **Test Impact & Test Gap (Observation 1.4)**:
   `apps/api/tests/test_cafe_mvp.py:54` currently exercises the outdated behavior (Tenant Admin updating `businessPersona`). Implementing the 403 restriction will break that test unless it is updated. Additionally, zero tests currently verify the 403 rejection or Super Admin persona update across all three personas (`RETAIL`, `CAFE`, `HYBRID`).

---

## 3. Caveats

1. **Frontend Persona Configuration Removal**:
   While this report focuses on the backend, regular tenant settings in `SettingsView.tsx` currently submit `settings: { businessPersona, cafeConfig }`. When the frontend Explorer/Developer removes the persona toggle from `SettingsView.tsx`, they must ensure that `SettingsView.tsx` stops sending `businessPersona` in `settings` so legitimate store setting saves do not trigger HTTP 403.
2. **Backward Compatibility with Snake_case vs CamelCase**:
   Pydantic uses `alias="businessPersona"` on `business_persona`. MongoDB stores `settings.businessPersona`. The RBAC check must inspect both `"businessPersona"` and `"business_persona"` in the `settings` dict to avoid bypasses via alternate casing.
3. **Tenant Creation (`POST /api/v1/tenants`)**:
   Currently, `TenantCreateRequest` does not accept `business_persona` during initial provisioning. Adding `business_persona: Optional[str] = Field(default="RETAIL", alias="businessPersona")` to `TenantCreateRequest` allows Super Admin to assign the persona upon store creation.

---

## 4. Conclusion & Proposed Implementation Plan

### 4.1 Schema Definitions (`apps/api/app/schemas/cafe.py`)
Add an explicit `BusinessPersona` string Enum:
```python
from enum import Enum

class BusinessPersona(str, Enum):
    RETAIL = "RETAIL"
    CAFE = "CAFE"
    HYBRID = "HYBRID"

class TenantSettings(BaseSchema):
    business_persona: BusinessPersona = Field(default=BusinessPersona.RETAIL, alias="businessPersona")
    cafe_config: Optional[CafeConfig] = Field(default=None, alias="cafeConfig")
    ...
```

### 4.2 Endpoint Hardening (`apps/api/app/api/v1/tenants.py`)

#### Update `TenantUpdateRequest`:
```python
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
    settings: Optional[Dict[str, Any]] = None
    business_persona: Optional[str] = Field(None, alias="businessPersona")
    cafe_config: Optional[Dict[str, Any]] = Field(None, alias="cafeConfig")
```

#### Update `PUT /api/v1/tenants/{tenant_id}`:
```python
VALID_PERSONAS = {"RETAIL", "CAFE", "HYBRID"}

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

    # Detect persona modification attempt
    persona_attempted = req.business_persona is not None
    persona_in_settings = False
    requested_persona_val = req.business_persona

    if req.settings is not None:
        if "businessPersona" in req.settings:
            persona_attempted = True
            persona_in_settings = True
            requested_persona_val = req.settings["businessPersona"]
        elif "business_persona" in req.settings:
            persona_attempted = True
            persona_in_settings = True
            requested_persona_val = req.settings["business_persona"]

    # RBAC Enforcement: Only Super Admin can modify business persona
    if persona_attempted and not is_super_admin(user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Super Administrators are authorized to configure business persona."
        )

    primary_db = get_database()
    t_oid = ObjectId(tenant_id) if ObjectId.is_valid(tenant_id) else None
    update_data = {}

    # Regular profile fields
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

    # Super Admin only: Status, Plan, Database Config
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

    # Super Admin only: Business Persona Assignment & Validation
    if persona_attempted and is_super_admin(user):
        if requested_persona_val is None:
            clean_persona = "RETAIL"
        else:
            clean_persona = str(requested_persona_val).strip().upper()
        
        if clean_persona not in VALID_PERSONAS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid business persona '{requested_persona_val}'. Valid personas are: {', '.join(sorted(VALID_PERSONAS))}."
            )
        update_data["settings.businessPersona"] = clean_persona

    # Store settings & cafe config (Tenant admin can configure cafe parameters e.g. QR ordering, sections)
    if req.cafe_config is not None:
        update_data["settings.cafeConfig"] = req.cafe_config
    if req.settings is not None:
        for k, v in req.settings.items():
            if k in ("businessPersona", "business_persona"):
                continue  # already handled above
            update_data[f"settings.{k}"] = v

    if update_data:
        query = {"_id": t_oid} if t_oid else {"slug": tenant_id}
        await primary_db.tenants.update_one(query, {"$set": update_data})

    return {
        "success": True,
        "message": "Store profile updated successfully",
        "tenantId": tenant_id,
        "profile": update_data
    }
```

#### Update `POST /api/v1/tenants` (`create_tenant`):
Allow Super Admin to optionally select persona at tenant creation:
```python
class TenantCreateRequest(BaseModel):
    ...
    business_persona: Optional[str] = Field(default="RETAIL", alias="businessPersona")

# Inside create_tenant:
clean_persona = (req.business_persona or "RETAIL").strip().upper()
if clean_persona not in VALID_PERSONAS:
    raise HTTPException(status_code=400, detail=f"Invalid business persona '{req.business_persona}'.")

new_tenant_doc = {
    ...
    "settings": {
        "businessPersona": clean_persona
    }
}
```

---

## 5. Verification Method

### 5.1 Test Suite Plan (`apps/api/tests/test_persona_rbac.py`)
Create a new comprehensive test suite containing:

```python
import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.core.security import create_access_token, TokenPayload

TENANT_ID = "65f2a1b9a000000000000001"

@pytest.fixture
def superadmin_headers():
    token = create_access_token(TokenPayload(
        sub="sa_user",
        email="superadmin@quickbill.local",
        roles=["SUPER_ADMIN"],
        default_business_id=TENANT_ID,
        authorized_business_ids=[TENANT_ID]
    ))
    return {"Authorization": f"Bearer {token}"}

@pytest.fixture
def tenant_admin_headers():
    token = create_access_token(TokenPayload(
        sub="admin_user",
        email="admin@store.local",
        roles=["TENANT_ADMIN"],
        default_business_id=TENANT_ID,
        authorized_business_ids=[TENANT_ID]
    ))
    return {"Authorization": f"Bearer {token}"}

@pytest.fixture
def cashier_headers():
    token = create_access_token(TokenPayload(
        sub="cashier_user",
        email="cashier@store.local",
        roles=["CASHIER"],
        default_business_id=TENANT_ID,
        authorized_business_ids=[TENANT_ID]
    ))
    return {"Authorization": f"Bearer {token}"}

@pytest.mark.asyncio
async def test_non_superadmin_cannot_update_persona_direct(tenant_admin_headers):
    """Verify Tenant Admin receives 403 Forbidden when attempting to modify businessPersona."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.put(
            f"/api/v1/tenants/{TENANT_ID}",
            json={"businessPersona": "CAFE"},
            headers=tenant_admin_headers
        )
        assert res.status_code == 403
        assert "Only Super Administrators are authorized to configure business persona" in res.json()["detail"]

@pytest.mark.asyncio
async def test_non_superadmin_cannot_update_persona_via_settings_dict(tenant_admin_headers):
    """Verify Tenant Admin receives 403 when smuggling businessPersona inside settings dict."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.put(
            f"/api/v1/tenants/{TENANT_ID}",
            json={"settings": {"businessPersona": "HYBRID"}},
            headers=tenant_admin_headers
        )
        assert res.status_code == 403

@pytest.mark.asyncio
async def test_tenant_admin_regular_settings_update_succeeds(tenant_admin_headers):
    """Verify Tenant Admin can update normal settings without persona changes."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.put(
            f"/api/v1/tenants/{TENANT_ID}",
            json={
                "name": "Updated Store Name",
                "phone": "+91 98765 43210",
                "settings": {"currency": "USD", "defaultTaxRate": 12.0}
            },
            headers=tenant_admin_headers
        )
        assert res.status_code == 200
        assert res.json()["success"] is True

@pytest.mark.asyncio
async def test_superadmin_can_assign_retail_cafe_hybrid(superadmin_headers):
    """Verify Super Admin can successfully assign CAFE, HYBRID, and RETAIL personas."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        for persona in ["CAFE", "HYBRID", "RETAIL"]:
            res = await client.put(
                f"/api/v1/tenants/{TENANT_ID}",
                json={"businessPersona": persona},
                headers=superadmin_headers
            )
            assert res.status_code == 200
            
            # Verify retrieval
            get_res = await client.get("/api/v1/tenants/current", headers=superadmin_headers)
            assert get_res.status_code == 200
            assert get_res.json()["settings"]["businessPersona"] == persona

@pytest.mark.asyncio
async def test_superadmin_invalid_persona_rejected_with_400(superadmin_headers):
    """Verify Super Admin receives 400 Bad Request if an invalid persona string is passed."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.put(
            f"/api/v1/tenants/{TENANT_ID}",
            json={"businessPersona": "INVALID_PERSONA"},
            headers=superadmin_headers
        )
        assert res.status_code == 400
        assert "Invalid business persona" in res.json()["detail"]

@pytest.mark.asyncio
async def test_cashier_rejected_from_store_update(cashier_headers):
    """Verify unprivileged staff (Cashier) cannot update tenant profile at all."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.put(
            f"/api/v1/tenants/{TENANT_ID}",
            json={"name": "Hacked Name"},
            headers=cashier_headers
        )
        assert res.status_code == 403
```

### 5.2 Regression Fix for Existing Test (`apps/api/tests/test_cafe_mvp.py`)
In `apps/api/tests/test_cafe_mvp.py`, line 54:
Update `test_tenant_persona_configuration` to:
1. First verify that `auth_headers_tenant_a` receives `403 Forbidden` when attempting to set `businessPersona: "CAFE"`.
2. Then use a Super Admin token fixture to set `businessPersona: "CAFE"`, allowing subsequent table and session tests to run under the configured CAFE persona.

### 5.3 Invalidation Conditions
The conclusion would be invalidated if:
- Other endpoints exist that write to the `tenants` collection `settings` field (grepping confirmed only `tenants.py` does).
- The frontend requires tenant admins to retain persona toggling privileges (the prompt explicitly forbids this and commands complete removal from `SettingsView.tsx`).
