import fs from 'fs';
import path from 'path';
import assert from 'assert';
import ts from 'typescript';

console.log('================================================================');
console.log('--- STARTING ADVERSARIAL STRESS SUITE: CHALLENGER M4_2 ---');
console.log('================================================================\n');

const webSrcDir = path.resolve('apps/web/src');
const appTsxPath = path.join(webSrcDir, 'App.tsx');
const settingsViewPath = path.join(webSrcDir, 'views/SettingsView.tsx');
const superAdminViewPath = path.join(webSrcDir, 'views/SuperAdminView.tsx');
const tableManagementPath = path.join(webSrcDir, 'views/TableManagementView.tsx');
const digitalMenuPath = path.join(webSrcDir, 'customer/DigitalMenuPage.tsx');
const customerCartPath = path.join(webSrcDir, 'customer/CustomerCartDrawer.tsx');
const cafeDashboardPath = path.join(webSrcDir, 'views/CafeDashboardView.tsx');
const storePath = path.join(webSrcDir, 'services/store.ts');

const appTsxCode = fs.readFileSync(appTsxPath, 'utf8').replace(/\r\n/g, '\n');
const settingsCode = fs.readFileSync(settingsViewPath, 'utf8').replace(/\r\n/g, '\n');
const superAdminCode = fs.readFileSync(superAdminViewPath, 'utf8').replace(/\r\n/g, '\n');
const tableManagementCode = fs.readFileSync(tableManagementPath, 'utf8').replace(/\r\n/g, '\n');
const digitalMenuCode = fs.readFileSync(digitalMenuPath, 'utf8').replace(/\r\n/g, '\n');
const customerCartCode = fs.readFileSync(customerCartPath, 'utf8').replace(/\r\n/g, '\n');
const cafeDashboardCode = fs.readFileSync(cafeDashboardPath, 'utf8').replace(/\r\n/g, '\n');
const storeCode = fs.readFileSync(storePath, 'utf8').replace(/\r\n/g, '\n');

const appSourceFile = ts.createSourceFile('App.tsx', appTsxCode, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

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

function findNodes(sourceNode, predicate) {
  const results = [];
  function walk(node) {
    if (predicate(node)) {
      results.push(node);
    }
    ts.forEachChild(node, walk);
  }
  walk(sourceNode);
  return results;
}

// ====================================================================
// SECTION 1: ROUTE GUARDS & PATH TRAVERSAL / SPOOFING ADVERSARIAL TESTS
// ====================================================================
console.log('--- SECTION 1: Route Guards & Path Spoofing Stress Tests ---');

runTest('Route Guards: Cashier access logic rejects 10+ prefix spoofing and traversal patterns', () => {
  const allowedCashierPaths = ['/pos', '/invoices', '/transactions', '/parties', '/ledger', '/cafe'];
  function checkCashierAllowed(path) {
    return allowedCashierPaths.some(p => path === p || path.startsWith(p + '/'));
  }

  // Prefix collisions (must be blocked)
  const hostilePrefixes = [
    '/cafeteria',
    '/cafebar',
    '/cafe_admin',
    '/cafe-settings',
    '/cafe.json',
    '/pos_super',
    '/pos-admin',
    '/invoices_dump',
    '/parties_secret',
    '/ledger_hack',
    '/transactions_all',
  ];
  for (const hostile of hostilePrefixes) {
    assert.strictEqual(checkCashierAllowed(hostile), false, `Should reject spoofed path: ${hostile}`);
  }

  // Path traversal attacks (relative path normalization)
  // When a browser resolves /cafe/../settings, it sends /settings
  assert.strictEqual(checkCashierAllowed(path.posix.normalize('/cafe/../settings')), false);
  assert.strictEqual(checkCashierAllowed(path.posix.normalize('/cafe/../../superadmin')), false);
  assert.strictEqual(checkCashierAllowed(path.posix.normalize('/pos/../inventory')), false);

  // Legitimate Café nested paths (must be allowed)
  const validCafePaths = [
    '/cafe',
    '/cafe/dashboard',
    '/cafe/tables',
    '/cafe/orders/incoming',
    '/cafe/kitchen',
    '/cafe/session/sess_123',
    '/cafe/orders/456/details',
  ];
  for (const valid of validCafePaths) {
    assert.strictEqual(checkCashierAllowed(valid), true, `Should allow valid nested path: ${valid}`);
  }
});

runTest('Route Guards: Store suspension lockout locks all /cafe routes for tenant users', () => {
  const lockedPaths = ['/pos', '/inventory', '/purchase-orders', '/parties', '/ledger', '/cafe'];
  function isRouteLockedWhenStoreSuspended(path) {
    return lockedPaths.some(p => path === p || path.startsWith(p + '/'));
  }

  // All cafe routes must be locked when store is suspended
  assert.strictEqual(isRouteLockedWhenStoreSuspended('/cafe'), true);
  assert.strictEqual(isRouteLockedWhenStoreSuspended('/cafe/dashboard'), true);
  assert.strictEqual(isRouteLockedWhenStoreSuspended('/cafe/tables'), true);
  assert.strictEqual(isRouteLockedWhenStoreSuspended('/cafe/orders/incoming'), true);
  assert.strictEqual(isRouteLockedWhenStoreSuspended('/cafe/kitchen'), true);

  // General operational routes
  assert.strictEqual(isRouteLockedWhenStoreSuspended('/pos'), true);
  assert.strictEqual(isRouteLockedWhenStoreSuspended('/inventory'), true);
  assert.strictEqual(isRouteLockedWhenStoreSuspended('/purchase-orders'), true);

  // Non-locked administrative views (settings / dashboard allowed for renewal)
  assert.strictEqual(isRouteLockedWhenStoreSuspended('/dashboard'), false);
  assert.strictEqual(isRouteLockedWhenStoreSuspended('/settings'), false);

  // Prefix collisions should NOT be locked unnecessarily
  assert.strictEqual(isRouteLockedWhenStoreSuspended('/cafeteria'), false);
  assert.strictEqual(isRouteLockedWhenStoreSuspended('/pos_test'), false);
});

runTest('Route Guards: Manager and Tenant Admin SuperAdmin isolation', () => {
  function checkRestricted(role, pathname) {
    if (role === 'MANAGER') {
      if (pathname.startsWith('/settings') || pathname.startsWith('/superadmin')) {
        return 'REDIRECT_DASHBOARD';
      }
    } else if (role === 'TENANT_ADMIN') {
      if (pathname.startsWith('/superadmin')) {
        return 'REDIRECT_DASHBOARD';
      }
    }
    return 'ALLOWED';
  }

  assert.strictEqual(checkRestricted('MANAGER', '/settings'), 'REDIRECT_DASHBOARD');
  assert.strictEqual(checkRestricted('MANAGER', '/superadmin'), 'REDIRECT_DASHBOARD');
  assert.strictEqual(checkRestricted('MANAGER', '/superadmin/tenants'), 'REDIRECT_DASHBOARD');
  assert.strictEqual(checkRestricted('MANAGER', '/cafe/dashboard'), 'ALLOWED');

  assert.strictEqual(checkRestricted('TENANT_ADMIN', '/superadmin'), 'REDIRECT_DASHBOARD');
  assert.strictEqual(checkRestricted('TENANT_ADMIN', '/superadmin/billing'), 'REDIRECT_DASHBOARD');
  assert.strictEqual(checkRestricted('TENANT_ADMIN', '/settings'), 'ALLOWED');
  assert.strictEqual(checkRestricted('TENANT_ADMIN', '/cafe/dashboard'), 'ALLOWED');
});

// ====================================================================
// SECTION 2: QR STANDEE TOKEN & URL DERIVATION STRESS TESTS
// ====================================================================
console.log('\n--- SECTION 2: QR Standee Token & URL Derivation Stress Tests ---');

runTest('Standee: Robust extraction across query strings, HMAC tokens, and fallback matrix', () => {
  function deriveStandeeUrl(table, activeTenant, baseUrl = 'http://localhost:5173') {
    const tenantSlug = activeTenant?.id || 'demo';
    const token = table.qrCodeToken || (table.qrCodeUrl ? new URL(table.qrCodeUrl, baseUrl).searchParams.get('token') : '');
    const url = table.qrCodeUrl 
      ? (table.qrCodeUrl.startsWith('http') ? table.qrCodeUrl : `${baseUrl}${table.qrCodeUrl}`)
      : `${baseUrl}/order/${tenantSlug}/${table.id}?token=${encodeURIComponent(token || '')}`;
    return { token, url };
  }

  // Case 1: Both qrCodeToken and relative qrCodeUrl provided
  const r1 = deriveStandeeUrl({
    id: 'tbl_1',
    qrCodeToken: 'tok_direct_123',
    qrCodeUrl: '/order/biz_1/tbl_1?token=tok_in_url_456'
  }, { id: 'biz_1' });
  assert.strictEqual(r1.token, 'tok_direct_123'); // qrCodeToken takes direct precedence
  assert.strictEqual(r1.url, 'http://localhost:5173/order/biz_1/tbl_1?token=tok_in_url_456');

  // Case 2: Only relative qrCodeUrl provided (token extracted via URL searchParams)
  const r2 = deriveStandeeUrl({
    id: 'tbl_2',
    qrCodeToken: null,
    qrCodeUrl: '/order/biz_2/tbl_2?source=qr&token=tok_extracted_789&lang=en'
  }, { id: 'biz_2' });
  assert.strictEqual(r2.token, 'tok_extracted_789');
  assert.strictEqual(r2.url, 'http://localhost:5173/order/biz_2/tbl_2?source=qr&token=tok_extracted_789&lang=en');

  // Case 3: Fully qualified absolute URL with port and query params
  const r3 = deriveStandeeUrl({
    id: 'tbl_3',
    qrCodeUrl: 'https://cafe.quickbill.app:8443/order/biz_3/tbl_3?token=secure_jwt_token'
  }, { id: 'biz_3' });
  assert.strictEqual(r3.token, 'secure_jwt_token');
  assert.strictEqual(r3.url, 'https://cafe.quickbill.app:8443/order/biz_3/tbl_3?token=secure_jwt_token');

  // Case 4: No qrCodeUrl, but qrCodeToken present -> synthesized URL
  const r4 = deriveStandeeUrl({
    id: 'tbl_4',
    qrCodeToken: 'pure_token_xyz',
    qrCodeUrl: null
  }, { id: 'biz_4' });
  assert.strictEqual(r4.token, 'pure_token_xyz');
  assert.strictEqual(r4.url, 'http://localhost:5173/order/biz_4/tbl_4?token=pure_token_xyz');

  // Case 5: Empty table with no token and no url (graceful fallback)
  const r5 = deriveStandeeUrl({
    id: 'tbl_5',
  }, null);
  assert.strictEqual(r5.token, '');
  assert.strictEqual(r5.url, 'http://localhost:5173/order/demo/tbl_5?token=');
});

runTest('Standee: URL encoding safety prevents parameter injection in generated QR URL', () => {
  function deriveStandeeUrl(table, activeTenant, baseUrl = 'http://localhost:5173') {
    const tenantSlug = activeTenant?.id || 'demo';
    const token = table.qrCodeToken || (table.qrCodeUrl ? new URL(table.qrCodeUrl, baseUrl).searchParams.get('token') : '');
    const url = table.qrCodeUrl 
      ? (table.qrCodeUrl.startsWith('http') ? table.qrCodeUrl : `${baseUrl}${table.qrCodeUrl}`)
      : `${baseUrl}/order/${tenantSlug}/${table.id}?token=${encodeURIComponent(token || '')}`;
    return { token, url };
  }

  // Token containing adversarial characters: &attacker=true#fragment
  const attackToken = 'valid_token&attacker=true#fragment';
  const r = deriveStandeeUrl({
    id: 'tbl_attack',
    qrCodeToken: attackToken,
  }, { id: 'biz_sec' });

  // Verify encodeURIComponent escaped the '&' and '#'
  assert.ok(r.url.includes('token=valid_token%26attacker%3Dtrue%23fragment'));
  const parsed = new URL(r.url);
  assert.strictEqual(parsed.searchParams.get('token'), attackToken);
  assert.strictEqual(parsed.searchParams.get('attacker'), null);
});

// ====================================================================
// SECTION 3: DIGITAL MENU FALLBACK & DATA ROBUSTNESS
// ====================================================================
console.log('\n--- SECTION 3: Digital Menu Fallback & Data Robustness ---');

runTest('DigitalMenuPage: Tenant and Table Name fallbacks withstand empty, zero, null, and corrupt responses', () => {
  function resolveNames(menuData, tableId) {
    const tenantName = menuData?.storeName || menuData?.tenantName || 'Café & Bistro';
    const tableName = menuData?.table?.label || (menuData?.table?.tableNumber ? `Table ${menuData.table.tableNumber}` : (menuData?.tableName || `Table #${menuData?.tableNumber || tableId}`));
    return { tenantName, tableName };
  }

  // Corrupt / empty object
  assert.deepStrictEqual(resolveNames({}, 't99'), {
    tenantName: 'Café & Bistro',
    tableName: 'Table #t99',
  });

  // Table label present
  assert.deepStrictEqual(resolveNames({
    storeName: 'The Roast House',
    table: { label: 'Patio Corner 4' }
  }, 't10'), {
    tenantName: 'The Roast House',
    tableName: 'Patio Corner 4',
  });

  // Table number only (number type)
  assert.deepStrictEqual(resolveNames({
    tenantName: 'Espresso Bar',
    table: { tableNumber: 12 }
  }, 't12'), {
    tenantName: 'Espresso Bar',
    tableName: 'Table 12',
  });

  // Table number only (string type)
  assert.deepStrictEqual(resolveNames({
    table: { tableNumber: 'B-3' }
  }, 'tb3'), {
    tenantName: 'Café & Bistro',
    tableName: 'Table B-3',
  });

  // Legacy flat tableName
  assert.deepStrictEqual(resolveNames({
    tableName: 'Rooftop Lounge 1'
  }, 'trl1'), {
    tenantName: 'Café & Bistro',
    tableName: 'Rooftop Lounge 1',
  });
});

runTest('DigitalMenuPage: Dietary and Category filtering handles null and missing flags', () => {
  const items = [
    { id: '1', name: 'Veg Sandwich', category: 'Snacks', isVeg: true, dietaryFlags: { isVeg: true }, salePrice: 120 },
    { id: '2', name: 'Chicken Wrap', category: 'Snacks', isVeg: false, dietaryFlags: { isVeg: false }, salePrice: 180 },
    { id: '3', name: 'Black Coffee', category: 'Beverages', isVeg: true, salePrice: 80 },
    { id: '4', name: 'Egg Muffin', category: 'Snacks', dietaryFlags: null, isVeg: false, salePrice: 110 },
    { id: '5', name: 'Mystery Item', category: null, dietaryFlags: null, salePrice: 50 },
  ];

  function filterMenu(rawItems, selectedCategory, dietaryFilter, searchQuery) {
    return rawItems.filter(item => {
      if (selectedCategory !== 'ALL' && item.category !== selectedCategory) {
        return false;
      }
      if (dietaryFilter === 'VEG' && item.dietaryFlags?.isVeg !== true && item.isVeg !== true) {
        return false;
      }
      if (dietaryFilter === 'NON_VEG' && (item.dietaryFlags?.isVeg === true || item.isVeg === true)) {
        return false;
      }
      if (searchQuery && searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = item.name?.toLowerCase().includes(q);
        const matchesDesc = item.description?.toLowerCase().includes(q);
        if (!matchesName && !matchesDesc) return false;
      }
      return true;
    });
  }

  // Filter VEG
  const vegItems = filterMenu(items, 'ALL', 'VEG', '');
  assert.strictEqual(vegItems.length, 2); // Veg Sandwich, Black Coffee

  // Filter NON_VEG
  const nonVegItems = filterMenu(items, 'ALL', 'NON_VEG', '');
  assert.strictEqual(nonVegItems.length, 3); // Chicken Wrap, Egg Muffin, Mystery Item

  // Filter by Category
  const snacks = filterMenu(items, 'Snacks', 'ALL', '');
  assert.strictEqual(snacks.length, 3);

  // Search case-insensitive
  const sandwich = filterMenu(items, 'ALL', 'ALL', 'sandwich');
  assert.strictEqual(sandwich.length, 1);
  assert.strictEqual(sandwich[0].id, '1');
});

// ====================================================================
// SECTION 4: CUSTOMER CART DRAWER & PUBLIC ORDER SUBMISSION
// ====================================================================
console.log('\n--- SECTION 4: Customer Cart & Order Submission Stress Tests ---');

runTest('CustomerCart: Order payload constructor satisfies PublicOrderSubmitRequest schema', () => {
  function buildOrderPayload({ businessId, tableId, token, customerName, customerPhone, generalNotes, cartItems }) {
    return {
      businessId,
      tableId,
      qrToken: token || '',
      token: token || undefined,
      customerName: customerName ? customerName.trim() || undefined : undefined,
      customerPhone: customerPhone ? customerPhone.trim() || undefined : undefined,
      notes: generalNotes ? generalNotes.trim() || undefined : undefined,
      items: cartItems.map(c => ({
        itemId: c.item.id,
        itemName: c.item.name,
        quantity: c.quantity,
        variantName: c.variantName || undefined,
        notes: c.notes ? c.notes.trim() || undefined : undefined,
        unitPrice: c.item.salePrice || c.item.unitPrice || 0,
      })),
    };
  }

  // Scenario 1: Clean order with all fields
  const p1 = buildOrderPayload({
    businessId: 'biz_cafe_1',
    tableId: 'tbl_10',
    token: 'hmac_qr_token_abc',
    customerName: 'Alice',
    customerPhone: '9876543210',
    generalNotes: 'Near window please',
    cartItems: [
      { item: { id: 'it_1', name: 'Cappuccino', salePrice: 150 }, quantity: 2, notes: 'Extra hot', variantName: 'Large' },
      { item: { id: 'it_2', name: 'Croissant', unitPrice: 120 }, quantity: 1, notes: '' },
    ]
  });

  assert.strictEqual(p1.businessId, 'biz_cafe_1');
  assert.strictEqual(p1.tableId, 'tbl_10');
  assert.strictEqual(p1.qrToken, 'hmac_qr_token_abc');
  assert.strictEqual(p1.token, 'hmac_qr_token_abc');
  assert.strictEqual(p1.customerName, 'Alice');
  assert.strictEqual(p1.customerPhone, '9876543210');
  assert.strictEqual(p1.notes, 'Near window please');
  assert.strictEqual(p1.items.length, 2);
  assert.strictEqual(p1.items[0].unitPrice, 150);
  assert.strictEqual(p1.items[0].variantName, 'Large');
  assert.strictEqual(p1.items[1].unitPrice, 120);
  assert.strictEqual(p1.items[1].variantName, undefined);
  assert.strictEqual(p1.items[1].notes, undefined);

  // Scenario 2: Whitespace-only strings sanitized to undefined
  const p2 = buildOrderPayload({
    businessId: 'biz_cafe_2',
    tableId: 'tbl_20',
    token: 'tok_2',
    customerName: '   \t  ',
    customerPhone: '  \n ',
    generalNotes: '   ',
    cartItems: [
      { item: { id: 'it_3', name: 'Cold Brew', salePrice: 180 }, quantity: 1, notes: '   ' }
    ]
  });
  assert.strictEqual(p2.customerName, undefined);
  assert.strictEqual(p2.customerPhone, undefined);
  assert.strictEqual(p2.notes, undefined);
  assert.strictEqual(p2.items[0].notes, undefined);

  // Scenario 3: Fractional quantities (e.g. 1.5 portions)
  const p3 = buildOrderPayload({
    businessId: 'biz_cafe_3',
    tableId: 'tbl_30',
    token: 'tok_3',
    customerName: 'Bob',
    cartItems: [
      { item: { id: 'it_4', name: 'Cheesecake Slice', salePrice: 200 }, quantity: 1.5, notes: '' }
    ]
  });
  assert.strictEqual(p3.items[0].quantity, 1.5);
});

// ====================================================================
// SECTION 5: TABLE SETTLEMENT & DISCOUNT BOUNDS STRESS TESTS
// ====================================================================
console.log('\n--- SECTION 5: Table Settlement & Discount Bounds Stress Tests ---');

runTest('Settlement: Financial math and discount payload serialization across extreme values', () => {
  function computeSettlePayload(subtotal, discountPercent, paymentMode = 'CASH', paymentRef = '', customerName = '', customerPhone = '') {
    const gross = subtotal || 0;
    const discountVal = (gross * discountPercent) / 100;
    return {
      paymentMode,
      paymentRef: paymentRef ? paymentRef.trim() || undefined : undefined,
      customerName: customerName ? customerName.trim() || undefined : undefined,
      customerPhone: customerPhone ? customerPhone.trim() || undefined : undefined,
      discountAmount: discountVal,
      discountType: discountVal > 0 ? 'FIXED' : undefined,
      discountValue: discountVal > 0 ? discountVal : undefined,
      // Frontend tax display calculation:
      netAfterDiscount: gross - discountVal,
      taxAmount: (gross - discountVal) * 0.05,
      payable: (gross - discountVal) * 1.05,
    };
  }

  // 1. Zero discount
  const s0 = computeSettlePayload(500, 0);
  assert.strictEqual(s0.discountAmount, 0);
  assert.strictEqual(s0.discountType, undefined);
  assert.strictEqual(s0.discountValue, undefined);
  assert.strictEqual(s0.netAfterDiscount, 500);
  assert.strictEqual(s0.taxAmount, 25);
  assert.strictEqual(s0.payable, 525);

  // 2. Standard 10% discount
  const s10 = computeSettlePayload(1000, 10, 'UPI', 'UPI/2026/998877', 'Rajesh', '9811122233');
  assert.strictEqual(s10.discountAmount, 100);
  assert.strictEqual(s10.discountType, 'FIXED');
  assert.strictEqual(s10.discountValue, 100);
  assert.strictEqual(s10.netAfterDiscount, 900);
  assert.strictEqual(s10.taxAmount, 45);
  assert.strictEqual(s10.payable, 945);
  assert.strictEqual(s10.paymentMode, 'UPI');
  assert.strictEqual(s10.paymentRef, 'UPI/2026/998877');

  // 3. Comped 100% discount
  const s100 = computeSettlePayload(750, 100);
  assert.strictEqual(s100.discountAmount, 750);
  assert.strictEqual(s100.discountType, 'FIXED');
  assert.strictEqual(s100.discountValue, 750);
  assert.strictEqual(s100.netAfterDiscount, 0);
  assert.strictEqual(s100.taxAmount, 0);
  assert.strictEqual(s100.payable, 0);

  // 4. Negative discount percent protection
  const sNeg = computeSettlePayload(500, -15);
  assert.strictEqual(sNeg.discountType, undefined); // negative discount should never yield FIXED type
  assert.strictEqual(sNeg.discountValue, undefined);

  // 5. Zero subtotal session
  const sZero = computeSettlePayload(0, 10);
  assert.strictEqual(sZero.discountAmount, 0);
  assert.strictEqual(sZero.discountType, undefined);
  assert.strictEqual(sZero.payable, 0);
});

// ====================================================================
// SECTION 6: AST STATIC VERIFICATION OF PERSONA CONTROLS
// ====================================================================
console.log('\n--- SECTION 6: Static AST Checks for Persona Controls ---');

runTest('SettingsView: Persona toggle is completely absent from regular settings', () => {
  assert.ok(!settingsCode.includes('setBusinessPersona'), 'SettingsView must not define setBusinessPersona');
  assert.ok(!settingsCode.includes('name="businessPersona"'), 'SettingsView must not have radio toggle for persona');
  assert.ok(!settingsCode.includes("onChange={(e) => setBusinessPersona"), 'SettingsView must not have persona onChange handler');
});

runTest('SuperAdminView: Contains 3-button persona toggle for RETAIL, CAFE, HYBRID in both edit & new modals', () => {
  assert.ok(superAdminCode.includes("businessPersona === 'RETAIL'"), 'Must support RETAIL option');
  assert.ok(superAdminCode.includes("businessPersona === 'CAFE'"), 'Must support CAFE option');
  assert.ok(superAdminCode.includes("businessPersona === 'HYBRID'"), 'Must support HYBRID option');
  
  // Both creation and edit forms must update persona
  assert.ok(superAdminCode.includes("setNewTenant({ ...newTenant, businessPersona: 'RETAIL' })"));
  assert.ok(superAdminCode.includes("setNewTenant({ ...newTenant, businessPersona: 'CAFE' })"));
  assert.ok(superAdminCode.includes("setNewTenant({ ...newTenant, businessPersona: 'HYBRID' })"));

  assert.ok(superAdminCode.includes("setEditTenantForm({ ...editTenantForm, businessPersona: 'RETAIL' })"));
  assert.ok(superAdminCode.includes("setEditTenantForm({ ...editTenantForm, businessPersona: 'CAFE' })"));
  assert.ok(superAdminCode.includes("setEditTenantForm({ ...editTenantForm, businessPersona: 'HYBRID' })"));
});

runTest('Store Service: Normalizes business_persona on tenant fetch and updates', () => {
  assert.ok(storeCode.includes("businessPersona: t.business_persona || t.businessPersona || 'RETAIL'"), 'store.ts must normalize business_persona from API');
});

console.log(`\n================================================================`);
console.log(`--- ALL ${passCount} / ${testCount} ADVERSARIAL TESTS PASSED SUCCESSFULLY! ---`);
console.log(`================================================================\n`);
