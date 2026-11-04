# BRIEFING — 2026-10-31T09:50:00Z

## Mission
Investigate backend schemas, models, endpoints, RBAC, and tests for business persona (RETAIL, CAFE, HYBRID) and tenant store settings enforcement.

## 🔒 My Identity
- Archetype: explorer
- Roles: survey, backend analysis, synthesis
- Working directory: e:\Personal-git\inventory-bill management system\.agents\teamwork\explorer_survey_2
- Original parent: fa3ad742-3f4a-494a-be4c-6d31e9962f2f
- Milestone: business-persona-rbac-investigation

## 🔒 Key Constraints
- Read-only investigation — do NOT implement
- Analyze backend schemas, models, endpoints, RBAC, and tests for business persona enforcement
- Produce structured 5-component handoff report in .agents/teamwork/explorer_survey_2/handoff.md

## Current Parent
- Conversation ID: fa3ad742-3f4a-494a-be4c-6d31e9962f2f
- Updated: 2026-10-31T10:00:00Z

## Investigation State
- **Explored paths**:
  - `apps/api/app/schemas/cafe.py` (TenantSettings, CafeConfig, Table schemas)
  - `apps/api/app/schemas/common.py` (BaseSchema, Pagination)
  - `apps/api/app/api/v1/tenants.py` (tenant endpoints, update_tenant_profile, is_super_admin, is_tenant_admin)
  - `apps/api/app/core/security.py` (TokenPayload, get_current_user, get_current_business_id)
  - `apps/api/app/api/v1/auth.py` (MFA login, role handling)
  - `apps/api/app/api/v1/users.py` (user endpoints, roles)
  - `apps/api/tests/conftest.py` (MockDatabase, tenant seed data)
  - `apps/api/tests/test_cafe_mvp.py` (test_tenant_persona_configuration)
  - `apps/api/tests/test_multi_tenant_isolation.py` (superadmin_token, quota tests)
  - `apps/web/src/types/index.ts` (BusinessPersona enum/type, TenantSettings)
  - `apps/web/src/services/store.ts` (updateTenantProfile, updateBusinessPersona)
  - `apps/web/src/views/SuperAdminView.tsx` (handleSaveEditTenant)
  - `apps/web/src/views/SettingsView.tsx` (store settings view)
- **Key findings**:
  1. No formal Python Enum exists for `BusinessPersona`; string literals `RETAIL`, `CAFE`, `HYBRID` are used loosely.
  2. `PUT /api/v1/tenants/{tenant_id}` is the sole backend endpoint modifying store settings and persona.
  3. Currently, any user with `TENANT_ADMIN` role can supply `business_persona` (or `businessPersona`) or embed it within `settings: {"businessPersona": "..."}` and it gets updated in the database without any Super Admin verification.
  4. Non-superadmin callers are not rejected with 403 Forbidden on persona modification.
  5. In `test_cafe_mvp.py:54`, `test_tenant_persona_configuration` currently uses a `TENANT_ADMIN` token to update persona, which will fail once 403 enforcement is active unless updated to use Super Admin credentials.
  6. Super Admin does not currently have explicit persona assignment during initial tenant creation (`TenantCreateRequest`).
- **Unexplored areas**: Frontend Chit printing and standee templates (being surveyed by Explorer 1).

## Key Decisions Made
- Define a canonical `BusinessPersona` string Enum (`RETAIL`, `CAFE`, `HYBRID`) in `apps/api/app/schemas/cafe.py`.
- Enforce strict RBAC in `PUT /api/v1/tenants/{tenant_id}`: reject any request containing `business_persona` / `businessPersona` or `settings.businessPersona` / `settings.business_persona` with HTTP 403 Forbidden if `not is_super_admin(user)`.
- Validate Super Admin persona assignment against `BusinessPersona` enum values; return HTTP 400 Bad Request for unrecognized persona values.
- Design a comprehensive test suite in `apps/api/tests/test_persona_rbac.py` and update `test_cafe_mvp.py` to prevent regression.

## Artifact Index
- e:\Personal-git\inventory-bill management system\.agents\teamwork\explorer_survey_2\DISPATCH.md — Incoming dispatch message
- e:\Personal-git\inventory-bill management system\.agents\teamwork\explorer_survey_2\progress.md — Liveness heartbeat and task progress
- e:\Personal-git\inventory-bill management system\.agents\teamwork\explorer_survey_2\handoff.md — Final 5-component handoff report
