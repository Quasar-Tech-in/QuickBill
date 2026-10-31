## 2026-10-31T11:32:59Z
You are Worker M3 tasked with implementing Milestone 3: Café Persona End-to-End Audit & Wiring Fixes.

Original request file: e:\Personal-git\inventory-bill management system\.agents\teamwork\ORIGINAL_REQUEST.md
Working directory: e:\Personal-git\inventory-bill management system\.agents\teamwork\worker_m3
Project specification: e:\Personal-git\inventory-bill management system\PROJECT.md
Authoritative survey report to follow:
- e:\Personal-git\inventory-bill management system\.agents\teamwork\explorer_survey_3\handoff.md

Read ORIGINAL_REQUEST.md first.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Your exclusive write ownership:
- `apps/web/src/App.tsx`
- `apps/web/src/views/TableManagementView.tsx`
- `apps/web/src/customer/DigitalMenuPage.tsx`
- `apps/web/src/customer/CustomerCartDrawer.tsx`
- `apps/web/src/views/CafeDashboardView.tsx`
DO NOT edit any other files.

Requirements for Milestone 3:
1. `apps/web/src/App.tsx`:
   - In `AppLayout` (lines 177–182), add `'/cafe'` to `allowedCashierPaths` so cashiers can access floor tables, incoming orders, and kitchen display without being redirected to `/pos`.
   - In `CafeDashboardView` `onNavigate` (lines 586–590), replace `window.location.assign(...)` with React Router SPA `navigate(...)` (`navigate('/cafe/orders/incoming')`, `navigate('/cafe/kitchen')`, `navigate('/cafe/tables')`) to prevent full document reload tearing down state and polling connections.
   - In store suspension check (lines 169–175), include `'/cafe'` in `lockedPaths` so suspended/locked stores cannot operate café views while regular views are blocked.

2. `apps/web/src/views/TableManagementView.tsx`:
   - In `handleOpenStandee` (lines 157–176), ensure the generated QR code URL includes the authentic HMAC token:
     ```typescript
     const token = table.qrCodeToken || (table.qrCodeUrl ? new URL(table.qrCodeUrl, window.location.origin).searchParams.get('token') : '');
     const url = table.qrCodeUrl 
       ? `${baseUrl}${table.qrCodeUrl}`
       : `${baseUrl}/order/${tenantSlug}/${table.id}?token=${encodeURIComponent(token || '')}`;
     ```
     This fixes the empty `?token=` bug on printed table standees.

3. `apps/web/src/customer/DigitalMenuPage.tsx`:
   - Line 49: Pass `tableId: tableId` query parameter in `axios.get(`${API_BASE_URL}/public/cafe/${businessId}/menu`)` so backend receives `table_id` and populates the table response.
   - Lines 230–232: Map `tenantName = menuData?.storeName || menuData?.tenantName || 'Café & Bistro'` and table label/number properly.

4. `apps/web/src/customer/CustomerCartDrawer.tsx`:
   - Lines 80–97: Send `qrToken: token || ''` in addition to `token: token || undefined` in customer order submission payload to match backend `PublicOrderSubmitRequest`, preventing 422 Unprocessable Entity errors.

5. `apps/web/src/views/CafeDashboardView.tsx`:
   - Lines 202–208: In `store.settleTableSession`, pass `discountAmount: discountVal, discountType: discountVal > 0 ? 'FIXED' : undefined, discountValue: discountVal > 0 ? discountVal : undefined` so table discounts are recorded on settled sales.

6. Verification:
   - Run `npm --prefix apps/web run build` in sandboxed terminal (standard sandbox, do NOT use BypassSandbox=true).
   - Ensure exit code 0 and 0 TypeScript compilation errors.

Write a complete report to `e:\Personal-git\inventory-bill management system\.agents\teamwork\worker_m3\handoff.md`.
Include build outputs and line-number references.
When done, send a message to the orchestrator.
