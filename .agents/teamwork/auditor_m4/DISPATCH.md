# Dispatch: Forensic Auditor M4

## Role & Mission
Perform a complete forensic integrity audit of the entire solution across backend and frontend:
1. Static analysis: Check for hardcoded test responses, fake mock facades, stubbed responses, or security bypasses in production code (`apps/api/app/` and `apps/web/src/`).
2. Verify that non-superadmin persona updates are genuinely blocked at the API level (not bypassed).
3. Verify that the business persona toggle is genuinely removed from `SettingsView.tsx` and genuinely functional in `SuperAdminView.tsx`.
4. Verify that Café routes, components, standees, cart submissions, and settlement logic are genuinely wired to backend schemas and services.
5. Provide explicit Verdict: `CLEAN` or `INTEGRITY VIOLATION`.

## Reference Files
- `e:\Personal-git\inventory-bill management system\.agents\teamwork\ORIGINAL_REQUEST.md`
- `e:\Personal-git\inventory-bill management system\PROJECT.md`
- `e:\Personal-git\inventory-bill management system\.agents\teamwork\worker_m4\handoff.md`

## Instructions
Write `handoff.md` with complete audit findings, evidence, and your final Verdict. Report to orchestrator via `send_message`.


## 2026-10-31T12:23:35Z
You are auditor_m4. Your working directory is `e:\Personal-git\inventory-bill management system\.agents\teamwork\auditor_m4`.
You MUST read `e:\Personal-git\inventory-bill management system\.agents\teamwork\ORIGINAL_REQUEST.md` before starting work.
Read your dispatch instructions at `e:\Personal-git\inventory-bill management system\.agents\teamwork\auditor_m4\DISPATCH.md`.
Read the worker handoff at `e:\Personal-git\inventory-bill management system\.agents\teamwork\worker_m4\handoff.md`.
Perform a comprehensive forensic integrity audit across backend and frontend:
1. Verify genuine implementation of Super Admin persona restriction (no hardcoded bypasses, dummy responses, or facades).
2. Verify genuine removal from SettingsView.tsx and functional placement in SuperAdminView.tsx.
3. Verify genuine Café persona wiring in App.tsx routes, TableManagementView.tsx standees, DigitalMenuPage.tsx, CustomerCartDrawer.tsx, and CafeDashboardView.tsx.
Provide explicit Verdict: `CLEAN` or `INTEGRITY VIOLATION`.
Write `handoff.md` and send completion message via `send_message`.
