import pytesseract
from PIL import Image
import io
import re
import logging
from typing import Optional

logger = logging.getLogger(__name__)


def extract_text_from_image(image_bytes: bytes) -> str:
    """
    Run Tesseract OCR on image bytes.
    Returns extracted text string.
    """
    try:
        image = Image.open(io.BytesIO(image_bytes))
        # Use French + English for West African context
        text = pytesseract.image_to_string(image, lang='fra+eng')
        logger.info(f"OCR extracted {len(text)} characters")
        return text
    except Exception as e:
        logger.error(f"OCR failed: {e}")
        return ""


def validate_orange_money_payment(
    ocr_text: str,
    expected_amount: float,
    business_phone: str
) -> dict:
    """
    Validate a parsed Orange Money payment screenshot.

    Checks:
    1. The amount matches expected total (within 1 FCFA tolerance)
    2. Business phone number appears in the text
    3. Success keywords are present

    Returns a dict with:
        - is_valid: bool
        - extracted_amount: float or None
        - reason: explanation string
    """
    text_lower = ocr_text.lower()

    # --- Check success keywords ---
    success_keywords = [
        "succès", "success", "réussi", "confirmé", "confirmed",
        "transaction réussie", "paiement effectué", "envoi réussi"
    ]
    has_success = any(kw in text_lower for kw in success_keywords)

    if not has_success:
        return {
            "is_valid": False,
            "extracted_amount": None,
            "reason": "Aucun mot clé de succès trouvé dans la capture"
        }

    # --- Extract amount from text ---
    # Orange Money receipts show amounts like "5 000 F CFA" or "5000 FCFA" or "5.000"
    amount_patterns = [
        r'(\d[\d\s]*\d)\s*(?:f\s*cfa|fcfa|cfa|francs?)',  # 5 000 FCFA
        r'montant\s*:?\s*(\d[\d\s]*\d)',                    # Montant: 5000
        r'(\d[\d\s]*\d)\s*(?:xof)',                         # XOF notation
    ]

    extracted_amount = None
    for pattern in amount_patterns:
        match = re.search(pattern, text_lower)
        if match:
            # Remove spaces from number (e.g. "5 000" → "5000")
            amount_str = match.group(1).replace(' ', '').replace('.', '')
            try:
                extracted_amount = float(amount_str)
                break
            except ValueError:
                continue

    if extracted_amount is None:
        return {
            "is_valid": False,
            "extracted_amount": None,
            "reason": "Impossible d'extraire le montant de la capture"
        }

    # --- Validate amount matches ---
    tolerance = 1.0  # Allow 1 FCFA difference for rounding
    amount_matches = abs(extracted_amount - expected_amount) <= tolerance

    if not amount_matches:
        return {
            "is_valid": False,
            "extracted_amount": extracted_amount,
            "reason": f"Montant incorrect: trouvé {extracted_amount:,.0f} FCFA, attendu {expected_amount:,.0f} FCFA"
        }

    # --- Check business phone number ---
    # Clean phone for comparison (remove spaces, dashes, +)
    clean_business_phone = re.sub(r'[\s\-\+]', '', business_phone)
    # Also check last 8 digits (local format)
    local_phone = clean_business_phone[-8:]
    clean_text = re.sub(r'[\s\-\+]', '', ocr_text)

    phone_found = clean_business_phone in clean_text or local_phone in clean_text

    if not phone_found:
        return {
            "is_valid": False,
            "extracted_amount": extracted_amount,
            "reason": f"Numéro de téléphone du business non trouvé dans la capture"
        }

    return {
        "is_valid": True,
        "extracted_amount": extracted_amount,
        "reason": "Paiement validé avec succès"
    }