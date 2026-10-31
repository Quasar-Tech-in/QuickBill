# Dispatch: Reviewer M4_2 (Café Persona Wiring & Frontend Verification)

## Role & Mission
Review the entire project against the Café Persona Wiring & Functionality requirements and acceptance criteria in `ORIGINAL_REQUEST.md`:
1. `apps/web/src/App.tsx` — cashier path `/cafe` access, suspended store lockout, and React Router SPA navigation.
2. `apps/web/src/views/TableManagementView.tsx` — table QR standees and token resolution.
3. `apps/web/src/customer/DigitalMenuPage.tsx` & `apps/web/src/customer/CustomerCartDrawer.tsx` — public menu, tableId query param, and cart submission `qrToken` compatibility.
4. `apps/web/src/views/CafeDashboardView.tsx` — table session settlement discounts and backend `TableSettleRequest` alignment.
5. Frontend production build and empirical checks.

## Reference Files
- `e:\Personal-git\inventory-bill management system\.agents\teamwork\ORIGINAL_REQUEST.md`
- `e:\Personal-git\inventory-bill management system\PROJECT.md`
- `e:\Personal-git\inventory-bill management system\.agents\teamwork\worker_m4\handoff.md`

## Instructions
1. Run frontend build and empirical verification:
   `npm --prefix apps/web run build`
   `node apps/web/scripts/verify_m3_empirical.js`
2. Inspect source code to verify Café components, printing chits, and table standees render without errors and wire to data schemas.
3. Write `handoff.md` with explicit Verdict (`APPROVE` or `REQUEST_CHANGES`) and report to orchestrator via `send_message`.


## 2026-10-31T12:23:26Z
You are reviewer_m4_2. Your working directory is `e:\Personal-git\inventory-bill management system\.agents\teamwork\reviewer_m4_2`.
You MUST read `e:\Personal-git\inventory-bill management system\.agents\teamwork\ORIGINAL_REQUEST.md` before starting work.
Read your dispatch instructions at `e:\Personal-git\inventory-bill management system\.agents\teamwork\reviewer_m4_2\DISPATCH.md`.
Read the worker handoff at `e:\Personal-git\inventory-bill management system\.agents\teamwork\worker_m4\handoff.md`.
Review Café persona frontend wiring, route guards, standees, and schemas.
Execute frontend builds and empirical tests:
`npm --prefix apps/web run build`
`node apps/web/scripts/verify_m3_empirical.js`
Write `handoff.md` in your working directory with your explicit Verdict (`APPROVE` or `REQUEST_CHANGES`) and send a completion message to the caller via `send_message`.
