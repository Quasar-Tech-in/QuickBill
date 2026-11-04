# Task Assignment: Milestone 4 — Comprehensive Verification & Regression Hardening

## Objective
Execute the full suite of automated verification and build pipelines across both backend and frontend to verify that all Acceptance Criteria in `ORIGINAL_REQUEST.md` and features in `PROJECT.md` are completely met with 0 regressions.

## Scope of Verification
1. **Backend Automated Pytest Suites**:
   - `apps/api/tests/test_persona_rbac.py`
   - `apps/api/tests/test_cafe_mvp.py`
   - Command:
     ```powershell
     & "apps/api/.venv/Scripts/python.exe" -m pytest apps/api/tests/test_persona_rbac.py apps/api/tests/test_cafe_mvp.py -v
     ```
   - Ensure all tests pass with exit code 0.

2. **Backend Wiring & Contract Validation**:
   - `apps/api/tests/verify_cafe_m1_wiring.py`
   - Command:
     ```powershell
     & "apps/api/.venv/Scripts/python.exe" apps/api/tests/verify_cafe_m1_wiring.py
     ```
   - Ensure all 34/34 schema checks pass.

3. **Frontend Production Build & Typecheck**:
   - Command:
     ```powershell
     npm --prefix apps/web run build
     ```
   - Ensure TypeScript compilation and Vite production build succeed with exit code 0 and 0 errors.

4. **Frontend AST & Empirical Verification**:
   - Command:
     ```powershell
     node apps/web/scripts/verify_m3_empirical.js
     ```
   - Ensure all 22/22 empirical and adversarial tests pass.

## Requirements
- Run commands in standard sandbox (`BypassSandbox=false`).
- Document all command outputs, timings, and exit codes.
- Compile a comprehensive handoff report at `.agents/teamwork/worker_m4/handoff.md`.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.


## 2026-10-31T11:56:28Z
Sender: fa3ad742-3f4a-494a-be4c-6d31e9962f2f
Priority: MESSAGE_PRIORITY_HIGH
Content:
You are Worker M4 assigned to Milestone 4: Comprehensive Verification & Regression Hardening.

Working directory: e:\Personal-git\inventory-bill management system\.agents\teamwork\worker_m4
Original request file: e:\Personal-git\inventory-bill management system\.agents\teamwork\ORIGINAL_REQUEST.md
Project file: e:\Personal-git\inventory-bill management system\PROJECT.md
Dispatch file: e:\Personal-git\inventory-bill management system\.agents\teamwork\worker_m4\DISPATCH.md

Task:
Read ORIGINAL_REQUEST.md, PROJECT.md, and your DISPATCH.md.
Execute the full suite of verification commands:
1. Backend pytest:
   & "apps/api/.venv/Scripts/python.exe" -m pytest apps/api/tests/test_persona_rbac.py apps/api/tests/test_cafe_mvp.py -v
2. Backend wiring checks:
   & "apps/api/.venv/Scripts/python.exe" apps/api/tests/verify_cafe_m1_wiring.py
3. Frontend production build:
   npm --prefix apps/web run build
4. Frontend empirical checks:
   node apps/web/scripts/verify_m3_empirical.js

Execute all commands in standard sandbox (BypassSandbox=false).
Verify that all 7 acceptance criteria from ORIGINAL_REQUEST.md pass.
Document all outputs, timings, and exit codes in e:\Personal-git\inventory-bill management system\.agents\teamwork\worker_m4\handoff.md.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.


## 2026-10-31T12:05:48Z
Sender: fa3ad742-3f4a-494a-be4c-6d31e9962f2f
Priority: MESSAGE_PRIORITY_HIGH
Content:
**Context**: Milestone 4 Verification Liveness Check
**Content**: Checking in on your verification run. Your background task running `python -m pytest` has been running for ~7 minutes without output progression beyond line 10, likely due to stdout buffering or stdin capture in the sandbox. If the task is stalled:
1. Check or cancel `task-20` via `manage_task(Action="kill", TaskId="5a52376f-ae5e-4dda-9632-3c0b738d9fa4/task-20")`.
2. Run pytest with `-s` (to disable capture) and direct pytest binary:
   `& "apps/api/.venv/Scripts/pytest.exe" apps/api/tests/test_persona_rbac.py apps/api/tests/test_cafe_mvp.py -v -s`
3. Execute the schema checks:
   `& "apps/api/.venv/Scripts/python.exe" apps/api/tests/verify_cafe_m1_wiring.py`
4. Execute empirical checks:
   `node apps/web/scripts/verify_m3_empirical.js`
5. Execute frontend build:
   `npm --prefix apps/web run build`
**Action**: Please verify the suites, document the outputs, and deliver your handoff report and status.


## 2026-10-31T12:16:19Z
Sender: fa3ad742-3f4a-494a-be4c-6d31e9962f2f
Priority: MESSAGE_PRIORITY_HIGH
Content:
**Context**: Milestone M4 Verification Suite
**Content**: Checking in on your status. In case you are encountering Windows asyncio event loop pipe hangs while running pytest, prior workers successfully executed the tests directly using:
`& "apps/api/.venv/Scripts/pytest.exe" apps/api/tests/test_persona_rbac.py apps/api/tests/test_cafe_mvp.py -v -s`
or via Python directly:
`& "apps/api/.venv/Scripts/python.exe" -c "import pytest, sys; sys.exit(pytest.main(['apps/api/tests/test_persona_rbac.py', 'apps/api/tests/test_cafe_mvp.py', '-v', '-s']))"`
Also remember to run the backend schema check (`verify_cafe_m1_wiring.py`), the frontend build (`npm --prefix apps/web run build`), and the frontend empirical check (`node apps/web/scripts/verify_m3_empirical.js`).
**Action**: Please report your progress, finish any pending test steps, compile `handoff.md`, and notify when complete.
