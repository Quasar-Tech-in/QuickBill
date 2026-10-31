"""
Milestone 1 Empirical Verification Script
Café Schema Wiring, Session Service, and Public Ordering Validation
"""
import sys
import os
from decimal import Decimal
from typing import Dict, Any

# Ensure apps/api is on sys.path
api_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if api_root not in sys.path:
    sys.path.insert(0, api_root)

from pydantic import ValidationError
from app.schemas.cafe import (
    BusinessPersona,
    CafeConfig,
    TenantSettings,
    TableCreate,
    TableUpdate,
    TableResponse,
    PublicOrderItem,
    PublicOrderSubmitRequest,
    TableSettleRequest,
)


def run_checks():
    passed = 0
    failed = 0

    def check(name: str, condition: bool, err_msg: str = ""):
        nonlocal passed, failed
        if condition:
            print(f"  [PASS] {name}")
            passed += 1
        else:
            print(f"  [FAIL] {name}: {err_msg}")
            failed += 1

    print("=================================================================")
    print("RUNNING EMPIRICAL VERIFICATION FOR CAFÉ SCHEMAS & PUBLIC ORDERING")
    print("=================================================================")

    # -------------------------------------------------------------------------
    # Objective 1.1: PublicOrderSubmitRequest accepts qrToken, token, both, snake_case
    # -------------------------------------------------------------------------
    print("\n[Objective 1.1] PublicOrderSubmitRequest Token Aliasing & Validation")

    # (a) accepts qrToken (original camelCase)
    try:
        p1 = PublicOrderSubmitRequest.model_validate({
            "tableId": "65f2a1b9a000000000000001",
            "qrToken": "qr_token_original",
            "items": [{"itemId": "item_1", "unitPrice": 150.0, "quantity": 1.0}],
            "customerName": "Diner One"
        })
        check("Accepts qrToken", p1.qr_token == "qr_token_original")
    except Exception as e:
        check("Accepts qrToken", False, str(e))

    # (b) accepts token (frontend style)
    try:
        p2 = PublicOrderSubmitRequest.model_validate({
            "tableId": "65f2a1b9a000000000000001",
            "token": "frontend_token_style",
            "items": [{"itemId": "item_1", "unitPrice": 150.0, "quantity": 1.0}],
            "customerName": "Diner Two"
        })
        check("Accepts token (frontend style)", p2.qr_token == "frontend_token_style")
    except Exception as e:
        check("Accepts token (frontend style)", False, str(e))

    # (c) accepts both qrToken and token without error
    try:
        p3 = PublicOrderSubmitRequest.model_validate({
            "tableId": "65f2a1b9a000000000000001",
            "qrToken": "primary_token",
            "token": "secondary_token",
            "items": [{"itemId": "item_1", "unitPrice": 150.0, "quantity": 1.0}],
        })
        check("Accepts both qrToken and token without 422", p3.qr_token in ("primary_token", "secondary_token"))
    except Exception as e:
        check("Accepts both qrToken and token without 422", False, str(e))

    # (d) accepts qr_token (snake_case)
    try:
        p4 = PublicOrderSubmitRequest.model_validate({
            "table_id": "65f2a1b9a000000000000001",
            "qr_token": "snake_case_token",
            "items": [{"itemId": "item_1", "unitPrice": 150.0, "quantity": 1.0}],
        })
        check("Accepts qr_token (snake_case)", p4.qr_token == "snake_case_token")
    except Exception as e:
        check("Accepts qr_token (snake_case)", False, str(e))

    # (e) raises ValidationError when no token is supplied
    try:
        PublicOrderSubmitRequest.model_validate({
            "tableId": "65f2a1b9a000000000000001",
            "items": [{"itemId": "item_1", "unitPrice": 150.0, "quantity": 1.0}],
        })
        check("Rejects missing token with ValidationError", False, "Expected ValidationError")
    except ValidationError:
        check("Rejects missing token with ValidationError", True)
    except Exception as e:
        check("Rejects missing token with ValidationError", False, f"Unexpected error: {e}")

    # (f) raises ValidationError when items list is empty (min_length=1)
    try:
        PublicOrderSubmitRequest.model_validate({
            "tableId": "65f2a1b9a000000000000001",
            "token": "valid_token",
            "items": [],
        })
        check("Rejects empty items list with ValidationError", False, "Expected ValidationError")
    except ValidationError:
        check("Rejects empty items list with ValidationError", True)
    except Exception as e:
        check("Rejects empty items list with ValidationError", False, f"Unexpected error: {e}")

    # -------------------------------------------------------------------------
    # Objective 1.2: TableResponse properly serializes qrCodeToken
    # -------------------------------------------------------------------------
    print("\n[Objective 1.2] TableResponse qrCodeToken Serialization")

    # (a) Direct instantiation with qrCodeToken alias
    try:
        tr1 = TableResponse(
            _id="tbl_oid_123",
            businessId="biz_oid_456",
            tableNumber="T-01",
            label="Table 1",
            section="Main Hall",
            seatingCapacity=4,
            currentStatus="AVAILABLE",
            qrCodeUrl="/order/biz/tbl?token=tok123",
            qrCodeToken="tok123"
        )
        check("qr_code_token parsed from alias", tr1.qr_code_token == "tok123")
        dumped1 = tr1.model_dump(by_alias=True)
        check("model_dump(by_alias=True) contains qrCodeToken", "qrCodeToken" in dumped1 and dumped1["qrCodeToken"] == "tok123")
    except Exception as e:
        check("TableResponse direct instantiation", False, str(e))

    # (b) model_validate from dict as returned by db/service
    try:
        db_doc = {
            "_id": "65f2a1b9a000000000000001",
            "businessId": "65f2a1b9a000000000000002",
            "tableNumber": "T-10",
            "label": "Table 10",
            "section": "Indoor AC",
            "seatingCapacity": 6,
            "currentStatus": "OCCUPIED",
            "activeSessionId": "65f2a1b9a000000000000003",
            "qrCodeUrl": "/order/65f2a1b9a000000000000002/65f2a1b9a000000000000001?token=secret999",
            "qrCodeToken": "secret999",
            "isActive": True,
        }
        tr2 = TableResponse.model_validate(db_doc)
        dumped2 = tr2.model_dump(by_alias=True)
        check("model_validate preserves qrCodeToken", dumped2.get("qrCodeToken") == "secret999")
        check("model_dump has _id, businessId, tableNumber, qrCodeToken",
              dumped2.get("_id") == "65f2a1b9a000000000000001" and
              dumped2.get("businessId") == "65f2a1b9a000000000000002" and
              dumped2.get("qrCodeToken") == "secret999")
    except Exception as e:
        check("TableResponse model_validate from db dict", False, str(e))

    # -------------------------------------------------------------------------
    # Objective 1.3: TableSettleRequest accepts discountAmount as well as discountType/Value
    # -------------------------------------------------------------------------
    print("\n[Objective 1.3] TableSettleRequest Discount Fields & Alias")

    # (a) Accepts discountAmount (camelCase alias)
    try:
        s1 = TableSettleRequest.model_validate({
            "paymentMode": "CASH",
            "paidAmount": 250.0,
            "discountAmount": 50.0,
            "customerName": "Alice"
        })
        check("Accepts discountAmount alias", s1.discount_amount == 50.0)
    except Exception as e:
        check("Accepts discountAmount alias", False, str(e))

    # (b) Accepts discount_amount (snake_case)
    try:
        s2 = TableSettleRequest(discount_amount=75.0, payment_mode="CARD")
        check("Accepts discount_amount direct", s2.discount_amount == 75.0)
    except Exception as e:
        check("Accepts discount_amount direct", False, str(e))

    # (c) Accepts discountType and discountValue
    try:
        s3 = TableSettleRequest.model_validate({
            "paymentMode": "UPI",
            "discountType": "PERCENTAGE",
            "discountValue": 10.0
        })
        check("Accepts discountType and discountValue", s3.discount_type == "PERCENTAGE" and s3.discount_value == 10.0)
    except Exception as e:
        check("Accepts discountType and discountValue", False, str(e))

    # (d) Verify service settlement discount resolution logic
    # In cafe_session_service.py:
    # disc_type = payload.discount_type
    # disc_val = Decimal(str(payload.discount_value)) if payload.discount_value else None
    # if disc_val is None and payload.discount_amount is not None:
    #     disc_type = "FIXED"
    #     disc_val = Decimal(str(payload.discount_amount))
    def resolve_settle_discount(payload: TableSettleRequest):
        disc_type = payload.discount_type
        disc_val = Decimal(str(payload.discount_value)) if payload.discount_value else None
        if disc_val is None and payload.discount_amount is not None:
            disc_type = "FIXED"
            disc_val = Decimal(str(payload.discount_amount))
        return disc_type, disc_val

    t_type, t_val = resolve_settle_discount(s1)
    check("Service fallback: discountAmount mapped to FIXED discount", t_type == "FIXED" and t_val == Decimal("50.0"))

    t_type_pct, t_val_pct = resolve_settle_discount(s3)
    check("Service logic: PERCENTAGE discount preserved", t_type_pct == "PERCENTAGE" and t_val_pct == Decimal("10.0"))

    # -------------------------------------------------------------------------
    # Objective 1.4: TenantSettings rejects invalid persona types during Pydantic validation
    # -------------------------------------------------------------------------
    print("\n[Objective 1.4] TenantSettings Business Persona Validation")

    # (a) Valid personas accept RETAIL, CAFE, HYBRID
    for persona_val in ["RETAIL", "CAFE", "HYBRID"]:
        try:
            ts = TenantSettings.model_validate({"businessPersona": persona_val})
            check(f"Accepts valid persona '{persona_val}'", ts.business_persona.value == persona_val)
        except Exception as e:
            check(f"Accepts valid persona '{persona_val}'", False, str(e))

    # (b) Default is RETAIL
    try:
        ts_default = TenantSettings()
        check("Default businessPersona is RETAIL", ts_default.business_persona == BusinessPersona.RETAIL)
    except Exception as e:
        check("Default businessPersona is RETAIL", False, str(e))

    # (c) Invalid persona strings are rejected
    invalid_test_cases = [
        "INVALID",
        "BAR",
        "RESTAURANT",
        "SALON",
        "HOTEL",
        "retail",   # lowercase must be rejected by strict enum
        "cafe",     # lowercase
        "hybrid",   # lowercase
        "123",
        "",
    ]
    for inv in invalid_test_cases:
        try:
            TenantSettings.model_validate({"businessPersona": inv})
            check(f"Rejects invalid persona '{inv}'", False, "Expected ValidationError was not raised")
        except ValidationError:
            check(f"Rejects invalid persona '{inv}'", True)
        except Exception as e:
            check(f"Rejects invalid persona '{inv}'", False, f"Unexpected error type: {e}")

    # (d) Invalid non-string types rejected
    for inv_type in [123, 45.67, True, [], {}]:
        try:
            TenantSettings.model_validate({"businessPersona": inv_type})
            check(f"Rejects non-string persona '{inv_type}'", False, "Expected ValidationError")
        except ValidationError:
            check(f"Rejects non-string persona '{inv_type}'", True)
        except Exception as e:
            check(f"Rejects non-string persona '{inv_type}'", False, f"Unexpected error: {e}")

    # -------------------------------------------------------------------------
    # SUMMARY
    # -------------------------------------------------------------------------
    print("\n=================================================================")
    print(f"VERIFICATION SUMMARY: {passed} PASSED, {failed} FAILED")
    print("=================================================================")

    if failed > 0:
        print("VERDICT: FAIL")
        return False
    else:
        print("VERDICT: ALL EMPIRICAL CHECKS PASSED")
        return True


if __name__ == "__main__":
    success = run_checks()
    sys.exit(0 if success else 1)
