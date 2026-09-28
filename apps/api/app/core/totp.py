import base64
import hashlib
import hmac
import secrets
import struct
import time
from typing import List, Optional
import urllib.parse

def generate_totp_secret() -> str:
    """
    Generates a cryptographically secure 20-byte (160-bit) Base32 secret key.
    Compatible with Google Authenticator, Microsoft Authenticator, and standard RFC 6238 apps.
    """
    random_bytes = secrets.token_bytes(20)
    return base64.b32encode(random_bytes).decode("utf-8").replace("=", "")

def get_totp_uri(secret: str, email: str, issuer: str = "QuickBill Platform") -> str:
    """
    Generates the standard otpauth:// URI for QR code generation in authenticator apps.
    """
    clean_email = urllib.parse.quote(email.strip())
    clean_issuer = urllib.parse.quote(issuer.strip())
    return f"otpauth://totp/{clean_issuer}:{clean_email}?secret={secret}&issuer={clean_issuer}&algorithm=SHA1&digits=6&period=30"

def generate_totp_code(secret: str, for_time: Optional[float] = None, interval: int = 30) -> str:
    """
    Generates the 6-digit TOTP code for a given timestamp using HMAC-SHA1 (RFC 6238).
    """
    t = time.time() if for_time is None else for_time
    time_counter = int(t // interval)
    
    # Pad secret if padding is missing
    clean_secret = secret.strip().upper().replace(" ", "")
    missing_padding = len(clean_secret) % 8
    if missing_padding:
        clean_secret += "=" * (8 - missing_padding)
    
    key = base64.b32decode(clean_secret, casefold=True)
    msg = struct.pack(">Q", time_counter)
    
    h = hmac.new(key, msg, hashlib.sha1).digest()
    offset = h[-1] & 0x0F
    code_int = struct.unpack(">I", h[offset:offset + 4])[0] & 0x7FFFFFFF
    code = code_int % 1000000
    return f"{code:06d}"

def verify_totp_code(secret: str, code: str, drift_window: int = 1, interval: int = 30) -> bool:
    """
    Verifies a user-submitted 6-digit code against the secret across a ± drift window (default ±30s).
    Uses constant-time comparison to prevent timing attacks.
    """
    clean_code = code.strip().replace(" ", "").replace("-", "")
    if len(clean_code) != 6 or not clean_code.isdigit():
        return False

    now = time.time()
    for offset in range(-drift_window, drift_window + 1):
        test_time = now + (offset * interval)
        expected_code = generate_totp_code(secret, for_time=test_time, interval=interval)
        if hmac.compare_digest(clean_code, expected_code):
            return True

    return False

def generate_backup_codes(count: int = 8) -> List[str]:
    """
    Generates single-use 8-character emergency backup recovery codes (format: XXXX-XXXX).
    """
    codes = []
    for _ in range(count):
        part1 = secrets.token_hex(2).upper()
        part2 = secrets.token_hex(2).upper()
        codes.append(f"{part1}-{part2}")
    return codes
