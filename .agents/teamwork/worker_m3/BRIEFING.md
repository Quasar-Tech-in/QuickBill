# BRIEFING — 2026-10-31T11:42:00Z

## Mission
Milestone 3: Café Persona End-to-End Audit & Wiring Fixes across frontend routes, standees, menu, cart, and dashboard.

## 🔒 My Identity
- Archetype: worker
- Roles: implementer, qa, specialist
- Working directory: e:\Personal-git\inventory-bill management system\.agents\teamwork\worker_m3
- Original parent: fa3ad742-3f4a-494a-be4c-6d31e9962f2f
- Milestone: Milestone 3

## 🔒 Key Constraints
- Exclusive write ownership:
  - `apps/web/src/App.tsx`
  - `apps/web/src/views/TableManagementView.tsx`
  - `apps/web/src/customer/DigitalMenuPage.tsx`
  - `apps/web/src/customer/CustomerCartDrawer.tsx`
  - `apps/web/src/views/CafeDashboardView.tsx`
- DO NOT edit any other files.
- Integrity Mandate: genuine implementation, no cheating or facades.
- Verification: run `npm --prefix apps/web run build` in standard sandbox without BypassSandbox.

## Current Parent
- Conversation ID: fa3ad742-3f4a-494a-be4c-6d31e9962f2f
- Updated: 2026-10-31T11:42:00Z

## Task Summary
- **What to build**: Fix Café persona wiring issues in web frontend: Cashier routing & SPA navigation & lock guard in App.tsx; QR token extraction for table standees in TableManagementView.tsx; tableId param and storeName/table mapping in DigitalMenuPage.tsx; qrToken submission in CustomerCartDrawer.tsx; discount payload alignment in CafeDashboardView.tsx.
- **Success criteria**: All 5 files updated cleanly; TypeScript compilation and Vite build pass with 0 errors.
- **Interface contracts**: e:\Personal-git\inventory-bill management system\PROJECT.md
- **Code layout**: apps/web/src/

## Key Decisions Made
- Extracted HMAC token from `table.qrCodeToken` or parsed from `table.qrCodeUrl` to ensure printed standees contain valid tokens even if backend hasn't populated `table.qrCodeToken`.
- Introduced `CafeDashboardRoute` component using `useNavigate()` from `react-router-dom` to replace `window.location.assign` calls without causing full-page reloads.
- Updated `DigitalMenuPage` query params and fallback display names to match backend `/public/cafe/{businessId}/menu` payload schema.
- Added `qrToken` in `CustomerCartDrawer` order payload to prevent FastAPI 422 Unprocessable Entity errors.
- Added `discountType` ('FIXED') and `discountValue` alongside `discountAmount` in `settleTableSession` call.

## Artifact Index
- `.agents/teamwork/worker_m3/DISPATCH.md` — Dispatch requirements
- `.agents/teamwork/worker_m3/BRIEFING.md` — Situational awareness
- `.agents/teamwork/worker_m3/progress.md` — Liveness and progress
- `.agents/teamwork/worker_m3/handoff.md` — Final handoff report

## Change Tracker
- **Files modified**:
  - `apps/web/src/App.tsx`: Added `/cafe` to cashier and lock guards; added `CafeDashboardRoute` with React Router SPA `navigate()`.
  - `apps/web/src/views/TableManagementView.tsx`: Extracted token from `qrCodeToken` or parsed from `qrCodeUrl`.
  - `apps/web/src/customer/DigitalMenuPage.tsx`: Passed `tableId` to menu API query params; mapped `storeName` and `table.label`.
  - `apps/web/src/customer/CustomerCartDrawer.tsx`: Included `qrToken` in order submission payload.
  - `apps/web/src/views/CafeDashboardView.tsx`: Included `discountType` and `discountValue` in `settleTableSession`.
- **Build status**: `npm --prefix apps/web run build` passed with exit code 0.
- **Pending issues**: None

## Quality Status
- **Build/test result**: Passed (Exit code 0, 0 TypeScript errors, Vite bundle generated in 17.60s)
- **Lint status**: Clean
- **Tests added/modified**: Full frontend production typecheck & build passing

## Loaded Skills
- None
