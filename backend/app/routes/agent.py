"""
app/routes/agent.py

Universal voice agent endpoint for SuguAI.
Receives: transcribed text + current page context + page data
Returns:  AI action to execute on the frontend + TTS audio

Actions:
  fill_field   → { field: str, value: str }
  submit_form  → {}
  open_modal   → { modal: str }
  open_file_picker → { field: str }
  update_status → { order_id: str, status: str }
  speak        → (just speak, no DOM action)
  navigate     → { path: str }
  summarize    → { data: dict }
"""

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

import anthropic

from app.database import get_db
from app.models.business import Business
from app.models.product import Product
from app.models.order import Order
from app.config import settings
from app.dependencies import get_current_business

router = APIRouter(prefix="/agent", tags=["VoiceAgent"])
logger = logging.getLogger(__name__)
_claude = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)


# ── Request / Response schemas ─────────────────────────────────────────────────

class AgentCommandRequest(BaseModel):
    text: str                          # transcribed user speech
    page: str                          # "login" | "register" | "products" | "orders" | "settings" | "conversations"
    language: str = "french"           # "french" | "bambara" | "mixed"
    session_data: dict = {}            # current form state or page data passed from frontend
    business_id: Optional[str] = None # if authenticated


# ── System prompt per page ─────────────────────────────────────────────────────

PAGE_CONTEXTS = {
    "login": """
The user is on the LOGIN page. Fields: phone_number, password.
If the user gives their phone number, action=fill_field, field=phone_number.
If the user gives their password, action=fill_field, field=password.
If both are filled or user says "connecter/login/se connecter", action=submit_form.
If user says they have no account, action=navigate, path=/register.
""",
    "register": """
The user is on the REGISTER page. Fields: name (business name), phone_number, password, business_type.
business_type options: "products_seller" (sells physical goods) or "service_information" (services).
If user mentions their shop name, action=fill_field, field=name.
If user gives phone, action=fill_field, field=phone_number.
If user gives password, action=fill_field, field=password.
If user says they sell products/clothes/food → action=fill_field, field=business_type, value=products_seller.
If user says services/repair/information → action=fill_field, field=business_type, value=service_information.
If user says "créer/register/terminer", action=submit_form.
If user wants voice setup, action=navigate, path=/onboarding.
""",
    "products": """
The user is on the PRODUCTS page managing their product catalog.
To CREATE a product, guide through: name → price → stock → unit → description → (optional) photo.
If user gives product name: action=fill_field, field=name.
If user gives price (extract number): action=fill_field, field=price.
If user gives stock quantity: action=fill_field, field=stock.
If user gives unit (kg, sac, litre, unité...): action=fill_field, field=unit.
If user gives description: action=fill_field, field=description.
If user wants to add photo: action=open_file_picker, field=image.
If all fields filled or user says "sauvegarder/terminer/créer": action=submit_form.
If user asks for product list summary: action=speak (summarize the session_data.products).
""",
    "orders": """
The user is on the ORDERS page.
If user asks how many orders / statistics: action=speak, summarize from session_data.orders.
If user wants to update an order status:
  - Extract order number or partial ID from speech
  - Extract new status: "payé"→paid, "livré"→delivered, "expédié"→shipped, "annulé"→cancelled, "traitement"→processing
  - action=update_status, order_id=<id>, status=<status>
If user asks to see details of an order: action=select_order, order_id=<id>.
""",
    "settings": """
The user is on the SETTINGS / configuration page.
Fields: name, description, payment_instructions, ai_tone, language.
If user gives shop description: action=fill_field, field=description.
If user gives payment info: action=fill_field, field=payment_instructions.
If user says "sauvegarder/enregistrer": action=submit_form.
If user asks about WhatsApp connection: action=speak (explain QR code scanning process).
""",
    "conversations": """
The user is on the CONVERSATIONS page viewing customer chats.
If user asks for summary: action=speak (summarize conversation stats).
If user wants to activate/deactivate AI for a conversation: action=toggle_ai, conversation_id=<id>.
""",
}


def _build_system_prompt(page: str, language: str, session_data: dict) -> str:
    lang_instruction = {
        "bambara": "Reply in warm phonetic Bambara with French numbers/terms. Use 'I ni ce', 'Awo', 'Inch'Allah'.",
        "mixed":   "Reply naturally mixing Bambara greetings with French instructions.",
        "french":  "Reply in warm, simple French. Use 'Inch'Allah', 'Vraiment' naturally.",
    }.get(language, "Reply in French.")

    page_ctx = PAGE_CONTEXTS.get(page, "General assistant.")
    data_summary = ""
    if session_data:
        import json
        data_summary = f"\nCurrent page data: {json.dumps(session_data, ensure_ascii=False)[:800]}"

    return f"""You are SuguAI, a warm bilingual voice assistant helping Malian merchants use a WhatsApp commerce app.
Many merchants cannot read or write — guide them patiently, one step at a time.

LANGUAGE: {lang_instruction}

PAGE CONTEXT:
{page_ctx}
{data_summary}

RESPONSE FORMAT — you MUST return a valid JSON object with EXACTLY these fields:
{{
  "action": "fill_field" | "submit_form" | "open_modal" | "open_file_picker" | "update_status" | "select_order" | "toggle_ai" | "navigate" | "speak",
  "field": "<field name if action=fill_field or open_file_picker>",
  "value": "<extracted clean value if action=fill_field or update_status>",
  "order_id": "<order id if action=update_status or select_order>",
  "status": "<new status if action=update_status>",
  "path": "<route if action=navigate>",
  "conversation_id": "<id if action=toggle_ai>",
  "speech": "<what the AI should SAY to the user in the correct language — short, warm, max 2 sentences>"
}}

RULES:
- Always include "speech" — this is what gets read aloud to the user.
- For fill_field: extract ONLY the clean value (just the number, just the name, etc).
- For prices: extract numbers only, strip "FCFA", "francs", "mille" → convert to integer.
- For phone numbers: normalize to international format if possible.
- If you cannot determine an action, use action="speak" and ask a clarifying question.
- speech must be SHORT (max 2 sentences), voice-optimized: no markdown, no emojis, no lists.
- Always guide to the NEXT step after confirming what you heard.
- Return ONLY the JSON object. No markdown, no explanation, no code fences."""


# ── TTS helper ─────────────────────────────────────────────────────────────────

def _speak(text: str, language: str) -> str:
    try:
        from app.services.speech_service import synthesize
        return synthesize(text, language)
    except Exception as e:
        logger.error(f"TTS failed: {e}")
        return ""


# ── Main endpoint ──────────────────────────────────────────────────────────────

@router.post("/command")
async def agent_command(
    body: AgentCommandRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Core voice agent brain.
    Input:  transcribed speech + page context
    Output: action to execute + speech to play
    """
    if not body.text.strip():
        raise HTTPException(status_code=400, detail="Empty command")

    # Enrich session_data with live DB data for summary actions
    enriched_data = dict(body.session_data)
    if body.business_id and body.page in ("orders", "products", "settings"):
        try:
            from uuid import UUID
            biz_id = UUID(body.business_id)
            if body.page == "orders":
                result = await db.execute(
                    select(func.count(Order.id), func.sum(Order.total_amount))
                    .where(Order.business_id == biz_id)
                )
                count, total = result.first()
                enriched_data["order_count"] = count or 0
                enriched_data["total_revenue"] = float(total or 0)
            elif body.page == "products":
                result = await db.execute(
                    select(func.count(Product.id)).where(Product.business_id == biz_id)
                )
                enriched_data["product_count"] = result.scalar() or 0
        except Exception as e:
            logger.warning(f"DB enrichment failed: {e}")

    system = _build_system_prompt(body.page, body.language, enriched_data)

    try:
        resp = _claude.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=300,
            system=system,
            messages=[{"role": "user", "content": body.text}]
        )
        raw = resp.content[0].text.strip()
        # Strip markdown fences if model adds them
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        import json
        action_data = json.loads(raw)
    except Exception as e:
        logger.error(f"Agent AI error: {e}")
        fallback_speech = "Désolé, je n'ai pas compris. Pouvez-vous répéter?" if body.language == "french" else "Awo, dɔn tɛ. Aw haminikɛ tugun."
        return {
            "action": "speak",
            "speech": fallback_speech,
            "audio": _speak(fallback_speech, body.language),
        }

    speech = action_data.get("speech", "")
    audio = _speak(speech, body.language) if speech else ""

    return {
        **action_data,
        "audio": audio,
    }


# ── STT endpoint (shared with onboarding) ─────────────────────────────────────

from fastapi import UploadFile, File, Form

@router.post("/transcribe")
async def transcribe_audio(
    audio: UploadFile = File(...),
    page: str = Form("unknown"),
):
    """Transcribe audio and return text + language for the frontend to send to /agent/command."""
    audio_bytes = await audio.read()
    if not audio_bytes:
        raise HTTPException(status_code=400, detail="Empty audio")
    try:
        from app.services.speech_service import transcribe
        result = transcribe(audio_bytes, mime_type=audio.content_type or "audio/webm")
        return result  # { text, language, intent, whisper_lang }
    except (ValueError, RuntimeError) as e:
        raise HTTPException(status_code=422, detail=str(e))