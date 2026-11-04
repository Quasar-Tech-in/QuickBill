# Project: Business Persona Super Admin Restriction & Café Persona Audit

## Architecture
- **Backend Architecture**: FastAPI REST service (`apps/api/app`) with Pydantic v2 schemas (`app/schemas`), multi-tenant MongoDB data access, JWT/TokenPayload RBAC security (`app/core/security.py`), and tenant management endpoints (`app/api/v1/tenants.py`, `app/api/v1/cafe.py`, `app/api/v1/cafe_public.py`).
- **Frontend Architecture**: React 18 SPA (`apps/web`) with TypeScript, React Router 6, Zustand-like centralized store (`services/store.ts`), View components (`views/SettingsView.tsx`, `views/SuperAdminView.tsx`, `views/TableManagementView.tsx`, `views/CafeDashboardView.tsx`), and Diner customer portal (`customer/DigitalMenuPage.tsx`, `customer/CustomerCartDrawer.tsx`).
- **Data Flow & RBAC Contracts**:
  - `businessPersona` is a restricted tenant configuration property (`RETAIL` | `CAFE` | `HYBRID`).
  - Only callers with `SUPER_ADMIN` in `user.roles` are authorized to modify `businessPersona` or create tenants with custom personas.
  - Non-superadmin callers attempting to modify `businessPersona` directly or nested within `settings` receive HTTP 403 Forbidden.
  - Regular store setting updates (profile, taxes, currency) by `TENANT_ADMIN` continue to function without restriction.
  - Café table management, QR standees, public menu viewing, customer cart ordering, kitchen chits (KOT), and table settlement data flow seamlessly with strict schema alignment.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Backend Persona Enum & Schemas | Formal `BusinessPersona` Enum (`RETAIL`, `CAFE`, `HYBRID`), `TableResponse.qrCodeToken`, `PublicOrderSubmitRequest` alias & normalization, and `TableSettleRequest` discount amount compatibility | M1 | Survey 2 & 3 |
| 2 | Backend Persona RBAC 403 Enforcement | Strict 403 Forbidden rejection when non-superadmin users supply `businessPersona` or `business_persona` (directly or inside `settings` dict) | M1 | Survey 2 |
| 3 | Backend Super Admin Persona Provisioning | Super Admin can assign `RETAIL`, `CAFE`, `HYBRID` in `PUT /api/v1/tenants/{id}` and `POST /api/v1/tenants`, rejecting invalid values with 400 Bad Request | M1 | Survey 2 |
| 4 | SettingsView Persona Toggle Removal | Completely eliminate persona radio toggle cards from `SettingsView.tsx` and sanitize profile save payload to omit `businessPersona` | M2 | Survey 1 |
| 5 | SuperAdminView Persona Management | Add 3-way persona toggle (`RETAIL`, `CAFE`, `HYBRID`) inside Store Edit modal and Provision New Store modal, plus operating persona badges in store directory table | M2 | Survey 1 |
| 6 | Frontend Store State Normalization | Fix `store.ts` (`fetchTenants`, `fetchActiveTenant`, `addTenant`) to preserve `settings.businessPersona` and `settings.cafeConfig` | M2 | Survey 1 |
| 7 | Cashier Café Navigation & Guard Fix | Add `/cafe` to `allowedCashierPaths` in `AppLayout` so cashiers can access floor tables, incoming orders, and KDS | M3 | Survey 3 |
| 8 | Table QR Standee Token Wiring | Ensure QR standee generator uses genuine HMAC `qrCodeToken` and valid URL formatting | M3 | Survey 3 |
| 9 | Customer Public Menu & Cart Submission Fix | Pass `tableId` in `DigitalMenuPage`, resolve storeName/tableName mapping, and send both `qrToken` and `token` in `CustomerCartDrawer` | M3 | Survey 3 |
| 10| Café Dashboard SPA Navigation & Discount Settlement | Replace `window.location.assign` with React Router `navigate` and align table settlement discount parameters | M3 | Survey 3 |
| 11| Comprehensive Test Suite Verification | Pytest automated test suite for persona RBAC, updated `test_cafe_mvp.py`, frontend TypeScript compilation & build verification | M4 | Survey 1, 2, 3 |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Backend Persona RBAC & Schemas | `cafe.py` schemas, `tenants.py` RBAC 403 enforcement, `cafe_session_service.py` token serialization | None | DONE |
| M2 | Frontend Persona Management | `SettingsView.tsx` removal, `SuperAdminView.tsx` toggle & badges, `store.ts` normalization | M1 | DONE |
| M3 | Café Persona End-to-End Audit & Wiring Fixes | `App.tsx` cashier guards & SPA navigation, `TableManagementView.tsx` standees, `DigitalMenuPage.tsx` & `CustomerCartDrawer.tsx` ordering | M1, M2 | DONE |
| M4 | Comprehensive Verification & Regression Hardening | Automated backend pytest tests (`test_persona_rbac.py`, `test_cafe_mvp.py`), frontend build verification, integrity audit | M1, M2, M3 | DONE |

## Code Layout
- Backend Schemas: `apps/api/app/schemas/cafe.py`
- Backend Endpoints: `apps/api/app/api/v1/tenants.py`, `apps/api/app/api/v1/cafe.py`, `apps/api/app/api/v1/cafe_public.py`
- Backend Services: `apps/api/app/services/cafe_session_service.py`
- Backend Tests: `apps/api/tests/test_persona_rbac.py`, `apps/api/tests/test_cafe_mvp.py`
- Frontend Views: `apps/web/src/views/SettingsView.tsx`, `apps/web/src/views/SuperAdminView.tsx`, `apps/web/src/views/TableManagementView.tsx`, `apps/web/src/views/CafeDashboardView.tsx`
- Frontend Customer Portal: `apps/web/src/customer/DigitalMenuPage.tsx`, `apps/web/src/customer/CustomerCartDrawer.tsx`
- Frontend Core: `apps/web/src/App.tsx`, `apps/web/src/services/store.ts`, `apps/web/src/types/index.ts`

## Interface Contracts
### SuperAdmin / Tenant Settings RBAC Contract
- `PUT /api/v1/tenants/{tenant_id}`:
  - If `business_persona` is passed in body OR `"businessPersona"` / `"business_persona"` is in `settings`:
    - Caller must have `"SUPER_ADMIN"` or `"SUPERADMIN"` in `user.roles`.
    - If caller is not Super Admin: return `403 Forbidden` (`{"detail": "Only Super Administrators are authorized to configure business persona."}`).
    - If caller is Super Admin: validate value against `{"RETAIL", "CAFE", "HYBRID"}`. If invalid, return `400 Bad Request`.
  - Regular settings updates (without persona) by `TENANT_ADMIN`: succeed with `200 OK`.
- `POST /api/v1/tenants`:
  - `TenantCreateRequest` accepts optional `business_persona: Optional[str] = Field("RETAIL", alias="businessPersona")`.
### Café Public Order Contract
- `POST /api/v1/public/cafe/orders`:
  - `PublicOrderSubmitRequest` accepts `qr_token` (`alias="qrToken"`) and normalizes fallback from `token`.
- `GET /api/v1/public/cafe/{slug}/menu`:
  - Query parameters: `tableId: Optional[str]`, `token: Optional[str]`. Returns `storeName`, `table` info.
### Table Session & Settlement Contract
- `POST /api/v1/cafe/tables/sessions/{session_id}/settle`:
  - Accepts `TableSettleRequest` with `discount_amount` or `discount_type`/`discount_value`.
