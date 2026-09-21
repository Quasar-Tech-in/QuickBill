---
name: secure-coding
description: >-
  Security rules and defensive coding standards: OWASP Top 10 mitigation, NoSQL injection
  prevention, CORS/CSRF headers, rate limiting, and secure credential handling.
---

# Secure Coding & Defense-in-Depth Standards

## 1. Core Principles

1. **DEFENSE IN DEPTH**:
   - Security checks must occur across all layers (Network, Gateway, API Routing, Business Logic, Database Access).
   - Never rely on mobile or frontend client-side validation alone.
2. **STRICT INPUT SANITIZATION & TYPE VALIDATION**:
   - All inbound JSON payloads must be parsed and strictly validated using Pydantic schemas. Extra unexpected fields should be discarded (`extra='forbid'` or `extra='ignore'`).
3. **PRINCIPLE OF LEAST PRIVILEGE**:
   - Cashiers, stock staff, and accountants are granted only the minimum API permissions required for their specific workflow.

---

## 2. Specific Attack Mitigations

### 2.1. NoSQL Injection Prevention
Never pass raw, unsanitized user strings directly into MongoDB operator keys:
```python
# ❌ VULNERABLE (Attacker can pass dict like {"$gt": ""})
user = await db.users.find_one({"email": request_body["email"]})

# ✅ SECURE (Pydantic enforces string type + explicit assignment)
class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8)

user = await db.users.find_one({"email": str(login_req.email)})
```

### 2.2. Rate Limiting on Sensitive Endpoints
Apply rate limits using Redis / `slowapi` on authentication and lookup endpoints:
- `POST /api/v1/auth/login`: Max 5 attempts per IP per minute.
- `POST /api/v1/auth/forgot-password`: Max 3 attempts per hour.
- `GET /api/v1/items/lookup/qr/*`: Max 120 scans per minute per cashier session.

### 2.3. Safe File Uploads (Receipts / Invoices / Logos)
- Validate magic bytes / MIME types on the server (do not rely on file extension).
- Maximum upload size capped at 5 MB.
- Store user files in S3-compatible private object storage; serve files via short-lived pre-signed URLs.

---

## 3. Security Headers & CORS Policy

```python
from fastapi.middleware.cors import CORSMiddleware

def configure_security_headers(app):
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["https://admin.yourdomain.com", "http://localhost:3000"],
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type", "X-Business-ID", "Idempotency-Key", "X-Request-ID"],
    )

    @app.middleware("http")
    async def add_security_headers(request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        return response
```

---

## 4. Verification Checklist
- [ ] NoSQL injection vulnerabilities prevented via typed Pydantic models.
- [ ] Rate limits configured on `/auth/login`.
- [ ] Strict CORS policy enabled with whitelisted origins and custom headers.
- [ ] Sensitive secrets stored in environment variables, never checked into Git.
