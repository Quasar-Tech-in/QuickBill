---
name: testing-quality
description: >-
  Testing strategy and Quality Assurance guidelines covering unit tests (Pytest/Jest),
  API integration tests, multi-tenant isolation suites, financial calculation tests, and Definition of Done.
---

# Testing Strategy & Quality Assurance Standards

## 1. Test Pyramid & Tooling

```text
               ▲
              / \
             /E2E\      Mobile App & Web User Flows (Playwright / Maestro)
            /-----\
           / Integ \    FastAPI Endpoints + Real MongoDB (Pytest + Testcontainers)
          /---------\
         /   Unit    \  Financial Calculations, Decimal Rounding, QR Parsers
        /-------------\
```

- **Backend Unit & Integration Tests**: `pytest`, `pytest-asyncio`, `httpx`, `mongomock-motor` or `testcontainers-python` (real MongoDB replica set).
- **Mobile Tests**: `jest`, `@testing-library/react-native`.
- **Linting & Typing**: `ruff` + `mypy` for Python; `eslint` + `tsc --noEmit` for React Native / Next.js.

---

## 2. Mandatory Test Suites

### 2.1. Billing Calculation Accuracy Suite
Must verify calculation of line items, multiple tax rates, invoice discounts, and round-offs without floating-point errors:
```python
import pytest
from decimal import Decimal
from app.services.billing_engine import BillingEngine, CartItemInput

def test_multi_item_tax_and_roundoff():
    items = [
        CartItemInput(item_id="1", quantity=Decimal("2"), unit_price=Decimal("150.00"), tax_rate=Decimal("18.0")),
        CartItemInput(item_id="2", quantity=Decimal("1"), unit_price=Decimal("99.90"), tax_rate=Decimal("5.0")),
    ]
    res = BillingEngine.calculate_invoice(items=items, enable_round_off=True)
    
    # Item 1: Gross 300.00, Tax 18% = 54.00, Total = 354.00
    # Item 2: Gross 99.90, Tax 5% = 5.00, Total = 104.90
    # Subtotal: 399.90, Tax Total: 59.00 -> 458.90
    # Grand Total (Rounded): 459.00, Round Off: +0.10
    assert res.subtotal == Decimal("399.90")
    assert res.tax_total == Decimal("59.00")
    assert res.grand_total == Decimal("459.00")
    assert res.round_off == Decimal("0.10")
```

### 2.2. Multi-Tenant Isolation Suite
Must assert that Tenant B cannot read, mutate, or delete Tenant A's records:
```python
@pytest.mark.asyncio
async def test_tenant_isolation_on_invoices(api_client, auth_header_tenant_a, auth_header_tenant_b):
    # Tenant A creates invoice
    res = await api_client.post("/api/v1/sales", json={...}, headers=auth_header_tenant_a)
    invoice_id = res.json()["id"]

    # Tenant B tries to fetch it
    res_b = await api_client.get(f"/api/v1/sales/{invoice_id}", headers=auth_header_tenant_b)
    assert res_b.status_code == 404
```

### 2.3. Inventory Consistency & Race Condition Suite
Asserts that concurrent billing requests for limited stock decrement correctly and reject out-of-stock orders.

---

## 3. Definition of Done (DoD) Checklist

Before any PR or feature is marked complete:
- [ ] **Type-Checking**: `mypy --strict` passes with 0 errors on backend; `tsc --noEmit` passes on mobile.
- [ ] **Linting**: `ruff check .` passes without warnings.
- [ ] **Unit Tests**: All unit tests pass with $\ge 85\%$ coverage on calculation engines.
- [ ] **Integration Tests**: API endpoints tested with valid and invalid inputs.
- [ ] **Tenant Isolation**: Cross-tenant test included for new collection endpoints.
- [ ] **Security Review**: No hardcoded API secrets; all mutations authorized via RBAC.
- [ ] **OpenAPI Schema**: Pydantic models documented with accurate descriptions and examples.
