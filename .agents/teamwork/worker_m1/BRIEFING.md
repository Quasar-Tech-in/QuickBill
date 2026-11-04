# BRIEFING — 2026-10-31T10:05:00Z

## Mission
Implement Milestone 1: Backend Persona RBAC & Schemas for the inventory-bill management system.

## 🔒 My Identity
- Archetype: worker
- Roles: implementer, qa, specialist
- Working directory: e:\Personal-git\inventory-bill management system\.agents\teamwork\worker_m1
- Original parent: fa3ad742-3f4a-494a-be4c-6d31e9962f2f
- Milestone: Milestone 1: Backend Persona RBAC & Schemas

## 🔒 Key Constraints
- Strict integrity mandate: NO dummy code, NO hardcoded test results, NO shortcuts.
- Exclusive write ownership:
  - `apps/api/app/schemas/cafe.py`
  - `apps/api/app/api/v1/tenants.py`
  - `apps/api/app/services/cafe_session_service.py`
  - `apps/api/tests/test_persona_rbac.py`
  - `apps/api/tests/test_cafe_mvp.py`
  - DO NOT edit any other files.
- Python venv path: `e:\Personal-git\inventory-bill management system\apps\api\.venv\Scripts\pytest.exe`.

## Current Parent
- Conversation ID: fa3ad742-3f4a-494a-be4c-6d31e9962f2f
- Updated: 2026-10-31T10:05:00Z

## Task Summary
- **What to build**:
  1. Define `BusinessPersona(str, Enum)` and update `TenantSettings`, `TableResponse`, `PublicOrderSubmitRequest`, `TableSettleRequest` in `apps/api/app/schemas/cafe.py`.
  2. Populate `qrCodeToken` in `apps/api/app/services/cafe_session_service.py`.
  3. Enforce Super Admin-only persona updates and validation in `apps/api/app/api/v1/tenants.py`, and accept `businessPersona` in `TenantCreateRequest`.
  4. Write comprehensive tests in `apps/api/tests/test_persona_rbac.py`.
  5. Update `apps/api/tests/test_cafe_mvp.py` to adapt to the new RBAC requirement.
- **Success criteria**:
  - Non-superadmin receives 403 on persona modification attempts (both direct and nested).
  - Non-superadmin regular profile & settings updates succeed with 200 OK.
  - Superadmin can assign RETAIL, CAFE, HYBRID with 200 OK.
  - Invalid persona results in 400 Bad Request.
  - Cashier receives 403 on store profile update.
  - All tests in `test_persona_rbac.py` and `test_cafe_mvp.py` pass cleanly.
- **Interface contracts**: `apps/api/app/schemas/cafe.py`, `apps/api/app/api/v1/tenants.py`
- **Code layout**: Backend FastAPI under `apps/api/`

## Key Decisions Made
- [Initial] Use `model_validator(mode="before")` in `PublicOrderSubmitRequest` to allow both `qrToken` and `token`.
- [Initial] Ensure `TableResponse` exposes `qrCodeToken` so frontend standee generation gets the token.

## Artifact Index
- `DISPATCH.md` — Dispatch instructions
- `BRIEFING.md` — Situational awareness
- `progress.md` — Liveness & progress tracker
- `handoff.md` — Final 5-component report

## Change Tracker
- **Files modified**: None yet
- **Build status**: Pending
- **Pending issues**: None

## Quality Status
- **Build/test result**: Untested
- **Lint status**: Clean
- **Tests added/modified**: Pending

## Loaded Skills
- **Source**: `e:\Personal-git\inventory-bill management system\.agents\skills\auth-rbac\SKILL.md`
- **Source**: `e:\Personal-git\inventory-bill management system\.agents\skills\fastapi-backend\SKILL.md`
