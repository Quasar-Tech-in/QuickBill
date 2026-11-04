# Reviewer M4_2: Café Persona Frontend Wiring, Route Guards, Standees & Schemas — Handoff Report

## Review Summary

**Verdict**: **APPROVE**  
**Role**: Reviewer & Adversarial Critic  
**Working Directory**: `e:\Personal-git\inventory-bill management system\.agents\teamwork\reviewer_m4_2`  
**Milestone**: M4 (Comprehensive Verification & Regression Hardening)

---

## 1. Observation

Direct, empirical observations and command outputs collected during independent review execution:

### 1.1 Frontend Production Build
- **Command**:
  ```powershell
  npm --prefix apps/web run build
  ```
- **Exit Code**: `0`
- **Output**:
  ```
  npm notice run quickbill-web@1.0.0 build
  npm notice run tsc && vite build
  vite v5.4.21 building for production...
  transforming...
  ✓ 1852 modules transformed.
  rendering chunks...
  computing gzip size...
  dist/index.html                     1.09 kB │ gzip:   0.61 kB
  dist/assets/index-Ba2w7ea6.css     58.78 kB │ gzip:  11.02 kB
  dist/assets/index-DMnVemE6.js   1,802.50 kB │ gzip: 429.09 kB
  ✓ built in 31.62s
  ```
- **Verification**: Zero compilation, TypeScript, or asset bundling errors across all 1852 modules.

### 1.2 Frontend Empirical AST & Behavioral Suite
- **Command**:
  ```powershell
  node apps/web/scripts/verify_m3_empirical.js
  ```
- **Exit Code**: `0`
- **Output**:
  ```
  ================================================================
  --- STARTING EMPIRICAL AST & BEHAVIORAL VERIFICATION: M3 ---
  ================================================================

  --- GROUP 1: App.tsx Routing & Guards ---
  [PASS] Test 1: AST: allowedCashierPaths contains /cafe
  [PASS] Test 2: AST: lockedPaths contains /cafe for store suspension lockout
  [PASS] Test 3: AST: CafeDashboardRoute component defined with React Router useNavigate
  [PASS] Test 4: AST: Route for /cafe/dashboard uses CafeDashboardRoute
  [PASS] Test 5: Behavior: Cashier route access guard logic emulation
  [PASS] Test 6: Behavior: Suspended store lockout guard includes /cafe routes

  --- GROUP 2: TableManagementView.tsx QR Standees ---
  [PASS] Test 7: AST: handleOpenStandee extracts token from qrCodeToken and qrCodeUrl fallback
  [PASS] Test 8: Behavior: QR URL derivation with relative qrCodeUrl and HMAC token

  --- GROUP 3: DigitalMenuPage.tsx Customer Menu ---
  [PASS] Test 9: AST: fetchMenu passes tableId query parameter to public cafe menu API
  [PASS] Test 10: AST: tenantName fallback handles storeName and tenantName
  [PASS] Test 11: AST: tableName resolution handles table.label, tableNumber, and tableId
  [PASS] Test 12: Behavior: Name and Table resolution matrix under various API responses

  --- GROUP 4: CustomerCartDrawer.tsx Order Placement ---
  [PASS] Test 13: AST: payload includes qrToken and token fields
  [PASS] Test 14: Behavior: Order submission payload compatibility with backend PublicOrderSubmitRequest

  --- GROUP 5: CafeDashboardView.tsx Settle Table Session ---
  [PASS] Test 15: AST: handleConfirmSettle includes discountAmount, discountType, and discountValue
  [PASS] Test 16: Behavior: Table settlement discount calculations and backend TableSettleRequest alignment

  --- GROUP 6: Regression & Cross-Check ---
  [PASS] Test 17: Behavior: CafeDashboardView navigation delegates to onNavigate when provided

  --- GROUP 7: Adversarial Stress Testing ---
  [PASS] Test 18: Adversarial: Cashier path guard rejects prefix spoofing attacks
  [PASS] Test 19: Adversarial: Standee QR token extracts correctly from complex query strings
  [PASS] Test 20: Adversarial: DigitalMenuPage fallback eliminates "undefined" and "null" in all corner cases
  [PASS] Test 21: Adversarial: Customer cart order submission sanitizes whitespace-only strings
  [PASS] Test 22: Adversarial: Table settlement discounts bounds check prevents zero/negative discount types

  ================================================================
  --- ALL 22 / 22 EMPIRICAL TESTS PASSED SUCCESSFULLY! ---
  ================================================================
  ```

### 1.3 Backend Schemas & Wiring Check
- **Command**:
  ```powershell
  & "apps/api/.venv/Scripts/python.exe" apps/api/tests/verify_cafe_m1_wiring.py
  ```
- **Exit Code**: `0`
- **Output Summary**:
  - `PublicOrderSubmitRequest`: Accepts `qrToken`, `token`, `qr_token`; rejects missing token & empty items.
  - `TableResponse`: Serializes `qrCodeToken`, dumps `_id`, `businessId`, `tableNumber`, `qrCodeToken`.
  - `TableSettleRequest`: Accepts `discountAmount`, `discountType`, `discountValue`; fallback handles fixed/percentage logic.
  - `TenantSettings`: Accepts `RETAIL`, `CAFE`, `HYBRID`; rejects invalid personas.
  - Total: 34 passed, 0 failed.

### 1.4 Backend Automated Pytest Suite
- **Command**:
  ```powershell
  & "apps/api/.venv/Scripts/python.exe" -m pytest apps/api/tests/test_persona_rbac.py apps/api/tests/test_cafe_mvp.py -v
  ```
- **Exit Code**: `0`
- **Output**: 13 passed, 0 failed in 10.94s.

### 1.5 Code Inspection Findings
1. **`apps/web/src/App.tsx`**:
   - Lines 40–46: `getDefaultPathForRole` redirects users with `store.isCafePersona()` to `/cafe/dashboard`.
   - Lines 169–175: `lockedPaths` includes `/cafe`, redirecting suspended/expired tenants to `/dashboard`.
   - Lines 177–182: `allowedCashierPaths` includes `/cafe`, ensuring cashiers can access cafe operational views while rejecting unprivileged routes.
   - Lines 491–503: `CafeDashboardRoute` component encapsulates navigation using React Router `useNavigate` instead of `window.location.assign`.
   - Lines 596–604: Dedicated routes for `/cafe/dashboard`, `/cafe` (redirect), `/cafe/tables`, `/cafe/orders/incoming`, and `/cafe/kitchen`.
2. **`apps/web/src/views/TableManagementView.tsx`**:
   - Lines 157–179: `handleOpenStandee` resolves QR token via `table.qrCodeToken || (table.qrCodeUrl ? new URL(table.qrCodeUrl, window.location.origin).searchParams.get('token') : '')`.
   - Lines 600–686: 4x6 / A6 standee tent card modal formatted with `no-print` controls, crisp QR rendering (`QRCode.toDataURL`), table badge, tenant name, and diner scan instructions.
3. **`apps/web/src/customer/DigitalMenuPage.tsx`**:
   - Lines 49–52: `fetchMenu` passes `tableId` query parameter (`params: { tableId: tableId, token: token || undefined }`) to public cafe menu API.
   - Lines 230–232: Name resolution fallbacks: `storeName || tenantName || 'Café & Bistro'` and table label/number resolution without `undefined` string literals.
4. **`apps/web/src/customer/CustomerCartDrawer.tsx`**:
   - Lines 80–96: `handleSubmitOrder` sends both `qrToken` and `token` aliases to match backend `PublicOrderSubmitRequest`, trimming whitespace from customer notes, name, and phone.
5. **`apps/web/src/views/CafeDashboardView.tsx`**:
   - Lines 201–210: `handleConfirmSettle` calculates `discountAmount`, `discountType: discountVal > 0 ? 'FIXED' : undefined`, and `discountValue: discountVal > 0 ? discountVal : undefined`, aligning with backend `TableSettleRequest`.
6. **`apps/web/src/components/cafe/KOTPrintModal.tsx`**:
   - Lines 84–160: 80mm thermal KOT slip printing template rendering table name/number, round number, server, timestamp, item variants, line instructions, and total items.
7. **`apps/web/src/views/SettingsView.tsx` & `SuperAdminView.tsx`**:
   - `SettingsView.tsx`: Verified 0 occurrences of persona configuration toggles.
   - `SuperAdminView.tsx`: Lines 1750–1803 (New Tenant Modal) and Lines 2320–2378 (Edit Tenant Modal) feature full 3-button persona selection (`RETAIL`, `CAFE`, `HYBRID`).

---

## 2. Logic Chain

1. **Acceptance Criteria Verification**:
   - **AC1 & AC2 (Persona Toggle Location & Removal)**: Directly observed in `SuperAdminView.tsx` (present) and `SettingsView.tsx` (completely absent). Tested via grep and manual code inspection.
   - **AC3 (Backend Non-SuperAdmin Rejection)**: `apps/api/tests/test_persona_rbac.py` tests 1–4 passed with HTTP 403 Forbidden.
   - **AC4 (Super Admin Persona Assignment)**: `test_superadmin_can_assign_all_personas` and `test_superadmin_create_tenant_with_persona` passed with HTTP 200/201.
   - **AC5 (Café Persona Routes & Views)**: `App.tsx` routes build cleanly with 0 TypeScript errors and render valid React Router components.
   - **AC6 (Printing Templates, Chits & Standees)**: Verified `KOTPrintModal.tsx` thermal template, `TableManagementView.tsx` tent card standee, `DigitalMenuPage.tsx` table parameter passing, and `CafeDashboardView.tsx` settlement calculations.
   - **AC7 (Pass All Test Suites)**: All 4 test suites (`npm run build`, `verify_m3_empirical.js`, `verify_cafe_m1_wiring.py`, `pytest`) passed with exit code 0.

2. **Integrity Audit**:
   - Checked for hardcoded expected outputs or dummy mocks in source code: **None found**.
   - Checked for bypassed validation logic or fake test suites: `verify_m3_empirical.js` directly parses the TypeScript AST using the compiler API and asserts structural code properties and runtime behavioral algorithms.

---

## 3. Adversarial Review & Stress Testing

| Attack Scenario / Hypothesis | Stress Test Method | Expected Behavior | Actual Behavior | Result |
|---|---|---|---|---|
| **Cashier Path Spoofing**: Attacker requests `/cafeteria` or `/cafe_admin` to bypass cashier guard | Path prefix parsing in `checkCashierAllowed` | Reject unauthorized prefixes; redirect to `/pos` | Guard checks `p === path \|\| path.startsWith(p + '/')`; unauthorized prefixes return `false` | **PASS** |
| **Malformed Standee QR**: Table record has complex query parameters or url-encoded characters | `deriveStandeeUrl` with multi-param query strings | Extract token cleanly without corrupting target URL | URL parser correctly extracts `token` param and preserves encoded characters | **PASS** |
| **Missing / Null Menu Metadata**: Diner visits menu URL with null/empty table/store names | `resolveNames` under corner cases (null, empty strings, 0) | Gracefully fallback to default names without `"undefined"` or `"null"` strings | Falls back to `'Café & Bistro'` and `'Table #' + tableId` | **PASS** |
| **Customer Input Injection / Whitespace**: Diner sends whitespace-only customerName or notes | `sanitizeCustomerFields` | Sanitize to `undefined` so backend optional validators do not store empty strings | Trims and converts whitespace-only strings to `undefined` | **PASS** |
| **Settlement Negative / Zero Discount**: Edge case with 0% or negative discount input | `computeSettlePayload` | Omit `discountType` and `discountValue` when discount <= 0 | Correctly sets `undefined` for both fields, preventing invalid discount records | **PASS** |
| **Suspended Store Bypass**: User attempts to access cafe operations during store suspension | `isPathLocked` guard | Block access to `/cafe/*` and redirect to `/dashboard` | Guard locks `/cafe` paths and redirects to `/dashboard` | **PASS** |

---

## 4. Caveats

No caveats. All automated test suites, production builds, and manual code inspections completed cleanly in standard sandbox mode (`BypassSandbox=false`).

---

## 5. Conclusion

Milestone 4 Café persona frontend wiring, route guards, standees, and schemas satisfy all acceptance criteria specified in `ORIGINAL_REQUEST.md` and `DISPATCH.md`. The implementation is robust, defensive, well-tested, and free of integrity violations.

**Verdict**: **APPROVE**

---

## 6. Verification Method

To independently reproduce this verification:

1. **Frontend Production Build**:
   ```powershell
   npm --prefix apps/web run build
   ```
   *Expected*: Exit code 0, 1852 modules transformed.

2. **Frontend Empirical AST & Behavioral Suite**:
   ```powershell
   node apps/web/scripts/verify_m3_empirical.js
   ```
   *Expected*: Exit code 0, 22 passed, 0 failed.

3. **Backend Schemas & Contract Verification**:
   ```powershell
   & "apps/api/.venv/Scripts/python.exe" apps/api/tests/verify_cafe_m1_wiring.py
   ```
   *Expected*: Exit code 0, 34 passed, 0 failed.

4. **Backend Automated Pytest Suite**:
   ```powershell
   & "apps/api/.venv/Scripts/python.exe" -m pytest apps/api/tests/test_persona_rbac.py apps/api/tests/test_cafe_mvp.py -v
   ```
   *Expected*: Exit code 0, 13 passed, 0 failed.
