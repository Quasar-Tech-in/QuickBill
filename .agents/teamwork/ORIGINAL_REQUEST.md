# Original User Request

## Approved Prompt — 2026-10-31T09:47:00Z

Restrict the business persona toggle (Retail, Cafe, and Hybrid/Combination) exclusively to Super Admin users, completely removing it from regular tenant store settings, and audit and fix the Café persona wiring across components, templates, routes, printing chits, standees, and schemas.

Working directory: e:\Personal-git\inventory-bill management system
Integrity mode: development

## Requirements

### R1. Super Admin Exclusive Persona Management
Restrict the business persona configuration (`RETAIL`, `CAFE`, and `HYBRID`) so that it can only be modified by Super Admin users.
- In the frontend, place the business persona toggle inside tenant management / store details in `SuperAdminView` where tenants are edited.
- Completely remove the business persona configuration toggle from regular tenant store settings (`SettingsView.tsx`).
- Enforce the restriction at the backend API/RBAC level so that store settings update endpoints reject persona modifications attempted by non-superadmin accounts.

### R2. Café Persona Audit, Wiring, and Regression Fixes
Perform an end-to-end cross-check of the Café persona throughout the codebase. Identify and fix any missing wiring, template errors, broken routes, printing chits, QR standees, or schema inconsistencies so that both Café and Hybrid personas function correctly without regressions.

## Verification Resources
- Backend pytest test suite
- Frontend test suite and type-checks (npm run test / npm run lint / typecheck)
- New automated tests verifying Super Admin RBAC enforcement on persona updates and Café persona component wiring

## Acceptance Criteria

### Persona Access & RBAC
- [ ] The business persona toggle is accessible and editable only within tenant management in `SuperAdminView`.
- [ ] The business persona toggle is completely absent from regular tenant store settings in `SettingsView.tsx`.
- [ ] Backend API endpoints reject any attempt by non-superadmin users to modify the tenant `business_persona` with an authorization error (403 Forbidden).
- [ ] Super Admin users can successfully assign `RETAIL`, `CAFE`, and `HYBRID` personas to tenants.

### Café Persona Wiring & Functionality
- [ ] All Café persona routes, components, and views load and render without runtime errors.
- [ ] Café printing templates, kitchen/order chits, and table QR standees are properly placed and wired to their respective data schemas.
- [ ] Existing backend and frontend test suites pass, and new automated tests covering Super Admin persona RBAC and Café persona wiring pass.
