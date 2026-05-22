"""
app/crypto.py
─────────────
Fernet symmetric encryption for WhatsApp access tokens stored in the DB.

Usage:
    from app.crypto import encrypt_token, decrypt_token

    ciphertext = encrypt_token("EAAxxxxxxx")   # store in DB
    plaintext  = decrypt_token(ciphertext)      # use to call Meta API
"""
from cryptography.fernet import Fernet, InvalidToken
from fastapi import HTTPException
from app.config import settings

_fernet = Fernet(settings.ENCRYPTION_KEY.encode())


def encrypt_token(plaintext: str) -> str:
    return _fernet.encrypt(plaintext.encode()).decode()


def decrypt_token(ciphertext: str) -> str:
    try:
        return _fernet.decrypt(ciphertext.encode()).decode()
    except InvalidToken:
        raise HTTPException(
            status_code=500,
            detail="Impossible de déchiffrer le token WhatsApp. Contactez le support.",
        )