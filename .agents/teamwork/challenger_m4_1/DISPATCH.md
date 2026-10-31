# Dispatch: Challenger M4_1 (Backend & Schema Empirical Stress Testing)

## Role & Mission
Empirically stress-test the backend RBAC enforcement and schema contracts across all personas (`RETAIL`, `CAFE`, `HYBRID`):
1. Execute pytest suite:
   `& "apps/api/.venv/Scripts/python.exe" -m pytest apps/api/tests/test_persona_rbac.py apps/api/tests/test_cafe_mvp.py -v`
2. Execute schema verification:
   `& "apps/api/.venv/Scripts/python.exe" apps/api/tests/verify_cafe_m1_wiring.py`
3. Test edge cases: tampering with persona casing, empty payloads, malicious injection in `settings`, token mismatch in public order submission.

## Reference Files
- `e:\Personal-git\inventory-bill management system\.agents\teamwork\ORIGINAL_REQUEST.md`
- `e:\Personal-git\inventory-bill management system\PROJECT.md`
- `e:\Personal-git\inventory-bill management system\.agents\teamwork\worker_m4\handoff.md`

## Instructions
Write `handoff.md` with test results, evidence, and explicit Verdict (`APPROVE` or `REQUEST_CHANGES`). Report to orchestrator via `send_message`.


## 2026-10-31T12:23:35Z
From: fa3ad742-3f4a-494a-be4c-6d31e9962f2f
Priority: MESSAGE_PRIORITY_HIGH

You are challenger_m4_1. Your working directory is `e:\Personal-git\inventory-bill management system\.agents\teamwork\challenger_m4_1`.
You MUST read `e:\Personal-git\inventory-bill management system\.agents\teamwork\ORIGINAL_REQUEST.md` before starting work.
Read your dispatch instructions at `e:\Personal-git\inventory-bill management system\.agents\teamwork\challenger_m4_1\DISPATCH.md`.
Read the worker handoff at `e:\Personal-git\inventory-bill management system\.agents\teamwork\worker_m4\handoff.md`.
Empirically stress-test backend RBAC, schemas, and public order contracts.
Execute:
`& "apps/api/.venv/Scripts/python.exe" -m pytest apps/api/tests/test_persona_rbac.py apps/api/tests/test_cafe_mvp.py -v`
`& "apps/api/.venv/Scripts/python.exe" apps/api/tests/verify_cafe_m1_wiring.py`
Write `handoff.md` in your working directory with your empirical evidence and explicit Verdict (`APPROVE` or `REQUEST_CHANGES`). Report to caller via `send_message`.
