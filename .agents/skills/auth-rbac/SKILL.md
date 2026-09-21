---
name: auth-rbac
description: >-
  Implementation guidelines for user authentication, password hashing (Argon2/bcrypt),
  JWT access/refresh token lifecycles, Role-Based Access Control (RBAC), and endpoint authorization guards.
---

# Authentication & Role-Based Access Control (RBAC)

## 1. Authentication Architecture

- **Password Hashing**: Argon2id or bcrypt with high work factor (salt rounds $\ge 12$).
- **Token Strategy**:
  - **Access Token**: Short-lived JWT (e.g., 15 minutes), signed via RS256 or HS256, carrying user ID, default business ID, and permission roles.
  - **Refresh Token**: Long-lived opaque string or cryptographic JWT (e.g., 30 days) stored hashed in MongoDB with device/session fingerprinting for revocation.
- **Session Revocation**: User logout or password change immediately invalidates the refresh token family.

---

## 2. Role-Based Permissions Matrix

| Permission Key | Description | Admin | Cashier | Inventory Staff | Accountant |
| :--- | :--- | :---: | :---: | :---: | :---: |
| `sales.create` | Create sale invoices & scan items | ✅ | ✅ | ❌ | ❌ |
| `sales.read` | View sales transaction list | ✅ | ✅ | ❌ | ✅ |
| `sales.refund` | Issue refunds / credit notes | ✅ | ❌ | ❌ | ✅ |
| `items.manage` | Add, edit items & generate QR | ✅ | ❌ | ✅ | ❌ |
| `inventory.adjust`| Perform manual stock adjustments | ✅ | ❌ | ✅ | ❌ |
| `purchases.create`| Enter purchase invoices | ✅ | ❌ | ✅ | ✅ |
| `expenses.create` | Record business expense vouchers | ✅ | ❌ | ❌ | ✅ |
| `reports.view` | View P&L, Balance Sheet & reports | ✅ | ❌ | ❌ | ✅ |
| `users.manage` | Add/remove staff & assign roles | ✅ | ❌ | ❌ | ❌ |
| `business.settings`| Configure store profile & tax rules | ✅ | ❌ | ❌ | ❌ |

---

## 3. FastAPI Authorization Guard Pattern

```python
from enum import Enum
from typing import List
from fastapi import Depends, HTTPException, status
from app.core.security import get_current_user_claims
from app.models.user import UserTokenClaims

class Permission(str, Enum):
    SALES_CREATE = "sales.create"
    SALES_READ = "sales.read"
    SALES_REFUND = "sales.refund"
    ITEMS_MANAGE = "items.manage"
    INVENTORY_ADJUST = "inventory.adjust"
    PURCHASES_CREATE = "purchases.create"
    EXPENSES_CREATE = "expenses.create"
    REPORTS_VIEW = "reports.view"
    USERS_MANAGE = "users.manage"
    BUSINESS_SETTINGS = "business.settings"

def require_permissions(required_permissions: List[Permission]):
    async def permission_checker(claims: UserTokenClaims = Depends(get_current_user_claims)):
        user_perms = set(claims.permissions)
        # Admin role implicitly holds all permissions
        if "admin" in claims.roles:
            return claims

        for req in required_permissions:
            if req.value not in user_perms:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Missing required permission: '{req.value}'"
                )
        return claims
    return permission_checker
```

### Usage on Router Endpoints
```python
@router.post("/sales", status_code=201, dependencies=[Depends(require_permissions([Permission.SALES_CREATE]))])
async def create_sales_invoice(...):
    ...
```

---

## 4. Mobile Client Authentication Flow

1. User submits Phone/Email + Password.
2. API validates credentials and returns `accessToken`, `refreshToken`, and list of `businesses`.
3. Mobile app stores tokens in `expo-secure-store`.
4. Axios request interceptor attaches `Authorization: Bearer <accessToken>` and `X-Business-ID: <selectedBusinessId>`.
5. Axios response interceptor catches `401 Unauthorized` $\rightarrow$ calls `POST /auth/refresh` $\rightarrow$ retries failed request seamlessly.

---

## 5. Verification Checklist
- [ ] Passwords stored using secure salted hash (never plaintext).
- [ ] Expired access tokens rejected with HTTP 401.
- [ ] Endpoints protected by granular RBAC permissions.
- [ ] Refresh token revocation blocks subsequent refresh attempts.
