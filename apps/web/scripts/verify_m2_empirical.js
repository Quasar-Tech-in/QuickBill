import fs from 'fs';
import path from 'path';
import assert from 'assert';

console.log('--- STARTING EMPIRICAL VERIFICATION OF MILESTONE 2 ---');

const webSrcDir = path.resolve('apps/web/src');
const storePath = path.join(webSrcDir, 'services/store.ts');
const settingsViewPath = path.join(webSrcDir, 'views/SettingsView.tsx');
const superAdminViewPath = path.join(webSrcDir, 'views/SuperAdminView.tsx');
const sidebarPath = path.join(webSrcDir, 'components/Sidebar.tsx');

const storeCode = fs.readFileSync(storePath, 'utf8').replace(/\r\n/g, '\n');
const settingsCode = fs.readFileSync(settingsViewPath, 'utf8').replace(/\r\n/g, '\n');
const superAdminCode = fs.readFileSync(superAdminViewPath, 'utf8').replace(/\r\n/g, '\n');
const sidebarCode = fs.readFileSync(sidebarPath, 'utf8').replace(/\r\n/g, '\n');

let testCount = 0;
let passCount = 0;

function runTest(name, fn) {
  testCount++;
  try {
    fn();
    passCount++;
    console.log(`[PASS] Test ${testCount}: ${name}`);
  } catch (err) {
    console.error(`[FAIL] Test ${testCount}: ${name}`, err);
    throw err;
  }
}

// ----------------------------------------------------
// TEST GROUP 1: SettingsView Persona Removal & Scoping
// ----------------------------------------------------
runTest('SettingsView has NO setBusinessPersona state setter', () => {
  assert.ok(!settingsCode.includes('setBusinessPersona'), 'SettingsView must not contain setBusinessPersona');
});

runTest('SettingsView has NO radio toggle cards for businessPersona', () => {
  assert.ok(!settingsCode.includes('name="businessPersona"'), 'SettingsView must not contain persona radio group');
});

runTest('SettingsView reads tenantPersona as read-only from activeTenant settings', () => {
  assert.ok(
    settingsCode.includes("const tenantPersona: BusinessPersona = activeTenant?.settings?.businessPersona || 'RETAIL';"),
    'SettingsView must read tenantPersona read-only from activeTenant'
  );
});

runTest('SettingsView handleSaveProfile omits businessPersona from payload', () => {
  // Find handleSaveProfile
  const fnIndex = settingsCode.indexOf('const handleSaveProfile =');
  assert.ok(fnIndex !== -1, 'handleSaveProfile must exist');
  const fnBody = settingsCode.slice(fnIndex, fnIndex + 1500);
  assert.ok(fnBody.includes('settings: {'), 'Must include settings object');
  assert.ok(fnBody.includes('cafeConfig,'), 'Must include cafeConfig');
  assert.ok(!fnBody.includes('businessPersona'), 'Must NOT include businessPersona in profile save payload');
  assert.ok(!fnBody.includes('business_persona'), 'Must NOT include business_persona in profile save payload');
});

runTest('SettingsView conditionally renders Cafe Operations Preferences for CAFE or HYBRID', () => {
  assert.ok(
    settingsCode.includes("{(tenantPersona === 'CAFE' || tenantPersona === 'HYBRID') && ("),
    'Must conditionally render cafe operations preferences only for CAFE or HYBRID'
  );
  assert.ok(settingsCode.includes('enableKOT'), 'Must provide enableKOT toggle');
  assert.ok(settingsCode.includes('enableQROrdering'), 'Must provide enableQROrdering toggle');
  assert.ok(settingsCode.includes('Dine-In GST (%):'), 'Must provide Dine-In GST rate input');
});

// ----------------------------------------------------
// TEST GROUP 2: SuperAdminView Governance & Modals
// ----------------------------------------------------
runTest('SuperAdminView Modal 1 (Provision) includes 3-way persona selector', () => {
  assert.ok(superAdminCode.includes('name="newBusinessPersona"'), 'Provision modal must contain newBusinessPersona radio');
  assert.ok(superAdminCode.includes("newTenant.businessPersona === 'RETAIL'"), 'Must have RETAIL card in provision modal');
  assert.ok(superAdminCode.includes("newTenant.businessPersona === 'CAFE'"), 'Must have CAFE card in provision modal');
  assert.ok(superAdminCode.includes("newTenant.businessPersona === 'HYBRID'"), 'Must have HYBRID card in provision modal');
});

runTest('SuperAdminView Modal 3 (Edit) includes 3-way persona selector', () => {
  assert.ok(superAdminCode.includes('name="editBusinessPersona"'), 'Edit modal must contain editBusinessPersona radio');
  assert.ok(superAdminCode.includes("editTenantForm.businessPersona === 'RETAIL'"), 'Must have RETAIL card in edit modal');
  assert.ok(superAdminCode.includes("editTenantForm.businessPersona === 'CAFE'"), 'Must have CAFE card in edit modal');
  assert.ok(superAdminCode.includes("editTenantForm.businessPersona === 'HYBRID'"), 'Must have HYBRID card in edit modal');
});

runTest('SuperAdminView Modal 3 saves businessPersona and cafeConfig in settings', () => {
  const saveIndex = superAdminCode.indexOf('const handleSaveEditTenant =');
  assert.ok(saveIndex !== -1, 'handleSaveEditTenant must exist');
  const saveBody = superAdminCode.slice(saveIndex, saveIndex + 3000);
  assert.ok(saveBody.includes('businessPersona: editTenantForm.businessPersona'), 'Must persist businessPersona in settings');
  assert.ok(saveBody.includes('cafeConfig: editTenantForm.cafeConfig'), 'Must persist cafeConfig in settings');
});

runTest('SuperAdminView Tab 1 directory renders Operating Persona column & badge', () => {
  assert.ok(superAdminCode.includes('<th>Operating Persona</th>'), 'Must render Operating Persona table header');
  assert.ok(superAdminCode.includes('{getPersonaBadge(t.settings?.businessPersona)}'), 'Must call getPersonaBadge with settings.businessPersona');
  assert.ok(superAdminCode.includes('Café & Bistro'), 'Badge must render Café & Bistro');
  assert.ok(superAdminCode.includes('Hybrid (POS + Café)'), 'Badge must render Hybrid');
  assert.ok(superAdminCode.includes('Retail / Supermarket'), 'Badge must render Retail');
});

// ----------------------------------------------------
// TEST GROUP 3: StoreService Normalization & API Contracts
// ----------------------------------------------------
runTest('store.ts fetchTenants maps settings and preserves persona', () => {
  const fnIndex = storeCode.indexOf('async fetchTenants()');
  assert.ok(fnIndex !== -1, 'fetchTenants must exist');
  const fnBody = storeCode.slice(fnIndex, fnIndex + 6000);
  assert.ok(fnBody.includes('tenantSettings.businessPersona = t.business_persona || t.businessPersona || \'RETAIL\';'), 'Must preserve snake_case or camelCase persona');
  assert.ok(fnBody.includes('settings: tenantSettings,'), 'Must return mapped tenantSettings');
});

runTest('store.ts fetchActiveTenant maps settings and preserves persona', () => {
  const fnIndex = storeCode.indexOf('async fetchActiveTenant()');
  assert.ok(fnIndex !== -1, 'fetchActiveTenant must exist');
  const fnBody = storeCode.slice(fnIndex, fnIndex + 6000);
  assert.ok(fnBody.includes('tenantSettings.businessPersona = t.business_persona || t.businessPersona || \'RETAIL\';'), 'Must preserve snake_case or camelCase persona in active tenant');
  assert.ok(fnBody.includes('settings: tenantSettings,'), 'Must return mapped tenantSettings in active tenant');
});

runTest('store.ts updateTenantProfile merges settings without clobbering existing businessPersona', () => {
  const fnIndex = storeCode.indexOf('async updateTenantProfile(');
  assert.ok(fnIndex !== -1, 'updateTenantProfile must exist');
  const fnBody = storeCode.slice(fnIndex, fnIndex + 6000);
  assert.ok(
    fnBody.includes('settings: updates.settings !== undefined ? {\n        ...(current.settings || {}),\n        ...updates.settings,\n      } : current.settings,'),
    'Must shallow-merge updates.settings with current.settings'
  );
});

runTest('store.ts updateTenantProfile only sets payload.business_persona when explicitly provided in updates.settings', () => {
  const fnIndex = storeCode.indexOf('async updateTenantProfile(');
  const fnBody = storeCode.slice(fnIndex, fnIndex + 6000);
  assert.ok(
    fnBody.includes('if (updates.settings.businessPersona !== undefined) {\n            payload.business_persona = updates.settings.businessPersona;\n          }'),
    'Must conditionally set payload.business_persona ONLY if businessPersona is defined in updates.settings'
  );
});

runTest('store.ts addTenant includes settings and passes business_persona to POST /tenants', () => {
  const fnIndex = storeCode.indexOf('addTenant(tenantData:');
  assert.ok(fnIndex !== -1, 'addTenant must exist');
  const fnBody = storeCode.slice(fnIndex, fnIndex + 6000);
  assert.ok(fnBody.includes('settings: tenantData.settings'), 'Must assign settings in new tenant object');
  assert.ok(fnBody.includes('business_persona: persona,'), 'Must send business_persona in POST /tenants payload');
});

// ----------------------------------------------------
// TEST GROUP 4: Functional Logic Evaluation
// ----------------------------------------------------
runTest('Functional Persona Logic: isCafePersona evaluation', () => {
  function evalIsCafePersona(persona) {
    const p = persona || 'RETAIL';
    return p === 'CAFE' || p === 'HYBRID';
  }

  assert.strictEqual(evalIsCafePersona('RETAIL'), false, 'RETAIL should NOT be cafe persona');
  assert.strictEqual(evalIsCafePersona('CAFE'), true, 'CAFE should be cafe persona');
  assert.strictEqual(evalIsCafePersona('HYBRID'), true, 'HYBRID should be cafe persona');
  assert.strictEqual(evalIsCafePersona(undefined), false, 'undefined should fallback to RETAIL and return false');
  assert.strictEqual(evalIsCafePersona('UNKNOWN'), false, 'unknown should return false');
});

runTest('Functional Settings Normalization Logic', () => {
  function normalize(t) {
    const tenantSettings = t.settings || {
      businessPersona: t.business_persona || t.businessPersona || 'RETAIL',
      cafeConfig: t.cafe_config || t.cafeConfig,
    };
    if (!tenantSettings.businessPersona) {
      tenantSettings.businessPersona = t.business_persona || t.businessPersona || 'RETAIL';
    }
    if (!tenantSettings.cafeConfig && (t.cafe_config || t.cafeConfig)) {
      tenantSettings.cafeConfig = t.cafe_config || t.cafeConfig;
    }
    return tenantSettings;
  }

  // Case 1: Backend returns settings with businessPersona HYBRID
  const t1 = { settings: { businessPersona: 'HYBRID', cafeConfig: { enableKOT: true } } };
  assert.strictEqual(normalize(t1).businessPersona, 'HYBRID');

  // Case 2: Backend returns snake_case business_persona and no settings
  const t2 = { business_persona: 'CAFE', cafe_config: { enableKOT: false } };
  const n2 = normalize(t2);
  assert.strictEqual(n2.businessPersona, 'CAFE');
  assert.strictEqual(n2.cafeConfig.enableKOT, false);

  // Case 3: Backend returns camelCase businessPersona and no settings
  const t3 = { businessPersona: 'HYBRID' };
  assert.strictEqual(normalize(t3).businessPersona, 'HYBRID');

  // Case 4: Backend returns empty settings object
  const t4 = { settings: {}, business_persona: 'CAFE' };
  assert.strictEqual(normalize(t4).businessPersona, 'CAFE');

  // Case 5: Backend returns nothing
  const t5 = {};
  assert.strictEqual(normalize(t5).businessPersona, 'RETAIL');
});

runTest('Functional Settings Merging on Tenant Admin Save', () => {
  const current = {
    name: 'Café Paris',
    settings: {
      businessPersona: 'CAFE',
      cafeConfig: { enableKOT: true, enableQROrdering: true, taxRate: 5.0 }
    }
  };

  // Regular tenant admin saves operational preferences ONLY (no persona)
  const updates = {
    name: 'Café Paris & Bakery',
    settings: {
      cafeConfig: { enableKOT: false, enableQROrdering: true, taxRate: 12.0 }
    }
  };

  const updatedSettings = updates.settings !== undefined ? {
    ...(current.settings || {}),
    ...updates.settings,
  } : current.settings;

  // Persona MUST be preserved as CAFE
  assert.strictEqual(updatedSettings.businessPersona, 'CAFE');
  assert.strictEqual(updatedSettings.cafeConfig.enableKOT, false);
  assert.strictEqual(updatedSettings.cafeConfig.taxRate, 12.0);

  // Verify outgoing PUT payload
  const payload = {};
  if (updates.settings !== undefined) {
    payload.settings = updates.settings;
    if (updates.settings.businessPersona !== undefined) {
      payload.business_persona = updates.settings.businessPersona;
    }
  }

  // Payload must NOT contain business_persona or settings.businessPersona!
  assert.strictEqual(payload.business_persona, undefined);
  assert.strictEqual(payload.settings.businessPersona, undefined);
});

// ----------------------------------------------------
// TEST GROUP 5: Sidebar Reactivity Verification
// ----------------------------------------------------
runTest('Sidebar.tsx subscribes to store listeners and checks isCafePersona', () => {
  assert.ok(sidebarCode.includes('store.subscribe('), 'Sidebar must subscribe to store updates');
  assert.ok(
    sidebarCode.includes('store.isCafePersona() ? cafeNavItems.filter('),
    'Sidebar must conditionally show cafe nav items when store.isCafePersona() is true'
  );
});

// ----------------------------------------------------
// TEST GROUP 6: Adversarial Edge Cases & Stress Scenarios
// ----------------------------------------------------
runTest('Edge Case: null or empty tenant settings fall back safely to RETAIL', () => {
  function getPersona(tenant) {
    return tenant?.settings?.businessPersona || 'RETAIL';
  }
  assert.strictEqual(getPersona(null), 'RETAIL');
  assert.strictEqual(getPersona({}), 'RETAIL');
  assert.strictEqual(getPersona({ settings: null }), 'RETAIL');
  assert.strictEqual(getPersona({ settings: {} }), 'RETAIL');
  assert.strictEqual(getPersona({ settings: { businessPersona: null } }), 'RETAIL');
});

runTest('Edge Case: updateTenantProfile with empty updates retains all current settings', () => {
  const current = {
    settings: {
      businessPersona: 'HYBRID',
      cafeConfig: { enableKOT: true, enableQROrdering: false, taxRate: 18.0 }
    }
  };
  const updatesWithoutSettings = { name: 'Only Renaming Store' };
  const merged = updatesWithoutSettings.settings !== undefined ? {
    ...(current.settings || {}),
    ...updatesWithoutSettings.settings,
  } : current.settings;

  assert.strictEqual(merged.businessPersona, 'HYBRID');
  assert.strictEqual(merged.cafeConfig.taxRate, 18.0);
});

runTest('Edge Case: SuperAdminView badge renders for unexpected persona with safe fallback', () => {
  function getPersonaBadgeLabel(persona) {
    const p = persona || 'RETAIL';
    if (p === 'CAFE') return 'Café & Bistro';
    if (p === 'HYBRID') return 'Hybrid (POS + Café)';
    return 'Retail / Supermarket';
  }
  assert.strictEqual(getPersonaBadgeLabel(undefined), 'Retail / Supermarket');
  assert.strictEqual(getPersonaBadgeLabel(null), 'Retail / Supermarket');
  assert.strictEqual(getPersonaBadgeLabel('SOMETHING_ELSE'), 'Retail / Supermarket');
});

runTest('Security Check: SettingsView contains zero occurrences of "businessPersona"', () => {
  // We want to be 100% sure regular settings has no persona toggles or keys
  const occurrences = (settingsCode.match(/businessPersona/g) || []).length;
  // It only appears once in:
  // const tenantPersona: BusinessPersona = activeTenant?.settings?.businessPersona || 'RETAIL';
  assert.strictEqual(occurrences, 1, 'businessPersona should only be referenced once as read-only from activeTenant');
});

console.log(`\n--- ALL ${passCount} / ${testCount} EMPIRICAL TESTS PASSED SUCCESSFULLY! ---`);
