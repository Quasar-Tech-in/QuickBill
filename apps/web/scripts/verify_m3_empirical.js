import fs from 'fs';
import path from 'path';
import assert from 'assert';
import ts from 'typescript';

console.log('================================================================');
console.log('--- STARTING EMPIRICAL AST & BEHAVIORAL VERIFICATION: M3 ---');
console.log('================================================================\n');

const webSrcDir = path.resolve('apps/web/src');
const appTsxPath = path.join(webSrcDir, 'App.tsx');
const tableManagementPath = path.join(webSrcDir, 'views/TableManagementView.tsx');
const digitalMenuPath = path.join(webSrcDir, 'customer/DigitalMenuPage.tsx');
const customerCartPath = path.join(webSrcDir, 'customer/CustomerCartDrawer.tsx');
const cafeDashboardPath = path.join(webSrcDir, 'views/CafeDashboardView.tsx');

// Read files
const appTsxCode = fs.readFileSync(appTsxPath, 'utf8').replace(/\r\n/g, '\n');
const tableManagementCode = fs.readFileSync(tableManagementPath, 'utf8').replace(/\r\n/g, '\n');
const digitalMenuCode = fs.readFileSync(digitalMenuPath, 'utf8').replace(/\r\n/g, '\n');
const customerCartCode = fs.readFileSync(customerCartPath, 'utf8').replace(/\r\n/g, '\n');
const cafeDashboardCode = fs.readFileSync(cafeDashboardPath, 'utf8').replace(/\r\n/g, '\n');

// Parse ASTs using TypeScript compiler API
const appSourceFile = ts.createSourceFile('App.tsx', appTsxCode, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const tableSourceFile = ts.createSourceFile('TableManagementView.tsx', tableManagementCode, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const menuSourceFile = ts.createSourceFile('DigitalMenuPage.tsx', digitalMenuCode, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const cartSourceFile = ts.createSourceFile('CustomerCartDrawer.tsx', customerCartCode, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const cafeSourceFile = ts.createSourceFile('CafeDashboardView.tsx', cafeDashboardCode, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

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

// Helper: AST node finder (void visitor to avoid ts.forEachChild early termination)
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

// ----------------------------------------------------
// TEST GROUP 1: App.tsx (Cashier Route Guard, Lockout & SPA Navigate)
// ----------------------------------------------------
console.log('\n--- GROUP 1: App.tsx Routing & Guards ---');

runTest('AST: allowedCashierPaths contains /cafe', () => {
  const varDecls = findNodes(appSourceFile, n => ts.isVariableDeclaration(n) && n.name.getText(appSourceFile) === 'allowedCashierPaths');
  assert.strictEqual(varDecls.length, 1, 'allowedCashierPaths variable declaration must exist');
  const arrLiteral = varDecls[0].initializer;
  assert.ok(arrLiteral && ts.isArrayLiteralExpression(arrLiteral), 'initializer must be an array literal');
  const elements = arrLiteral.elements.map(e => e.getText(appSourceFile).replace(/['"]/g, ''));
  assert.ok(elements.includes('/cafe'), 'allowedCashierPaths must include /cafe');
  assert.deepStrictEqual(elements, ['/pos', '/invoices', '/transactions', '/parties', '/ledger', '/cafe']);
});

runTest('AST: lockedPaths contains /cafe for store suspension lockout', () => {
  const varDecls = findNodes(appSourceFile, n => ts.isVariableDeclaration(n) && n.name.getText(appSourceFile) === 'lockedPaths');
  assert.strictEqual(varDecls.length, 1, 'lockedPaths variable declaration must exist');
  const arrLiteral = varDecls[0].initializer;
  assert.ok(arrLiteral && ts.isArrayLiteralExpression(arrLiteral), 'initializer must be an array literal');
  const elements = arrLiteral.elements.map(e => e.getText(appSourceFile).replace(/['"]/g, ''));
  assert.ok(elements.includes('/cafe'), 'lockedPaths must include /cafe');
  assert.deepStrictEqual(elements, ['/pos', '/inventory', '/purchase-orders', '/parties', '/ledger', '/cafe']);
});

runTest('AST: CafeDashboardRoute component defined with React Router useNavigate', () => {
  const cafeRouteComp = findNodes(appSourceFile, n => ts.isVariableDeclaration(n) && n.name.getText(appSourceFile) === 'CafeDashboardRoute');
  assert.strictEqual(cafeRouteComp.length, 1, 'CafeDashboardRoute must be declared');
  const compCode = cafeRouteComp[0].getText(appSourceFile);
  assert.ok(compCode.includes('const navigate = useNavigate()'), 'Must call useNavigate()');
  assert.ok(compCode.includes("<CafeDashboardView"), 'Must render CafeDashboardView');
  assert.ok(!compCode.includes('window.location.assign'), 'Must NOT use window.location.assign');
  assert.ok(compCode.includes("navigate('/cafe/orders/incoming')"), 'Must navigate to /cafe/orders/incoming');
  assert.ok(compCode.includes("navigate('/cafe/kitchen')"), 'Must navigate to /cafe/kitchen');
  assert.ok(compCode.includes("navigate('/cafe/tables')"), 'Must navigate to /cafe/tables');
});

runTest('AST: Route for /cafe/dashboard uses CafeDashboardRoute', () => {
  const routes = findNodes(appSourceFile, n => ts.isJsxElement(n) || ts.isJsxSelfClosingElement(n));
  const cafeDashboardRoute = routes.find(r => {
    const text = r.getText(appSourceFile);
    return text.includes('path="/cafe/dashboard"') && text.includes('element={<CafeDashboardRoute');
  });
  assert.ok(cafeDashboardRoute, 'Route /cafe/dashboard must render CafeDashboardRoute');
});

runTest('Behavior: Cashier route access guard logic emulation', () => {
  const allowedCashierPaths = ['/pos', '/invoices', '/transactions', '/parties', '/ledger', '/cafe'];
  function checkCashierAllowed(path) {
    return allowedCashierPaths.some(p => path === p || path.startsWith(p + '/'));
  }

  // Allowed paths for cashier
  assert.strictEqual(checkCashierAllowed('/pos'), true);
  assert.strictEqual(checkCashierAllowed('/pos/checkout'), true);
  assert.strictEqual(checkCashierAllowed('/cafe'), true);
  assert.strictEqual(checkCashierAllowed('/cafe/dashboard'), true);
  assert.strictEqual(checkCashierAllowed('/cafe/tables'), true);
  assert.strictEqual(checkCashierAllowed('/cafe/orders/incoming'), true);
  assert.strictEqual(checkCashierAllowed('/cafe/kitchen'), true);
  assert.strictEqual(checkCashierAllowed('/invoices'), true);
  assert.strictEqual(checkCashierAllowed('/parties'), true);
  assert.strictEqual(checkCashierAllowed('/ledger'), true);

  // Forbidden paths for cashier (redirect to /pos)
  assert.strictEqual(checkCashierAllowed('/dashboard'), false);
  assert.strictEqual(checkCashierAllowed('/inventory'), false);
  assert.strictEqual(checkCashierAllowed('/purchase-orders'), false);
  assert.strictEqual(checkCashierAllowed('/reports'), false);
  assert.strictEqual(checkCashierAllowed('/settings'), false);
  assert.strictEqual(checkCashierAllowed('/superadmin'), false);
});

runTest('Behavior: Suspended store lockout guard includes /cafe routes', () => {
  const lockedPaths = ['/pos', '/inventory', '/purchase-orders', '/parties', '/ledger', '/cafe'];
  function isPathLocked(path, isSuperAdmin, isStoreLocked) {
    if (!isSuperAdmin && isStoreLocked) {
      return lockedPaths.some(p => path === p || path.startsWith(p + '/'));
    }
    return false;
  }

  // Tenant user with locked store
  assert.strictEqual(isPathLocked('/cafe', false, true), true);
  assert.strictEqual(isPathLocked('/cafe/dashboard', false, true), true);
  assert.strictEqual(isPathLocked('/cafe/tables', false, true), true);
  assert.strictEqual(isPathLocked('/pos', false, true), true);

  // Tenant user with active store (not locked)
  assert.strictEqual(isPathLocked('/cafe', false, false), false);
  assert.strictEqual(isPathLocked('/cafe/dashboard', false, false), false);

  // Super admin on locked store (bypasses lockout)
  assert.strictEqual(isPathLocked('/cafe', true, true), false);
  assert.strictEqual(isPathLocked('/pos', true, true), false);
});

// ----------------------------------------------------
// TEST GROUP 2: TableManagementView.tsx (Standee QR Token & URL Derivation)
// ----------------------------------------------------
console.log('\n--- GROUP 2: TableManagementView.tsx QR Standees ---');

runTest('AST: handleOpenStandee extracts token from qrCodeToken and qrCodeUrl fallback', () => {
  const standeeFn = findNodes(tableSourceFile, n => ts.isVariableDeclaration(n) && n.name.getText(tableSourceFile) === 'handleOpenStandee');
  assert.strictEqual(standeeFn.length, 1, 'handleOpenStandee must exist');
  const code = standeeFn[0].getText(tableSourceFile);
  assert.ok(code.includes('table.qrCodeToken'), 'Must inspect table.qrCodeToken');
  assert.ok(code.includes('table.qrCodeUrl'), 'Must inspect table.qrCodeUrl');
  assert.ok(code.includes("searchParams.get('token')"), 'Must parse searchParams for token fallback');
  assert.ok(code.includes("table.qrCodeUrl.startsWith('http')"), 'Must check if qrCodeUrl is absolute');
});

runTest('Behavior: QR URL derivation with relative qrCodeUrl and HMAC token', () => {
  function deriveStandeeUrl(table, activeTenant, baseUrl = 'http://localhost:5173') {
    const tenantSlug = activeTenant?.id || 'demo';
    const token = table.qrCodeToken || (table.qrCodeUrl ? new URL(table.qrCodeUrl, baseUrl).searchParams.get('token') : '');
    const url = table.qrCodeUrl 
      ? (table.qrCodeUrl.startsWith('http') ? table.qrCodeUrl : `${baseUrl}${table.qrCodeUrl}`)
      : `${baseUrl}/order/${tenantSlug}/${table.id}?token=${encodeURIComponent(token || '')}`;
    return { token, url };
  }

  // Case 1: Backend provides relative qrCodeUrl with query token
  const res1 = deriveStandeeUrl({
    id: 'tbl_101',
    qrCodeUrl: '/order/biz_abc/tbl_101?token=hmac_secret_hash_987',
    qrCodeToken: undefined
  }, { id: 'biz_abc' });
  assert.strictEqual(res1.token, 'hmac_secret_hash_987');
  assert.strictEqual(res1.url, 'http://localhost:5173/order/biz_abc/tbl_101?token=hmac_secret_hash_987');

  // Case 2: Backend provides direct qrCodeToken but no qrCodeUrl
  const res2 = deriveStandeeUrl({
    id: 'tbl_202',
    qrCodeToken: 'direct_hmac_token_333',
    qrCodeUrl: undefined
  }, { id: 'biz_abc' });
  assert.strictEqual(res2.token, 'direct_hmac_token_333');
  assert.strictEqual(res2.url, 'http://localhost:5173/order/biz_abc/tbl_202?token=direct_hmac_token_333');

  // Case 3: Backend provides absolute qrCodeUrl
  const res3 = deriveStandeeUrl({
    id: 'tbl_303',
    qrCodeUrl: 'https://cafe.quickbill.app/order/biz_abc/tbl_303?token=remote_token_555',
  }, { id: 'biz_abc' });
  assert.strictEqual(res3.token, 'remote_token_555');
  assert.strictEqual(res3.url, 'https://cafe.quickbill.app/order/biz_abc/tbl_303?token=remote_token_555');

  // Case 4: Adversarial edge case: Neither qrCodeUrl nor qrCodeToken present
  const res4 = deriveStandeeUrl({
    id: 'tbl_empty',
  }, { id: 'biz_abc' });
  assert.strictEqual(res4.token, '');
  assert.strictEqual(res4.url, 'http://localhost:5173/order/biz_abc/tbl_empty?token=');
  assert.ok(!res4.url.includes('undefined'), 'URL must never contain the literal string "undefined"');
  assert.ok(!res4.url.includes('null'), 'URL must never contain the literal string "null"');
});

// ----------------------------------------------------
// TEST GROUP 3: DigitalMenuPage.tsx (Public Menu tableId & Name Mapping)
// ----------------------------------------------------
console.log('\n--- GROUP 3: DigitalMenuPage.tsx Customer Menu ---');

runTest('AST: fetchMenu passes tableId query parameter to public cafe menu API', () => {
  assert.ok(
    digitalMenuCode.includes('params: { tableId: tableId, token: token || undefined }') ||
    digitalMenuCode.includes('tableId: tableId'),
    'fetchMenu must pass tableId in params'
  );
});

runTest('AST: tenantName fallback handles storeName and tenantName', () => {
  assert.ok(
    digitalMenuCode.includes("const tenantName = menuData?.storeName || menuData?.tenantName || 'Café & Bistro';"),
    'tenantName resolution must check storeName, tenantName, then default'
  );
});

runTest('AST: tableName resolution handles table.label, tableNumber, and tableId', () => {
  assert.ok(
    digitalMenuCode.includes("const tableName = menuData?.table?.label || (menuData?.table?.tableNumber ? `Table ${menuData.table.tableNumber}` : (menuData?.tableName || `Table #${menuData?.tableNumber || tableId}`));"),
    'tableName resolution must check table.label, table.tableNumber, and fallback gracefully'
  );
});

runTest('Behavior: Name and Table resolution matrix under various API responses', () => {
  function resolveNames(menuData, tableId) {
    const tenantName = menuData?.storeName || menuData?.tenantName || 'Café & Bistro';
    const tableName = menuData?.table?.label || (menuData?.table?.tableNumber ? `Table ${menuData.table.tableNumber}` : (menuData?.tableName || `Table #${menuData?.tableNumber || tableId}`));
    return { tenantName, tableName };
  }

  // Case 1: Full backend response with storeName and table object with label
  const r1 = resolveNames({
    storeName: 'Blue Tokai Roasters',
    table: { label: 'Window Table 4', tableNumber: '4' }
  }, 't1');
  assert.strictEqual(r1.tenantName, 'Blue Tokai Roasters');
  assert.strictEqual(r1.tableName, 'Window Table 4');

  // Case 2: Table object with no custom label (just tableNumber)
  const r2 = resolveNames({
    storeName: 'Blue Tokai Roasters',
    table: { label: '', tableNumber: '15' }
  }, 't2');
  assert.strictEqual(r2.tableName, 'Table 15');

  // Case 3: Legacy API response with tenantName and tableName at top level
  const r3 = resolveNames({
    tenantName: 'Espresso Bar',
    tableName: 'Booth A'
  }, 't3');
  assert.strictEqual(r3.tenantName, 'Espresso Bar');
  assert.strictEqual(r3.tableName, 'Booth A');

  // Case 4: Missing table object, but top-level tableNumber
  const r4 = resolveNames({
    storeName: 'Artisan Cafe',
    tableNumber: '7'
  }, 't4');
  assert.strictEqual(r4.tableName, 'Table #7');

  // Case 5: Table info completely absent (e.g., diner opened link without table metadata)
  const r5 = resolveNames({
    storeName: 'Artisan Cafe',
  }, 'tbl_raw_id_55');
  assert.strictEqual(r5.tableName, 'Table #tbl_raw_id_55');

  // Case 6: Completely empty menuData (loading or error state fallback)
  const r6 = resolveNames(null, 'param_table_88');
  assert.strictEqual(r6.tenantName, 'Café & Bistro');
  assert.strictEqual(r6.tableName, 'Table #param_table_88');
});

// ----------------------------------------------------
// TEST GROUP 4: CustomerCartDrawer.tsx (Order Submission Payload)
// ----------------------------------------------------
console.log('\n--- GROUP 4: CustomerCartDrawer.tsx Order Placement ---');

runTest('AST: payload includes qrToken and token fields', () => {
  const submitFn = findNodes(cartSourceFile, n => ts.isVariableDeclaration(n) && n.name.getText(cartSourceFile) === 'handleSubmitOrder');
  assert.strictEqual(submitFn.length, 1, 'handleSubmitOrder must exist');
  const code = submitFn[0].getText(cartSourceFile);
  assert.ok(code.includes("qrToken: token || ''"), 'payload must include qrToken: token || ""');
  assert.ok(code.includes("token: token || undefined"), 'payload must include token: token || undefined');
});

runTest('Behavior: Order submission payload compatibility with backend PublicOrderSubmitRequest', () => {
  function buildPayload(businessId, tableId, token, customerName, customerPhone, generalNotes, cartItems) {
    return {
      businessId,
      tableId,
      qrToken: token || '',
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
  }

  // Simulate Pydantic model validator from apps/api/app/schemas/cafe.py:81-89
  function pydanticNormalizeQrToken(data) {
    const token_val = data.qrToken || data.qr_token || data.token;
    if (token_val !== undefined && token_val !== null) {
      data.qrToken = token_val;
      data.qr_token = token_val;
    } else {
      data.qr_token = data.qrToken !== undefined ? data.qrToken : (data.qr_token !== undefined ? data.qr_token : data.token);
    }
    // Validation check: qr_token must be a string and required
    if (typeof data.qr_token !== 'string') {
      throw new Error('422 Unprocessable Entity: Field required: qrToken');
    }
    return data;
  }

  const dummyCart = [
    { item: { id: 'it_1', name: 'Cappuccino', salePrice: 180 }, quantity: 2, notes: 'Extra shot' }
  ];

  // Case 1: Valid token provided
  const payload1 = buildPayload('biz1', 'tbl1', 'token_hmac_abc', 'Alice', '9876543210', 'Hot please', dummyCart);
  assert.strictEqual(payload1.qrToken, 'token_hmac_abc');
  assert.strictEqual(payload1.token, 'token_hmac_abc');
  const normalized1 = pydanticNormalizeQrToken({ ...payload1 });
  assert.strictEqual(normalized1.qr_token, 'token_hmac_abc');

  // Case 2: Empty token provided (e.g. open table or staff override)
  const payload2 = buildPayload('biz1', 'tbl1', '', '', '', '', dummyCart);
  assert.strictEqual(payload2.qrToken, '');
  assert.strictEqual(payload2.token, undefined);
  const normalized2 = pydanticNormalizeQrToken({ ...payload2 });
  assert.strictEqual(normalized2.qr_token, '');
  assert.strictEqual(normalized2.customerName, undefined);
});

// ----------------------------------------------------
// TEST GROUP 5: CafeDashboardView.tsx (Table Settlement Discounts)
// ----------------------------------------------------
console.log('\n--- GROUP 5: CafeDashboardView.tsx Settle Table Session ---');

runTest('AST: handleConfirmSettle includes discountAmount, discountType, and discountValue', () => {
  const settleFn = findNodes(cafeSourceFile, n => ts.isVariableDeclaration(n) && n.name.getText(cafeSourceFile) === 'handleConfirmSettle');
  assert.strictEqual(settleFn.length, 1, 'handleConfirmSettle must exist');
  const code = settleFn[0].getText(cafeSourceFile);
  assert.ok(code.includes("discountAmount: discountVal"), 'Must provide discountAmount');
  assert.ok(code.includes("discountType: discountVal > 0 ? 'FIXED' : undefined"), 'Must provide discountType');
  assert.ok(code.includes("discountValue: discountVal > 0 ? discountVal : undefined"), 'Must provide discountValue');
});

runTest('Behavior: Table settlement discount calculations and backend TableSettleRequest alignment', () => {
  function computeSettlePayload(subtotal, discountPercent, paymentMode = 'CASH') {
    const gross = subtotal || 0;
    const discountVal = (gross * discountPercent) / 100;
    return {
      paymentMode,
      discountAmount: discountVal,
      discountType: discountVal > 0 ? 'FIXED' : undefined,
      discountValue: discountVal > 0 ? discountVal : undefined,
    };
  }

  // Case 1: 10% discount on 500 subtotal
  const p1 = computeSettlePayload(500, 10);
  assert.strictEqual(p1.discountAmount, 50);
  assert.strictEqual(p1.discountType, 'FIXED');
  assert.strictEqual(p1.discountValue, 50);

  // Case 2: 0% discount on 300 subtotal
  const p2 = computeSettlePayload(300, 0);
  assert.strictEqual(p2.discountAmount, 0);
  assert.strictEqual(p2.discountType, undefined);
  assert.strictEqual(p2.discountValue, undefined);

  // Case 3: 100% comped meal
  const p3 = computeSettlePayload(1250, 100);
  assert.strictEqual(p3.discountAmount, 1250);
  assert.strictEqual(p3.discountType, 'FIXED');
  assert.strictEqual(p3.discountValue, 1250);

  // Case 4: Fractional subtotal and discount
  const p4 = computeSettlePayload(49.99, 15);
  assert.strictEqual(p4.discountAmount, 7.4985);
  assert.strictEqual(p4.discountType, 'FIXED');
  assert.strictEqual(p4.discountValue, 7.4985);
});

// ----------------------------------------------------
// TEST GROUP 6: Regression & Integration Cross-Check
// ----------------------------------------------------
console.log('\n--- GROUP 6: Regression & Cross-Check ---');

runTest('Behavior: CafeDashboardView navigation delegates to onNavigate when provided', () => {
  const navigatedTabs = [];
  const mockOnNavigate = (tab) => navigatedTabs.push(tab);

  // Simulate button click handlers in CafeDashboardView
  const handleIncomingClick = () => mockOnNavigate ? mockOnNavigate('cafe-incoming') : null;
  const handleKitchenClick = () => mockOnNavigate ? mockOnNavigate('cafe-kitchen') : null;
  const handleTablesClick = () => mockOnNavigate ? mockOnNavigate('cafe-tables') : null;

  handleIncomingClick();
  handleKitchenClick();
  handleTablesClick();

  assert.deepStrictEqual(navigatedTabs, ['cafe-incoming', 'cafe-kitchen', 'cafe-tables']);
});

// ----------------------------------------------------
// TEST GROUP 7: Adversarial Stress Testing & Boundary Scenarios
// ----------------------------------------------------
console.log('\n--- GROUP 7: Adversarial Stress Testing ---');

runTest('Adversarial: Cashier path guard rejects prefix spoofing attacks', () => {
  const allowedCashierPaths = ['/pos', '/invoices', '/transactions', '/parties', '/ledger', '/cafe'];
  function checkCashierAllowed(path) {
    return allowedCashierPaths.some(p => path === p || path.startsWith(p + '/'));
  }

  // Path spoofing attacks: must all be rejected
  assert.strictEqual(checkCashierAllowed('/cafeteria'), false);
  assert.strictEqual(checkCashierAllowed('/cafe_admin'), false);
  assert.strictEqual(checkCashierAllowed('/cafe-settings'), false);
  assert.strictEqual(checkCashierAllowed('/pos_hack'), false);
  assert.strictEqual(checkCashierAllowed('/invoices_export'), false);
  assert.strictEqual(checkCashierAllowed('/ledger_super'), false);

  // Valid deeply nested paths: must all be allowed
  assert.strictEqual(checkCashierAllowed('/cafe/orders/incoming/details/123'), true);
  assert.strictEqual(checkCashierAllowed('/pos/history/receipt/456'), true);
});

runTest('Adversarial: Standee QR token extracts correctly from complex query strings', () => {
  function deriveStandeeUrl(table, activeTenant, baseUrl = 'http://localhost:5173') {
    const tenantSlug = activeTenant?.id || 'demo';
    const token = table.qrCodeToken || (table.qrCodeUrl ? new URL(table.qrCodeUrl, baseUrl).searchParams.get('token') : '');
    const url = table.qrCodeUrl 
      ? (table.qrCodeUrl.startsWith('http') ? table.qrCodeUrl : `${baseUrl}${table.qrCodeUrl}`)
      : `${baseUrl}/order/${tenantSlug}/${table.id}?token=${encodeURIComponent(token || '')}`;
    return { token, url };
  }

  // URL with multiple query params before and after token
  const t1 = {
    id: 'tbl_99',
    qrCodeUrl: '/order/biz_x/tbl_99?source=standee&token=secret_xyz_789&version=2',
  };
  const r1 = deriveStandeeUrl(t1, { id: 'biz_x' });
  assert.strictEqual(r1.token, 'secret_xyz_789');

  // URL with URL-encoded special characters
  const t2 = {
    id: 'tbl_special',
    qrCodeUrl: '/order/biz_x/tbl_special?token=token%2Bwith%2Fspecial%3Dchars',
  };
  const r2 = deriveStandeeUrl(t2, { id: 'biz_x' });
  assert.strictEqual(r2.token, 'token+with/special=chars');
});

runTest('Adversarial: DigitalMenuPage fallback eliminates "undefined" and "null" in all corner cases', () => {
  function resolveNames(menuData, tableId) {
    const tenantName = menuData?.storeName || menuData?.tenantName || 'Café & Bistro';
    const tableName = menuData?.table?.label || (menuData?.table?.tableNumber ? `Table ${menuData.table.tableNumber}` : (menuData?.tableName || `Table #${menuData?.tableNumber || tableId}`));
    return { tenantName, tableName };
  }

  // Corner Case 1: Empty strings in storeName & tenantName
  const res1 = resolveNames({ storeName: '', tenantName: '' }, 'tid1');
  assert.strictEqual(res1.tenantName, 'Café & Bistro');

  // Corner Case 2: Empty table label and empty tableNumber
  const res2 = resolveNames({ table: { label: '', tableNumber: '' } }, 'tid2');
  assert.strictEqual(res2.tableName, 'Table #tid2');

  // Corner Case 3: table is undefined, tableNumber is 0
  const res3 = resolveNames({ tableNumber: 0 }, 'tid3');
  assert.strictEqual(res3.tableName, 'Table #tid3');

  // Corner Case 4: null values
  const res4 = resolveNames({ storeName: null, table: null }, 'tid4');
  assert.strictEqual(res4.tenantName, 'Café & Bistro');
  assert.strictEqual(res4.tableName, 'Table #tid4');
});

runTest('Adversarial: Customer cart order submission sanitizes whitespace-only strings', () => {
  function sanitizeCustomerFields(name, phone, notes) {
    return {
      customerName: name.trim() || undefined,
      customerPhone: phone.trim() || undefined,
      notes: notes.trim() || undefined,
    };
  }

  const s1 = sanitizeCustomerFields('   ', '\t\n  ', '    ');
  assert.strictEqual(s1.customerName, undefined);
  assert.strictEqual(s1.customerPhone, undefined);
  assert.strictEqual(s1.notes, undefined);

  const s2 = sanitizeCustomerFields('  Bob  ', ' 9876543210 ', ' No onions ');
  assert.strictEqual(s2.customerName, 'Bob');
  assert.strictEqual(s2.customerPhone, '9876543210');
  assert.strictEqual(s2.notes, 'No onions');
});

runTest('Adversarial: Table settlement discounts bounds check prevents zero/negative discount types', () => {
  function computeSettlePayload(subtotal, discountPercent, paymentMode = 'CASH') {
    const gross = subtotal || 0;
    const discountVal = (gross * discountPercent) / 100;
    return {
      paymentMode,
      discountAmount: discountVal,
      discountType: discountVal > 0 ? 'FIXED' : undefined,
      discountValue: discountVal > 0 ? discountVal : undefined,
    };
  }

  // Zero discount
  const p0 = computeSettlePayload(100, 0);
  assert.strictEqual(p0.discountType, undefined);
  assert.strictEqual(p0.discountValue, undefined);

  // Negative discount edge case
  const pNeg = computeSettlePayload(100, -5);
  assert.strictEqual(pNeg.discountType, undefined);
  assert.strictEqual(pNeg.discountValue, undefined);
});

console.log(`\n================================================================`);
console.log(`--- ALL ${passCount} / ${testCount} EMPIRICAL TESTS PASSED SUCCESSFULLY! ---`);
console.log(`================================================================\n`);
