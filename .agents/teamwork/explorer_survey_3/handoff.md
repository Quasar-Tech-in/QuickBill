# End-to-End Café Persona Audit & Architecture Survey Report

**Agent**: Explorer 3 (Survey)  
**Date**: 2026-10-31  
**Scope**: Café & Hybrid Persona End-to-End Investigation (Frontend Routes, Views, Components, Printing Templates, QR Standees, Backend APIs, Schemas, RBAC Enforcement, and Test Gaps)  
**Target File**: `.agents/teamwork/explorer_survey_3/handoff.md`  

---

## 1. Observation

### 1.1 Frontend Routing, Navigation & Access Guards

1. **Cashier Route Lockout on Café Views (`apps/web/src/App.tsx:177-182`)**:
   In `AppLayout`, the role-based route guard restricts cashiers:
   ```typescript
   if (role === 'CASHIER') {
     const allowedCashierPaths = ['/pos', '/invoices', '/transactions', '/parties', '/ledger'];
     const isAllowed = allowedCashierPaths.some(p => path === p || path.startsWith(p + '/'));
     if (!isAllowed) {
       navigate('/pos', { replace: true });
     }
   }
   ```
   **Observation**: Café paths (`/cafe/dashboard`, `/cafe/tables`, `/cafe/orders/incoming`, `/cafe/kitchen`) are **absent** from `allowedCashierPaths`.
   However, in `App.tsx:43`:
   ```typescript
   const getDefaultPathForRole = (user: User | null): string => {
     if (!user) return '/login';
     if (user.role === 'SUPER_ADMIN') return '/superadmin';
     if (store.isCafePersona()) return '/cafe/dashboard';
     if (user.role === 'CASHIER') return '/pos';
     return '/dashboard';
   };
   ```
   And in `apps/web/src/components/Sidebar.tsx:137-170`, Cashiers are granted access to:
   - `/cafe/dashboard` ("Floor & Tables", roles: `['TENANT_ADMIN', 'MANAGER', 'CASHIER']`)
   - `/cafe/orders/incoming` ("Incoming Orders", roles: `['TENANT_ADMIN', 'MANAGER', 'CASHIER']`)
   - `/cafe/kitchen` ("Kitchen KDS", roles: `['TENANT_ADMIN', 'MANAGER', 'CASHIER']`)
   **Runtime Behavior**: When a cashier logs into a Café persona store, `getDefaultPathForRole` returns `/cafe/dashboard`. Upon rendering, `AppLayout`'s route guard intercepts the route, flags `/cafe/dashboard` as disallowed, and forcibly redirects the cashier to `/pos`. Any click on Café sidebar links by a Cashier results in an immediate boot back to `/pos`.

2. **Full Page Reload on Café Tab Navigation (`apps/web/src/App.tsx:586-590`)**:
   ```typescript
   <CafeDashboardView 
     onNavigate={(tab) => {
       if (tab === 'cafe-incoming') window.location.assign('/cafe/orders/incoming');
       else if (tab === 'cafe-kitchen') window.location.assign('/cafe/kitchen');
       else if (tab === 'cafe-tables') window.location.assign('/cafe/tables');
     }}
     onViewInvoice={(inv) => setViewingInvoice(inv)} 
   />
   ```
   **Observation**: Uses `window.location.assign(...)` instead of React Router's SPA `navigate(...)`, causing an unnecessary full-page document reload, tearing down memory state and WebSocket/polling connections.

3. **Store Suspension / Expiration Guard Missing Café Routes (`apps/web/src/App.tsx:169-175`)**:
   ```typescript
   if (!isSuperAdmin && store.isStoreLocked()) {
     const lockedPaths = ['/pos', '/inventory', '/purchase-orders', '/parties', '/ledger'];
     if (lockedPaths.some(p => path === p || path.startsWith(p + '/'))) {
       navigate('/dashboard', { replace: true });
       return;
     }
   }
   ```
   **Observation**: If a tenant's license expires or the store is suspended, `/cafe` routes (`/cafe/dashboard`, `/cafe/tables`, etc.) are not in `lockedPaths`, allowing operations to continue even while regular POS is locked out.

4. **Default Dashboard Route Routing (`apps/web/src/App.tsx:469-489` and `MobileBottomNav.tsx:79-86`)**:
   When navigating to `/dashboard`, `DashboardRoute` renders `DashboardView` (Retail inventory/sales widgets) instead of checking `store.isCafePersona()`. Similarly, `MobileBottomNav` hardcodes tabs to `POS`, `Items`, `Invoices`, and `Dashboard`, with no awareness of the Café persona's table floor plan or incoming order queues.

---

### 1.2 QR Standee Generation & Printing Wiring

1. **Undefined QR Token in Standee URL (`apps/web/src/views/TableManagementView.tsx:157-176`)**:
   ```typescript
   const handleOpenStandee = async (table: CafeTable) => {
     setPreviewTable(table);
     const tenantSlug = activeTenant?.id || 'demo';
     const baseUrl = window.location.origin;
     const url = `${baseUrl}/order/${tenantSlug}/${table.id}?token=${encodeURIComponent(table.qrCodeToken || '')}`;
     ...
     const dataUrl = await QRCode.toDataURL(url, ...);
     setQrDataUrl(dataUrl);
   };
   ```
   **Observation**:
   - `table.qrCodeToken` is accessed, but backend `TableResponse` (`apps/api/app/schemas/cafe.py:41-54`) does **not** declare or serialize `qrCodeToken` or `qr_code_token`.
   - In MongoDB (`apps/api/app/services/cafe_session_service.py:100`), the token is saved under `qrCodeSecret`, not `qrCodeToken`.
   - The backend `create_table` method computes:
     `qr_url = f"/order/{business_id}/{str(table_oid)}?token={token}"`
     and sets `qrCodeUrl`.
   - Consequently, `table.qrCodeToken` on the frontend is always `undefined`.
   - The generated QR image contains `.../order/{tenantSlug}/{table.id}?token=`.
   - When scanned, the query parameter `token` is empty, leading to verification failure when diner orders are submitted.

2. **Tent Card Standee Print Layout (`apps/web/src/views/TableManagementView.tsx:557-713`)**:
   - Visual structure: 4x6 / A6 tent card design with coffee icon, café branding, upper-case table label badge, dashed container for 220x220 QR code, customer scan instructions, and section note.
   - Print trigger: `handlePrintStandee` calls `window.print()`.
   - Print CSS rule in `apps/web/src/index.css:2932-3000`:
     `.modal-overlay` is styled as `position: static !important; width: 100% !important; background: transparent;`.
     Controls bar has `.no-print`, but `#printable-kot` and standee modals lack print media isolation `@page { size: auto; }` specifications for thermal or card sizes.

---

### 1.3 Customer Digital Menu & Cart Submission Wiring

1. **Missing `tableId` in Public Menu Request (`apps/web/src/customer/DigitalMenuPage.tsx:49-51`)**:
   ```typescript
   const res = await axios.get(`${API_BASE_URL}/public/cafe/${businessId}/menu`, {
     params: { token: token || undefined }
   });
   ```
   **Observation**:
   - Backend `GET /public/cafe/{business_slug}/menu` (`apps/api/app/api/v1/cafe_public.py:23-28`) takes:
     `table_id: Optional[str] = Query(None, alias="tableId")`, `token: Optional[str] = Query(None)`
   - `DigitalMenuPage.tsx` fails to pass `tableId: tableId` in query params.
   - Backend sets `table_info = None` because `table_id` is null.
   - Response field `table` is therefore `None`.

2. **Schema Property Mismatch in Digital Menu Response (`apps/web/src/customer/DigitalMenuPage.tsx:230-232` vs `apps/api/app/api/v1/cafe_public.py:100-106`)**:
   - Backend returns:
     ```python
     return {
         "storeName": tenant.get("name", "QuickBill Café"),
         "storeLogo": tenant.get("logoUrl"),
         "table": table_info,
         "categories": sorted(list(cats)),
         "items": cleaned_items
     }
     ```
   - Frontend expects:
     ```typescript
     const tenantName = menuData?.tenantName || 'Café & Bistro';
     const tableName = menuData?.tableName || `Table #${menuData?.tableNumber || tableId}`;
     ```
   - Discrepancies:
     - `menuData.storeName` vs `menuData.tenantName`
     - `menuData.table.label` / `tableNumber` vs top-level `menuData.tableName` / `menuData.tableNumber`.

3. **CRITICAL: Customer Cart Order Submission Field Name Mismatch (`apps/web/src/customer/CustomerCartDrawer.tsx:80-97` vs `apps/api/app/schemas/cafe.py:66-73`)**:
   - Frontend payload:
     ```typescript
     const payload = {
       businessId,
       tableId,
       token: token || undefined,
       customerName: customerName.trim() || undefined,
       customerPhone: customerPhone.trim() || undefined,
       notes: generalNotes.trim() || undefined,
       items: cartItems.map(c => ({
         itemId: c.item.id,
         itemName: c.item.name,
         quantity: c.quantity,
         variantName: c.variantName || undefined,
         notes: c.notes.trim() || undefined,
         unitPrice: c.item.salePrice || c.item.unitPrice || 0,
       })),
     };
     const res = await axios.post(`${API_BASE_URL}/public/cafe/orders`, payload);
     ```
   - Backend Pydantic schema:
     ```python
     class PublicOrderSubmitRequest(BaseSchema):
         table_id: str = Field(..., alias="tableId")
         qr_token: str = Field(..., alias="qrToken")
         customer_name: Optional[str] = Field(None, alias="customerName")
         customer_phone: Optional[str] = Field(None, alias="customerPhone")
         items: List[PublicOrderItem] = Field(..., min_length=1)
         notes: Optional[str] = None
     ```
   - **Observation**:
     - Backend requires field `qrToken` (`qr_token`), which is a required string without a default.
     - Frontend sends `token`.
     - When a customer submits an order, FastAPI / Pydantic rejects the request with HTTP **422 Unprocessable Entity**:
       `{"detail": [{"loc": ["body", "qrToken"], "msg": "Field required", "type": "missing"}]}`.
     - Customer mobile ordering is broken end-to-end as a result.

---

### 1.4 Kitchen Order Ticket (KOT) Printing & Settlement

1. **KOT Printing Modal Structure (`apps/web/src/components/cafe/KOTPrintModal.tsx`)**:
   - Formatted as an 80mm thermal receipt with dashed separators, uppercase `*** KITCHEN ORDER TICKET ***`, Table name, KOT number, Round number, Server name, Timestamp, line items with variant and kitchen instructions (`* Instruction: ...`), total item count, and `--- END OF TICKET ---`.
   - Wired properly to `KOT` and ad-hoc KOT chit schemas.
   - Print button calls `window.print()`.

2. **Table Settlement Payload Mismatch (`apps/web/src/views/CafeDashboardView.tsx:202-208` vs `apps/api/app/schemas/cafe.py:124-131`)**:
   - Frontend sends:
     ```typescript
     const res = await store.settleTableSession(settleSession.id, {
       paymentMode,
       paymentRef: paymentRef.trim() || undefined,
       customerName: customerName.trim() || undefined,
       customerPhone: customerPhone.trim() || undefined,
       discountAmount: discountVal,
     });
     ```
   - Backend schema:
     ```python
     class TableSettleRequest(BaseSchema):
         payment_mode: str = Field(default="CASH", alias="paymentMode")
         paid_amount: Optional[float] = Field(None, alias="paidAmount")
         discount_type: Optional[str] = Field(None, alias="discountType")
         discount_value: Optional[float] = Field(None, alias="discountValue")
         customer_name: Optional[str] = Field(None, alias="customerName")
         customer_phone: Optional[str] = Field(None, alias="customerPhone")
         notes: Optional[str] = None
     ```
   - **Observation**: Frontend provides `discountAmount`, whereas backend expects `discountType` and `discountValue`. The discount is ignored during backend settlement (`SaleService.create_sale`), resulting in bills settled without the intended table discount.

---

### 1.5 Persona Configuration & RBAC Audit

1. **Settings View Persona Toggle Location (`apps/web/src/views/SettingsView.tsx:1238-1350`)**:
   - `SettingsView.tsx` exposes the business persona selection radio cards (`RETAIL` vs `CAFE`) to regular store users (`TENANT_ADMIN`).
   - The `HYBRID` option is completely missing from `SettingsView.tsx`.
   - `SuperAdminView.tsx` has zero persona options or toggles.

2. **Backend API RBAC Missing Super Admin Persona Guard (`apps/api/app/api/v1/tenants.py:450-517`)**:
   ```python
   @router.put("/{tenant_id}")
   async def update_tenant_profile(
       tenant_id: str,
       req: TenantUpdateRequest,
       user: TokenPayload = Depends(get_current_user)
   ):
       if not is_tenant_admin(user):
           raise HTTPException(
               status_code=status.HTTP_403_FORBIDDEN,
               detail="Only Store Administrators or Super Admins can update the business profile."
           )
       ...
       if req.business_persona is not None:
           update_data["settings.businessPersona"] = req.business_persona.strip().upper()
       if req.cafe_config is not None:
           update_data["settings.cafeConfig"] = req.cafe_config
       if req.settings is not None:
           for k, v in req.settings.items():
               update_data[f"settings.{k}"] = v
   ```
   **Observation**: Any user with `TENANT_ADMIN` role can update `business_persona` and `cafe_config`. There is no check verifying `is_super_admin(user)` for `business_persona` modifications.

---

### 1.6 Existing Tests & Test Suite Run Results

1. **Backend Pytest Execution (`apps/api/tests/test_cafe_mvp.py`)**:
   - Command: `& "e:\Personal-git\inventory-bill management system\apps\api\.venv\Scripts\pytest.exe" apps\api\tests\test_cafe_mvp.py` (with BypassSandbox: true).
   - Result: `4 passed, 3 warnings in 3.37s`.
   - Existing tests:
     - `test_tenant_persona_configuration`: Verifies `TENANT_ADMIN` can PUT `businessPersona: "CAFE"` (asserts status 200). Note: This test directly relies on the behavior that Requirement R1 orders us to forbid!
     - `test_table_crud_and_tenant_isolation`: Table CRUD, uniqueness conflict, tenant isolation.
     - `test_qr_token_signing_and_validation`: HMAC verification and tamper prevention.
     - `test_public_menu_and_customer_ordering_flow`: End-to-end API test with mock diner order using `qrToken` (which passed in API tests because test used `qrToken`, hiding the frontend's `token` bug).

2. **Frontend Build Verification (`apps/web`)**:
   - Command: `npm run build` (`tsc && vite build`).
   - Result: Built in 14.31s with **0 TypeScript errors**.

---

## 2. Logic Chain

```
Observation 1.1.1 (AppLayout cashier guard)
  ↳ allowedCashierPaths = ['/pos', '/invoices', '/transactions', '/parties', '/ledger']
  ↳ Cafe routes are not included in allowedCashierPaths
  ↳ Inference: Cashier clicking any Cafe tab in sidebar is forcefully navigated to /pos
  ↳ Bug: Cafe cashiers cannot view tables, incoming orders, or kitchen display.

Observation 1.2.1 (TableManagementView Standee) + Observation 1.1 (cafe.py TableResponse)
  ↳ TableManagementView constructs QR URL with table.qrCodeToken
  ↳ TableResponse schema does NOT declare qrCodeToken (stored as qrCodeSecret in MongoDB)
  ↳ Inference: table.qrCodeToken is undefined, resulting in "?token=" in printed QR standees
  ↳ Bug: Standee QR codes are printed without authentic HMAC tokens.

Observation 1.3.1 (DigitalMenuPage) + Observation 1.3.3 (CustomerCartDrawer) + Observation 1.1 (cafe.py)
  ↳ DigitalMenuPage does not send tableId query parameter to /public/cafe/{businessSlug}/menu
  ↳ Backend returns table = null
  ↳ CustomerCartDrawer submits order payload with { token } instead of { qrToken }
  ↳ Backend PublicOrderSubmitRequest requires qrToken (Field(..., alias="qrToken"))
  ↳ Inference: Backend rejects customer cart submission with HTTP 422 Unprocessable Entity
  ↳ Bug: Customer self-ordering fails upon placing order.

Observation 1.4.2 (CafeDashboardView settle) + Observation 1.1 (cafe.py TableSettleRequest)
  ↳ Frontend sends { discountAmount: discountVal }
  ↳ Backend schema expects { discountType, discountValue }
  ↳ Inference: Backend ignores discountAmount, so discounts are omitted from final settled invoice.

Observation 1.5.1 (SettingsView.tsx) + Observation 1.5.2 (tenants.py update_tenant_profile)
  ↳ Persona toggle is exposed in tenant SettingsView.tsx (only RETAIL and CAFE; HYBRID missing)
  ↳ SuperAdminView has no persona toggle
  ↳ Backend PUT /tenants/{tenant_id} allows any TENANT_ADMIN to modify businessPersona
  ↳ Direct Violation of Requirement R1: Persona toggle must be exclusive to Super Admin.
```

---

## 3. Caveats

1. **Hardware POS Printers**: Thermal printing in `KOTPrintModal` and `InvoicePrintModal` currently triggers the browser's native `window.print()` dialog. Physical network ESC/POS thermal printers (raw 9100 socket / USB thermal printer daemon) are not implemented; they rely on browser print drivers or print spoolers.
2. **React Native Mobile Codebase**: `apps/mobile` currently contains no Café-specific screens or persona switches. All Café dine-in workflows currently live in `apps/web` (responsive web app for staff and responsive digital menu for diners).

---

## 4. Conclusion & Actionable Proposals

### 4.1 Required Frontend Fixes

1. **`apps/web/src/App.tsx`**:
   - In `AppLayout` (lines 177-182), add `/cafe` to `allowedCashierPaths`:
     ```typescript
     const allowedCashierPaths = ['/pos', '/invoices', '/transactions', '/parties', '/ledger', '/cafe'];
     ```
   - In `CafeDashboardView` `onNavigate` (lines 586-590), replace `window.location.assign(...)` with React Router's `navigate(...)`.
   - In store suspension check (lines 169-175), include `'/cafe'` in `lockedPaths`.

2. **`apps/web/src/views/SettingsView.tsx`**:
   - Completely remove the Operating Persona & Business Mode section (lines 1228-1350) and state variables `businessPersona` / `setBusinessPersona`.

3. **`apps/web/src/views/SuperAdminView.tsx`**:
   - Add the Business Persona selector (`RETAIL`, `CAFE`, `HYBRID`) inside the Tenant Edit Drawer / Store Details modal.
   - Wire the selection to update the tenant's `businessPersona` and `cafeConfig`.

4. **`apps/web/src/views/TableManagementView.tsx`**:
   - In `handleOpenStandee` (line 161), ensure URL uses `table.qrCodeUrl` directly if present, or extract/pass the valid token:
     ```typescript
     const token = table.qrCodeToken || (table.qrCodeUrl ? new URL(table.qrCodeUrl, window.location.origin).searchParams.get('token') : '');
     const url = table.qrCodeUrl 
       ? `${baseUrl}${table.qrCodeUrl}`
       : `${baseUrl}/order/${tenantSlug}/${table.id}?token=${encodeURIComponent(token || '')}`;
     ```

5. **`apps/web/src/customer/DigitalMenuPage.tsx`**:
   - In line 49, pass `tableId`:
     ```typescript
     const res = await axios.get(`${API_BASE_URL}/public/cafe/${businessId}/menu`, {
       params: { tableId, token: token || undefined }
     });
     ```
   - Map `storeName` and `table.label` / `table.tableNumber` correctly:
     ```typescript
     const tenantName = menuData?.storeName || menuData?.tenantName || 'Café & Bistro';
     const tableName = menuData?.table?.label || (menuData?.table?.tableNumber ? `Table ${menuData.table.tableNumber}` : `Table #${tableId}`);
     ```

6. **`apps/web/src/customer/CustomerCartDrawer.tsx`**:
   - In lines 80-97, send `qrToken: token || undefined` in addition to `token`:
     ```typescript
     const payload = {
       businessId,
       tableId,
       qrToken: token || '',
       token: token || undefined,
       ...
     ```

7. **`apps/web/src/views/CafeDashboardView.tsx`**:
   - In lines 202-208, align settlement discount parameters with `TableSettleRequest`:
     ```typescript
     const res = await store.settleTableSession(settleSession.id, {
       paymentMode,
       paymentRef: paymentRef.trim() || undefined,
       customerName: customerName.trim() || undefined,
       customerPhone: customerPhone.trim() || undefined,
       discountType: discountPercent > 0 ? 'PERCENTAGE' : undefined,
       discountValue: discountPercent > 0 ? discountPercent : undefined,
     });
     ```

---

### 4.2 Required Backend Fixes

1. **`apps/api/app/api/v1/tenants.py`**:
   - In `update_tenant_profile`, reject non-superadmin users if `req.business_persona` is supplied or if `settings.businessPersona` is present in `req.settings`:
     ```python
     if req.business_persona is not None or (req.settings and "businessPersona" in req.settings):
         if not is_super_admin(user):
             raise HTTPException(
                 status_code=status.HTTP_403_FORBIDDEN,
                 detail="Only Super Admin accounts are authorized to modify business persona."
             )
     ```
   - Validate that persona value is one of `{"RETAIL", "CAFE", "HYBRID"}`.

2. **`apps/api/app/schemas/cafe.py`**:
   - In `TableResponse`, add:
     ```python
     qr_code_token: Optional[str] = Field(None, alias="qrCodeToken")
     ```
   - In `PublicOrderSubmitRequest`, accept both `qr_token` and `token`:
     ```python
     qr_token: str = Field(..., alias="qrToken")
     
     @model_validator(mode="before")
     @classmethod
     def normalize_qr_token(cls, values):
         if isinstance(values, dict) and "qrToken" not in values and "token" in values:
             values["qrToken"] = values["token"]
         return values
     ```
   - In `TableSettleRequest`, accept `discount_amount: Optional[float] = Field(None, alias="discountAmount")` and handle it gracefully.

3. **`apps/api/app/services/cafe_session_service.py`**:
   - In `list_tables` and `create_table`, populate `qrCodeToken`:
     ```python
     d["qrCodeToken"] = d.get("qrCodeSecret") or d.get("qrCodeToken")
     ```

---

### 4.3 Required Test Additions & Updates

1. **Update `apps/api/tests/test_cafe_mvp.py`**:
   - Update `test_tenant_persona_configuration`:
     - Assert that `TENANT_ADMIN` updating `businessPersona` receives HTTP **403 Forbidden**.
     - Assert that `SUPER_ADMIN` updating `businessPersona` to `CAFE`, `RETAIL`, and `HYBRID` succeeds (HTTP 200).
2. **Add New Tests**:
   - Test Super Admin RBAC enforcement on persona updates across all roles (`SUPER_ADMIN`, `TENANT_ADMIN`, `MANAGER`, `CASHIER`).
   - Test invalid persona rejection (HTTP 422/400 for `INVALID_PERSONA`).
   - Test `CustomerCartDrawer` order submission payload compatibility.
   - Test multi-round KOT numbering sequence (`KOT-001`, `KOT-002`).
   - Test table settlement with percentage and fixed discounts.

---

## 5. Verification Method

### 5.1 Verification Commands

1. **Backend Tests**:
   ```powershell
   & "e:\Personal-git\inventory-bill management system\apps\api\.venv\Scripts\pytest.exe" "e:\Personal-git\inventory-bill management system\apps\api\tests\test_cafe_mvp.py" -v
   ```
   *Expected*: All tests pass, including updated Super Admin RBAC tests.

2. **Frontend Typecheck & Build**:
   ```powershell
   cd "e:\Personal-git\inventory-bill management system\apps\web"
   npm run build
   ```
   *Expected*: TypeScript compilation (`tsc`) and Vite production bundle build succeed with 0 errors.

3. **Code Inspection**:
   - Inspect `apps/web/src/views/SettingsView.tsx`: verify persona toggle is completely removed.
   - Inspect `apps/web/src/views/SuperAdminView.tsx`: verify persona toggle exists for tenants.
   - Inspect `apps/web/src/App.tsx`: verify Cashier route guard allows `/cafe` paths.
   - Inspect `apps/web/src/customer/CustomerCartDrawer.tsx`: verify `qrToken` is sent.

### 5.2 Invalidation Conditions
- A `TENANT_ADMIN` is able to update `businessPersona` via PUT `/api/v1/tenants/{id}` without receiving 403 Forbidden.
- A Cashier user is booted to `/pos` when accessing `/cafe/dashboard` or `/cafe/orders/incoming`.
- A customer scanning a generated Table QR Standee receives 403 or 422 upon submitting an order.
