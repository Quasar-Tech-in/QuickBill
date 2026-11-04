# Orchestrator Plan

## Goal
Restrict the business persona configuration (`RETAIL`, `CAFE`, `HYBRID`) exclusively to Super Admin users (removing it from `SettingsView.tsx`, adding/verifying it in `SuperAdminView`, and enforcing backend RBAC with 403 Forbidden on unauthorized updates). Audit and fix the Café persona wiring across components, templates, routes, printing chits, standees, and schemas. Ensure all backend & frontend tests pass.

## Phases
1. **Survey (Phase 0)**:
   - Spawn 3 parallel Explorers:
     - Explorer 1: Frontend persona management audit (`SettingsView.tsx`, `SuperAdminView`, tenant store settings, business persona toggle, state/context, routes).
     - Explorer 2: Backend persona API and RBAC audit (tenant schemas, store settings update endpoints, user role/auth middleware, Super Admin permission checks, 403 enforcement).
     - Explorer 3: Café persona audit (Café & Hybrid components, templates, routes, printing chits, QR standees, schemas, dining/order workflows).
   - Aggregate findings into `PROJECT.md § Feature Inventory` and architecture layout.

2. **Milestone 1: Super Admin Exclusive Persona Management (R1)**:
   - Frontend: Relocate persona toggle to SuperAdminView tenant management; completely eliminate from SettingsView.
   - Backend: Ensure store settings update endpoints reject persona modifications if user is not superadmin (403 Forbidden). Super admin can assign RETAIL, CAFE, HYBRID.
   - Worker implementation + Reviewer + Challenger + Forensic Auditor.

3. **Milestone 2: Café Persona Audit, Wiring & Templates (R2)**:
   - Fix all broken routes, missing component wiring, printing chit templates, QR standees, and schema mismatches.
   - Ensure Cafe and Hybrid personas render and function properly.
   - Worker implementation + Reviewer + Challenger + Forensic Auditor.

4. **Milestone 3: Verification & Regression Testing**:
   - Run backend test suite (pytest) with new automated tests for RBAC enforcement and Cafe persona wiring.
   - Run frontend tests, typecheck, linting.
   - Verify all acceptance criteria are met.
