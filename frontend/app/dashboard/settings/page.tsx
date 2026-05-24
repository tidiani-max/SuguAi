"use client";
import { useEffect, useState, useRef } from "react";
import { authApi } from "@/lib/api";
import { Business, BusinessType } from "@/types";
import toast from "react-hot-toast";

const TONE_OPTIONS = [
  { id: "professional", emoji: "👔", title: "Sérieux",    desc: "Respectueux et poli" },
  { id: "friendly",     emoji: "😊", title: "Amical",     desc: "Comme un ami" },
  { id: "persuasive",   emoji: "💰", title: "Vendeur",    desc: "Pousse à l'achat" },
  { id: "bambara_mixed",emoji: "🇲🇱", title: "Mali Style", desc: "Français + Bambara" },
];

const appendText = (current: string, addition: string) => {
  if (!current) return addition;
  if (current.includes(addition)) return current;
  return `${current}\n${addition}`;
};

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      background: "white", borderRadius: 24, border: "1px solid #E5E7EB",
      padding: 32, marginBottom: 24, boxShadow: "0 4px 10px rgba(0,0,0,0.03)",
    }}>
      {children}
    </div>
  );
}

function SectionTitle({ icon, title }: { icon: string; title: string }) {
  return (
    <h2 style={{
      fontFamily: "var(--font-head)", fontSize: 20, color: "#1B4332",
      marginBottom: 24, display: "flex", alignItems: "center", gap: 10,
    }}>
      <span>{icon}</span> {title}
    </h2>
  );
}

function Pill({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      style={{
        background: "#F3F4F6", border: "1px solid #E5E7EB", padding: "10px 16px",
        borderRadius: 100, fontSize: 13, fontWeight: 600, color: "#4B5563",
        cursor: "pointer", transition: "all 0.2s", display: "inline-block",
      }}
      onMouseEnter={e => { const el = e.currentTarget as HTMLDivElement; el.style.background = "#D4AF37"; el.style.color = "white"; }}
      onMouseLeave={e => { const el = e.currentTarget as HTMLDivElement; el.style.background = "#F3F4F6"; el.style.color = "#4B5563"; }}
    >
      {label}
    </div>
  );
}

// ── WhatsApp connect section ──────────────────────────────────────────────────
type QrPhase = "idle" | "loading" | "qr" | "connecting" | "connected" | "error";

function WhatsAppSection({ business, onReload }: { business: Business; onReload: () => void }) {
  const [phase, setPhase]       = useState<QrPhase>(business.whatsapp_connected ? "connected" : "idle");
  const [qrCode, setQrCode]     = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [disconnecting, setDisconnecting] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (business.whatsapp_connected) setPhase("connected");
    else if (phase === "connected") setPhase("idle");
  }, [business.whatsapp_connected]);

  const closeWs = () => {
    if (wsRef.current) { wsRef.current.close(); wsRef.current = null; }
  };

  const handleConnect = async () => {
    setPhase("loading"); setQrCode(null); setErrorMsg(""); closeWs();
    try {
      const res = await authApi.connectWhatsAppQr();
      if (!res.data.ready) { setPhase("error"); setErrorMsg("Impossible de préparer l'instance WhatsApp."); return; }
      await new Promise(r => setTimeout(r, 1200));
      const token = document.cookie.split("; ").find(r => r.startsWith("access_token="))?.split("=")[1];
      if (!token) { setPhase("error"); setErrorMsg("Session expirée — veuillez vous reconnecter."); return; }
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";
      const wsUrl = backendUrl.replace("https://", "wss://").replace("http://", "ws://");
      const ws = new WebSocket(`${wsUrl}/auth/whatsapp/qr-stream?token=${token}`);
      wsRef.current = ws;
      ws.onopen = () => setPhase("qr");
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.qrcode?.base64 || data.base64) { setQrCode(data.qrcode?.base64 || data.base64); setPhase("qr"); return; }
          if (data.state === "connecting") { setPhase("connecting"); return; }
          if (data.state === "open") { setPhase("connected"); setQrCode(null); toast.success("✅ WhatsApp connecté avec succès !"); onReload(); closeWs(); return; }
          if (data.error) { closeWs(); setPhase("error"); setErrorMsg(data.error); }
        } catch {}
      };
      ws.onerror = () => { closeWs(); setPhase("error"); setErrorMsg("Connexion WebSocket perdue — réessayez."); };
      ws.onclose = (e) => { if (e.code !== 1000 && e.code !== 1001) { setPhase(p => p === "connected" ? p : "error"); } };
    } catch (err: any) {
      setPhase("error"); setErrorMsg(err?.response?.data?.detail || "Erreur réseau — réessayez.");
      toast.error("Impossible de lancer la connexion WhatsApp");
    }
  };

  const handleDisconnect = async () => {
    if (!confirm("Déconnecter votre WhatsApp ? L'assistant ne répondra plus à vos clients.")) return;
    setDisconnecting(true);
    try { await authApi.disconnectWhatsApp(); setPhase("idle"); setQrCode(null); toast.success("WhatsApp déconnecté."); onReload(); }
    catch { toast.error("Erreur lors de la déconnexion."); }
    finally { setDisconnecting(false); }
  };

  const handleCancel = () => { closeWs(); setPhase("idle"); setQrCode(null); };

  const statusBadge = phase === "connected"
    ? { bg: "#DCFCE7", color: "#166534", label: "✅ ACTIF" }
    : { bg: "#FEE2E2", color: "#991B1B", label: "○ ARRÊTÉ" };

  return (
    <Card>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <SectionTitle icon="📱" title="Connexion WhatsApp" />
        <div style={{ background: statusBadge.bg, color: statusBadge.color, padding: "6px 16px", borderRadius: 100, fontWeight: 800, fontSize: 12 }}>
          {statusBadge.label}
        </div>
      </div>

      {phase === "idle" && (
        <div style={{ background: "#F9FAFB", padding: 28, borderRadius: 18, textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 14 }}>📱</div>
          <p style={{ fontWeight: 700, color: "#1B4332", marginBottom: 6 }}>Connectez votre WhatsApp pour recevoir les messages</p>
          <p style={{ fontSize: 13, color: "#6B7280", marginBottom: 20 }}>Une fois connecté, l'assistant répondra automatiquement à vos clients.</p>
          <button onClick={handleConnect} style={{ background: "#25D366", color: "white", padding: "16px 32px", borderRadius: 100, border: "none", fontWeight: 900, cursor: "pointer", fontSize: 16 }}>
            📲 Connecter mon WhatsApp
          </button>
        </div>
      )}

      {phase === "loading" && (
        <div style={{ background: "#F9FAFB", padding: 28, borderRadius: 18, textAlign: "center" }}>
          <div style={{ fontSize: 40, marginBottom: 14 }}>⚙️</div>
          <p style={{ fontWeight: 700, color: "#1B4332" }}>Préparation de votre instance…</p>
          <p style={{ fontSize: 13, color: "#6B7280", marginTop: 6 }}>Cela prend quelques secondes.</p>
        </div>
      )}

      {phase === "qr" && (
        <div style={{ background: "#F9FAFB", padding: 28, borderRadius: 18, textAlign: "center" }}>
          {qrCode ? (
            <>
              <img src={qrCode} alt="QR WhatsApp" style={{ width: 210, border: "8px solid white", borderRadius: 14, boxShadow: "0 4px 20px rgba(0,0,0,0.1)" }} />
              <p style={{ marginTop: 14, fontWeight: 800, color: "#1B4332" }}>Scannez avec votre WhatsApp</p>
              <p style={{ fontSize: 13, color: "#6B7280", marginTop: 6, maxWidth: 320, margin: "8px auto 0" }}>
                Ouvrez WhatsApp → 3 points → "Appareils connectés" → "Connecter un appareil"
              </p>
              <button onClick={handleCancel} style={{ color: "#6B7280", background: "none", border: "none", marginTop: 14, cursor: "pointer", fontSize: 13 }}>Annuler</button>
            </>
          ) : (
            <>
              <div style={{ fontSize: 40, marginBottom: 14 }}>⏳</div>
              <p style={{ fontWeight: 700, color: "#1B4332" }}>En attente du QR code…</p>
              <button onClick={handleCancel} style={{ color: "#6B7280", background: "none", border: "none", marginTop: 14, cursor: "pointer", fontSize: 13 }}>Annuler</button>
            </>
          )}
        </div>
      )}

      {phase === "connecting" && (
        <div style={{ background: "#FFFBEB", padding: 28, borderRadius: 18, textAlign: "center", border: "1px solid #FCD34D" }}>
          <div style={{ fontSize: 40, marginBottom: 14 }}>🔄</div>
          <p style={{ fontWeight: 700, color: "#92400E" }}>Connexion en cours…</p>
          <p style={{ fontSize: 13, color: "#78350F", marginTop: 6 }}>Ne fermez pas cette page.</p>
        </div>
      )}

      {phase === "connected" && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: 20, background: "#F0FDF4", borderRadius: 14, border: "1px solid #BBF7D0", flexWrap: "wrap", gap: 12 }}>
          <div>
            <p style={{ fontWeight: 800, color: "#065F46", marginBottom: 4 }}>✅ L'assistant répond sur votre WhatsApp</p>
            {business.whatsapp_business_phone && <p style={{ fontSize: 13, color: "#059669" }}>📞 {business.whatsapp_business_phone}</p>}
          </div>
          <button onClick={handleDisconnect} disabled={disconnecting}
            style={{ background: "#FEE2E2", color: "#991B1B", border: "1px solid #FCA5A5", padding: "10px 20px", borderRadius: 100, fontWeight: 700, cursor: disconnecting ? "not-allowed" : "pointer", fontSize: 13, opacity: disconnecting ? 0.6 : 1 }}>
            {disconnecting ? "Déconnexion…" : "🔌 Déconnecter"}
          </button>
        </div>
      )}

      {phase === "error" && (
        <div style={{ background: "#FEF2F2", padding: 24, borderRadius: 18, textAlign: "center", border: "1px solid #FCA5A5" }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>❌</div>
          <p style={{ fontWeight: 700, color: "#991B1B", marginBottom: 6 }}>Connexion échouée</p>
          <p style={{ fontSize: 13, color: "#7F1D1D", marginBottom: 16 }}>{errorMsg}</p>
          <button onClick={handleConnect} style={{ background: "#25D366", color: "white", padding: "12px 28px", borderRadius: 100, border: "none", fontWeight: 800, cursor: "pointer" }}>
            🔄 Réessayer
          </button>
        </div>
      )}
    </Card>
  );
}

// ── Per-type config ───────────────────────────────────────────────────────────

interface TypeConfig {
  descLabel: string;
  descPills: { l: string; v: string }[];
  faqPills:  { l: string; v: string }[];
  paymentPills: { l: string; v: string }[];
  showPayment: boolean;
  catalogLabel: string; // what products/services are called
}

function getTypeConfig(type: BusinessType): TypeConfig {
  const commonFaq = [
    { l: "⏰ Horaires",     v: "Nous sommes ouverts de 09h à 20h." },
    { l: "📍 Localisation", v: "Nous sommes situés au Grand Marché." },
    { l: "📞 Rappel",       v: "Vous pouvez nous appeler pour plus d'infos." },
  ];
  const commonPayment = [
    { l: "🟠 Orange Money",   v: "ORANGE MONEY: (Votre numéro ici)" },
    { l: "🟢 Moov Money",     v: "MOOV MONEY: (Votre numéro ici)" },
    { l: "💵 Espèces",        v: "PAIEMENT EN ESPÈCES: Accepté." },
    { l: "🏦 Virement",       v: "VIREMENT BANCAIRE: (Votre RIB ici)" },
  ];

  switch (type) {
    case "products_seller":
      return {
        descLabel: "2. Que vendez-vous ? 🛍️",
        descPills: [
          { l: "👗 Habits/Chaussures",  v: "Je vends des vêtements et des chaussures tendance." },
          { l: "📱 Téléphones",         v: "Je vends des téléphones et accessoires mobiles." },
          { l: "🍱 Nourriture",         v: "Je vends des plats cuisinés et de la nourriture." },
          { l: "💄 Beauté/Parfums",     v: "Je vends des produits cosmétiques et parfums." },
          { l: "🪑 Meubles/Maison",     v: "Je vends des articles pour la maison et déco." },
          { l: "🚗 Pièces Auto",        v: "Je vends des pièces et accessoires pour voitures." },
        ],
        faqPills: [
          ...commonFaq,
          { l: "🚚 Livraison 1000F",  v: "La livraison coûte 1000F à Bamako." },
          { l: "❌ Pas de crédit",    v: "Désolé, nous ne faisons pas de crédit." },
        ],
        paymentPills: [
          ...commonPayment,
          { l: "🤝 Paiement livraison", v: "PAIEMENT À LA LIVRAISON: Accepté." },
        ],
        showPayment: true,
        catalogLabel: "produits",
      };

    case "fnb":
      return {
        descLabel: "2. Que proposez-vous à manger ? 🍽️",
        descPills: [
          { l: "🍛 Restaurant",       v: "Je suis un restaurant qui prépare des plats chauds." },
          { l: "☕ Café/Pâtisserie",  v: "Je suis un café avec boissons et pâtisseries." },
          { l: "🥡 À emporter",       v: "Je prépare des plats à emporter et livraisons." },
          { l: "🎂 Traiteur",         v: "Je suis traiteur pour événements et cérémonies." },
          { l: "🍕 Fast food",        v: "Je vends des sandwichs, pizzas et fast food." },
        ],
        faqPills: [
          ...commonFaq,
          { l: "🚚 Livraison dispo",  v: "Livraison disponible à Bamako. Min 2000 FCFA." },
          { l: "⏰ Horaires cuisine", v: "Cuisine ouverte de 11h à 22h." },
        ],
        paymentPills: [
          ...commonPayment,
          { l: "🤝 Paiement livraison", v: "PAIEMENT À LA LIVRAISON: Accepté." },
        ],
        showPayment: true,
        catalogLabel: "plats du menu",
      };

    case "transport":
      return {
        descLabel: "2. Quels trajets proposez-vous ? 🚌",
        descPills: [
          { l: "🚌 Bus inter-villes",   v: "Compagnie de transport bus inter-villes au Mali." },
          { l: "🚐 Minibus",            v: "Service de minibus pour voyages et transferts." },
          { l: "🛺 Moto-taxi",          v: "Service de moto-taxi rapide en ville." },
          { l: "✈️ Agence de voyage",   v: "Agence de voyage, billets et transferts aéroport." },
          { l: "🚗 Location voiture",   v: "Location de véhicules avec ou sans chauffeur." },
        ],
        faqPills: [
          { l: "📍 Gare de départ",     v: "Départs depuis la Gare Routière de Bamako." },
          { l: "🧳 Bagages",            v: "Bagage de cabine inclus. Soute: 500 FCFA/kg." },
          { l: "⏰ Horaires",           v: "Départs quotidiens à 07h, 10h, 14h et 18h." },
          { l: "📞 Réservation",        v: "Réservez par WhatsApp ou directement au guichet." },
          { l: "🔄 Remboursement",      v: "Annulation possible 24h avant le départ." },
        ],
        paymentPills: [
          ...commonPayment,
          { l: "💳 Paiement au guichet", v: "PAIEMENT AU GUICHET: Accepté le jour du départ." },
        ],
        showPayment: true,
        catalogLabel: "trajets",
      };

    case "health":
      return {
        descLabel: "2. Quels services de santé proposez-vous ? 🏥",
        descPills: [
          { l: "🩺 Clinique générale",    v: "Clinique généraliste, consultations médicales." },
          { l: "💊 Pharmacie",            v: "Pharmacie, médicaments et produits de santé." },
          { l: "🔬 Laboratoire",          v: "Laboratoire d'analyses médicales et examens." },
          { l: "👁️ Ophtalmologie",        v: "Cabinet ophtalmologique, lunettes et examens." },
          { l: "🦷 Dentiste",             v: "Cabinet dentaire, soins et chirurgie dentaire." },
          { l: "🤱 Maternité",            v: "Maternité, suivi grossesse et accouchement." },
        ],
        faqPills: [
          ...commonFaq,
          { l: "🚨 Urgences",            v: "Urgences disponibles 24h/24 et 7j/7." },
          { l: "📋 Documents",           v: "Apportez votre carnet de santé et pièce d'identité." },
          { l: "💳 Assurance",           v: "Nous acceptons la CMSS, CANAM et principales mutuelles." },
        ],
        paymentPills: [
          ...commonPayment,
          { l: "🏥 Assurance maladie",   v: "ASSURANCE: CMSS et CANAM acceptées." },
        ],
        showPayment: true,
        catalogLabel: "services médicaux",
      };

    case "education":
      return {
        descLabel: "2. Quels cours ou formations proposez-vous ? 📚",
        descPills: [
          { l: "🏫 École primaire",      v: "École primaire, classes de CI à CM2." },
          { l: "🏛️ Lycée",              v: "Lycée d'enseignement général et technique." },
          { l: "🎓 Université",          v: "Université, formations supérieures et licences." },
          { l: "💻 Formation pro",       v: "Formation professionnelle: informatique, comptabilité, langues." },
          { l: "📖 Cours particuliers",  v: "Cours particuliers à domicile, toutes matières." },
          { l: "🌍 Langues",             v: "Cours de langues: anglais, français, arabe, bambara." },
        ],
        faqPills: [
          ...commonFaq,
          { l: "📅 Rentrée scolaire",    v: "La rentrée scolaire est en octobre." },
          { l: "📝 Inscription",         v: "Inscriptions ouvertes. Apportez acte de naissance et photos." },
          { l: "🏆 Résultats",           v: "Les résultats sont affichés sur place et sur WhatsApp." },
        ],
        paymentPills: [
          ...commonPayment,
          { l: "📅 Paiement mensuel",    v: "PAIEMENT MENSUEL: Scolarité payable chaque mois." },
          { l: "🎓 Bourse",              v: "Des bourses partielles sont disponibles sur demande." },
        ],
        showPayment: true,
        catalogLabel: "cours et formations",
      };

    case "real_estate":
      return {
        descLabel: "2. Quels biens immobiliers proposez-vous ? 🏠",
        descPills: [
          { l: "🏠 Location maison",     v: "Location de maisons et appartements à Bamako." },
          { l: "🏢 Location bureau",     v: "Location de bureaux et locaux commerciaux." },
          { l: "🌳 Vente terrain",       v: "Vente de terrains viabilisés et non viabilisés." },
          { l: "🏗️ Vente immeuble",     v: "Vente d'immeubles, maisons et appartements." },
          { l: "🔑 Gestion locative",    v: "Gestion locative et conciergerie immobilière." },
        ],
        faqPills: [
          ...commonFaq,
          { l: "📄 Documents requis",    v: "Pièce d'identité, justificatif de revenus requis." },
          { l: "🤝 Commission agence",   v: "Commission agence: 1 mois de loyer pour location." },
          { l: "🔍 Visite gratuite",     v: "Les visites sont gratuites et sans engagement." },
        ],
        paymentPills: [
          ...commonPayment,
          { l: "📅 Loyer mensuel",       v: "LOYER: Paiement mensuel d'avance." },
          { l: "🔐 Caution",             v: "CAUTION: 2 mois de loyer remboursables à la sortie." },
        ],
        showPayment: false, // Real estate negotiates directly
        catalogLabel: "biens immobiliers",
      };

    case "events":
      return {
        descLabel: "2. Quelles prestations événementielles proposez-vous ? 🎉",
        descPills: [
          { l: "🎵 DJ / Sonorisation",   v: "DJ professionnel, sonorisation et éclairage événementiel." },
          { l: "📸 Photo / Vidéo",       v: "Photographie et vidéographie pour mariages et événements." },
          { l: "💐 Décoration",          v: "Décoration florale et thématique pour tous événements." },
          { l: "🍽️ Traiteur événement",  v: "Traiteur pour mariages, baptêmes et cérémonies." },
          { l: "🎪 Organisation complète",v: "Organisation complète d'événements clé en main." },
          { l: "🎤 Animation",           v: "Animation, maître de cérémonie et présentateur." },
        ],
        faqPills: [
          ...commonFaq,
          { l: "📅 Réservation",         v: "Réservation minimum 2 semaines à l'avance." },
          { l: "💰 Acompte",             v: "Acompte de 50% requis pour confirmer la réservation." },
          { l: "🔄 Annulation",          v: "Annulation : acompte non remboursable à J-7." },
        ],
        paymentPills: [
          ...commonPayment,
          { l: "💰 Acompte 50%",         v: "ACOMPTE: 50% à la réservation, solde le jour J." },
        ],
        showPayment: true,
        catalogLabel: "prestations",
      };

    case "service_information":
      return {
        descLabel: "2. Quels services proposez-vous ? 🛠️",
        descPills: [
          { l: "✂️ Coiffure/Beauté",    v: "Je suis coiffeur/se et propose des prestations beauté." },
          { l: "👗 Couture/Retouches",  v: "Je fais de la couture et retouches de vêtements." },
          { l: "🔧 Réparation",         v: "Je répare les téléphones, électroménagers et appareils." },
          { l: "🩺 Santé/Consultation", v: "Je propose des consultations médicales ou de santé." },
          { l: "🏋️ Sport/Coaching",    v: "Je propose des séances de sport et coaching." },
          { l: "📚 Cours particuliers", v: "Je donne des cours particuliers à domicile." },
        ],
        faqPills: [
          ...commonFaq,
          { l: "📅 Rendez-vous",        v: "Sur rendez-vous uniquement. Appelez pour réserver." },
          { l: "⏱️ Durée séance",       v: "La durée d'une séance est environ 1 heure." },
        ],
        paymentPills: commonPayment,
        showPayment: false,
        catalogLabel: "services",
      };

    default: // custom
      return {
        descLabel: "2. Que fait votre organisation ?",
        descPills: [
          { l: "ℹ️ Informations",  v: "Je fournis des informations sur mes services." },
          { l: "🏢 Entreprise",    v: "Je suis une entreprise qui répond aux questions clients." },
          { l: "📋 Association",   v: "Je suis une association qui informe le public." },
          { l: "🏛️ Institution",  v: "Je suis une institution publique ou privée." },
        ],
        faqPills: commonFaq,
        paymentPills: commonPayment,
        showPayment: false,
        catalogLabel: "services",
      };
  }
}

// ── AI settings form ──────────────────────────────────────────────────────────
function AiSettingsForm({
  business, aiForm, setAiForm, onSave, saving,
}: {
  business: Business;
  aiForm: { description: string; faq: string; payment_instructions: string; ai_tone: string };
  setAiForm: (f: any) => void;
  onSave: (e: React.FormEvent) => void;
  saving: boolean;
}) {
  const type   = business.business_type;
  const config = getTypeConfig(type);

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: 16, borderRadius: 16,
    border: "2px solid #F3F4F6", fontFamily: "inherit",
    fontSize: 15, minHeight: 100, outline: "none",
    resize: "vertical" as const, boxSizing: "border-box",
  };

  // Type badge shown next to section title
  const TYPE_LABELS: Record<BusinessType, string> = {
    products_seller:     "🛒 Boutique",
    fnb:                 "🍽️ Restaurant",
    transport:           "🚌 Transport",
    health:              "🏥 Santé",
    education:           "📚 Éducation",
    real_estate:         "🏠 Immobilier",
    events:              "🎉 Événementiel",
    service_information: "✂️ Services",
    custom:              "🤖 Bot info",
  };

  return (
    <form onSubmit={onSave}>
      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
          <SectionTitle icon="🤖" title="Réglages de l'assistant" />
          <span style={{
            background: "#F0FDF4", color: "#1B4332", border: "1px solid #BBF7D0",
            borderRadius: 100, padding: "4px 12px", fontSize: 12, fontWeight: 700,
          }}>
            {TYPE_LABELS[type] || type}
          </span>
        </div>

        {/* Tone */}
        <div style={{ marginBottom: 32 }}>
          <label style={{ display: "block", fontWeight: 800, color: "#1B4332", marginBottom: 8, fontSize: 16 }}>
            1. Comment l'IA doit-elle parler à vos clients ?
          </label>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: 10 }}>
            {TONE_OPTIONS.map(tone => (
              <div
                key={tone.id}
                onClick={() => setAiForm({ ...aiForm, ai_tone: tone.id })}
                style={{
                  padding: "14px 12px", borderRadius: 18, border: "2px solid",
                  borderColor: aiForm.ai_tone === tone.id ? "#D4AF37" : "#F3F4F6",
                  background: aiForm.ai_tone === tone.id ? "#FFFCF5" : "white",
                  cursor: "pointer", textAlign: "center",
                  transform: aiForm.ai_tone === tone.id ? "translateY(-2px)" : "none",
                  transition: "all 0.2s",
                }}
              >
                <span style={{ fontSize: 28, display: "block" }}>{tone.emoji}</span>
                <span style={{ fontWeight: 800, display: "block", fontSize: 13, marginTop: 4 }}>{tone.title}</span>
                <span style={{ fontSize: 11, color: "#6B7280" }}>{tone.desc}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Description */}
        <div style={{ marginBottom: 32 }}>
          <label style={{ display: "block", fontWeight: 800, color: "#1B4332", marginBottom: 6, fontSize: 16 }}>
            {config.descLabel}
          </label>
          <p style={{ fontSize: 13, color: "#6B7280", marginBottom: 12 }}>Cliquez pour ajouter rapidement :</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
            {config.descPills.map(ex => (
              <Pill key={ex.l} label={ex.l} onClick={() => setAiForm({ ...aiForm, description: appendText(aiForm.description, ex.v) })} />
            ))}
          </div>
          <textarea
            style={inputStyle}
            value={aiForm.description}
            onChange={e => setAiForm({ ...aiForm, description: e.target.value })}
            placeholder={`Décrivez ici vos ${config.catalogLabel}…`}
          />
        </div>

        {/* FAQ */}
        <div style={{ marginBottom: 32 }}>
          <label style={{ display: "block", fontWeight: 800, color: "#1B4332", marginBottom: 6, fontSize: 16 }}>
            3. Questions fréquentes de vos clients ❓
          </label>
          <p style={{ fontSize: 13, color: "#6B7280", marginBottom: 12 }}>Cliquez pour ajouter des réponses types :</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
            {config.faqPills.map(ex => (
              <Pill key={ex.l} label={`+ ${ex.l}`} onClick={() => setAiForm({ ...aiForm, faq: appendText(aiForm.faq, ex.v) })} />
            ))}
          </div>
          <textarea
            style={inputStyle}
            value={aiForm.faq}
            onChange={e => setAiForm({ ...aiForm, faq: e.target.value })}
            placeholder="Ex: Horaires, adresse, conditions, délais…"
          />
        </div>

        {/* Payment — shown for most types */}
        {config.showPayment && (
          <div style={{ marginBottom: 32 }}>
            <label style={{ display: "block", fontWeight: 800, color: "#1B4332", marginBottom: 6, fontSize: 16 }}>
              4. Comment les clients peuvent payer ? 💰
            </label>
            <p style={{ fontSize: 13, color: "#6B7280", marginBottom: 12 }}>Cliquez sur vos modes de paiement :</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
              {config.paymentPills.map(ex => (
                <Pill key={ex.l} label={ex.l} onClick={() => setAiForm({ ...aiForm, payment_instructions: appendText(aiForm.payment_instructions, ex.v) })} />
              ))}
            </div>
            <textarea
              style={{ ...inputStyle, minHeight: 130, border: "3px solid #D4AF37", background: "#FFFCF5", fontWeight: 700, fontSize: 15 }}
              value={aiForm.payment_instructions}
              onChange={e => setAiForm({ ...aiForm, payment_instructions: e.target.value })}
              placeholder="Ex: Orange Money au 70 00 00 00"
            />
          </div>
        )}

        <button
          type="submit"
          disabled={saving}
          style={{
            width: "100%", background: "#1B4332", color: "white",
            padding: 20, borderRadius: 100, border: "none",
            fontWeight: 900, cursor: saving ? "not-allowed" : "pointer",
            fontSize: 17, boxShadow: "0 8px 20px rgba(27,67,50,0.2)",
            opacity: saving ? 0.7 : 1,
          }}
        >
          {saving ? "Enregistrement…" : "💾 Sauvegarder tout"}
        </button>
      </Card>
    </form>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function SettingsPage() {
  const [business, setBusiness] = useState<Business | null>(null);
  const [aiForm, setAiForm] = useState({
    description: "", faq: "", payment_instructions: "", ai_tone: "professional",
  });
  const [saving, setSaving] = useState(false);

  const loadBusiness = () =>
    authApi.me().then(r => {
      setBusiness(r.data);
      setAiForm({
        description:          r.data.description          || "",
        faq:                  r.data.faq                  || "",
        payment_instructions: r.data.payment_instructions || "",
        ai_tone:              r.data.ai_tone              || "professional",
      });
    });

  useEffect(() => { loadBusiness(); }, []);

  const handleSaveAI = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await authApi.updateSettings(aiForm);
      toast.success("✅ Paramètres enregistrés !");
    } catch {
      toast.error("Erreur de sauvegarde");
    } finally {
      setSaving(false);
    }
  };

  if (!business) return null;

  return (
    <div style={{ maxWidth: 860, margin: "0 auto" }}>
      <WhatsAppSection business={business} onReload={loadBusiness} />
      <AiSettingsForm
        business={business}
        aiForm={aiForm}
        setAiForm={setAiForm}
        onSave={handleSaveAI}
        saving={saving}
      />
    </div>
  );
}