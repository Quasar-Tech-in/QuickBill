## 2026-10-31T10:03:35Z
You are Worker M1 tasked with implementing Milestone 1: Backend Persona RBAC & Schemas.

Original request file: e:\Personal-git\inventory-bill management system\.agents\teamwork\ORIGINAL_REQUEST.md
Working directory: e:\Personal-git\inventory-bill management system\.agents\teamwork\worker_m1
Project specification: e:\Personal-git\inventory-bill management system\PROJECT.md
Explorer reports to reference:
- e:\Personal-git\inventory-bill management system\.agents\teamwork\explorer_survey_2\handoff.md
- e:\Personal-git\inventory-bill management system\.agents\teamwork\explorer_survey_3\handoff.md

Read ORIGINAL_REQUEST.md first.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Your exclusive write ownership:
- `apps/api/app/schemas/cafe.py`
- `apps/api/app/api/v1/tenants.py`
- `apps/api/app/services/cafe_session_service.py`
- `apps/api/tests/test_persona_rbac.py`
- `apps/api/tests/test_cafe_mvp.py`
DO NOT edit any other files.

Requirements for Milestone 1:
1. `apps/api/app/schemas/cafe.py`:
   - Define `BusinessPersona(str, Enum)` with values `RETAIL = "RETAIL"`, `CAFE = "CAFE"`, `HYBRID = "HYBRID"`.
   - Update `TenantSettings` to use `BusinessPersona` enum for `business_persona` (default `BusinessPersona.RETAIL`, alias `businessPersona`).
   - Add `qr_code_token: Optional[str] = Field(None, alias="qrCodeToken")` to `TableResponse`.
   - In `PublicOrderSubmitRequest`, add validator or alias so both `qrToken` and `token` are accepted without 422 errors.
   - In `TableSettleRequest`, accept `discount_amount: Optional[float] = Field(None, alias="discountAmount")`.

2. `apps/api/app/services/cafe_session_service.py`:
   - In `list_tables` and `create_table`, ensure `qrCodeToken` is populated from `qrCodeSecret` (or `qrCodeToken`) so `TableResponse` serializes `qrCodeToken`.

3. `apps/api/app/api/v1/tenants.py`:
   - In `update_tenant_profile`:
     - Detect if caller is attempting to set persona (either via `req.business_persona is not None` or `req.settings` contains `"businessPersona"` or `"business_persona"`).
     - If persona modification is attempted AND caller is NOT superadmin (`not is_super_admin(user)`): immediately raise `HTTPException(status_code=403, detail="Only Super Administrators are authorized to configure business persona.")`.
     - If persona modification is attempted AND caller IS superadmin: validate that the persona is in `{"RETAIL", "CAFE", "HYBRID"}`. If invalid, raise `HTTPException(status_code=400, detail="Invalid business persona '{val}'. Valid personas are: CAFE, HYBRID, RETAIL.")`. Set `update_data["settings.businessPersona"] = clean_persona`.
     - Allow regular profile and settings updates by `TENANT_ADMIN` (without persona modification) to proceed normally with 200 OK.
   - In `TenantCreateRequest`, add `business_persona: Optional[str] = Field(default="RETAIL", alias="businessPersona")` and populate `settings.businessPersona` in the new tenant document.

4. `apps/api/tests/test_persona_rbac.py`:
   - Write comprehensive pytest tests using httpx AsyncClient and ASGITransport:
     - Test non-superadmin (TENANT_ADMIN) receives 403 on direct `businessPersona` update.
     - Test non-superadmin receives 403 on nested `settings.businessPersona` and `settings.business_persona` update.
     - Test non-superadmin regular profile & settings updates succeed with 200 OK.
     - Test Super Admin successfully assigns `RETAIL`, `CAFE`, and `HYBRID` with 200 OK.
     - Test Super Admin passing invalid persona receives 400 Bad Request.
     - Test unprivileged user (Cashier) receives 403 on store profile update.

5. `apps/api/tests/test_cafe_mvp.py`:
   - In `test_tenant_persona_configuration`, update the test so it first checks that `TENANT_ADMIN` receives 403 when updating `businessPersona`, and then uses a Super Admin token to configure `businessPersona = "CAFE"` so subsequent tests in the module run smoothly.

6. Verification:
   - Run pytest using the virtual environment:
     `& "e:\Personal-git\inventory-bill management system\apps\api\.venv\Scripts\pytest.exe" apps\api\tests\test_persona_rbac.py apps\api\tests\test_cafe_mvp.py -v` (use BypassSandbox=true).
   - Verify all tests pass.

Write a complete report to `e:\Personal-git\inventory-bill management system\.agents\teamwork\worker_m1\handoff.md`.
Include the test commands executed and output logs.
When finished, send a message to the orchestrator.
