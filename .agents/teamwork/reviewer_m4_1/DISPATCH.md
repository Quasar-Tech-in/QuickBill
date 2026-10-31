# Dispatch: Reviewer M4_1 (Backend & RBAC Verification)

## Role & Mission
Review the entire project against the Persona Access & RBAC requirements and acceptance criteria in `ORIGINAL_REQUEST.md`:
1. `apps/web/src/views/SuperAdminView.tsx` — business persona toggle only editable within Super Admin tenant management.
2. `apps/web/src/views/SettingsView.tsx` — persona toggle completely absent from regular store settings.
3. `apps/api/app/routers/tenants.py` & `apps/api/app/schemas/tenant.py` — 403 Forbidden enforced on non-superadmin updates passing `business_persona` (direct or nested).
4. `apps/api/tests/test_persona_rbac.py` & `apps/api/tests/test_cafe_mvp.py` — automated tests pass.

## Reference Files
- `e:\Personal-git\inventory-bill management system\.agents\teamwork\ORIGINAL_REQUEST.md`
- `e:\Personal-git\inventory-bill management system\PROJECT.md`
- `e:\Personal-git\inventory-bill management system\.agents\teamwork\worker_m4\handoff.md`

## Instructions
1. Run backend tests:
   `& "apps/api/.venv/Scripts/python.exe" -m pytest apps/api/tests/test_persona_rbac.py apps/api/tests/test_cafe_mvp.py -v`
   `& "apps/api/.venv/Scripts/python.exe" apps/api/tests/verify_cafe_m1_wiring.py`
2. Inspect source code to confirm RBAC security boundaries, absence of bypasses, and adherence to requirements.
3. Write `handoff.md` with explicit Verdict (`APPROVE` or `REQUEST_CHANGES`) and report to orchestrator via `send_message`.


## 2026-10-31T12:23:26Z
[Message] timestamp=2026-10-31T12:23:26Z sender=fa3ad742-3f4a-494a-be4c-6d31e9962f2f priority=MESSAGE_PRIORITY_HIGH content=You are reviewer_m4_1. Your working directory is `e:\Personal-git\inventory-bill management system\.agents\teamwork\reviewer_m4_1`.
You MUST read `e:\Personal-git\inventory-bill management system\.agents\teamwork\ORIGINAL_REQUEST.md` before starting work.
Read your dispatch instructions at `e:\Personal-git\inventory-bill management system\.agents\teamwork\reviewer_m4_1\DISPATCH.md`.
Read the worker handoff at `e:\Personal-git\inventory-bill management system\.agents\teamwork\worker_m4\handoff.md`.
Review backend persona RBAC enforcement, schemas, and tests.
Execute tests:
`& "apps/api/.venv/Scripts/python.exe" -m pytest apps/api/tests/test_persona_rbac.py apps/api/tests/test_cafe_mvp.py -v`
`& "apps/api/.venv/Scripts/python.exe" apps/api/tests/verify_cafe_m1_wiring.py`
Write `handoff.md` in your working directory with your explicit Verdict (`APPROVE` or `REQUEST_CHANGES`) and send a completion message to the caller via `send_message`.
