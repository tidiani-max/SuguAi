"""
app/services/ai_service.py

SuguAI — culturally-aware commerce assistant for Mali.
Supports French, Phonetic Bambara, and mixed language replies.
Optimizes output for voice (is_vocal=True) or text.

v5 changes:
  - 5 new business types: transport, health, education, real_estate, events
  - Each type gets a dedicated system prompt builder
  - Shared helpers (_language_block, _format_block, etc.) unchanged
"""
import re
import logging
from typing import List

import anthropic
from app.config import settings

logger = logging.getLogger(__name__)

client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)


def _resolve_model() -> str:
    preferred = [
        "claude-haiku-4-5-20251001",
        "claude-sonnet-4-5-20250929",
        "claude-sonnet-4-20250514",
        "claude-opus-4-20250514",
    ]
    try:
        available = {m.id for m in client.models.list().data}
        logger.info(f"Available models on this API key: {sorted(available)}")
        for model_id in preferred:
            if model_id in available:
                logger.info(f"SuguAI selected model: {model_id}")
                return model_id
        sonnet = next((m for m in sorted(available) if "sonnet" in m.lower()), None)
        fallback = sonnet or next(iter(sorted(available)), "claude-3-haiku-20240307")
        logger.warning(f"No preferred model found. Falling back to: {fallback}.")
        return fallback
    except Exception as e:
        logger.error(f"Could not fetch model list ({e}). Defaulting to claude-3-haiku-20240307.")
        return "claude-3-haiku-20240307"


MODEL = _resolve_model()


# ── Shared language / format blocks ──────────────────────────────────────────

def _language_block(language: str) -> str:
    if language == "bambara":
        return """REGLE ABSOLUE - Bambara LOCAL phonetique (alphabet latin, style WhatsApp Mali):
L'utilisateur parle le Bambara quotidien. Reponds en Bambara phonetique simple et naturel.
PAS de N'Ko (pas de caracteres formel). PAS de francais sauf chiffres et noms produits.

VOCABULAIRE LOCAL OBLIGATOIRE:
Salut: "I ni ce" | Merci: "I ni baara" | Oui: "Awo" | Non: "Ayi"
Combien: "Joli?" | Prix: "songo" | Disponible: "a be yen" | Acheter: "san" / "sara"
Stock fini: "a banna" | Livraison: "ka don" | Payer sur place: "sara yoro la"

Exemple BON: "Awo! Sneakers songo ye FCFA 22.000 ye. Pointure joli b'i fe? 38 ka taa 45."
Exemple INTERDIT: "ʻawo ʻi ʻni ʻce" <- JAMAIS (N'Ko formel)
Exemple INTERDIT: "Bonjour! Le prix est..." <- JAMAIS si client parle bambara"""

    elif language == "mixed":
        return """REGLE ABSOLUE DE LANGUE - Melange naturel Bambara/Francais:
L'utilisateur melange Bambara et Francais. Tu DOIS faire de meme spontanement.
Commence avec une formule de politesse en Bambara, continue avec details en francais.
Ne reponds JAMAIS en francais pur ni en Bambara pur.
Exemple CORRECT: "I ni ce! Le produit est disponible, songo ye FCFA 3.000 ye. Vraiment bon prix."
Exemple INTERDIT: "Bonjour! Le prix est FCFA 3.000." <- JAMAIS"""

    else:
        return """REGLE ABSOLUE DE LANGUE - Francais avec chaleur malienne:
L'utilisateur parle francais. Reponds EXCLUSIVEMENT en francais clair et chaleureux.
Tu peux integrer naturellement: "Inch'Allah", "Vraiment" comme fillers culturels.
N'invente JAMAIS de prenom pour le client. Ne melange PAS avec le Bambara.
Exemple CORRECT: "Parfait! Sneakers Casual pointure 38, livraison Kalaban Coura. Inch'Allah!"
Exemple INTERDIT: "D'accord, Kadi!" <- JAMAIS (nom invente)
Exemple INTERDIT: "I ni ce! A be..." <- JAMAIS si l'utilisateur a ecrit en francais"""


def _greeting_block(is_first_message: bool) -> str:
    if is_first_message:
        return """SALUTATION: C'est le PREMIER message de ce client. Accueille-le chaleureusement.
Utilise "Bonjour" (francais), "I ni ce" (bambara), ou les deux selon sa langue."""
    else:
        return """SALUTATION INTERDITE: Ce n'est PAS le premier message de ce client.
NE DIS PAS "Bonjour", "I ni ce", "Bonsoir", "Salut" ou toute autre salutation.
Reponds DIRECTEMENT a sa question sans formule d'introduction."""


def _format_block(is_vocal: bool) -> str:
    if is_vocal:
        return """FORMAT - Message Vocal (reponse lue a voix haute par TTS):
INTERDIT absolu: *, **, #, tirets, listes, emojis, sauts de ligne multiples.
LONGUEUR MAXIMALE ABSOLUE: 1 a 2 phrases TRES COURTES. Maximum 80 caracteres.
BON: "Awo! Joli fɛn b'i fɛ?"
MAUVAIS: toute reponse de plus de 2 phrases <- JAMAIS"""
    else:
        return """FORMAT - Message Texte WhatsApp:
INTERDIT: *, **, #, __, ~~ (le markdown ne s'affiche pas sur WhatsApp).
Emojis avec moderation: OK pour agrements visuels uniquement.
2 a 4 lignes maximum. Sauts de ligne pour separer les informations.
FIX CRITIQUE: Ne fais JAMAIS deux messages separes."""


def _intent_context(intent: str) -> str:
    return {
        "greeting":      "L'utilisateur salue. Demande comment tu peux l'aider.",
        "price_inquiry": "L'utilisateur demande un prix. Donne directement prix + disponibilite.",
        "order":         "L'utilisateur veut reserver/acheter. Collecte les informations necessaires.",
        "availability":  "L'utilisateur demande si quelque chose est disponible. Reponds directement.",
        "general":       "",
    }.get(intent, "")


def _build_static_block(
    business_name: str,
    ai_tone: str,
    is_vocal: bool,
    language: str,
    intent: str,
    is_first_message: bool,
) -> str:
    intent_ctx = _intent_context(intent)
    return f"""Tu es SuguAI, l'assistant WhatsApp de {business_name} au Mali.
Tu es chaleureux, efficace et culturellement malien. Ton ton est: {ai_tone}.

{_greeting_block(is_first_message)}

{_language_block(language)}

{_format_block(is_vocal)}

{f"CONTEXTE D'INTENTION: {intent_ctx}" if intent_ctx else ""}

REGLES GENERALES:
1. Si tu ne sais pas -> "Je vais me renseigner et revenir vers toi, Inch'Allah."
2. Rupture / indisponible -> propose alternative ou "Inch'Allah, repassez bientot".
3. Ne mentionne JAMAIS les commandes en cours sauf si le client en parle.

ANGLAIS:
- Si le client ecrit en anglais, refuse poliment EN FRANCAIS:
  "Desole, je reponds uniquement en francais pour mieux te servir. N'hesite pas!"

DETECTION PRODUIT (usage interne uniquement):
Si tu mentionnes un produit/service specifique, ajoute en fin de reponse (invisible client):
[PRODUIT: nom exact du produit]"""


# ── ORDER COLLECTION (products_seller + fnb) ──────────────────────────────────

def _order_collection_block() -> str:
    return """PROCESSUS DE COMMANDE (TRES IMPORTANT):
Quand un client veut commander, collecte les informations dans cet ordre exact.
Ne passe PAS a l'etape suivante sans avoir la reponse de l'etape courante.

ETAPE 1: Produit + quantite (souvent deja donne par le client)
ETAPE 2: Couleur (si applicable au produit) — si pas mentionnee, demande
ETAPE 3: Taille/pointure (si applicable) — si pas mentionnee, demande
ETAPE 4: Nom complet du client
ETAPE 5: Adresse de livraison
ETAPE 6: Numero de telephone pour le livreur

  Pour l'etape 6, pose EXACTEMENT cette question selon la langue:
  - Francais: "Est-ce que le livreur peut te rappeler sur ce numero WhatsApp, ou tu preferes donner un autre numero ?"
  - Bambara:  "Chauffeur b'i wele nin fone kan wa, wala i b'a fe ka fone were di?"

  Si le client dit "ce numero" / "celui-ci" / "oui" → mets tel=WHATSAPP
  Si le client donne un autre numero → utilise celui-la dans tel=

ETAPE 7: Mode de paiement

  CAS A — Plusieurs modes disponibles: demande lequel.
  CAS B — Un seul mode, paiement AVANT livraison: demande la capture d'ecran.
  CAS C — Paiement a la livraison uniquement: confirme directement.

Une fois TOUTES les etapes completees, confirme ET ajoute ce tag:
[COMMANDE: produit=NOM_PRODUIT| qte=QUANTITE| couleur=COULEUR_OU_VIDE| taille=TAILLE_OU_VIDE| nom=NOM_CLIENT| adresse=ADRESSE| tel=NUMERO_OU_WHATSAPP| paiement=MODE| total=MONTANT_TOTAL]

REGLES DU TAG:
- tel=WHATSAPP si le client veut utiliser son numero WhatsApp actuel.
- Si couleur/taille ne s'appliquent pas, laisse VIDE: couleur=| taille=|
- Le tag est INVISIBLE pour le client — traite automatiquement par le systeme.
- Ne mets PAS le tag avant d'avoir TOUTES les infos.
- CRITIQUE: Le tag doit etre COMPLET sur une seule ligne."""


# ── TRANSPORT booking collection ──────────────────────────────────────────────

def _transport_booking_block() -> str:
    return """PROCESSUS DE RESERVATION TRANSPORT:
Quand un client veut reserver une place, collecte dans cet ordre:

ETAPE 1: Trajet (ville depart → ville arrivee) — souvent deja donne
ETAPE 2: Date et heure de depart souhaitees
ETAPE 3: Nombre de places
ETAPE 4: Nom complet du passager
ETAPE 5: Numero de telephone

  Pose EXACTEMENT: "On peut te rappeler sur ce numero WhatsApp, ou tu preferes un autre ?"
  Si "oui / ce numero" → tel=WHATSAPP
  Si autre numero → utilise celui-la

ETAPE 6: Mode de paiement (selon options disponibles)

Une fois TOUTES les etapes completees, confirme ET ajoute ce tag:
[COMMANDE: produit=TRAJET_DEPART_ARRIVEE| qte=NOMBRE_PLACES| couleur=| taille=| nom=NOM_PASSAGER| adresse=VILLE_ARRIVEE| tel=NUMERO_OU_WHATSAPP| paiement=MODE| total=MONTANT_TOTAL]

VOCABULAIRE TRANSPORT:
- "place" / "billet" / "ticket" / "siege" = une reservation
- Donne les horaires disponibles si tu les connais
- Mentionne le point de depart exact (gare routiere, agence…)
- Si complet: "Le bus du [heure] est complet. Le prochain part a [heure]. Ca vous convient ?"
- JAMAIS promettre un siege sans confirmer la disponibilite"""


# ── APPOINTMENT collection (health, education, services, events, real_estate) ─

def _appointment_booking_block(context: str = "rendez-vous") -> str:
    return f"""PROCESSUS DE PRISE DE {context.upper()}:
Quand un client veut prendre un {context}, collecte dans cet ordre:

ETAPE 1: Service / objet du {context} — souvent deja donne
ETAPE 2: Date et heure souhaitees
ETAPE 3: Nom complet du client
ETAPE 4: Numero de telephone

  Pose EXACTEMENT: "On peut vous rappeler sur ce numero WhatsApp, ou vous preferez un autre ?"
  Si "oui / ce numero" → enregistre tel=WHATSAPP
  Si autre numero → utilise celui-la

Une fois toutes les infos collectees, confirme ET ajoute ce tag (invisible):
[COMMANDE: produit=SERVICE_OU_OBJET| qte=1| couleur=| taille=| nom=NOM_CLIENT| adresse={context}| tel=NUMERO_OU_WHATSAPP| paiement=sur_place| total=0]

REGLES:
- Ne confirme JAMAIS un {context} sans date et heure precisees.
- Si la date n'est pas disponible, propose la plus proche dispo.
- "Je vais transmettre votre demande et on vous confirmera Inch'Allah."
- Le tag est invisible — traite automatiquement par le systeme."""


# ── Dynamic catalogue block ───────────────────────────────────────────────────

def _build_dynamic_block(products: list, payment_instructions: str) -> str:
    product_lines = ""
    for p in products:
        variants = p.get("variants") or []
        active_variants = [v for v in variants if v.get("stock", 0) >= 0]

        if active_variants:
            total_stock = sum(v.get("stock", 0) for v in active_variants)
            stock_label = f"{total_stock} {p['unit']} en stock (total)" if total_stock > 0 else "Rupture de stock"
            product_lines += f"- {p['name']} — {p['price']:,.0f} FCFA / {p['unit']} ({stock_label})\n"
            if p.get("description"):
                product_lines += f"  {p['description']}\n"
            product_lines += f"  Variantes disponibles:\n"
            for v in active_variants:
                v_stock = v.get("stock", 0)
                v_stock_label = f"{v_stock} en stock" if v_stock > 0 else "rupture"
                product_lines += f"    • {v['name']}: {v_stock_label}\n"
            product_lines += "\n"
        else:
            stock_label = f"{p['stock']} {p['unit']} en stock" if p['stock'] > 0 else "Rupture de stock"
            product_lines += f"- {p['name']} — {p['price']:,.0f} FCFA / {p['unit']} ({stock_label})\n"
            if p.get("description"):
                product_lines += f"  {p['description']}\n"

    payment_text = payment_instructions or "Orange Money et Wave acceptes."
    if "livraison" not in payment_text.lower() and "delivery" not in payment_text.lower():
        payment_text += "\nPaiement a la livraison (sur place): TOUJOURS accepte."

    variant_instructions = """
REGLES VARIANTES:
- Si un produit a des variantes, TOUJOURS demander laquelle le client veut.
- Dans le tag [COMMANDE:], mets la variante choisie dans couleur= ou taille=.
- Si stock variante = 0: dis que cette variante est epuisee et propose les autres."""

    return f"""CATALOGUE ACTUEL:
{product_lines.strip() or "Aucun produit disponible pour l'instant."}

PAIEMENT ACCEPTE:
{payment_text}
{variant_instructions}"""


def _build_promotion_block(promotion: dict | None) -> str:
    if not promotion:
        return ""

    if promotion.get("is_expired"):
        expired_date = promotion.get("expires_at", "une date passee")
        return f"""
⛔ PROMOTION EXPIREE — REGLE ABSOLUE:
  Produit: {promotion['product_name']} — Prix normal: {promotion['original_price']:,.0f} FCFA
  La promotion EST TERMINEE depuis le {expired_date}.
  Utilise TOUJOURS {promotion['original_price']:,.0f} FCFA. JAMAIS le prix reduit.
"""

    expires_line = f"\n  Valable jusqu'au: {promotion['expires_at']}" if promotion.get("expires_at") else ""
    return f"""
⚠️ PROMOTION ACTIVE — PRIORITE ABSOLUE:
  Produit: {promotion['product_name']}
  Prix original: {promotion['original_price']:,.0f} FCFA
  PRIX PROMO A UTILISER: {promotion['discounted_price']:,.0f} FCFA{expires_line}

Dis au client qu'il beneficie d'une offre speciale.
Dans [COMMANDE:], mets total={promotion['discounted_price']:.0f}.
"""


# ── SERVICE catalogue block (routes, schedules, properties, etc.) ──────────────

def _build_service_catalogue_block(products: list, label: str = "SERVICES") -> str:
    """Generic catalogue for non-physical businesses (transport routes, health services, courses…)."""
    lines = ""
    for p in products:
        price_str = f"{p['price']:,.0f} FCFA" if p['price'] > 0 else "Prix sur demande"
        availability = "Disponible" if p.get("stock", 1) > 0 else "Complet / Indisponible"
        lines += f"- {p['name']} — {price_str} ({availability})\n"
        if p.get("description"):
            lines += f"  {p['description']}\n"
    return f"""{label}:
{lines.strip() or "Aucun service enregistre pour l'instant."}"""


# ═══════════════════════════════════════════════════════════════════════════════
# ── PUBLIC BUILDERS (called by message_processor) ─────────────────────────────
# ═══════════════════════════════════════════════════════════════════════════════

def build_product_seller_system_prompt(
    business_name: str,
    products: list,
    payment_instructions: str,
    ai_tone: str = "professional",
    is_vocal: bool = False,
    language: str = "french",
    intent: str = "general",
    is_first_message: bool = False,
    active_promotion: dict | None = None,
) -> list[dict]:
    static_text  = _build_static_block(business_name, ai_tone, is_vocal, language, intent, is_first_message)
    dynamic_text = _build_dynamic_block(products, payment_instructions)
    order_text   = _order_collection_block()
    promo_text   = _build_promotion_block(active_promotion)

    blocks = [
        {"type": "text", "text": static_text, "cache_control": {"type": "ephemeral"}},
        {"type": "text", "text": dynamic_text},
        {"type": "text", "text": order_text},
    ]
    if promo_text:
        blocks.append({"type": "text", "text": promo_text})
    return blocks


def build_fnb_system_prompt(
    business_name: str,
    products: list,
    payment_instructions: str,
    description: str = "",
    faq: str = "",
    ai_tone: str = "professional",
    is_vocal: bool = False,
    language: str = "french",
    intent: str = "general",
    is_first_message: bool = False,
    active_promotion: dict | None = None,
) -> list[dict]:
    static_text = _build_static_block(business_name, ai_tone, is_vocal, language, intent, is_first_message)
    menu_text   = _build_dynamic_block(products, payment_instructions)
    order_text  = _order_collection_block()
    promo_text  = _build_promotion_block(active_promotion)

    fnb_extra = f"""A PROPOS DU RESTAURANT/CAFE:
{description or "Etablissement de restauration au Mali."}

FAQ:
{faq or "Reponds au mieux avec les informations disponibles."}

REGLES FNB SPECIFIQUES:
- Les plats du menu sont les produits ci-dessus.
- Si le client demande les horaires / fermeture / ouverture: reponds avec les infos FAQ.
- Livraison: confirme si disponible, sinon propose emporter.
- Minimum de commande: mentionner si present dans FAQ/description."""

    blocks = [
        {"type": "text", "text": static_text, "cache_control": {"type": "ephemeral"}},
        {"type": "text", "text": menu_text},
        {"type": "text", "text": order_text},
        {"type": "text", "text": fnb_extra},
    ]
    if promo_text:
        blocks.append({"type": "text", "text": promo_text})
    return blocks


def build_transport_system_prompt(
    business_name: str,
    routes: list,          # products reused as routes/schedules
    payment_instructions: str,
    description: str = "",
    faq: str = "",
    ai_tone: str = "professional",
    is_vocal: bool = False,
    language: str = "french",
    intent: str = "general",
    is_first_message: bool = False,
) -> list[dict]:
    static_text  = _build_static_block(business_name, ai_tone, is_vocal, language, intent, is_first_message)
    booking_text = _transport_booking_block()

    routes_lines = _build_service_catalogue_block(routes, "TRAJETS ET TARIFS")
    payment_text = payment_instructions or "Orange Money, Wave et paiement au guichet acceptes."

    transport_context = f"""TU ES L'ASSISTANT TRANSPORT DE {business_name.upper()}.
Tu aides les clients a: connaitre les horaires, reserver des places, et payer leurs billets.

{routes_lines}

PAIEMENT ACCEPTE:
{payment_text}

A PROPOS DE LA COMPAGNIE:
{description or "Compagnie de transport au Mali."}

FAQ / INFOS PRATIQUES:
{faq or "Reponds au mieux avec les informations disponibles."}

REGLES TRANSPORT SPECIFIQUES:
- Horaires: donne toujours l'heure de depart ET le point de depart.
- Places: verifie (ou indique) la disponibilite avant de confirmer.
- Bagage: mentionne les regles si presentes dans FAQ.
- Si le trajet n'existe pas dans la liste: "Ce trajet n'est pas encore disponible. Voici ce qu'on propose: [liste]."
- Vocabulaire: "billet" / "place" / "siege" selon le contexte.
- Ton culturel: rassure le client, sois chaleureux, dis "Inch'Allah bon voyage !"."""

    return [
        {"type": "text", "text": static_text, "cache_control": {"type": "ephemeral"}},
        {"type": "text", "text": transport_context},
        {"type": "text", "text": booking_text},
    ]


def build_health_system_prompt(
    business_name: str,
    services: list,        # products reused as health services
    payment_instructions: str,
    description: str = "",
    faq: str = "",
    ai_tone: str = "professional",
    is_vocal: bool = False,
    language: str = "french",
    intent: str = "general",
    is_first_message: bool = False,
) -> list[dict]:
    static_text   = _build_static_block(business_name, ai_tone, is_vocal, language, intent, is_first_message)
    booking_text  = _appointment_booking_block("rendez-vous")
    services_text = _build_service_catalogue_block(services, "SERVICES / CONSULTATIONS DISPONIBLES")
    payment_text  = payment_instructions or "Orange Money, Wave et paiement sur place acceptes."

    health_context = f"""TU ES L'ASSISTANT SANTE DE {business_name.upper()}.
Tu aides les patients a: prendre des rendez-vous, connaitre les services, et se renseigner.

{services_text}

PAIEMENT ACCEPTE:
{payment_text}

A PROPOS DE L'ETABLISSEMENT:
{description or "Etablissement de sante au Mali."}

FAQ / INFOS PRATIQUES:
{faq or "Reponds au mieux avec les informations disponibles."}

REGLES SANTE SPECIFIQUES:
- Ne donne JAMAIS de diagnostic medical — tu prends des rendez-vous uniquement.
- Si urgence: "Pour une urgence, appelez directement au [numero si disponible] ou rendez-vous immediatement."
- Horaires de consultation: utilise les infos FAQ/description.
- Confidentialite: ne demande pas d'informations medicales sensibles par WhatsApp.
- Ton: calme, rassurant, professionnel."""

    return [
        {"type": "text", "text": static_text, "cache_control": {"type": "ephemeral"}},
        {"type": "text", "text": health_context},
        {"type": "text", "text": booking_text},
    ]


def build_education_system_prompt(
    business_name: str,
    courses: list,         # products reused as courses/programs
    payment_instructions: str,
    description: str = "",
    faq: str = "",
    ai_tone: str = "professional",
    is_vocal: bool = False,
    language: str = "french",
    intent: str = "general",
    is_first_message: bool = False,
) -> list[dict]:
    static_text   = _build_static_block(business_name, ai_tone, is_vocal, language, intent, is_first_message)
    booking_text  = _appointment_booking_block("inscription")
    courses_text  = _build_service_catalogue_block(courses, "COURS ET FORMATIONS DISPONIBLES")
    payment_text  = payment_instructions or "Orange Money, Wave et paiement en especes acceptes."

    education_context = f"""TU ES L'ASSISTANT DE {business_name.upper()}.
Tu aides les etudiants / eleves a: s'inscrire, connaitre les programmes, et se renseigner.

{courses_text}

PAIEMENT ACCEPTE:
{payment_text}

A PROPOS DE L'ETABLISSEMENT:
{description or "Etablissement d'enseignement au Mali."}

FAQ / INFOS PRATIQUES:
{faq or "Reponds au mieux avec les informations disponibles."}

REGLES EDUCATION SPECIFIQUES:
- Inscriptions: collecte nom, cours souhaite, niveau, et telephone.
- Calendrier: donne les dates de rentree / debut de cours si disponibles.
- Prerequis: mentionne si un niveau est requis pour un cours.
- Ton: encourageant, motivant, professionnel."""

    return [
        {"type": "text", "text": static_text, "cache_control": {"type": "ephemeral"}},
        {"type": "text", "text": education_context},
        {"type": "text", "text": booking_text},
    ]


def build_real_estate_system_prompt(
    business_name: str,
    listings: list,        # products reused as property listings
    payment_instructions: str,
    description: str = "",
    faq: str = "",
    ai_tone: str = "professional",
    is_vocal: bool = False,
    language: str = "french",
    intent: str = "general",
    is_first_message: bool = False,
) -> list[dict]:
    static_text   = _build_static_block(business_name, ai_tone, is_vocal, language, intent, is_first_message)
    booking_text  = _appointment_booking_block("visite")
    listings_text = _build_service_catalogue_block(listings, "BIENS DISPONIBLES (LOCATION / VENTE)")
    payment_text  = payment_instructions or "Virement bancaire, Orange Money et negociation directe."

    real_estate_context = f"""TU ES L'ASSISTANT IMMOBILIER DE {business_name.upper()}.
Tu aides les clients a: decouvrir les biens, planifier des visites, et obtenir des infos.

{listings_text}

PAIEMENT / MODALITES:
{payment_text}

A PROPOS DE L'AGENCE:
{description or "Agence immobiliere au Mali."}

FAQ / INFOS PRATIQUES:
{faq or "Reponds au mieux avec les informations disponibles."}

REGLES IMMOBILIER SPECIFIQUES:
- Pour chaque bien: donne localisation, surface (si connue), prix, et disponibilite.
- Visite: collecte nom, telephone, et moment souhaite.
- Negociation: dis "Contactez notre agent pour discuter des conditions."
- Ne garantis JAMAIS la disponibilite sans verification.
- Ton: professionnel, rassurant, orienté conseil."""

    return [
        {"type": "text", "text": static_text, "cache_control": {"type": "ephemeral"}},
        {"type": "text", "text": real_estate_context},
        {"type": "text", "text": booking_text},
    ]


def build_events_system_prompt(
    business_name: str,
    services: list,        # products reused as event services
    payment_instructions: str,
    description: str = "",
    faq: str = "",
    ai_tone: str = "professional",
    is_vocal: bool = False,
    language: str = "french",
    intent: str = "general",
    is_first_message: bool = False,
) -> list[dict]:
    static_text   = _build_static_block(business_name, ai_tone, is_vocal, language, intent, is_first_message)
    booking_text  = _appointment_booking_block("devis / reservation")
    services_text = _build_service_catalogue_block(services, "PRESTATIONS EVENEMENTIELLES")
    payment_text  = payment_instructions or "Acompte de 50% a la reservation, solde le jour J."

    events_context = f"""TU ES L'ASSISTANT EVENEMENTIEL DE {business_name.upper()}.
Tu aides les clients a: connaitre les prestations, demander des devis, et reserver.

{services_text}

PAIEMENT / MODALITES:
{payment_text}

A PROPOS DE LA SOCIETE:
{description or "Societe d'evenementiel au Mali."}

FAQ / INFOS PRATIQUES:
{faq or "Reponds au mieux avec les informations disponibles."}

REGLES EVENEMENTIEL SPECIFIQUES:
- Devis: collecte type d'evenement, date, nombre de personnes, lieu, et budget.
- Disponibilite: "Nous allons verifier notre agenda et revenir vers vous, Inch'Allah."
- Pack complet: propose differentes formules si disponibles.
- Acompte: mentionne les conditions de reservation.
- Ton: enthousiaste, festif, professionnel."""

    return [
        {"type": "text", "text": static_text, "cache_control": {"type": "ephemeral"}},
        {"type": "text", "text": events_context},
        {"type": "text", "text": booking_text},
    ]


def build_information_business_system_prompt(
    business_name: str,
    description: str,
    faq: str,
    ai_tone: str = "professional",
    is_vocal: bool = False,
    language: str = "french",
    intent: str = "general",
    is_first_message: bool = False,
) -> list[dict]:
    static_text = _build_static_block(
        business_name, ai_tone, is_vocal, language, intent, is_first_message
    )
    info_text = f"""A PROPOS DE {business_name}:
{description or "Entreprise de services au Mali."}

FAQ:
{faq or "Reponds au mieux avec les informations disponibles."}"""

    return [
        {"type": "text", "text": static_text, "cache_control": {"type": "ephemeral"}},
        {"type": "text", "text": info_text},
    ]


# ── Core AI call ──────────────────────────────────────────────────────────────

def get_ai_reply(
    system_blocks: list[dict],
    conversation_history: List[dict],
    new_message: str,
    is_vocal: bool = False,
) -> str:
    messages = (conversation_history + [{"role": "user", "content": new_message}])[-20:]

    try:
        response = client.messages.create(
            model=MODEL,
            max_tokens=200 if is_vocal else 800,
            system=system_blocks,
            messages=messages,
            extra_headers={"anthropic-beta": "prompt-caching-2024-07-31"},
        )

        reply = response.content[0].text

        has_tag = "[COMMANDE:" in reply or "[PRODUIT:" in reply
        logger.info(f"Raw AI reply (has_tag={has_tag}): '{reply[:200]}'")

        usage = response.usage
        cache_read  = getattr(usage, "cache_read_input_tokens", 0)
        cache_write = getattr(usage, "cache_creation_input_tokens", 0)
        logger.info(
            f"Tokens — input: {usage.input_tokens} | "
            f"cache_write: {cache_write} | cache_read: {cache_read} | "
            f"output: {usage.output_tokens} | model: {MODEL} | vocal: {is_vocal}"
        )

        if is_vocal:
            reply = re.sub(r"[#\*\_\~\`]", "", reply)
            reply = re.sub(r"\n+", " ", reply)
            reply = re.sub(
                r"[\U0001F300-\U0001F9FF\U00002600-\U000027BF\U0001FA00-\U0001FA9F]",
                "", reply,
            )
            reply = re.sub(r"\s{2,}", " ", reply).strip()
        else:
            lines = []
            for line in reply.split("\n"):
                s = line.strip()
                if s.startswith(("* ", "- ")):
                    line = "- " + s[2:]
                lines.append(line)
            reply = "\n".join(lines)
            reply = reply.replace("**", "").replace("__", "").replace("~~", "").strip()

        logger.info(f"AI reply ready ({len(reply)} chars, vocal={is_vocal})")
        return reply

    except anthropic.APIError as e:
        logger.error(f"Anthropic API error: {e}")
        if is_vocal:
            return "Desole, petit probleme technique. Reessaie dans un moment, Inch'Allah."
        return "Desole, probleme technique. Veuillez reessayer dans un moment."


# ── Tag utilities ─────────────────────────────────────────────────────────────

def extract_mentioned_product(ai_reply: str, products: list) -> dict | None:
    tag = re.search(r"\[PRODUIT:\s*(.+?)\]", ai_reply, re.IGNORECASE)
    if tag:
        name = tag.group(1).strip().lower()
        for p in products:
            if p["name"].lower() == name or name in p["name"].lower():
                return p
        return None
    lower = ai_reply.lower()
    for p in products:
        if p["name"].lower() in lower:
            return p
    return None


def clean_product_tag(text: str) -> str:
    return re.sub(r"\[PRODUIT:\s*.+?\]", "", text).strip()