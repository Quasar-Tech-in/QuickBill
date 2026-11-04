# Investigation & Handoff Report: Frontend Business Persona Management

**Explorer**: Explorer 1 (survey)  
**Date**: 2026-10-31  
**Working Directory**: `e:\Personal-git\inventory-bill management system\.agents\teamwork\explorer_survey_1`  
**Target Areas**: `apps/web/src/views/SettingsView.tsx`, `apps/web/src/views/SuperAdminView.tsx`, `apps/web/src/services/store.ts`, `apps/web/src/types/index.ts`, `apps/web/src/components/Sidebar.tsx`, `apps/web/src/App.tsx`.

---

## 1. Observations

### 1.1. Current Persona Configuration in Regular Tenant Store Settings (`SettingsView.tsx`)
- **File**: `apps/web/src/views/SettingsView.tsx`
  - **Imports (Line 41)**:
    ```tsx
    import { User, StoreLocation, UserRole, Tenant, BusinessPersona, CafeConfig } from '../types';
    ```
  - **State Initialization (Lines 152–164)**:
    ```tsx
    const [businessPersona, setBusinessPersona] = useState<BusinessPersona>(
      activeTenant?.settings?.businessPersona || 'RETAIL'
    );
    const [cafeConfig, setCafeConfig] = useState<CafeConfig>(
      activeTenant?.settings?.cafeConfig || {
        enableKOT: true,
        enableQROrdering: true,
        allowCustomerOrdering: true,
        autoAcceptOrders: false,
        taxRate: 5.0,
        serviceChargeRate: 0.0,
      }
    );
    ```
  - **Save Profile Handler (Lines 617–620, 631–635)**:
    ```tsx
    await store.updateTenantProfile({
      name: profileName.trim(),
      gstin: profileGstin.trim(),
      phone: profilePhone.trim(),
      email: profileEmail.trim().toLowerCase(),
      address: profileAddress.trim(),
      currency: profileCurrency.trim(),
      logoUrl: profileLogoUrl.trim(),
      tagline: profileTagline.trim(),
      receiptFooterNote: profileReceiptFooter.trim(),
      settings: {
        businessPersona,
        cafeConfig,
      },
    });
    ```
  - **Rendered Persona Toggle Cards (Lines 1216–1352)**:
    Located inside `activeTab === 'profile'` form.
    Renders an "Operating Persona & Business Mode" section offering two clickable cards:
    1. **Retail Mode Card**: `setBusinessPersona('RETAIL')` (Lines 1240–1270)
    2. **Cafe Mode Card**: `setBusinessPersona('CAFE')` (Lines 1272–1305)
    3. **Cafe Specific Toggles (Lines 1308–1351)**: Rendered conditionally when `businessPersona === 'CAFE'` for `enableKOT`, `enableQROrdering`, and `taxRate`.
    *Note*: `HYBRID` mode is completely missing from `SettingsView.tsx`! Regular tenant admins currently have unilateral ability to switch their business persona between Retail and Cafe directly from their store settings.

### 1.2. Tenant Management & Store Details in `SuperAdminView.tsx`
- **File**: `apps/web/src/views/SuperAdminView.tsx`
  - **Access & Role Guards (Lines 54–73, `App.tsx:42, 102`)**:
    Accessible exclusively to users where `currentUser.role === 'SUPER_ADMIN'` at route `/superadmin`. Non-superadmin users are redirected away.
  - **Tenant Directory Table (Lines 756–1005)**:
    Renders all tenants from `store.getTenants()`.
    Columns: `Store / Business`, `Plan & License`, `Users Quota`, `Branches Quota`, `Database Isolation`, `Monthly GMV`, `Status`, `Governance Actions`.
    *Observation*: The directory table currently has **no column or badge** indicating which business persona (`RETAIL`, `CAFE`, `HYBRID`) each store is configured with.
  - **Modal 3: Edit Store Profile (Lines 2014–2196)**:
    - Triggered by `openEditTenantModal(t)` (Lines 397–425) on clicking the `<Edit3 />` action icon (Line 978).
    - Form State (`editTenantForm`, Lines 124–135):
      ```tsx
      const [editTenantForm, setEditTenantForm] = useState({
        name: '',
        adminEmail: '',
        phone: '',
        gstin: '',
        address: '',
        status: 'ACTIVE' as 'ACTIVE' | 'SUSPENDED',
        plan: 'PROFESSIONAL' as PlanTier,
        isolationMode: 'SHARED' as 'SHARED' | 'DEDICATED_DATABASE' | 'CUSTOM_CLUSTER',
        mongodbUri: '',
        databaseName: 'quickbill_main_db',
      });
      ```
    - Save Handler (`handleSaveEditTenant`, Lines 452–487):
      Sends `name`, `email`, `phone`, `gstin`, `address`, `status`, `plan`, `databaseConfig`.
    - Dirty State Checking (`isEditTenantDirty`, Lines 427–442):
      Compares serialized form state against `initialEditTenantSnapshot`.
    *Observation*: `SuperAdminView` currently has **no state, no input fields, and no logic** for viewing or modifying `businessPersona` or `cafeConfig`.
  - **Modal 1: Provision New Store (Lines 1530–1845)**:
    Form state `newTenant` (Lines 91–107) and handler `handleCreateTenant` (Lines 249–295) provision a new store but do not specify or allow selecting `businessPersona`.

### 1.3. Persona State Lifecycle Across Frontend Services & Components
- **Types Definition (`apps/web/src/types/index.ts`)**:
  - Line 379: `export type BusinessPersona = 'RETAIL' | 'CAFE' | 'HYBRID';`
  - Line 381–395: `export interface CafeConfig { ... }`
  - Line 397–404: `export interface TenantSettings { businessPersona?: BusinessPersona; cafeConfig?: CafeConfig; ... }`
  - Line 376: `Tenant.settings?: TenantSettings;`
- **Store Service (`apps/web/src/services/store.ts`)**:
  - Line 5092–5094:
    ```tsx
    getBusinessPersona(): BusinessPersona {
      return this.currentTenant?.settings?.businessPersona || 'RETAIL';
    }
    ```
  - Line 5096–5099:
    ```tsx
    isCafePersona(): boolean {
      const p = this.getBusinessPersona();
      return p === 'CAFE' || p === 'HYBRID';
    }
    ```
  - Line 5101–5111:
    ```tsx
    async updateBusinessPersona(persona: BusinessPersona, cafeConfig?: any): Promise<void> {
      const active = this.getActiveTenant();
      const newSettings = {
        ...active.settings,
        businessPersona: persona,
        cafeConfig: cafeConfig || active.settings?.cafeConfig,
      };
      await this.updateTenantProfile({
        settings: newSettings,
      });
    }
    ```
  - Line 1320–1389 (`updateTenantProfile`):
    Sends `PUT /tenants/${targetId}` with:
    ```ts
    settings: updates.settings,
    business_persona: updates.settings?.businessPersona,
    cafe_config: updates.settings?.cafeConfig,
    ```
  - **Critical Data Normalization Gap Found in `store.ts`**:
    - Lines 1123–1167 (`fetchTenants`): The mapper drops `t.settings` and `t.business_persona` from the constructed Tenant model!
    - Lines 1189–1233 (`fetchActiveTenant`): The mapper also omits `settings` from `normalizedTenant`!
    Because of this, when `fetchTenants()` or `fetchActiveTenant()` is invoked after updating a tenant, `this.tenants` and `this.currentTenant` lose their `settings` in memory, defaulting `getBusinessPersona()` back to `'RETAIL'`!
- **Component Subscriptions & Reactivity**:
  - `apps/web/src/components/Sidebar.tsx` (Lines 243–249):
    ```tsx
    const navItems: NavItem[] = isSuperAdmin 
      ? superAdminNavItems 
      : [
          ...(store.isCafePersona() ? cafeNavItems.filter(item => item.roles?.includes(userRole)) : []),
          ...tenantNavItems.filter(item => item.roles?.includes(userRole))
        ];
    ```
    Dynamically mounts Café views (`/cafe/dashboard`, `/cafe/orders/incoming`, `/cafe/kitchen`, `/cafe/tables`) whenever `store.isCafePersona()` is true.
  - `apps/web/src/App.tsx` (Line 43):
    Redirects to `/cafe/dashboard` if `store.isCafePersona()` returns true.
  - Listener Mechanism: `store.subscribe(listener)` triggers re-render in `AppLayout` via tick state (`setTick(t => t + 1)` in `App.tsx:68`).

### 1.4. Current Testing Suite Status
- **Build Status**:
  Verified via `npm --prefix apps/web run build` (`tsc && vite build`):
  - **Result**: Exit code 0 (1,852 modules transformed cleanly, 0 TypeScript errors).
- **Frontend Automated Tests**:
  - `apps/web/package.json` contains only `dev`, `build`, and `preview` scripts.
  - There are currently **no** Vitest / Jest test suites or `*.test.tsx` test files inside `apps/web`.
- **Backend Test Suite Reference**:
  - `apps/api/tests/test_cafe_mvp.py` (Lines 53–78): Currently tests that a regular Tenant Admin can update `businessPersona` to `CAFE` via `PUT /api/v1/tenants/{TENANT_A}`. Once Super Admin RBAC is enforced, non-superadmin attempts must yield 403 Forbidden.

---

## 2. Logic Chain

1. **RBAC Isolation Need**:
   Under the business requirements, tenant business persona (`RETAIL`, `CAFE`, `HYBRID`) determines license scope, database features, and available interfaces. Regular tenant admins must not be able to switch personas arbitrarily.
2. **SettingsView Removal**:
   In `SettingsView.tsx`, lines 1216–1352 contain the UI toggle. Lines 617–620 include `businessPersona` in `handleSaveProfile`. Removing lines 1216–1306 and removing `businessPersona` from the save payload ensures regular users have neither the UI affordance nor the network payload to alter their persona.
3. **SuperAdminView Integration**:
   Super Admins are responsible for tenant onboarding and management. Placing the persona configuration in `SuperAdminView.tsx` within:
   - Tab 1 Table: A visual persona badge (`Retail 🛒`, `Café ☕`, `Hybrid 🍽️`) for each store.
   - Modal 3 (`Edit Store Profile`): Persona selector cards for `RETAIL`, `CAFE`, and `HYBRID`, with cafe options when applicable.
   - Modal 1 (`Provision New Store`): Persona selection at creation time.
   This provides full Super Admin governance.
4. **State Persistence Fix**:
   In `store.ts`, fixing `fetchTenants()` and `fetchActiveTenant()` to preserve `settings` guarantees that when a Super Admin saves a persona update, the updated persona survives refresh and refetch without falling back to `'RETAIL'`.
5. **Testing Architecture**:
   To ensure stability, frontend tests should be added to verify persona isolation, SuperAdmin editing, and reactive sidebar rendering, while backend tests verify 403 Forbidden for non-superadmin users.

---

## 3. Caveats

- **Operational Café Settings vs. Business Persona**:
  A distinction must be maintained between *Business Persona* (`RETAIL`, `CAFE`, `HYBRID`, restricted exclusively to Super Admin) and *Operational Café Settings* (e.g., KOT printing toggle, QR ordering toggle, dine-in GST rate). If a tenant is already assigned `CAFE` or `HYBRID` by a Super Admin, tenant admins can still be permitted to configure operational preferences (like tax rates or printer chits) without being allowed to change the persona itself.
- **Backend RBAC Synchronization**:
  The backend endpoint `PUT /tenants/{tenant_id}` currently permits non-superadmin tenant admins to update `business_persona`. Backend RBAC enforcement must be deployed in tandem so non-superadmin requests attempting to pass `business_persona` return 403 Forbidden.

---

## 4. Conclusion & Actionable Implementation Plan

### 4.1. Implementation in `apps/web/src/views/SettingsView.tsx`
1. **Remove Persona State**:
   - Remove `const [businessPersona, setBusinessPersona] = useState<BusinessPersona>(...)` (lines 152–154).
   - Read persona as a read-only variable from tenant context:
     ```tsx
     const tenantPersona: BusinessPersona = activeTenant?.settings?.businessPersona || 'RETAIL';
     ```
2. **Sanitize `handleSaveProfile` Payload**:
   - Update lines 617–620 and 631–635 so `businessPersona` is omitted from `settings`:
     ```tsx
     settings: {
       cafeConfig,
     }
     ```
3. **Remove Persona Toggle UI**:
   - Remove lines 1216–1306 (the "Operating Persona & Business Mode" header and the Retail / Cafe radio cards).
   - If `tenantPersona === 'CAFE' || tenantPersona === 'HYBRID'`, keep the operational cafe settings (KOT, QR ordering, dine-in GST) inside a clean, read-only-labeled "Café Operations Preferences" card.

### 4.2. Implementation in `apps/web/src/views/SuperAdminView.tsx`
1. **Enhance `editTenantForm` & Dirty Tracking**:
   - Add `businessPersona: BusinessPersona` and `cafeConfig: CafeConfig` to `editTenantForm` (lines 124–135).
   - In `openEditTenantModal(t)` (lines 397–425), extract:
     ```tsx
     businessPersona: t.settings?.businessPersona || 'RETAIL',
     cafeConfig: t.settings?.cafeConfig || { enableKOT: true, enableQROrdering: true, taxRate: 5.0 },
     ```
   - In `initialEditTenantSnapshot` and `isEditTenantDirty` (lines 427–442), include `businessPersona` and `cafeConfig`.
2. **Wire Save Handler (`handleSaveEditTenant`)**:
   - In lines 468–482, include `settings`:
     ```tsx
     settings: {
       ...selectedTenant.settings,
       businessPersona: editTenantForm.businessPersona,
       cafeConfig: editTenantForm.cafeConfig,
     }
     ```
3. **Add Persona Selector to Modal 3 (`Edit Store Profile`)**:
   - Add a 3-way selector for `RETAIL`, `CAFE`, and `HYBRID`:
     - **RETAIL**: Retail & Supermarket POS (Barcode, multi-counter, stock inventory).
     - **CAFE**: Café & Dine-In Bistro (Tables, KOT, diner QR ordering).
     - **HYBRID**: Hybrid Retail & Dine-In (Omnichannel counter + table service).
   - When `CAFE` or `HYBRID` is selected, include toggles for initial cafe configuration (`enableKOT`, `enableQROrdering`, `taxRate`).
4. **Add Persona Selector to Modal 1 (`Provision New Store`)**:
   - Add `businessPersona` to `newTenant` state and render persona selection options so new stores can be provisioned directly into their target persona.
5. **Add Persona Badges to Tenant Directory Table (Tab 1)**:
   - Add an Operating Persona column/badge in the tenant list:
     - `RETAIL` ➔ `<span className="badge badge-info">🛒 Retail POS</span>`
     - `CAFE` ➔ `<span className="badge badge-success">☕ Café Bistro</span>`
     - `HYBRID` ➔ `<span className="badge badge-purple">🍽️ Hybrid (POS + Café)</span>`

### 4.3. Fix State Mapping in `apps/web/src/services/store.ts`
1. **In `fetchTenants()` (Lines 1123–1167)**:
   - Map `settings` from `t.settings` or fallback to `{ businessPersona: t.business_persona || 'RETAIL', cafeConfig: t.cafe_config }`.
2. **In `fetchActiveTenant()` (Lines 1189–1233)**:
   - Map `settings` into `normalizedTenant`.
3. **In `addTenant()` (Lines 1653–1727)**:
   - Allow passing `settings?: TenantSettings` and forward `business_persona` to `apiClient.post('/tenants')`.

### 4.4. Frontend Test Plan
1. **Component Unit / Integration Tests**:
   - **`SettingsView.test.tsx`**:
     - Verify that no persona selection radios (`RETAIL`, `CAFE`, `HYBRID`) are rendered in `SettingsView`.
     - Verify that submitting store profile updates does not send `businessPersona` in the request body.
     - Verify that if store is assigned `CAFE`, operational cafe toggles (KOT, QR) are rendered without the persona switcher.
   - **`SuperAdminView.test.tsx`**:
     - Verify that the tenant directory renders the correct persona badge for `RETAIL`, `CAFE`, and `HYBRID` stores.
     - Verify that clicking "Edit Store Profile" displays the persona selector with all three options (`RETAIL`, `CAFE`, `HYBRID`).
     - Verify that changing persona marks form dirty and triggers `store.updateTenantProfile()` with updated `businessPersona`.
   - **`SidebarReactivity.test.tsx`**:
     - Verify that when tenant persona is `RETAIL`, Café navigation items are not displayed.
     - Verify that when tenant persona is changed to `CAFE` or `HYBRID`, Café navigation items (`/cafe/dashboard`, `/cafe/orders/incoming`, `/cafe/kitchen`, `/cafe/tables`) immediately appear in the sidebar.

---

## 5. Verification Method

1. **TypeScript Type Check & Bundling**:
   ```bash
   npm --prefix apps/web run build
   ```
   Must succeed with 0 errors (`tsc && vite build`).
2. **Manual Inspection Points**:
   - `apps/web/src/views/SettingsView.tsx`: Verify lines 1216–1306 are removed, and `businessPersona` is not included in `handleSaveProfile`.
   - `apps/web/src/views/SuperAdminView.tsx`: Verify `editTenantForm` includes `businessPersona`, Modal 3 renders all three persona options, and Tab 1 displays persona badges.
   - `apps/web/src/services/store.ts`: Verify `fetchTenants` and `fetchActiveTenant` preserve `settings.businessPersona`.
3. **Backend Integration Verification**:
   - Run backend test suite:
     ```bash
     cd apps/api && pytest tests/test_multi_tenant_isolation.py tests/test_cafe_mvp.py
     ```
   - Invalidate if a non-superadmin user is able to update `businessPersona` via frontend or API.
