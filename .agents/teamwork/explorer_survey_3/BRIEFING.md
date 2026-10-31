# BRIEFING — 2026-10-31T10:02:00Z

## Mission
Conduct an end-to-end audit of all files, components, and logic related to the Café persona (`CAFE`, `HYBRID`, dining, tables, KOT, kitchen chits, QR standees, cafe POS) across frontend and backend.

## 🔒 My Identity
- Archetype: explorer
- Roles: survey, analyzer, synthesist
- Working directory: e:\Personal-git\inventory-bill management system\.agents\teamwork\explorer_survey_3
- Original parent: fa3ad742-3f4a-494a-be4c-6d31e9962f2f
- Milestone: Café persona end-to-end audit

## 🔒 Key Constraints
- Read-only investigation — do NOT modify application source code (only write reports and analysis files in working directory)
- Provide exact file paths, line numbers, template structures, schema comparisons, detected bugs/missing wiring, and proposed fixes
- Self-contained handoff with 5 required sections

## Current Parent
- Conversation ID: fa3ad742-3f4a-494a-be4c-6d31e9962f2f
- Updated: 2026-10-31T10:02:00Z

## Investigation State
- **Explored paths**: `apps/web/src/App.tsx`, `Sidebar.tsx`, `SettingsView.tsx`, `SuperAdminView.tsx`, `TableManagementView.tsx`, `CafeDashboardView.tsx`, `IncomingOrdersView.tsx`, `KitchenOrdersView.tsx`, `DigitalMenuPage.tsx`, `CustomerCartDrawer.tsx`, `KOTPrintModal.tsx`, `apps/api/app/schemas/cafe.py`, `apps/api/app/api/v1/cafe_*.py`, `tenants.py`, `cafe_session_service.py`, `test_cafe_mvp.py`.
- **Key findings**:
  1. Cashier route guard in `App.tsx:178` blocks Cashiers from all `/cafe/*` routes.
  2. Standee QR code in `TableManagementView.tsx:161` uses undefined `table.qrCodeToken`, leaving empty `?token=`.
  3. `CustomerCartDrawer.tsx:83` sends `{ token }` while backend schema `PublicOrderSubmitRequest` requires `qrToken`, failing orders with HTTP 422.
  4. `DigitalMenuPage.tsx:49` omits `tableId` query parameter, resulting in `table = null`.
  5. `CafeDashboardView.tsx:207` sends `{ discountAmount }` while backend expects `{ discountType, discountValue }`.
  6. Backend `tenants.py:450-517` lacks Super Admin RBAC guard on `business_persona` updates.
  7. Persona toggle is in tenant `SettingsView.tsx` (missing `HYBRID`) instead of `SuperAdminView.tsx`.
  8. `test_cafe_mvp.py` expects 200 for tenant admin updating persona, which conflicts with Requirement R1.
- **Unexplored areas**: None, audit complete across all objectives.

## Key Decisions Made
- Documented all concrete file paths, exact line numbers, schema mismatches, and specific fix snippets in `handoff.md`.

## Artifact Index
- DISPATCH.md — Received dispatch instructions
- progress.md — Liveness heartbeat and checklist
- BRIEFING.md — Working memory
- handoff.md — Comprehensive audit report with 5-component handoff structure
