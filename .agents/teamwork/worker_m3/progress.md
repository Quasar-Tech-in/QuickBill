# Progress - Worker M3

Last visited: 2026-10-31T11:42:30Z

## Status
Completed all Milestone 3 tasks and verified build passes cleanly.

## Completed
1. `apps/web/src/App.tsx`:
   - Added `'/cafe'` to `allowedCashierPaths` (lines 177-182) so cashiers can access floor tables, incoming orders, and kitchen display without being redirected to `/pos`.
   - Added `'/cafe'` to `lockedPaths` (lines 169-175) so suspended/locked stores cannot operate café views.
   - Introduced `CafeDashboardRoute` component using React Router SPA `navigate(...)` (`navigate('/cafe/orders/incoming')`, `navigate('/cafe/kitchen')`, `navigate('/cafe/tables')`) to prevent full document reload.
2. `apps/web/src/views/TableManagementView.tsx`:
   - Updated `handleOpenStandee` (lines 157-176) to extract HMAC token from `table.qrCodeToken` or parse it from `table.qrCodeUrl`, and prepend `baseUrl`, eliminating empty `?token=` on printed table standees.
3. `apps/web/src/customer/DigitalMenuPage.tsx`:
   - Passed `tableId: tableId` query parameter in `axios.get(`${API_BASE_URL}/public/cafe/${businessId}/menu`)` so backend receives `table_id` and returns `table_info`.
   - Mapped `tenantName = menuData?.storeName || menuData?.tenantName || 'Café & Bistro'` and table label/number properly.
4. `apps/web/src/customer/CustomerCartDrawer.tsx`:
   - Sent `qrToken: token || ''` in addition to `token: token || undefined` in customer order submission payload, matching backend `PublicOrderSubmitRequest`.
5. `apps/web/src/views/CafeDashboardView.tsx`:
   - In `store.settleTableSession`, passed `discountAmount: discountVal, discountType: discountVal > 0 ? 'FIXED' : undefined, discountValue: discountVal > 0 ? discountVal : undefined` so table discounts are recorded on settled sales.
6. Verification:
   - Executed `npm --prefix apps/web run build` in standard sandbox without BypassSandbox. Exit code 0, 0 TypeScript compilation errors.
