---
name: fastapi-backend
description: >-
  Standards and design patterns for developing the FastAPI REST backend: clean
  architecture (router, service, repository layers), Pydantic v2 validation,
  dependency injection, tenant extraction, error handling contracts, and OpenAPI.
---

# FastAPI Backend Standards & Architecture

## 1. Clean Layered Architecture

```text
apps/api/app/
├── api/                  # HTTP Routers (v1)
│   ├── v1/
│   │   ├── auth.py
│   │   ├── businesses.py
│   │   ├── items.py
│   │   ├── sales.py
│   │   ├── purchases.py
│   │   ├── expenses.py
│   │   ├── parties.py
│   │   ├── payments.py
│   │   └── reports.py
│   └── deps.py           # Reusable API Dependencies (Auth, DB, RBAC)
├── core/                 # Config, Security, Constants, Database client
│   ├── config.py
│   ├── database.py
│   └── security.py
├── models/               # MongoDB Document Definitions / Beanie ODM models
├── schemas/              # Pydantic v2 Request/Response Data Contracts
├── services/             # Business Logic & Orchestration (Calculations, State transitions)
├── repositories/         # Database access layer (tenant-scoped MongoDB queries)
└── main.py               # Application factory & middleware configuration
```

### Layer Rules & Responsibilities
1. **Routers (`api/`)**: Accept HTTP requests, parse query params/path variables, call service methods, and return Pydantic response models. **Zero raw DB queries or business math in routers.**
2. **Services (`services/`)**: Orchestrate business logic, run validation rules, handle calculations, manage ACID transaction sessions, and trigger events/audit logs.
3. **Repositories (`repositories/`)**: Execute MongoDB CRUD and aggregation pipelines. **Must inject and scope all queries with `businessId`.**
4. **Schemas (`schemas/`)**: Strict Pydantic v2 models with type annotations, field validations, and example payloads for OpenAPI.

---

## 2. Pydantic v2 Schema Conventions

```python
from decimal import Decimal
from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict

class BaseTenantSchema(BaseModel):
    model_config = ConfigDict(populate_by_name=True, from_attributes=True)

class ItemCreateRequest(BaseTenantSchema):
    name: str = Field(..., min_length=2, max_length=150, description="Product display name")
    sku: Optional[str] = Field(None, max_length=50, description="Stock Keeping Unit / Barcode")
    category_id: Optional[str] = Field(None, description="Category ObjectId")
    unit: str = Field(default="pcs", description="Measurement unit (pcs, kg, ltr, etc.)")
    purchase_price: Decimal = Field(..., ge=0, decimal_places=2, description="Purchase cost")
    sale_price: Decimal = Field(..., ge=0, decimal_places=2, description="Retail selling price")
    tax_rate: Decimal = Field(default=Decimal("0.0"), ge=0, le=100, description="Applicable GST/Tax percentage")
    min_stock_alert: int = Field(default=5, ge=0, description="Low stock warning threshold")

class ItemResponse(BaseTenantSchema):
    id: str = Field(..., alias="_id")
    business_id: str
    public_item_id: str
    name: str
    sku: Optional[str]
    unit: str
    purchase_price: Decimal
    sale_price: Decimal
    tax_rate: Decimal
    current_stock: int
    min_stock_alert: int
    qr_payload: str
    is_active: bool
    created_at: datetime
```

---

## 3. Dependency Injection & Context Extraction

```python
from fastapi import Depends, HTTPException, status, Header
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.core.security import decode_jwt_token
from app.models.user import UserTokenClaims

security_scheme = HTTPBearer()

async def get_current_user_claims(
    creds: HTTPAuthorizationCredentials = Depends(security_scheme)
) -> UserTokenClaims:
    claims = decode_jwt_token(creds.credentials)
    if not claims:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired access token."
        )
    return claims

async def get_current_business_id(
    claims: UserTokenClaims = Depends(get_current_user_claims),
    x_business_id: Optional[str] = Header(None, alias="X-Business-ID")
) -> str:
    # Verify user has membership in requested business
    target_business = x_business_id or claims.default_business_id
    if target_business not in claims.authorized_business_ids:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User is not authorized to perform actions for this business."
        )
    return target_business
```

---

## 4. Standard Error Contract

Every non-2xx response must conform to a predictable JSON error contract:
```json
{
  "error": {
    "code": "ITEM_OUT_OF_STOCK",
    "message": "Product 'Organic Green Tea' has only 2 units available (requested 5).",
    "details": {
      "itemId": "65f2a1b9e01...",
      "availableStock": 2,
      "requestedQuantity": 5
    }
  }
}
```

---

## 5. Pagination & Filtering Standards
All list endpoints (`/items`, `/sales`, `/parties`, `/expenses`) must support standardized pagination parameters:
- `page`: int (default `1`, `ge=1`)
- `page_size`: int (default `20`, `ge=1`, `le=100`)
- `sort_by`: str (default `"created_at"`)
- `sort_dir`: str (`"asc"` | `"desc"`, default `"desc"`)

```json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "totalItems": 142,
    "totalPages": 8
  }
}
```

---

## 6. Verification Checklist
- [ ] All business endpoints require authentication and inject `business_id`.
- [ ] Money calculations use `Decimal` with strict validation rules.
- [ ] OpenAPI schema documentation renders correctly at `/docs`.
- [ ] Pydantic validation errors return HTTP 422 with readable field hints.
