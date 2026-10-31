# Progress — Worker M2 (Gen 2)

Last visited: 2026-10-31T11:15:00Z

- [x] Initial dispatch received and briefed.
- [x] Read ORIGINAL_REQUEST.md and explorer survey handoff.
- [x] Inspect existing implementations in `apps/web/src/views/SettingsView.tsx`, `apps/web/src/views/SuperAdminView.tsx`, `apps/web/src/services/store.ts`, and tenant type definitions.
- [x] Plan modifications across the 3 files.
- [x] Implement changes in `apps/web/src/services/store.ts`:
  - `fetchTenants()` maps and preserves `settings` with fallback.
  - `fetchActiveTenant()` maps and preserves `settings`.
  - `addTenant()` accepts `settings?: TenantSettings` and forwards `business_persona`.
  - `updateTenantProfile()` merges `current.settings` with partial `updates.settings` to prevent persona erasure in local state, and omits `business_persona` from PUT payload when undefined.
- [x] Implement changes in `apps/web/src/views/SettingsView.tsx`:
  - Persona toggle cards (RETAIL vs CAFE) completely removed.
  - `businessPersona` state and `setBusinessPersona` removed.
  - Read persona as read-only from activeTenant context (`tenantPersona`).
  - Operational cafe preferences kept under clean "Café Operations Preferences" section for `CAFE` and `HYBRID`.
  - In `handleSaveProfile`, strictly omit `businessPersona` from `settings` payload to avoid 403 Forbidden.
  - Included `cafeConfig` in dirty tracking snapshot and memo.
- [x] Implement changes in `apps/web/src/views/SuperAdminView.tsx`:
  - Added "Operating Persona" badge column in Tab 1 store directory table (`RETAIL`, `CAFE`, `HYBRID`).
  - Modal 3 (`Edit Store Profile`): added `businessPersona` & `cafeConfig` to state, `openEditTenantModal`, snapshots, dirty checking, 3-way card selector, cafe toggles, and save handler.
  - Modal 1 (`Provision New Store`): added 3-way persona selector so stores can be provisioned directly into target persona.
- [x] Verify build with `npm --prefix apps/web run build` (Exit code 0, 0 TypeScript errors).
- [x] Prepare handoff.md and notify orchestrator.
