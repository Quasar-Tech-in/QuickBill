# BRIEFING — 2026-10-31T10:55:00Z

## Mission
Implement Milestone 2: Frontend Persona Management in SettingsView.tsx, SuperAdminView.tsx, and store.ts.

## 🔒 My Identity
- Archetype: worker_m2
- Roles: implementer, qa, specialist
- Working directory: e:\Personal-git\inventory-bill management system\.agents\teamwork\worker_m2
- Original parent: fa3ad742-3f4a-494a-be4c-6d31e9962f2f
- Milestone: M2: Frontend Persona Management

## 🔒 Key Constraints
- Exclusive write ownership:
  - `apps/web/src/views/SettingsView.tsx`
  - `apps/web/src/views/SuperAdminView.tsx`
  - `apps/web/src/services/store.ts`
  DO NOT edit any other files.
- Mandatory integrity mandate: No cheats, genuine logic, real state and behavior.
- In `SettingsView.tsx`: completely remove persona toggle cards (RETAIL vs CAFE) from lines 1216–1306, remove `businessPersona` state & setter, read persona as read-only from `activeTenant?.settings?.businessPersona || 'RETAIL'`. If `CAFE` or `HYBRID`, keep operational cafe settings under "Café Operations Preferences". Omit `businessPersona` strictly from `handleSaveProfile` settings payload.
- In `SuperAdminView.tsx`: add "Operating Persona" badge column in Tab 1 store directory table (RETAIL, CAFE, HYBRID). In Modal 3 (Edit Store Profile), add `businessPersona` and `cafeConfig` to `editTenantForm`, `openEditTenantModal`, `isEditTenantDirty`, render 3-way persona selector cards (`RETAIL`, `CAFE`, `HYBRID`) with cafe operational toggles when `CAFE`/`HYBRID` selected, and include settings in `store.updateTenantProfile`. In Modal 1 (Provision New Store), allow selecting initial `businessPersona`.
- In `store.ts`: fix `fetchTenants()` to map and preserve `t.settings` (or fallback to `businessPersona` and `cafeConfig`), fix `fetchActiveTenant()` to map and preserve `settings`, in `addTenant()` allow passing `settings` and forward `business_persona`.
- Verification: `npm --prefix apps/web run build` with 0 errors.

## Current Parent
- Conversation ID: fa3ad742-3f4a-494a-be4c-6d31e9962f2f
- Updated: 2026-10-31T10:55:00Z

## Task Summary
- **What to build**: Restrict business persona toggle exclusively to SuperAdminView, remove from SettingsView, and fix store.ts persistence.
- **Success criteria**: SettingsView has no persona toggle, profile save payload omits businessPersona; SuperAdminView allows viewing & editing RETAIL/CAFE/HYBRID persona and provisioning new stores with persona; store.ts preserves settings across tenant fetches; npm --prefix apps/web run build passes.
- **Interface contracts**: PROJECT.md Interface Contracts
- **Code layout**: apps/web/src/views/SettingsView.tsx, apps/web/src/views/SuperAdminView.tsx, apps/web/src/services/store.ts

## Key Decisions Made
- [Pending investigation]

## Artifact Index
- handoff.md — Final handoff report

## Change Tracker
- **Files modified**: None yet
- **Build status**: Not run yet
- **Pending issues**: None

## Quality Status
- **Build/test result**: Untested
- **Lint status**: Clean
- **Tests added/modified**: None yet

## Loaded Skills
- None
