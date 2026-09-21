---
name: observability
description: >-
  Observability, structured JSON logging, distributed tracing with OpenTelemetry,
  correlation/request IDs, health checks, error monitoring, and PII masking.
---

# Observability, Structured Logging & Tracing

## 1. Core Principles

1. **STRUCTURED JSON LOGGING**:
   - Never use unstructured `print()` statements.
   - All backend logs must be formatted as machine-parseable JSON containing standard envelope fields.
2. **CONTEXT CORRELATION (REQUEST & TENANT IDS)**:
   - Every inbound HTTP request receives or inherits an `X-Request-ID`.
   - The logger automatically binds `request_id`, `business_id`, and `user_id` to every log line within that async request context.
3. **ZERO SENSITIVE PII IN LOGS**:
   - Mask customer passwords, plain credit card / bank account numbers, JWT tokens, and tax identification numbers.

---

## 2. Standard Structured Log Envelope

```json
{
  "timestamp": "2026-09-20T10:15:02.145Z",
  "level": "INFO",
  "logger": "app.services.sale_service",
  "message": "Sales invoice created successfully",
  "context": {
    "requestId": "req_8f1a7c3b2e",
    "businessId": "65f2a1b9a00...",
    "userId": "65f2a1b9u01...",
    "invoiceNumber": "INV-2026-000142",
    "grandTotal": 917.00,
    "itemsCount": 2,
    "durationMs": 42.6
  }
}
```

---

## 3. OpenTelemetry Integration & Distributed Tracing

Instrument FastAPI with OpenTelemetry for distributed tracing:
```python
from opentelemetry import trace
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from opentelemetry.instrumentation.pymongo import PymongoInstrumentor
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor, OTLPSpanExporter

def setup_telemetry(app):
    provider = TracerProvider()
    processor = BatchSpanProcessor(OTLPSpanExporter(endpoint="http://otel-collector:4317"))
    provider.add_span_processor(processor)
    trace.set_tracer_provider(provider)

    FastAPIInstrumentor.instrument_app(app)
    PymongoInstrumentor().instrument()
```

---

## 4. Health Checks & Metrics Endpoints

- `GET /health/live`: Fast liveness check returning `{"status": "ok"}`.
- `GET /health/ready`: Readiness check asserting active connectivity to MongoDB and Redis before accepting traffic.

```python
@app.get("/health/ready", tags=["Health"])
async def readiness_probe(db = Depends(get_database)):
    try:
        # Ping MongoDB database
        await db.command("ping")
        return {"status": "ready", "database": "connected"}
    except Exception as e:
        return JSONResponse(
            status_code=503,
            content={"status": "unhealthy", "database": "disconnected", "error": str(e)}
        )
```

---

## 5. Verification Checklist
- [ ] Correlation `request_id` passed through from HTTP header to logs and responses.
- [ ] MongoDB latency and query timings instrumented.
- [ ] Passwords and auth tokens masked from log outputs.
- [ ] Health check endpoints respond with appropriate HTTP status codes.
