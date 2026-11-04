# Milestone 4 Independent Quality & Adversarial Review Report

**Reviewer**: `reviewer_m4_1`  
**Roles**: Reviewer, Adversarial Critic  
**Date**: 2026-10-31  
**Target Milestone**: M4 — Persona Access & RBAC Enforcement Review  
**Verdict**: **APPROVE**  

---

## 1. Observation

### 1.1 Source Code Inspection

1. **`apps/api/app/api/v1/tenants.py` (lines 462–560)**:
   - Endpoint: `PUT /api/v1/tenants/{tenant_id}` (`update_tenant_profile`)
   - Guard check for tenant admin role:
     ```python
     if not is_tenant_admin(user):
         raise HTTPException(
             status_code=status.HTTP_403_FORBIDDEN,
             detail="Only Store Administrators or Super Admins can update the business profile."
         )
     if not is_super_admin(user) and user.default_business_id != tenant_id:
         raise HTTPException(status_code=403, detail="Unauthorized access to modify this store profile.")
     ```
   - Persona modification interception across direct and nested dictionaries:
     ```python
     persona_attempted = req.business_persona is not None
     persona_val = req.business_persona

     if req.settings is not None and isinstance(req.settings, dict):
         if "businessPersona" in req.settings:
             persona_attempted = True
             persona_val = req.settings["businessPersona"]
         elif "business_persona" in req.settings:
             persona_attempted = True
             persona_val = req.settings["business_persona"]

     if persona_attempted and not is_super_admin(user):
         raise HTTPException(
             status_code=status.HTTP_403_FORBIDDEN,
             detail="Only Super Administrators are authorized to configure business persona."
         )
     ```
   - Super Admin validation on persona values (lines 532–540):
     ```python
     if persona_attempted and is_super_admin(user):
         clean_persona = str(persona_val).strip().upper() if persona_val is not None else "RETAIL"
         if clean_persona not in VALID_PERSONAS:
             valid_list = ", ".join(sorted(VALID_PERSONAS))
             raise HTTPException(
                 status_code=status.HTTP_400_BAD_REQUEST,
                 detail=f"Invalid business persona '{persona_val}'. Valid personas are: {valid_list}."
             )
         update_data["settings.businessPersona"] = clean_persona
     ```
   - `VALID_PERSONAS = {"RETAIL", "CAFE", "HYBRID"}` strictly enforced.
   - Tenant creation endpoint `POST /api/v1/tenants` (lines 705–759) strictly requires `is_super_admin(user)` and rejects invalid personas with HTTP 400.

2. **`apps/web/src/views/SettingsView.tsx`**:
   - Persona toggle controls (`RETAIL`, `CAFE`, `HYBRID`) are completely absent from store settings.
   - `tenantPersona` (line 152) is read-only from `activeTenant?.settings?.businessPersona` solely to conditionally display the "Café Operations Preferences" configuration box (line 1218).
   - Form submission handler `handleSaveProfile` (lines 606–642) persists store name, gstin, phone, email, address, logo, tagline, receipt footer, and `cafeConfig`, with zero transmission of `businessPersona`.

3. **`apps/web/src/views/SuperAdminView.tsx`**:
   - Store Provisioning Modal (lines 1715–1800): 3-option radio selector card (`RETAIL`, `CAFE`, `HYBRID`) allowing Super Admin to assign business persona at store creation.
   - Store Profile Edit Modal (lines 2278–2350): Dedicated `Operating Business Persona (Super Admin Exclusive)` section with 3 interactive radio cards (`RETAIL`, `CAFE`, `HYBRID`).
   - Tenant Management Table (lines 917 & 965): Displays current persona badge (`RETAIL`, `CAFE`, `HYBRID`) for every registered store.
   - Edit form submission (lines 500–521) properly transmits `settings.businessPersona` to the backend.

4. **`apps/api/app/schemas/cafe.py`**:
   - `BusinessPersona(str, Enum)` defines `RETAIL`, `CAFE`, `HYBRID`.
   - `TenantSettings` defaults `business_persona` to `BusinessPersona.RETAIL`.
   - `PublicOrderSubmitRequest` includes `@model_validator(mode="before")` normalizing `token`, `qrToken`, and `qr_token`.
   - `TableResponse` defines `qr_code_token` with alias `qrCodeToken`.
   - `TableSettleRequest` supports `discount_amount` with alias `discountAmount`.

---

### 1.2 Independent Test Suite Executions

All commands were executed independently by this reviewer in standard sandbox mode (`BypassSandbox=false`):

#### 1. Backend Automated Pytest Suite (`test_persona_rbac.py` + `test_cafe_mvp.py`)
- **Command**:
  ```powershell
  & "apps/api/.venv/Scripts/python.exe" -m pytest apps/api/tests/test_persona_rbac.py apps/api/tests/test_cafe_mvp.py -v
  ```
- **Exit Code**: `0`
- **Output Snippet**:
  ```
  collected 13 items
  apps\api\tests\test_persona_rbac.py::test_non_superadmin_cannot_update_persona_direct PASSED [  7%]
  apps\api\tests\test_persona_rbac.py::test_non_superadmin_cannot_update_persona_nested_camel_case PASSED [ 15%]
  apps\api\tests\test_persona_rbac.py::test_non_superadmin_cannot_update_persona_nested_snake_case PASSED [ 23%]
  apps\api\tests\test_persona_rbac.py::test_non_superadmin_regular_profile_and_settings_update_succeeds PASSED [ 30%]
  apps\api\tests\test_persona_rbac.py::test_superadmin_can_assign_all_personas PASSED [ 38%]
  apps\api\tests\test_persona_rbac.py::test_superadmin_invalid_persona_returns_400 PASSED [ 46%]
  apps\api\tests\test_persona_rbac.py::test_cashier_forbidden_from_store_profile_update PASSED [ 53%]
  apps\api\tests\test_persona_rbac.py::test_schemas_persona_and_normalization PASSED [ 61%]
  apps\api\tests\test_persona_rbac.py::test_superadmin_create_tenant_with_persona PASSED [ 69%]
  apps\api\tests\test_cafe_mvp.py::test_tenant_persona_configuration PASSED [ 76%]
  apps\api\tests\test_cafe_mvp.py::test_table_crud_and_tenant_isolation PASSED [ 84%]
  apps\api\tests\test_cafe_mvp.py::test_qr_token_signing_and_validation PASSED [ 92%]
  apps\api\tests\test_cafe_mvp.py::test_public_menu_and_customer_ordering_flow PASSED [100%]
  ======================= 13 passed, 6 warnings in 14.74s =======================
  ```

#### 2. Backend Empirical Wiring & Schema Checks (`verify_cafe_m1_wiring.py`)
- **Command**:
  ```powershell
  & "apps/api/.venv/Scripts/python.exe" apps/api/tests/verify_cafe_m1_wiring.py
  ```
- **Exit Code**: `0`
- **Verbatim Summary**:
  ```
  VERIFICATION SUMMARY: 34 PASSED, 0 FAILED
  VERDICT: ALL EMPIRICAL CHECKS PASSED
  ```

#### 3. Frontend Production Build & Typecheck (`npm run build`)
- **Command**:
  ```powershell
  npm --prefix apps/web run build
  ```
- **Exit Code**: `0`
- **Duration**: `24.48s`
- **Output Snippet**:
  ```
  ✓ 1852 modules transformed.
  rendering chunks...
  dist/index.html                     1.09 kB │ gzip:   0.61 kB
  dist/assets/index-Ba2w7ea6.css     58.78 kB │ gzip:  11.02 kB
  dist/assets/index-DMnVemE6.js   1,802.50 kB │ gzip: 429.09 kB
  ✓ built in 24.48s
  ```

#### 4. Frontend Empirical AST Verification (`verify_m3_empirical.js`)
- **Command**:
  ```powershell
  node apps/web/scripts/verify_m3_empirical.js
  ```
- **Exit Code**: `0`
- **Verbatim Summary**:
  ```
  --- ALL 22 / 22 EMPIRICAL TESTS PASSED SUCCESSFULLY! ---
  ```

#### 5. Adversarial Empirical Stress Test Suite (`test_challenger_m4_empirical.py`)
- **Command**:
  ```powershell
  & "apps/api/.venv/Scripts/python.exe" -m pytest apps/api/tests/test_challenger_m4_empirical.py -v
  ```
- **Exit Code**: `0`
- **Output Snippet**:
  ```
  collected 5 items
  apps\api\tests\test_challenger_m4_empirical.py::test_adversarial_persona_casing_and_smuggling PASSED [ 20%]
  apps\api\tests\test_challenger_m4_empirical.py::test_adversarial_superadmin_normalization_and_rejections PASSED [ 40%]
  apps\api\tests\test_challenger_m4_empirical.py::test_adversarial_unauthorized_and_idor_attempts PASSED [ 60%]
  apps\api\tests\test_challenger_m4_empirical.py::test_adversarial_public_order_token_and_payload_tampering PASSED [ 80%]
  apps\api\tests\test_challenger_m4_empirical.py::test_adversarial_public_menu_resilience PASSED [100%]
  ======================== 5 passed, 6 warnings in 3.77s ========================
  ```

---

## 2. Integrity Assessment

No integrity violations detected:
1. **No hardcoded test results**: Source code executes actual calculations, parameter normalizations, and database updates.
2. **No dummy or facade implementations**: RBAC logic uses genuine JWT claims (`TokenPayload`) and verifies role lists dynamically. Schema models run standard Pydantic validation.
3. **No shortcuts or bypassed tasks**: Super Admin persona toggle was genuinely wired into `SuperAdminView.tsx` (edit and provisioning modals) and completely removed from `SettingsView.tsx`.
4. **No fabricated verification outputs**: All test suites and commands were executed live and produced genuine exit code 0 output.
5. **No self-certifying work**: Verification was conducted independently by the reviewer agent using separate test suites and code audits.

---

## 3. Logic Chain

1. **AC1 Verification**:
   - `SuperAdminView.tsx` defines persona selection radio cards in the tenant provisioning modal (lines 1715–1800) and the store edit modal (lines 2278–2350).
   - *Conclusion*: AC1 is satisfied.

2. **AC2 Verification**:
   - `SettingsView.tsx` does not render any interactive persona configuration elements.
   - `handleSaveProfile` does not include `businessPersona` in its save payload.
   - *Conclusion*: AC2 is satisfied.

3. **AC3 Verification**:
   - `apps/api/app/api/v1/tenants.py` detects any presence of `businessPersona` or `business_persona` (top-level or nested under `settings`) and raises HTTP 403 Forbidden if `is_super_admin(user)` is false.
   - Verified empirically by `test_non_superadmin_cannot_update_persona_direct`, `test_non_superadmin_cannot_update_persona_nested_camel_case`, `test_non_superadmin_cannot_update_persona_nested_snake_case`, and `test_adversarial_persona_casing_and_smuggling`.
   - *Conclusion*: AC3 is satisfied.

4. **AC4 Verification**:
   - Super Admin can assign `RETAIL`, `CAFE`, and `HYBRID` personas via `PUT /api/v1/tenants/{tenant_id}` and `POST /api/v1/tenants`.
   - Verified empirically by `test_superadmin_can_assign_all_personas`, `test_superadmin_create_tenant_with_persona`, and `test_adversarial_superadmin_normalization_and_rejections`.
   - *Conclusion*: AC4 is satisfied.

5. **AC5, AC6, AC7 Verification**:
   - Production Vite frontend build compiled 1852 modules with 0 errors.
   - Café table standees, digital menu, public ordering, KOT generation, and table settlement tests passed across both frontend AST checks (22/22) and backend integration tests (18/18).
   - *Conclusion*: AC5, AC6, and AC7 are satisfied.

---

## 4. Adversarial Review & Stress-Testing

| Attack Vector / Scenario | Target System | Expected Behavior | Observed Result | Status |
|---|---|---|---|---|
| **Parameter Casing Smuggling** (`businessPersona` vs `business_persona`) | `PUT /api/v1/tenants/{id}` | Non-superadmin rejected with 403 Forbidden | HTTP 403 Forbidden returned | **PASS** |
| **Nested Dictionary Smuggling** (`settings.businessPersona`) | `PUT /api/v1/tenants/{id}` | Non-superadmin rejected with 403 Forbidden | HTTP 403 Forbidden returned | **PASS** |
| **Cross-Tenant IDOR Attempt** | `PUT /api/v1/tenants/{id}` | Tenant A Admin modifying Tenant B blocked | HTTP 403 Forbidden returned | **PASS** |
| **Unprivileged Role Modification** (Cashier) | `PUT /api/v1/tenants/{id}` | Staff role modifying store profile blocked | HTTP 403 Forbidden returned | **PASS** |
| **Invalid Persona Injection** (`INVALID`, `BAR`, `<script>`, SQL) | `PUT /api/v1/tenants/{id}` | Super Admin passing invalid persona rejected | HTTP 400 Bad Request returned | **PASS** |
| **Tampered HMAC Table Token** | `POST /public/cafe/orders` | Customer order with forged token rejected | HTTP 403 Forbidden returned | **PASS** |
| **Cross-Table Token Replay Attack** | `POST /public/cafe/orders` | Table 20 token submitted for Table 10 | HTTP 403 Forbidden returned | **PASS** |
| **Empty / Malformed Order Payload** | `POST /public/cafe/orders` | Zero/negative items rejected | HTTP 422 Unprocessable Entity | **PASS** |

---

## 5. Caveats

No caveats. All test suites executed cleanly in standard sandbox (`BypassSandbox=false`) without bypasses, and all acceptance criteria from `ORIGINAL_REQUEST.md` have been met.

---

## 6. Conclusion & Verdict

**Verdict**: **APPROVE**

All requirements and acceptance criteria in `ORIGINAL_REQUEST.md` have been met with robust backend RBAC enforcement, strict schema validation, clean frontend UI separation, and thorough automated test coverage. Zero regressions were detected.

---

## 7. Verification Method

To independently reproduce this verification:

```powershell
# 1. Run all backend RBAC, Cafe MVP, and Adversarial pytest suites:
& "apps/api/.venv/Scripts/python.exe" -m pytest apps/api/tests/test_persona_rbac.py apps/api/tests/test_cafe_mvp.py apps/api/tests/test_challenger_m4_empirical.py -v

# 2. Run backend schema wiring verification:
& "apps/api/.venv/Scripts/python.exe" apps/api/tests/verify_cafe_m1_wiring.py

# 3. Run frontend production build & typecheck:
npm --prefix apps/web run build

# 4. Run frontend empirical AST & routing checks:
node apps/web/scripts/verify_m3_empirical.js
```
