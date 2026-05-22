"""
app/services/speech_service.py

Voice pipeline for SuguAI — Mali commerce assistant.

SIMPLE LANGUAGE RULE:
  French voice note  → Whisper small (forced fr) → MMS-TTS fra
  Bambara voice note → Djelia API               → Djelia TTS
  Unknown/ambiguous  → Try Whisper forced French first.
                       If result looks wrong → Djelia handles it.

FIX v2:
  - detect_language() now recognises BOTH phonetic Latin keywords (typed chat)
    AND real IPA Bambara characters output by Djelia ASR (voice notes).
  - transcribe() now always runs detect_language() on the Djelia transcript
    instead of hardcoding language="french".

FIX v3:
  - Added STRONG_FRENCH tier-0 check: unambiguous French words like "salut",
    "parle", "moi", "oui" immediately return 'french' before any Bambara
    keyword counting. Prevents misclassifying "Salut Bella" as Bambara.
  - Bambara keyword match now requires >= 2 matches AND must exceed French score.
"""

import io
import os
import re
import base64
import logging
import tempfile

logger = logging.getLogger(__name__)

try:
    from app.config import settings as _app_settings
    _DJELIA_API_KEY = _app_settings.DJELIA_API_KEY
except Exception:
    _DJELIA_API_KEY = os.getenv("DJELIA_API_KEY", "")

_whisper_model = None
_tts_fra_cache = None


# ── Djelia client ──────────────────────────────────────────────────────────────

def _get_djelia():
    api_key = _DJELIA_API_KEY
    if not api_key:
        logger.warning("DJELIA_API_KEY not set — Bambara will use Whisper fallback")
        return None
    try:
        from djelia import Djelia
        return Djelia(api_key=api_key)
    except ImportError:
        logger.warning("djelia SDK not installed. Run: pip install djelia")
        return None
    except Exception as e:
        logger.warning(f"Djelia client init failed: {e}")
        return None


# ── Local model loaders ────────────────────────────────────────────────────────

def _get_whisper():
    global _whisper_model
    if _whisper_model is None:
        from faster_whisper import WhisperModel
        logger.info("Loading faster-whisper small (~240 MB, first run)...")
        _whisper_model = WhisperModel("small", device="cpu", compute_type="int8")
        logger.info("faster-whisper small ready.")
    return _whisper_model


def _get_tts_fra():
    global _tts_fra_cache
    if _tts_fra_cache is None:
        import torch
        from transformers import VitsModel, AutoTokenizer

        model_id = "facebook/mms-tts-fra"
        logger.info(f"Loading {model_id} (~145 MB, first run)...")
        tokenizer = AutoTokenizer.from_pretrained(model_id)
        model = VitsModel.from_pretrained(model_id)
        model.eval()
        device = torch.device("mps") if torch.backends.mps.is_available() else torch.device("cpu")
        model = model.to(device)
        _tts_fra_cache = (tokenizer, model, device)
        logger.info(f"MMS TTS fra ready on {device}.")
    return _tts_fra_cache


# ── Language & intent detection ────────────────────────────────────────────────

# Phonetic Latin keywords — used when customer TYPES on WhatsApp
BAMBARA_KEYWORDS_LATIN = {
    "ber", "i ber", "a ber", "ni ke", "ni ke", "inike",
    "i ni ce", "i ni tile", "i ni su", "i ni sogoma",
    "songo", "doni", "wari", "sara", "ka sara",
    "min", "don", "tɛ", "ye", "ka", "bɛ",
    "tokodi", "toko", "foyi", "kana", "nka", "cogo",
    "mogo", "kelen", "fila", "saba", "naani", "duuru",
    "koro", "kuma", "ko", "nii",
    "awo", "hee", "aw", "ee", "ayi", "joli",
    "san", "bisimila", "baara", "awoni",
}

# IPA / real Bambara script — output by Djelia ASR for VOICE notes
BAMBARA_KEYWORDS_IPA = {
    "bɛ", "tɛ", "kɛ", "fɔ", "sɔ", "dɔ", "kɔ", "jɛ", "yɛ",
    "fɔtɔ", "fɔtɔdaw", "ci", "cita", "ka", "ye", "se", "don",
    "kɛra", "kɛlen", "sɔrɔ", "taara", "nana",
    "samara", "samaraya", "wari", "songo", "mɔgɔ", "dɔgɔ",
    "fɛn", "fɛnw", "kɔnɔ", "bolo", "wɛɛ",
    "aw", "awo", "ayi", "ɛɛ", "hɛɛ", "ɲɛ", "ɔ",
    "kɛlɛn", "fila", "saba", "naani", "duuru",
    "wa", "waa", "dɛ", "nɛ", "ko", "nka",
}

BAMBARA_KEYWORDS = BAMBARA_KEYWORDS_LATIN | BAMBARA_KEYWORDS_IPA

# IPA character detection — Djelia Bambara ASR output signature
_IPA_BAMBARA_RE = re.compile(r"[ɛɔɲŋɓɗàáèéìíòóùú]", re.UNICODE)

# FIX v3: Strong French words — unambiguous, never appear in Bambara text.
# If ANY of these words are found, language is immediately 'french'.
STRONG_FRENCH = {
    "salut", "bonjour", "bonsoir", "merci", "oui", "non", "je", "tu", "il",
    "elle", "nous", "vous", "ils", "elles", "est", "sont", "avoir", "etre",
    "une", "des", "les", "pour", "avec", "dans", "sur", "par", "que", "qui",
    "quoi", "comment", "combien", "quand", "pourquoi", "mais", "donc", "alors",
    "pas", "plus", "tres", "bien", "aussi", "encore", "toujours", "jamais",
    "parle", "parler", "moi", "toi", "lui", "eux", "leur", "mon", "ton",
    "son", "notre", "votre", "cette", "cet", "ces", "tout", "tous",
    "veux", "voudrais", "peux", "pouvez", "faire", "venir", "aller",
    "vouloir", "pouvoir", "etre", "avoir", "francais", "chaussures",
    "chaussure", "paire", "paires", "livraison", "paiement", "prix",
    "produit", "commande", "commander", "acheter", "disponible",
}

FRENCH_KEYWORDS = {
    "bonjour", "bonsoir", "merci", "comment", "combien", "prix",
    "vouloir", "voudrais", "avoir", "nous", "vous", "pour", "avec",
    "produit", "article", "livraison", "paiement", "disponible",
    "commander", "acheter", "cher", "moins", "salut", "oui", "non",
    "bien", "tres", "est", "pas", "que", "une", "des", "les", "dans",
    "je", "tu", "il", "elle", "on", "mais", "donc", "alors",
}

_GREETING_RE = re.compile(
    r"\b(a\s*ber|i\s*ber|ni\s*k[eɛ]|inike|bonjour|bonsoir"
    r"|i\s*ni\s*(ce|tile|su|sogoma)|salut|hello|ca\s*va|bisimila)\b",
    re.IGNORECASE
)
_PRICE_RE  = re.compile(r"\b(songo|prix|combien|doni|dɔni|wari|tokodi|joli)\b", re.IGNORECASE)
_ORDER_RE  = re.compile(r"\b(commander|acheter|vouloir|ka\s*san|sara|payer|voudrais|prendre)\b", re.IGNORECASE)
_STOCK_RE  = re.compile(r"\b(disponible|stock|ka\s*sɔrɔ|foyi\s*b[eɛ]|avez|reste|a\s*be\s*yen)\b", re.IGNORECASE)


def detect_language(text: str) -> str:
    """
    Returns 'bambara', 'french', or 'mixed'.

    Four-tier detection:
      Tier 0 — Strong French words: if ANY unambiguous French word is present,
               return 'french' immediately. Fixes "Salut Bella" → bambara bug.
      Tier 1 — IPA characters: if the text contains ɛ, ɔ, ɲ, ŋ etc. →  'bambara'.
      Tier 2 — Keyword overlap: Bambara needs >= 2 matches AND must exceed French.
      Tier 3 — Default to 'french'.
    """
    words = set(re.findall(r"[a-zɛɔɲŋàáèéìíòóùúɔ']+", text.lower()))

    # Tier 0: Strong French — unambiguous, wins immediately
    if words & STRONG_FRENCH:
        logger.debug(f"detect_language: strong French word found → french")
        return "french"

    # Tier 1: IPA Bambara character presence (Djelia ASR output signature)
    ipa_matches = len(_IPA_BAMBARA_RE.findall(text))
    if ipa_matches >= 2:
        logger.debug(f"detect_language: IPA chars={ipa_matches} → bambara")
        return "bambara"

    # Tier 2: keyword overlap — Bambara needs >= 2 matches AND must beat French
    bam = len(words & BAMBARA_KEYWORDS)
    fra = len(words & FRENCH_KEYWORDS)

    logger.debug(f"detect_language: bam_kw={bam} fra_kw={fra} ipa={ipa_matches} text='{text[:50]}'")

    if bam == 0 and fra == 0:
        return "french"
    if bam >= 2 and bam > fra:
        return "bambara"
    if fra > 0 and bam <= fra:
        return "french"
    if bam >= 2 and fra > 0:
        return "mixed"
    return "french"


def detect_intent(text: str) -> str:
    if _GREETING_RE.search(text):  return "greeting"
    if _PRICE_RE.search(text):     return "price_inquiry"
    if _ORDER_RE.search(text):     return "order"
    if _STOCK_RE.search(text):     return "availability"
    return "general"


# ── Audio helpers ──────────────────────────────────────────────────────────────

def _to_wav_path(audio_bytes: bytes) -> str:
    """Convert OGG to 16kHz mono WAV. Returns temp file path (caller deletes)."""
    from pydub import AudioSegment

    with tempfile.NamedTemporaryFile(suffix=".ogg", delete=False) as f:
        f.write(audio_bytes)
        inp = f.name

    out = inp.replace(".ogg", ".wav")
    try:
        audio = AudioSegment.from_file(inp)
        audio = audio.set_frame_rate(16000).set_channels(1)
        audio.export(out, format="wav")
    finally:
        os.unlink(inp)
    return out


def _is_hallucination(text: str) -> bool:
    """Returns True if text looks like a Whisper hallucination."""
    if not text.strip():
        return True
    clean = text.replace(" ", "")
    if len(clean) > 10 and len(set(clean)) < 5:
        return True
    latin = sum(1 for c in clean if ord(c) < 1000)
    if latin < len(clean) * 0.4:
        return True
    return False


# ── Whisper French transcription ───────────────────────────────────────────────

def _transcribe_french(wav_path: str) -> str:
    model = _get_whisper()
    segs, info = model.transcribe(
        wav_path,
        language="fr",
        task="transcribe",
        beam_size=5,
        vad_filter=True,
        vad_parameters={"min_silence_duration_ms": 300},
    )
    text = " ".join(s.text.strip() for s in segs).strip()
    logger.info(f"Whisper (forced fr): prob={info.language_probability:.2f} text='{text[:60]}'")

    if _is_hallucination(text):
        logger.info("Whisper result looks like hallucination — will try Djelia")
        return ""
    return text


# ── Djelia Bambara transcription ───────────────────────────────────────────────

def _transcribe_bambara(wav_path: str) -> str:
    djelia = _get_djelia()
    if djelia is None:
        return ""
    try:
        from djelia.models import Versions
        segments = djelia.transcription.transcribe(
            audio_file=wav_path,
            version=Versions.v2,
        )
        text = " ".join(seg.text.strip() for seg in segments if seg.text).strip()
        logger.info(f"Djelia ASR: '{text[:80]}'")
        return text
    except Exception as e:
        logger.warning(f"Djelia ASR failed: {e}")
        return ""


# ── Claude French cleaner ──────────────────────────────────────────────────────

def _clean_french(text: str) -> str:
    """Fix phonetic mishearings in Malian French."""
    if len(text.split()) < 3:
        return text
    try:
        import anthropic
        client = anthropic.Anthropic(api_key=_app_settings.ANTHROPIC_API_KEY)
        resp = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=200,
            system=(
                "Correcteur de transcriptions vocales maliennes. "
                "RÈGLE: Retourne UNIQUEMENT le texte corrigé, rien d'autre. "
                "Corrige les fautes phonétiques du français malien. "
                "Garde les mots Bambara intacts. "
                "Si incompréhensible, retourne le texte original sans modification."
            ),
            messages=[{"role": "user", "content": text}],
        )
        cleaned = resp.content[0].text.strip()
        bad = ["je remarque", "cette transcription", "je ne peux", "il s'agit", "pouvez-vous"]
        if any(b in cleaned.lower() for b in bad):
            return text
        return cleaned or text
    except Exception as e:
        logger.warning(f"Claude cleaning skipped: {e}")
        return text


# ── Public API ─────────────────────────────────────────────────────────────────

def transcribe(audio_bytes: bytes, mime_type: str = "audio/ogg") -> dict:
    """
    Transcribe a WhatsApp voice note.

    Path A: Try Djelia first (handles French + Bambara natively).
            Always run detect_language() on the result — never assume french.
    Path B: Djelia unavailable → Whisper forced French fallback.

    Returns:
        {"text": str, "language": str, "intent": str, "whisper_lang": str}
    """
    wav_path = None
    text = ""
    language = "french"
    used_djelia = False

    try:
        wav_path = _to_wav_path(audio_bytes)

        djelia_text = _transcribe_bambara(wav_path)
        if djelia_text:
            text = djelia_text
            used_djelia = True
            logger.info("Using Djelia transcription")
        else:
            logger.info("Djelia unavailable — falling back to Whisper forced French")
            text = _transcribe_french(wav_path)

            if not text:
                logger.warning("Both Djelia and Whisper forced-fr failed — trying free detection")
                model = _get_whisper()
                segs, _ = model.transcribe(
                    wav_path, language=None, task="transcribe",
                    beam_size=5, vad_filter=True,
                    vad_parameters={"min_silence_duration_ms": 300},
                )
                text = " ".join(s.text.strip() for s in segs).strip()

    except (ValueError, RuntimeError):
        raise
    except Exception as e:
        raise RuntimeError(f"Transcription failed: {e}") from e
    finally:
        if wav_path and os.path.exists(wav_path):
            os.unlink(wav_path)

    if not text.strip():
        raise ValueError("No speech detected in audio")

    language = detect_language(text)
    logger.info(f"Language detected from transcript: '{language}' (djelia={used_djelia})")

    if not used_djelia and language in ("french", "mixed"):
        text = _clean_french(text)
        language = detect_language(text)

    intent = detect_intent(text)

    logger.info(
        f"Transcript: '{text[:80]}' | lang={language} | intent={intent} | "
        f"model={'djelia' if used_djelia else 'whisper-small'}"
    )
    return {
        "text": text,
        "language": language,
        "intent": intent,
        "whisper_lang": "fr" if not used_djelia else "bm",
    }


# ── TTS ────────────────────────────────────────────────────────────────────────

def synthesize(text: str, language: str) -> str:
    """
    Text-to-speech.
    Bambara/mixed → Djelia TTS (Seydou voice, natural Malian)
    French        → facebook/mms-tts-fra (local, MPS-accelerated)

    Returns: "data:audio/wav;base64,..."
    """
    tmp = None

    if language in ("bambara", "mixed"):
        djelia = _get_djelia()
        if djelia is not None:
            try:
                from djelia.models import TTSRequestV2, Versions
                import uuid as _uuid

                tmp = os.path.join(tempfile.gettempdir(), f"djelia_{_uuid.uuid4().hex}.wav")

                djelia.tts.text_to_speech(
                    request=TTSRequestV2(
                        text=text,
                        description="Seydou speaks warmly and naturally",
                        chunk_size=1.0,
                    ),
                    output_file=tmp,
                    version=Versions.v2,
                )

                with open(tmp, "rb") as f:
                    audio_bytes = f.read()
                os.unlink(tmp)
                tmp = None

                if audio_bytes[:3] == b"ID3" or (
                    len(audio_bytes) > 1
                    and audio_bytes[0] == 0xFF
                    and (audio_bytes[1] & 0xE0) == 0xE0
                ):
                    mime = "audio/mpeg"
                    logger.info(f"Djelia TTS → MP3 detected ({len(audio_bytes):,} B)")
                else:
                    mime = "audio/wav"
                    logger.info(f"Djelia TTS → WAV detected ({len(audio_bytes):,} B)")

                raw_b64 = base64.b64encode(audio_bytes).decode("utf-8")
                logger.info(f"Djelia TTS: {len(text)} chars → Bambara (Seydou)")
                return f"data:{mime};base64,{raw_b64}"

            except TimeoutError as e:
                logger.warning(f"Djelia TTS timed out — falling back to MMS-fra: {e}")
            except Exception as e:
                logger.warning(f"Djelia TTS failed ({e}) — falling back to MMS-fra")
            finally:
                if tmp and os.path.exists(tmp):
                    try:
                        os.unlink(tmp)
                    except OSError:
                        pass

    return _synthesize_mms_fra(text)


def _synthesize_mms_fra(text: str) -> str:
    """French TTS via facebook/mms-tts-fra, MPS-accelerated on Apple Silicon."""
    import torch
    import numpy as np
    import scipy.io.wavfile as wav_io

    try:
        tokenizer, model, device = _get_tts_fra()
        inputs = {k: v.to(device) for k, v in tokenizer(text, return_tensors="pt").items()}
        with torch.no_grad():
            output = model(**inputs)

        waveform = output.waveform.squeeze().cpu().numpy()
        sample_rate = model.config.sampling_rate
        peak = np.max(np.abs(waveform))
        if peak > 0:
            waveform = waveform / peak
        waveform_int16 = (waveform * 32767).astype(np.int16)

        buf = io.BytesIO()
        wav_io.write(buf, sample_rate, waveform_int16)
        raw_b64 = base64.b64encode(buf.getvalue()).decode("utf-8")
        logger.info(f"MMS TTS fra: {len(text)} chars @ {sample_rate}Hz on {device}")
        return f"data:audio/wav;base64,{raw_b64}"
    except Exception as e:
        raise RuntimeError(f"MMS TTS failed: {e}") from e