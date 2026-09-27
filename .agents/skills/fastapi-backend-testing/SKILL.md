---
name: fastapi-backend-testing
description: >-
  Comprehensive testing standards, code quality auditing, design pattern evaluation,
  code duplication detection, and security penetration prevention for FastAPI backend services.
---

# FastAPI Backend Testing, Code Quality & Security Audit Standards

This skill provides the authoritative framework for testing, reviewing, rating, and auditing the FastAPI backend (`apps/api`). It ensures enterprise-grade coding standards, clean design patterns, DRY implementation, and zero security vulnerabilities.

---

## 1. Testing Framework & Architecture

### 1.1. Test Pyramid & Directory Layout
```text
apps/api/tests/
├── conftest.py               # Root fixtures: DB connections, test client, tenant contexts
├── unit/
│   ├── services/             # Pure business logic, calculation engine, tax rounding
│   ├── schemas/              # Pydantic v2 validation, serialization, custom validators
│   └── core/                 # JWT parsing, password hashing, security utilities
├── integration/
│   ├── api/v1/               # Router endpoint tests (status codes, headers, contracts)
│   ├── repositories/         # MongoDB tenant-scoped CRUD and aggregation queries
│   └── rbac/                 # Role and permission access matrix checks
├── security/
│   ├── test_tenant_isolation.py  # Cross-tenant data leak / IDOR penetration tests
│   ├── test_nosql_injection.py   # Malicious payload injection in query/filters
│   ├── test_auth_tampering.py    # Expired/forged JWTs, missing scopes, privilege escalation
│   └── test_rate_limiting.py     # Throttling and brute force protections
└── performance/
    └── test_query_profiling.py   # N+1 query detection, execution time budgets
```

### 1.2. Pytest Asyncio & Multi-Tenant Fixture Pattern
```python
import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.core.security import create_access_token

@pytest.fixture
async def api_client():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        yield client

@pytest.fixture
def tenant_a_headers():
    token = create_access_token(data={"sub": "user_a1", "business_id": "biz_tenant_alpha", "role": "admin"})
    return {"Authorization": f"Bearer {token}"}

@pytest.fixture
def tenant_b_headers():
    token = create_access_token(data={"sub": "user_b1", "business_id": "biz_tenant_beta", "role": "cashier"})
    return {"Authorization": f"Bearer {token}"}
```

---

## 2. Design Patterns & Code Architecture Auditing

### 2.1. Architectural Layer Violations (Anti-Patterns vs Standard)

| Layer | Permitted Actions | Forbidden Anti-Patterns (Deduct Score) |
|---|---|---|
| **Routers** (`api/v1/`) | Query parsing, dependency injection, calling single service, returning Pydantic schema. | ❌ Direct database/Motor calls.<br>❌ Monetary/tax calculation logic.<br>❌ Raw SQL/Mongo dict construction. |
| **Services** (`services/`) | Business workflows, transaction boundaries, math calculation, calling repositories, emitting events. | ❌ Direct HTTP request/response object handling.<br>❌ Skipping repository abstraction. |
| **Repositories** (`repositories/`) | Encapsulated DB queries, projection, filtering, pagination. | ❌ Business rules/decisions.<br>❌ Missing mandatory `business_id` filter. |
| **Schemas** (`schemas/`) | Strict Pydantic v2 validation, decimal coercing, field constraints. | ❌ Business state mutation.<br>❌ Direct DB connection dependencies. |

### 2.2. Design Pattern Verification

1. **Dependency Injection (DI)**:
   - Database sessions, current tenant, and authenticated user **must** be injected using FastAPI `Depends(...)`.
   - Never instantiate global DB connection references or hardcode configurations in route functions.
2. **Strategy Pattern for Calculations**:
   - Multiple tax calculation engines (e.g., GST vs VAT vs Flat) must use polymorphism/strategy interfaces, not nested `if-elif-else` blocks.
3. **Repository Pattern with Unit of Work**:
   - All write operations modifying multiple collections (e.g., Invoice + Stock Ledger + Customer Balance) must use a session-aware Unit of Work / Transaction manager.

---

## 3. Code Duplication (DRY) Identification & Resolution

When auditing code, flag and penalize the following duplications:

1. **Repetitive Tenant Query Filters**:
   - *Bad*: Manually writing `{"business_id": current_user.business_id}` in 50 separate repository functions.
   - *Good*: Base tenant repository class automatically prepending `business_id` to every query filter.
2. **Duplicate Calculation Logic**:
   - *Bad*: Calculating line totals or tax in router, service, and PDF generator separately.
   - *Good*: Centralized `BillingEngine.calculate_line_item()` and `BillingEngine.calculate_invoice()`.
3. **Redundant Validation Code**:
   - *Bad*: Manual phone number, GSTIN, or SKU regex checks inside route handlers.
   - *Good*: Reusable Pydantic custom types (e.g., `Annotated[str, Field(..., pattern=...)]` or `PhoneNumberStr`).
4. **Boilerplate Error Responses**:
   - *Bad*: Copy-pasting `raise HTTPException(status_code=404, detail="Item not found")` with inconsistent JSON bodies.
   - *Good*: Custom domain exceptions mapped to standard response envelopes via global FastAPI exception handlers.

---

## 4. Security Patterns & Penetration Audit Rules

```text
┌────────────────────────────────────────────────────────────────────────┐
│                      FASTAPI SECURITY AUDIT GATES                      │
├─────────────────────────┬──────────────────────────────────────────────┤
│ 1. Multi-Tenant IDOR    │ BusinessId match assertion on EVERY resource │
│ 2. Injection Defense    │ Type-safe Pydantic fields & BSON builders   │
│ 3. RBAC Enforcement     │ Granular permission dependencies on routes   │
│ 4. Rate Limiting        │ Redis/Memory token bucket on Auth/POS routes │
│ 5. Safe Decimal Math    │ Zero floating-point arithmetic on currency   │
│ 6. PII / Token Hygiene  │ Sensitive fields excluded from logs/responses│
└─────────────────────────┴──────────────────────────────────────────────┘
```

### 4.1. Mandatory IDOR Prevention Test
Every entity endpoint (`GET /items/{id}`, `PUT /sales/{id}`, `DELETE /parties/{id}`) **must** have a test verifying cross-tenant rejection:

```python
@pytest.mark.asyncio
async def test_cross_tenant_idor_prevention(api_client, tenant_a_headers, tenant_b_headers):
    # Tenant A creates an item
    create_res = await api_client.post(
        "/api/v1/items",
        json={"name": "Confidential Widget", "unit_price": "100.00"},
        headers=tenant_a_headers
    )
    item_id = create_res.json()["id"]

    # Tenant B tries to fetch Tenant A's item -> MUST return 404 (Not Found) or 403 (Forbidden)
    leak_res = await api_client.get(f"/api/v1/items/{item_id}", headers=tenant_b_headers)
    assert leak_res.status_code in [404, 403], f"IDOR Vulnerability detected! Tenant B accessed {item_id}"
```

### 4.2. NoSQL & Parameter Pollution Guard
- Reject any unstructured dictionary inputs in request bodies that feed directly into MongoDB filters (prevents `$where`, `$regex`, `$gt` operator injection).
- All query parameters must be explicitly typed Pydantic models or strictly typed route parameters.

### 4.3. Timing Attack & Password Security
- Passwords must use `Argon2id` or `bcrypt` with appropriate work factors.
- Token and signature comparisons must use `hmac.compare_digest()`.

---

## 5. Coding Standards & Code Rating Scorecard

When conducting a backend audit, rate the codebase out of 100 based on the following rubric:

| Category | Weight | Criteria & Evaluation |
|---|:---:|---|
| **Architecture & Layering** | 20% | Clean separation of Routers, Services, Repositories; zero DB calls in routers; strict Dependency Injection. |
| **Test Coverage & Quality** | 25% | Pytest test suite covering unit math, integration endpoints, ACID rollbacks, and multi-tenant isolation. Coverage >= 85%. |
| **Security & Tenant Isolation** | 25% | Strict `business_id` scoping, RBAC guards on every endpoint, zero NoSQL injection vectors, secure JWT lifecycle, no PII leakage. |
| **DRY & Code Deduplication** | 15% | Reusable base repositories, centralized billing/tax engine, common Pydantic field validators, DRY exception handlers. |
| **Typing & Linting Standards** | 15% | Full type annotations (`mypy` strict mode passes), `ruff` clean (0 warnings), Pydantic v2 `ConfigDict` and `Field` constraints. |

### Grade Classification
- **90 - 100 (A+)**: Enterprise production-grade, hardened multi-tenant isolation, comprehensive test suite.
- **75 - 89 (B)**: Good foundation, minor refactoring required in deduplication or test fixture coverage.
- **60 - 74 (C)**: Architectural leaks detected (e.g., business logic in routes), missing tenant IDOR tests.
- **< 60 (F - Failing)**: Security vulnerability present (cross-tenant leak risk, raw dict query injections, unvalidated float math). Must block release.
