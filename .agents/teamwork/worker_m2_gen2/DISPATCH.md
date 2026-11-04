## 2026-10-31T11:04:30Z
You are Worker M2 (Gen 2) replacing an unresponsive worker to implement Milestone 2: Frontend Persona Management.

Original request file: e:\Personal-git\inventory-bill management system\.agents\teamwork\ORIGINAL_REQUEST.md
Working directory: e:\Personal-git\inventory-bill management system\.agents\teamwork\worker_m2_gen2
Project specification: e:\Personal-git\inventory-bill management system\PROJECT.md
Frontend survey report to follow:
- e:\Personal-git\inventory-bill management system\.agents\teamwork\explorer_survey_1\handoff.md

Read ORIGINAL_REQUEST.md first.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Your exclusive write ownership:
- `apps/web/src/views/SettingsView.tsx`
- `apps/web/src/views/SuperAdminView.tsx`
- `apps/web/src/services/store.ts`
DO NOT edit any other files.

Requirements for Milestone 2:
1. `apps/web/src/views/SettingsView.tsx`:
   - Completely remove the persona toggle cards (RETAIL vs CAFE) from lines 1216–1306.
   - Remove `businessPersona` state variable and `setBusinessPersona`.
   - Read persona as a read-only variable from tenant context:
     `const tenantPersona: BusinessPersona = activeTenant?.settings?.businessPersona || 'RETAIL';`
   - If `tenantPersona === 'CAFE' || tenantPersona === 'HYBRID'`, keep the operational cafe settings (enableKOT, enableQROrdering, taxRate) under a clean "Café Operations Preferences" section.
   - In `handleSaveProfile`: strictly omit `businessPersona` from the `settings` payload sent to `store.updateTenantProfile({ settings: { cafeConfig } })`. This ensures non-superadmin users never attempt to modify `businessPersona`, preventing backend 403 Forbidden errors.

2. `apps/web/src/views/SuperAdminView.tsx`:
   - In Tab 1 (`Provisioned Business Stores & Quotas`) store directory table:
     - Add an "Operating Persona" badge column displaying store personas:
       - `RETAIL` -> badge with Retail / Supermarket
       - `CAFE` -> badge with Café & Bistro
       - `HYBRID` -> badge with Hybrid (POS + Café)
   - In Modal 3 (`Edit Store Profile`):
     - Add `businessPersona: BusinessPersona` and `cafeConfig: CafeConfig` to `editTenantForm` state.
     - In `openEditTenantModal(t)`, populate `businessPersona` and `cafeConfig` from `t.settings`.
     - Include `businessPersona` and `cafeConfig` in initial snapshot and dirty checking (`isEditTenantDirty`).
     - Render 3-way persona selector cards: `RETAIL`, `CAFE`, and `HYBRID`. When `CAFE` or `HYBRID` is selected, include toggles for cafe operational settings (`enableKOT`, `enableQROrdering`, `taxRate`).
     - In `handleSaveEditTenant`, include `settings: { ...selectedTenant.settings, businessPersona: editTenantForm.businessPersona, cafeConfig: editTenantForm.cafeConfig }` in `store.updateTenantProfile`.
   - In Modal 1 (`Provision New Store`):
     - Allow selecting initial `businessPersona` (`RETAIL`, `CAFE`, `HYBRID`) so Super Admins can provision new stores directly into their target persona.

3. `apps/web/src/services/store.ts`:
   - Fix `fetchTenants()`: map and preserve `t.settings` (or fallback `{ businessPersona: t.business_persona || 'RETAIL', cafeConfig: t.cafe_config }`).
   - Fix `fetchActiveTenant()`: map and preserve `settings` in `normalizedTenant`.
   - In `addTenant()`: allow passing `settings?: TenantSettings` and forward `business_persona` to `apiClient.post('/tenants')`.

4. Verification:
   - Run `npm --prefix apps/web run build` in the sandboxed terminal.
   - Verify that TypeScript compilation (`tsc`) and Vite build succeed with 0 errors.

Write a complete report to `e:\Personal-git\inventory-bill management system\.agents\teamwork\worker_m2_gen2\handoff.md`.
Include build command outputs and line-number references.
When done, send a message to the orchestrator.
