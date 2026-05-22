# Shared in-memory QR store
# Written by: app/routes/webhook.py  (on qrcode.updated / connection.update)
# Read by:    app/routes/auth.py     (WebSocket qr-stream)

_qr_store: dict[str, str] = {}