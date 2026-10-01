import os
import sys

# Ensure apps/api directory is on python path
current_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if current_dir not in sys.path:
    sys.path.insert(0, current_dir)

from app.main import app as fastapi_app

# ASGI middleware to handle Vercel path rewrites
async def app(scope, receive, send):
    if scope["type"] == "http":
        headers = dict(scope.get("headers", []))
        # If Vercel rewrote the path to /api/index.py or /api/index, restore original path from x-matched-path
        current_path = scope.get("path", "")
        if current_path in ("/api/index.py", "/api/index", "/api"):
            matched_path = headers.get(b"x-matched-path", b"").decode("utf-8")
            if matched_path and matched_path not in ("/api/index.py", "/api/index"):
                scope["path"] = matched_path
                scope["raw_path"] = matched_path.encode("utf-8")
            else:
                scope["path"] = "/"
                scope["raw_path"] = b"/"

    await fastapi_app(scope, receive, send)
