"use client";
import { useEffect, useState, useRef } from "react";
import { productsApi, uploadApi } from "@/lib/api";
import { authApi } from "@/lib/api";
import { Product, ProductVariant, BusinessType } from "@/types";
import toast from "react-hot-toast";

const C = {
  gold: "#C5A034", goldLight: "#FFF8E7", goldBorder: "#F0D88A",
  green: "#1B4332", greenLight: "#F0FDF4", greenBorder: "#BBF7D0",
  text: "#111827", muted: "#6B7280", border: "#E5E7EB",
  bg: "#F9FAFB", white: "#FFFFFF",
  blue: "#1E40AF", blueLight: "#EFF6FF", blueBorder: "#BFDBFE",
  purple: "#6D28D9", purpleLight: "#F5F3FF", purpleBorder: "#C4B5FD",
  red: "#991B1B", redLight: "#FEF2F2", redBorder: "#FECACA",
  orange: "#92400E", orangeLight: "#FFFBEB", orangeBorder: "#FDE68A",
};

function useBusinessType(): BusinessType | null {
  const [type, setType] = useState<BusinessType | null>(null);
  useEffect(() => {
    authApi.me().then((r) => setType(r.data.business_type)).catch(() => {});
  }, []);
  return type;
}

// ── Catalog config ────────────────────────────────────────────────────────────
interface CatalogConfig {
  pageTitle: string; pageIcon: string;
  itemLabel: string; itemLabelPlural: string; addLabel: string;
  emptyTitle: string; emptyDesc: string;
  hasStock: boolean; hasUnit: boolean; hasSizes: boolean; hasDuration: boolean;
  categories: Category[]; priceSuffix: string;
  namePlaceholder: string; descPlaceholder: string;
  priceLabel: string;
}

type UnitMode = "single" | "sizes";
interface Category {
  value: string; label: string; emoji: string;
  unitMode?: UnitMode; units?: string[];
  sizeGroups?: { label: string; sizes: string[] }[];
  defaultUnit?: string;
}

function getConfig(type: BusinessType): CatalogConfig {
  switch (type) {

    case "fnb":
      return {
        pageTitle: "Mon menu", pageIcon: "🍽️",
        itemLabel: "plat", itemLabelPlural: "plats", addLabel: "Ajouter un plat",
        emptyTitle: "Votre menu est vide", emptyDesc: "Ajoutez vos plats, boissons et desserts.",
        hasStock: false, hasUnit: false, hasSizes: false, hasDuration: false,
        priceSuffix: "FCFA", namePlaceholder: "Ex: Riz sauce arachide, Jus de gingembre…",
        descPlaceholder: "Ingrédients, allergènes, portions…", priceLabel: "Prix",
        categories: [
          { value: "entree",        label: "Entrées",          emoji: "🥗" },
          { value: "plat",          label: "Plats principaux", emoji: "🍛" },
          { value: "accompagnement",label: "Accompagnements",  emoji: "🍚" },
          { value: "dessert",       label: "Desserts",         emoji: "🍰" },
          { value: "boisson",       label: "Boissons",         emoji: "🥤" },
          { value: "petit_dej",     label: "Petit déj.",       emoji: "☕" },
          { value: "snack",         label: "Snacks",           emoji: "🍟" },
          { value: "special",       label: "Spécialités",      emoji: "⭐" },
        ],
      };

    case "transport":
      return {
        pageTitle: "Mes trajets", pageIcon: "🚌",
        itemLabel: "trajet", itemLabelPlural: "trajets", addLabel: "Ajouter un trajet",
        emptyTitle: "Aucun trajet enregistré",
        emptyDesc: "Ajoutez vos trajets avec les tarifs. Le bot WhatsApp les présentera aux passagers et prendra les réservations automatiquement.",
        hasStock: true, hasUnit: true, hasSizes: false, hasDuration: false,
        priceSuffix: "FCFA", namePlaceholder: "Ex: Bamako → Mopti, Bamako → Ségou…",
        descPlaceholder: "Horaires de départ, point de départ, durée du trajet, arrêts…",
        priceLabel: "Prix par place",
        categories: [
          { value: "bus",       label: "Bus",               emoji: "🚌", units: ["place", "billet"], defaultUnit: "place" },
          { value: "minibus",   label: "Minibus",           emoji: "🚐", units: ["place", "billet"], defaultUnit: "place" },
          { value: "taxi",      label: "Taxi / Voiture",    emoji: "🚗", units: ["place", "voyage"], defaultUnit: "place" },
          { value: "moto",      label: "Moto-taxi",         emoji: "🛺", units: ["place", "voyage"], defaultUnit: "place" },
          { value: "avion",     label: "Vol / Avion",       emoji: "✈️", units: ["billet", "place"], defaultUnit: "billet" },
          { value: "location",  label: "Location véhicule", emoji: "🔑", units: ["jour", "heure", "km"], defaultUnit: "jour" },
          { value: "transfert", label: "Transfert aéroport",emoji: "🛬", units: ["voyage", "place"], defaultUnit: "voyage" },
        ],
      };

    case "health":
      return {
        pageTitle: "Mes services", pageIcon: "🏥",
        itemLabel: "service", itemLabelPlural: "services", addLabel: "Ajouter un service",
        emptyTitle: "Aucun service enregistré",
        emptyDesc: "Ajoutez vos consultations et services médicaux. Le bot WhatsApp les présentera et prendra les rendez-vous.",
        hasStock: false, hasUnit: false, hasSizes: false, hasDuration: true,
        priceSuffix: "FCFA", namePlaceholder: "Ex: Consultation générale, Analyse de sang…",
        descPlaceholder: "Description du service, préparation requise, conditions…",
        priceLabel: "Tarif",
        categories: [
          { value: "consultation", label: "Consultation",    emoji: "🩺" },
          { value: "analyse",      label: "Analyses",        emoji: "🔬" },
          { value: "imagerie",     label: "Imagerie",        emoji: "🩻" },
          { value: "chirurgie",    label: "Chirurgie",       emoji: "🔪" },
          { value: "pharmacie",    label: "Pharmacie",       emoji: "💊" },
          { value: "maternite",    label: "Maternité",       emoji: "🤱" },
          { value: "dentaire",     label: "Dentaire",        emoji: "🦷" },
          { value: "ophtalmologie",label: "Ophtalmologie",   emoji: "👁️" },
          { value: "autre_sante",  label: "Autre",           emoji: "🏥" },
        ],
      };

    case "education":
      return {
        pageTitle: "Mes cours", pageIcon: "📚",
        itemLabel: "cours", itemLabelPlural: "cours", addLabel: "Ajouter un cours",
        emptyTitle: "Aucun cours enregistré",
        emptyDesc: "Ajoutez vos cours et formations. Le bot WhatsApp les présentera et prendra les inscriptions.",
        hasStock: true, hasUnit: true, hasSizes: false, hasDuration: true,
        priceSuffix: "FCFA", namePlaceholder: "Ex: Mathématiques CM2, Anglais débutant…",
        descPlaceholder: "Programme, niveau requis, matériel nécessaire, objectifs…",
        priceLabel: "Frais d'inscription / scolarité",
        categories: [
          { value: "primaire",     label: "Primaire",         emoji: "🏫", units: ["mois", "trimestre", "année"], defaultUnit: "mois" },
          { value: "secondaire",   label: "Secondaire",       emoji: "🏛️", units: ["mois", "trimestre", "année"], defaultUnit: "mois" },
          { value: "superieur",    label: "Supérieur",        emoji: "🎓", units: ["mois", "semestre", "année"], defaultUnit: "semestre" },
          { value: "formation",    label: "Formation pro",    emoji: "💼", units: ["séance", "semaine", "mois"], defaultUnit: "mois" },
          { value: "langue",       label: "Langues",          emoji: "🌍", units: ["séance", "semaine", "mois"], defaultUnit: "mois" },
          { value: "informatique", label: "Informatique",     emoji: "💻", units: ["séance", "semaine", "mois"], defaultUnit: "mois" },
          { value: "cours_part",   label: "Cours particuliers",emoji: "📖", units: ["séance", "heure", "mois"], defaultUnit: "séance" },
          { value: "autre_edu",    label: "Autre",            emoji: "📚", units: ["séance", "mois", "année"], defaultUnit: "mois" },
        ],
      };

    case "real_estate":
      return {
        pageTitle: "Mes biens", pageIcon: "🏠",
        itemLabel: "bien", itemLabelPlural: "biens", addLabel: "Ajouter un bien",
        emptyTitle: "Aucun bien immobilier enregistré",
        emptyDesc: "Ajoutez vos propriétés à louer ou vendre. Le bot WhatsApp les présentera et planifiera les visites.",
        hasStock: true, hasUnit: true, hasSizes: false, hasDuration: false,
        priceSuffix: "FCFA", namePlaceholder: "Ex: Villa 3 chambres Badalabougou, Terrain ACI 2000…",
        descPlaceholder: "Superficie, localisation précise, équipements, état, particularités…",
        priceLabel: "Prix (loyer mensuel ou prix de vente)",
        categories: [
          { value: "location_maison",  label: "Location maison",  emoji: "🏠", units: ["mois", "an"], defaultUnit: "mois" },
          { value: "location_appart",  label: "Location appart.", emoji: "🏢", units: ["mois", "an"], defaultUnit: "mois" },
          { value: "location_bureau",  label: "Location bureau",  emoji: "🏗️", units: ["mois", "an"], defaultUnit: "mois" },
          { value: "vente_maison",     label: "Vente maison",     emoji: "🔑", units: ["bien", "unité"], defaultUnit: "bien" },
          { value: "vente_terrain",    label: "Vente terrain",    emoji: "🌳", units: ["bien", "m²"], defaultUnit: "bien" },
          { value: "vente_immeuble",   label: "Vente immeuble",   emoji: "🏦", units: ["bien", "unité"], defaultUnit: "bien" },
          { value: "autre_immo",       label: "Autre",            emoji: "🏘️", units: ["bien", "mois"], defaultUnit: "bien" },
        ],
      };

    case "events":
      return {
        pageTitle: "Mes prestations", pageIcon: "🎉",
        itemLabel: "prestation", itemLabelPlural: "prestations", addLabel: "Ajouter une prestation",
        emptyTitle: "Aucune prestation enregistrée",
        emptyDesc: "Ajoutez vos prestations événementielles. Le bot WhatsApp les présentera et collectera les demandes de devis.",
        hasStock: false, hasUnit: false, hasSizes: false, hasDuration: false,
        priceSuffix: "FCFA", namePlaceholder: "Ex: DJ + Sonorisation 6h, Pack photo mariage…",
        descPlaceholder: "Ce qui est inclus, durée, matériel fourni, conditions…",
        priceLabel: "Tarif de base",
        categories: [
          { value: "dj",          label: "DJ / Musique",    emoji: "🎵" },
          { value: "photo",       label: "Photo / Vidéo",   emoji: "📸" },
          { value: "deco",        label: "Décoration",      emoji: "💐" },
          { value: "traiteur",    label: "Traiteur",        emoji: "🍽️" },
          { value: "animation",   label: "Animation",       emoji: "🎤" },
          { value: "organisation",label: "Organisation",    emoji: "🎪" },
          { value: "autre_event", label: "Autre",           emoji: "🎉" },
        ],
      };

    case "service_information":
      return {
        pageTitle: "Mes services", pageIcon: "🛠️",
        itemLabel: "service", itemLabelPlural: "services", addLabel: "Ajouter un service",
        emptyTitle: "Aucun service encore", emptyDesc: "Ajoutez vos prestations.",
        hasStock: false, hasUnit: false, hasSizes: false, hasDuration: true,
        priceSuffix: "FCFA", namePlaceholder: "Ex: Coupe + brushing, Massage relaxant…",
        descPlaceholder: "Décrivez la prestation…", priceLabel: "Prix",
        categories: [
          { value: "coiffure",       label: "Coiffure",        emoji: "✂️" },
          { value: "beaute",         label: "Beauté & Soins",  emoji: "💅" },
          { value: "massage",        label: "Massage & Spa",   emoji: "💆" },
          { value: "medical",        label: "Médical / Santé", emoji: "🏥" },
          { value: "juridique",      label: "Juridique",       emoji: "⚖️" },
          { value: "comptabilite",   label: "Comptabilité",    emoji: "📊" },
          { value: "informatique",   label: "Informatique",    emoji: "💻" },
          { value: "formation",      label: "Formation",       emoji: "📚" },
          { value: "transport",      label: "Transport",       emoji: "🚗" },
          { value: "nettoyage",      label: "Nettoyage",       emoji: "🧹" },
          { value: "evenement",      label: "Événementiel",    emoji: "🎉" },
          { value: "photo",          label: "Photo / Vidéo",   emoji: "📷" },
          { value: "autre_service",  label: "Autre",           emoji: "🔧" },
        ],
      };

    // products_seller is default
    default:
      return {
        pageTitle: "Mes produits", pageIcon: "📦",
        itemLabel: "produit", itemLabelPlural: "produits", addLabel: "Ajouter un produit",
        emptyTitle: "Ajoutez votre premier produit",
        emptyDesc: "Une fois ajouté, le robot WhatsApp pourra présenter ce produit, prendre les commandes et encaisser les paiements automatiquement.",
        hasStock: true, hasUnit: true, hasSizes: true, hasDuration: false,
        priceSuffix: "FCFA", namePlaceholder: "Ex: Robe en wax bleue, Riz 5kg…",
        descPlaceholder: "Matière, couleur, utilisation…", priceLabel: "Prix",
        categories: [
          { value: "vetements",    label: "Vêtements",        emoji: "👗", unitMode: "sizes" as UnitMode, sizeGroups: [
            { label: "Tailles standard",  sizes: ["XS","S","M","L","XL","XXL","XXXL"] },
            { label: "Tailles numériques",sizes: ["34","36","38","40","42","44","46","48","50"] },
            { label: "Taille unique",     sizes: ["Taille unique"] },
          ]},
          { value: "chaussures",   label: "Chaussures",       emoji: "👟", unitMode: "sizes" as UnitMode, sizeGroups: [
            { label: "Adultes", sizes: ["36","37","38","39","40","41","42","43","44","45","46"] },
            { label: "Enfants", sizes: ["20","21","22","23","24","25","26","27","28","29","30","31","32","33","34","35"] },
          ]},
          { value: "accessoires",  label: "Sacs & Accessoires",emoji: "👜", units: ["pièce","lot de 2","lot de 3","lot de 5"] },
          { value: "alimentation", label: "Alimentation",     emoji: "🥕", units: ["kg","g","500g","litre","sac","boîte","bouteille","sachet","pièce","lot"] },
          { value: "boissons",     label: "Boissons & Jus",   emoji: "🥤", units: ["litre","cl","bouteille","carton","pack de 6","pack de 12"] },
          { value: "cosmetiques",  label: "Cosmétiques",      emoji: "💄", units: ["flacon","tube","pot","pièce","kit","lot de 2"] },
          { value: "electronique", label: "Électronique",     emoji: "📱", units: ["pièce","kit"], defaultUnit: "pièce" },
          { value: "electromenager",label: "Électroménager",  emoji: "🍳", units: ["pièce"], defaultUnit: "pièce" },
          { value: "meubles",      label: "Meubles & Déco",   emoji: "🛋️", units: ["pièce","ensemble"], defaultUnit: "pièce" },
          { value: "tissus",       label: "Tissus & Pagnes",  emoji: "🧵", units: ["mètre","2 mètres","6 yards","rouleau","pièce"] },
          { value: "materiel",     label: "Matériaux",        emoji: "🧱", units: ["pièce","kg","tonne","sac","mètre","carton"] },
          { value: "medicaments",  label: "Pharmacie",        emoji: "💊", units: ["boîte","flacon","comprimé","sachet","tube"] },
          { value: "jouets",       label: "Jouets",           emoji: "🧸", units: ["pièce","lot","kit"], defaultUnit: "pièce" },
          { value: "autre",        label: "Autre",            emoji: "📦", units: ["pièce","kg","litre","mètre","sac","boîte","lot"] },
        ],
      };
  }
}

// ── Types ─────────────────────────────────────────────────────────────────────
interface VariantDraft {
  _key: string; id?: string; name: string; color_hex: string; image_url: string; stock: string; uploading: boolean;
}
interface FormState {
  name: string; description: string; price: string; image_url: string; imageUploading: boolean;
  category: string; unit: string; selectedSizes: string[]; stockPerSize: Record<string, string>;
  globalStock: string; duration: string; pricingType: string; variants: VariantDraft[]; hasVariants: boolean;
}
const EMPTY_FORM: FormState = {
  name: "", description: "", price: "", image_url: "", imageUploading: false,
  category: "", unit: "", selectedSizes: [], stockPerSize: {}, globalStock: "",
  duration: "", pricingType: "fixed", variants: [], hasVariants: false,
};
function newVariantDraft(): VariantDraft {
  return { _key: crypto.randomUUID(), name: "", color_hex: "", image_url: "", stock: "1", uploading: false };
}

const DURATIONS = ["15 min","30 min","45 min","1h","1h30","2h","3h","Demi-journée","Journée entière","Sur devis"];
const PRICING_TYPES = [
  { value: "fixed", label: "Prix fixe" },
  { value: "hourly", label: "Par heure" },
  { value: "from", label: "À partir de" },
];
const PRESET_COLORS = [
  "#111827","#FFFFFF","#EF4444","#F97316","#EAB308","#22C55E",
  "#3B82F6","#8B5CF6","#EC4899","#14B8A6","#F59E0B","#6B7280",
  "#92400E","#065F46","#1E40AF","#7C3AED","#BE185D","#0F766E",
];

// ── Payload builders ──────────────────────────────────────────────────────────
function buildVariantsPayload(variants: VariantDraft[]) {
  return variants.map((v, i) => ({
    name: v.name.trim(), color_hex: v.color_hex || null, image_url: v.image_url || null,
    stock: parseInt(v.stock || "0", 10), sort_order: i,
  }));
}
function buildPayload(form: FormState, config: CatalogConfig, cat?: Category) {
  const variantsPayload = form.hasVariants && form.variants.length > 0 ? buildVariantsPayload(form.variants) : [];
  const globalStock = variantsPayload.length > 0
    ? variantsPayload.reduce((s, v) => s + v.stock, 0)
    : parseInt(form.globalStock || "0", 10);

  if (config.hasDuration) {
    const durationNote = form.duration ? `\nDurée : ${form.duration}` : "";
    const pricingNote = form.pricingType === "hourly" ? " / heure" : form.pricingType === "from" ? " (à partir de)" : "";
    return { name: form.name, description: `${form.description || ""}${durationNote}`.trim(), price: parseFloat(form.price), stock: globalStock, unit: pricingNote || "prestation", image_url: form.image_url || null, variants: variantsPayload };
  }
  if (!config.hasStock) {
    return { name: form.name, description: form.description || "", price: parseFloat(form.price), stock: 999, unit: "portion", image_url: form.image_url || null, variants: variantsPayload };
  }
  if (cat?.unitMode === "sizes") {
    const sizeLines = form.selectedSizes.map((s) => `${s}: ${form.stockPerSize[s] || "0"}`).join(", ");
    const totalStock = form.selectedSizes.reduce((sum, s) => sum + parseInt(form.stockPerSize[s] || "0", 10), 0);
    return { name: form.name, description: form.description ? `${form.description}\nTailles disponibles: ${sizeLines}` : `Tailles disponibles: ${sizeLines}`, price: parseFloat(form.price), stock: totalStock, unit: "pièce", image_url: form.image_url || null, variants: variantsPayload };
  }
  return { name: form.name, description: form.description || "", price: parseFloat(form.price), stock: globalStock, unit: form.unit || "pièce", image_url: form.image_url || null, variants: variantsPayload };
}
function fromProduct(p: Product, config: CatalogConfig): FormState {
  const hasVariants = p.variants && p.variants.length > 0;
  const variantDrafts: VariantDraft[] = hasVariants
    ? p.variants.map((v) => ({ _key: v.id, id: v.id, name: v.name, color_hex: v.color_hex || "", image_url: v.image_url || "", stock: String(v.stock), uploading: false }))
    : [];
  const sizeMatch = p.description?.match(/Tailles disponibles: (.+)/);
  if (sizeMatch) {
    const pairs = sizeMatch[1].split(", ");
    const selectedSizes: string[] = []; const stockPerSize: Record<string, string> = {};
    pairs.forEach((pair) => { const [size, qty] = pair.split(": "); if (size) { selectedSizes.push(size); stockPerSize[size] = qty || "0"; } });
    return { ...EMPTY_FORM, name: p.name, price: String(p.price), image_url: p.image_url || "", category: "vetements", description: p.description?.replace(/\nTailles disponibles:.+/, "") || "", selectedSizes, stockPerSize, variants: variantDrafts, hasVariants };
  }
  const durationMatch = p.description?.match(/\nDurée : (.+)/);
  const cleanDesc = p.description?.replace(/\nDurée : .+/, "") || "";
  return { ...EMPTY_FORM, name: p.name, price: String(p.price), image_url: p.image_url || "", category: "autre", description: cleanDesc, unit: p.unit, globalStock: String(p.stock), duration: durationMatch?.[1] || "", variants: variantDrafts, hasVariants };
}

// ── Small UI helpers ──────────────────────────────────────────────────────────
function Chip({ label, selected, onClick, accent = C.green }: { label: string; selected: boolean; onClick: () => void; accent?: string }) {
  return <button type="button" onClick={onClick} style={{ padding: "6px 13px", borderRadius: 100, fontSize: 12, fontFamily: "inherit", cursor: "pointer", transition: "all 0.12s", border: `1px solid ${selected ? accent : C.border}`, background: selected ? C.greenLight : C.white, color: selected ? accent : C.muted, fontWeight: selected ? 700 : 500 }}>{label}</button>;
}
function FL({ children }: { children: React.ReactNode }) {
  return <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase" as const, letterSpacing: "0.06em", marginBottom: 8 }}>{children}</label>;
}
const inp: React.CSSProperties = { width: "100%", padding: "11px 14px", background: "#fff", border: `1px solid ${C.border}`, borderRadius: 10, color: C.text, fontSize: 14, fontFamily: "inherit", outline: "none", boxSizing: "border-box", transition: "border-color 0.2s" };

// ── Variant row ───────────────────────────────────────────────────────────────
function VariantRow({ variant, index, onChange, onDelete, onUpload }: { variant: VariantDraft; index: number; onChange: (key: string, field: keyof VariantDraft, value: string | boolean) => void; onDelete: (key: string) => void; onUpload: (key: string, file: File) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [showColorPicker, setShowColorPicker] = useState(false);
  return (
    <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 14, padding: 14, position: "relative", animation: "fadeIn 0.2s ease" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: C.muted }}>Variante {index + 1}</span>
        <button type="button" onClick={() => onDelete(variant._key)} style={{ background: C.redLight, border: `1px solid ${C.redBorder}`, borderRadius: 8, color: C.red, cursor: "pointer", padding: "3px 10px", fontSize: 12, fontFamily: "inherit", fontWeight: 700 }}>✕ Supprimer</button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <input ref={fileRef} type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={(e) => { const f = e.target.files?.[0]; if (f) onUpload(variant._key, f); if (fileRef.current) fileRef.current.value = ""; }} />
          {variant.image_url ? (
            <div style={{ position: "relative", borderRadius: 10, overflow: "hidden", height: 80, background: C.border }}>
              <img src={variant.image_url} alt={variant.name || "variante"} style={{ width: "100%", height: "100%", objectFit: "cover", opacity: variant.uploading ? 0.5 : 1 }} />
              {variant.uploading && <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(255,255,255,0.7)" }}><span style={{ width: 18, height: 18, border: `2px solid ${C.border}`, borderTopColor: C.green, borderRadius: "50%", animation: "spin 0.8s linear infinite", display: "inline-block" }} /></div>}
              <button type="button" onClick={() => onChange(variant._key, "image_url", "")} style={{ position: "absolute", top: 4, right: 4, background: C.white, border: `1px solid ${C.border}`, borderRadius: "50%", width: 22, height: 22, cursor: "pointer", color: C.muted, fontSize: 11, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
            </div>
          ) : (
            <button type="button" onClick={() => fileRef.current?.click()} style={{ height: 80, background: C.goldLight, border: `2px dashed ${C.goldBorder}`, borderRadius: 10, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4, fontFamily: "inherit" }}>
              <span style={{ fontSize: 20 }}>📸</span><span style={{ fontSize: 11, color: C.muted, fontWeight: 600 }}>Photo</span>
            </button>
          )}
          <div style={{ position: "relative" }}>
            <button type="button" onClick={() => setShowColorPicker(!showColorPicker)} style={{ width: "100%", padding: "7px 10px", borderRadius: 8, border: `1px solid ${C.border}`, background: C.white, cursor: "pointer", display: "flex", alignItems: "center", gap: 8, fontFamily: "inherit", fontSize: 12 }}>
              <span style={{ width: 16, height: 16, borderRadius: 4, background: variant.color_hex || "#E5E7EB", border: `1px solid ${C.border}`, flexShrink: 0 }} />
              <span style={{ color: variant.color_hex ? C.text : C.muted, fontSize: 11 }}>{variant.color_hex || "Couleur (optionnel)"}</span>
            </button>
            {showColorPicker && (
              <div style={{ position: "absolute", top: "110%", left: 0, zIndex: 50, background: C.white, border: `1px solid ${C.border}`, borderRadius: 12, padding: 12, boxShadow: "0 8px 24px rgba(0,0,0,0.12)", width: 200 }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(6,1fr)", gap: 6, marginBottom: 10 }}>
                  {PRESET_COLORS.map((c) => <button key={c} type="button" onClick={() => { onChange(variant._key, "color_hex", c); setShowColorPicker(false); }} style={{ width: 24, height: 24, borderRadius: 6, background: c, border: variant.color_hex === c ? "2px solid #1B4332" : `1px solid ${C.border}`, cursor: "pointer" }} />)}
                </div>
                <input type="text" value={variant.color_hex} onChange={(e) => onChange(variant._key, "color_hex", e.target.value)} placeholder="#000000" style={{ ...inp, padding: "6px 10px", fontSize: 12 }} />
                {variant.color_hex && <button type="button" onClick={() => { onChange(variant._key, "color_hex", ""); setShowColorPicker(false); }} style={{ marginTop: 6, width: "100%", padding: "5px", borderRadius: 6, border: `1px solid ${C.border}`, background: C.white, color: C.muted, cursor: "pointer", fontSize: 11, fontFamily: "inherit" }}>Supprimer la couleur</button>}
              </div>
            )}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div>
            <p style={{ fontSize: 11, color: C.muted, fontWeight: 600, marginBottom: 4 }}>Nom *</p>
            <input className="inp" value={variant.name} onChange={(e) => onChange(variant._key, "name", e.target.value)} placeholder="Ex: Rouge, Design floral…" style={{ ...inp, fontSize: 13, padding: "9px 12px", borderColor: variant.name ? C.greenBorder : C.border }} />
          </div>
          <div>
            <p style={{ fontSize: 11, color: C.muted, fontWeight: 600, marginBottom: 4 }}>Stock *</p>
            <input type="number" min="0" className="inp" value={variant.stock} onChange={(e) => onChange(variant._key, "stock", e.target.value)} placeholder="0" style={{ ...inp, fontSize: 13, padding: "9px 12px", textAlign: "center", fontWeight: 700 }} />
          </div>
          {variant.stock && parseInt(variant.stock) > 0 && <div style={{ background: C.greenLight, borderRadius: 8, padding: "6px 10px", textAlign: "center" }}><span style={{ fontSize: 12, color: C.green, fontWeight: 700 }}>{parseInt(variant.stock)} en stock</span></div>}
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function ProductsPage() {
  const bizType = useBusinessType();
  const [products, setProducts]   = useState<Product[]>([]);
  const [loading, setLoading]     = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing]     = useState<Product | null>(null);
  const [form, setForm]           = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving]       = useState(false);
  const [showDesc, setShowDesc]   = useState(false);
  const fileInputRef              = useRef<HTMLInputElement>(null);

  const config = getConfig(bizType ?? "products_seller");

  const load = () =>
    productsApi.list()
      .then((r) => setProducts(r.data))
      .catch(() => toast.error("Impossible de charger. Réessayez."))
      .finally(() => setLoading(false));

  useEffect(() => { load(); }, []);
  useEffect(() => { document.body.style.overflow = showModal ? "hidden" : ""; return () => { document.body.style.overflow = ""; }; }, [showModal]);

  const openCreate = () => { setEditing(null); setForm(EMPTY_FORM); setShowDesc(false); setShowModal(true); };
  const openEdit   = (p: Product) => { setEditing(p); setForm(fromProduct(p, config)); setShowDesc(!!p.description); setShowModal(true); };

  const handleImageFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const previewUrl = URL.createObjectURL(file);
    setForm((p) => ({ ...p, image_url: previewUrl, imageUploading: true }));
    try {
      const res = await uploadApi.uploadImage(file);
      setForm((p) => ({ ...p, image_url: res.data.url, imageUploading: false }));
      toast.success("📷 Photo ajoutée !");
    } catch { setForm((p) => ({ ...p, image_url: "", imageUploading: false })); toast.error("Impossible d'uploader la photo."); }
    finally { URL.revokeObjectURL(previewUrl); if (fileInputRef.current) fileInputRef.current.value = ""; }
  };

  const set = (k: keyof FormState, v: any) => setForm((p) => ({ ...p, [k]: v }));
  const toggleSize = (size: string) => {
    const already = form.selectedSizes.includes(size);
    const next = already ? form.selectedSizes.filter((s) => s !== size) : [...form.selectedSizes, size];
    const nextStock = { ...form.stockPerSize };
    if (!already) nextStock[size] = nextStock[size] || "1";
    set("selectedSizes", next); set("stockPerSize", nextStock);
  };

  const addVariant    = () => setForm((p) => ({ ...p, variants: [...p.variants, newVariantDraft()], hasVariants: true }));
  const changeVariant = (key: string, field: keyof VariantDraft, value: string | boolean) =>
    setForm((p) => ({ ...p, variants: p.variants.map((v) => v._key === key ? { ...v, [field]: value } : v) }));
  const deleteVariant = (key: string) => setForm((p) => { const next = p.variants.filter((v) => v._key !== key); return { ...p, variants: next, hasVariants: next.length > 0 }; });
  const uploadVariantImage = async (key: string, file: File) => {
    const previewUrl = URL.createObjectURL(file);
    changeVariant(key, "image_url", previewUrl); changeVariant(key, "uploading", true);
    try {
      const res = await uploadApi.uploadImage(file);
      setForm((p) => ({ ...p, variants: p.variants.map((v) => v._key === key ? { ...v, image_url: res.data.url, uploading: false } : v) }));
      toast.success("📷 Photo variante ajoutée !");
    } catch {
      setForm((p) => ({ ...p, variants: p.variants.map((v) => v._key === key ? { ...v, image_url: "", uploading: false } : v) }));
      toast.error("Impossible d'uploader la photo.");
    } finally { URL.revokeObjectURL(previewUrl); }
  };

  const selectedCat = config.categories.find((c) => c.value === form.category);
  const variantTotalStock = form.variants.reduce((s, v) => s + parseInt(v.stock || "0", 10), 0);
  const anyVariantUploading = form.variants.some((v) => v.uploading);

  const canSave = (() => {
    if (!form.name.trim() || !form.category || !form.price || form.imageUploading || anyVariantUploading) return false;
    if (form.hasVariants) { if (form.variants.length === 0) return false; if (form.variants.some((v) => !v.name.trim())) return false; return true; }
    if (config.hasDuration) return true;
    if (!config.hasStock) return true;
    if (selectedCat?.unitMode === "sizes") return form.selectedSizes.length > 0;
    return !!form.globalStock && !!form.unit;
  })();

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error("Le nom est obligatoire."); return; }
    if (!form.category) { toast.error("Choisissez une catégorie."); return; }
    if (!form.price || isNaN(parseFloat(form.price))) { toast.error("Entrez un prix valide."); return; }
    if (form.imageUploading || anyVariantUploading) { toast.error("Attendez la fin de l'upload."); return; }
    if (form.hasVariants) {
      if (form.variants.length === 0) { toast.error("Ajoutez au moins une variante."); return; }
      if (form.variants.find((v) => !v.name.trim())) { toast.error("Donnez un nom à chaque variante."); return; }
    } else if (config.hasStock && selectedCat?.unitMode !== "sizes") {
      if (!form.globalStock || isNaN(parseInt(form.globalStock))) { toast.error("Entrez la quantité en stock."); return; }
      if (!form.unit) { toast.error("Choisissez une unité."); return; }
    }
    setSaving(true);
    try {
      const payload = buildPayload(form, config, selectedCat);
      editing ? await productsApi.update(editing.id, payload) : await productsApi.create(payload);
      toast.success(editing ? `✅ ${config.itemLabel} mis à jour !` : `✅ ${config.itemLabel} ajouté !`);
      setShowModal(false); load();
    } catch { toast.error("Une erreur s'est produite. Réessayez."); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Supprimer "${name}" ?`)) return;
    try { await productsApi.delete(id); toast.success("Supprimé."); load(); }
    catch { toast.error("Impossible de supprimer."); }
  };

  const renderStock = (p: Product) => {
    if (config.hasDuration || !config.hasStock) return <span style={{ color: C.green, fontWeight: 600, fontSize: 13 }}>✓ Disponible</span>;
    const hasVariants = p.variants && p.variants.length > 0;
    if (hasVariants) {
      const active = p.variants.filter((v) => v.is_active);
      const inStock = active.filter((v) => v.stock > 0);
      if (inStock.length === 0) return <span style={{ color: "#DC2626", fontWeight: 700, fontSize: 13 }}>⚠️ Complet</span>;
      return <span style={{ color: C.green, fontWeight: 700, fontSize: 13 }}>{inStock.length}/{active.length} variantes</span>;
    }
    if (p.stock === 0) return <span style={{ color: "#DC2626", fontWeight: 700, fontSize: 13 }}>⚠️ {bizType === "transport" ? "Complet" : "Rupture"}</span>;
    return <span style={{ color: p.stock <= 3 ? "#D97706" : C.green, fontWeight: 700, fontSize: 14 }}>{p.stock} <span style={{ fontWeight: 500, color: C.muted, fontSize: 12 }}>{p.unit}</span></span>;
  };

  if (!bizType) return null;

  return (
    <div style={{ maxWidth: 1280, margin: "0 auto", padding: "24px 20px" }}>
      <style>{`
        .prod-row { transition: background 0.15s; }
        .prod-row:hover { background: ${C.goldLight} !important; }
        .inp:focus { border-color: ${C.greenBorder} !important; }
        @keyframes spin   { to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:none; } }
      `}</style>

      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 12 }}>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 900, color: C.text, marginBottom: 4 }}>{config.pageIcon} {config.pageTitle}</h1>
            <p style={{ color: C.muted, fontSize: 14 }}>
              {loading ? "Chargement…" : products.length === 0 ? `Aucun ${config.itemLabel} pour l'instant` : `${products.length} ${config.itemLabel}${products.length !== 1 ? "s" : ""} dans votre catalogue`}
            </p>
          </div>
          <button onClick={openCreate} style={{ background: C.green, color: C.white, border: "none", borderRadius: 12, padding: "12px 22px", fontSize: 15, fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", gap: 8, boxShadow: "0 4px 14px rgba(27,67,50,0.25)" }}>
            + {config.addLabel}
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: "100px 0", color: C.muted }}><div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>Chargement…</div>
      ) : products.length === 0 ? (
        <div style={{ background: C.white, borderRadius: 20, border: `1px solid ${C.border}`, padding: "80px 40px", textAlign: "center" }}>
          <div style={{ fontSize: 64, marginBottom: 16 }}>{config.pageIcon}</div>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: C.text, marginBottom: 8 }}>{config.emptyTitle}</h2>
          <p style={{ color: C.muted, maxWidth: 380, margin: "0 auto 24px", lineHeight: 1.6 }}>{config.emptyDesc}</p>
          <button onClick={openCreate} style={{ background: C.green, color: C.white, border: "none", borderRadius: 12, padding: "12px 28px", fontSize: 15, fontWeight: 700, cursor: "pointer" }}>+ {config.addLabel}</button>
        </div>
      ) : (
        <div style={{ background: C.white, borderRadius: 20, border: `1px solid ${C.border}`, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: C.bg, borderBottom: `1px solid ${C.border}` }}>
                {["Photo", "Nom", "Prix", config.hasDuration ? "Durée" : config.hasStock ? "Dispo" : "Cat.", "État", "Actions"].map((h) => (
                  <th key={h} style={{ padding: "14px 16px", textAlign: "left", fontSize: 11, color: C.muted, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id} className="prod-row" style={{ borderBottom: `1px solid ${C.border}` }}>
                  <td style={{ padding: "14px 16px", width: 64 }}>
                    {p.image_url
                      ? <img src={p.image_url} alt={p.name} style={{ width: 52, height: 52, borderRadius: 10, objectFit: "cover", border: `1px solid ${C.border}`, display: "block" }} onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                      : <div style={{ width: 52, height: 52, borderRadius: 10, background: C.bg, border: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>{config.pageIcon}</div>
                    }
                  </td>
                  <td style={{ padding: "14px 16px" }}>
                    <p style={{ fontWeight: 700, color: C.text, fontSize: 14, marginBottom: 2 }}>{p.name}</p>
                    {p.description && <p style={{ color: C.muted, fontSize: 12, maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.description}</p>}
                  </td>
                  <td style={{ padding: "14px 16px", whiteSpace: "nowrap" }}>
                    <p style={{ fontWeight: 900, color: C.gold, fontSize: 15 }}>
                      {Number(p.price) > 0 ? <>{Number(p.price).toLocaleString("fr-FR")} <span style={{ fontSize: 11, fontWeight: 600, color: C.muted }}>FCFA</span></> : <span style={{ color: C.muted, fontWeight: 600, fontSize: 13 }}>Sur devis</span>}
                    </p>
                  </td>
                  <td style={{ padding: "14px 16px" }}>{renderStock(p)}</td>
                  <td style={{ padding: "14px 16px" }}>
                    <span style={{ padding: "4px 12px", borderRadius: 100, fontSize: 12, fontWeight: 700, background: p.is_active ? C.greenLight : C.bg, color: p.is_active ? C.green : C.muted, border: `1px solid ${p.is_active ? C.greenBorder : C.border}` }}>
                      {p.is_active ? "✓ Visible" : "Masqué"}
                    </span>
                  </td>
                  <td style={{ padding: "14px 16px" }}>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={() => openEdit(p)} style={{ background: C.blueLight, border: `1px solid ${C.blueBorder}`, borderRadius: 8, color: C.blue, cursor: "pointer", padding: "6px 12px", fontSize: 13, fontWeight: 700, fontFamily: "inherit" }}>✏️ Modifier</button>
                      <button onClick={() => handleDelete(p.id, p.name)} style={{ background: C.redLight, border: `1px solid ${C.redBorder}`, borderRadius: 8, color: C.red, cursor: "pointer", padding: "6px 10px", fontSize: 13, fontFamily: "inherit" }}>🗑️</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <>
          <div onClick={() => setShowModal(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1000, backdropFilter: "blur(2px)" }} />
          <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", zIndex: 1001, background: C.white, borderRadius: 24, width: "min(560px, calc(100vw - 32px))", maxHeight: "calc(100vh - 48px)", display: "flex", flexDirection: "column", boxShadow: "0 24px 64px rgba(0,0,0,0.18)", overflow: "hidden", animation: "fadeIn 0.2s ease" }}>

            {/* Header */}
            <div style={{ padding: "20px 24px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center", background: C.goldLight, flexShrink: 0 }}>
              <div>
                <p style={{ fontSize: 11, color: C.muted, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>{editing ? `Modifier le ${config.itemLabel}` : `Nouveau ${config.itemLabel}`}</p>
                <h3 style={{ fontSize: 18, fontWeight: 900, color: C.green, marginTop: 2 }}>{editing ? form.name || config.itemLabel : config.addLabel}</h3>
              </div>
              <button onClick={() => setShowModal(false)} style={{ background: C.border, border: "none", borderRadius: "50%", width: 36, height: 36, cursor: "pointer", color: C.muted, fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>✕</button>
            </div>

            {/* Body */}
            <div style={{ padding: 24, overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: 20 }}>

              {/* Photo */}
              <div>
                <FL>📷 Photo principale <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0, fontSize: 11, color: C.muted }}>(facultatif)</span></FL>
                <input ref={fileInputRef} type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={handleImageFile} />
                {form.image_url ? (
                  <div style={{ position: "relative", borderRadius: 12, overflow: "hidden", height: 140, background: C.bg, border: `1px solid ${C.border}` }}>
                    <img src={form.image_url} alt="Aperçu" style={{ width: "100%", height: "100%", objectFit: "cover", opacity: form.imageUploading ? 0.5 : 1 }} />
                    {form.imageUploading ? (
                      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, background: "rgba(255,255,255,0.7)" }}>
                        <span style={{ width: 24, height: 24, border: `3px solid ${C.border}`, borderTopColor: C.green, borderRadius: "50%", animation: "spin 0.8s linear infinite", display: "inline-block" }} />
                        <span style={{ fontSize: 12, color: C.muted }}>Upload en cours…</span>
                      </div>
                    ) : (
                      <button type="button" onClick={() => set("image_url", "")} style={{ position: "absolute", top: 8, right: 8, background: C.white, border: `1px solid ${C.border}`, borderRadius: "50%", width: 28, height: 28, color: C.muted, cursor: "pointer", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
                    )}
                  </div>
                ) : (
                  <button type="button" onClick={() => fileInputRef.current?.click()} style={{ width: "100%", padding: "24px 20px", background: C.goldLight, border: `2px dashed ${C.goldBorder}`, borderRadius: 12, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 8, boxSizing: "border-box", fontFamily: "inherit" }}>
                    <span style={{ fontSize: 32 }}>📸</span>
                    <span style={{ fontWeight: 700, color: C.text, fontSize: 14 }}>Appuyez pour ajouter une photo</span>
                    <span style={{ fontSize: 12, color: C.muted }}>Depuis votre galerie ou appareil photo</span>
                  </button>
                )}
              </div>

              {/* Name */}
              <div>
                <FL>Nom <span style={{ color: C.gold }}>*</span></FL>
                <input className="inp" required value={form.name} onChange={(e) => set("name", e.target.value)} placeholder={config.namePlaceholder} style={{ ...inp, borderColor: form.name ? C.greenBorder : C.border }} />
              </div>

              {/* Category */}
              <div>
                <FL>Catégorie <span style={{ color: C.gold }}>*</span></FL>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {config.categories.map((cat) => {
                    const active = form.category === cat.value;
                    return (
                      <button key={cat.value} type="button"
                        onClick={() => { set("category", cat.value); if (!cat.unitMode || cat.unitMode === "single") { set("unit", cat.defaultUnit || cat.units?.[0] || "pièce"); } else { set("unit", ""); } set("selectedSizes", []); set("stockPerSize", {}); }}
                        style={{ padding: "8px 14px", borderRadius: 100, fontSize: 13, fontFamily: "inherit", cursor: "pointer", transition: "all 0.12s", border: `1px solid ${active ? C.green : C.border}`, background: active ? C.green : C.white, color: active ? C.white : C.text, fontWeight: active ? 700 : 500, display: "flex", alignItems: "center", gap: 6 }}>
                        {cat.emoji} {cat.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Duration (for service types) */}
              {config.hasDuration && form.category && (
                <div style={{ animation: "fadeIn 0.2s ease" }}>
                  <FL>Durée <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0, fontSize: 11, color: C.muted }}>(facultatif)</span></FL>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
                    {DURATIONS.map((d) => <Chip key={d} label={d} selected={form.duration === d} onClick={() => set("duration", form.duration === d ? "" : d)} accent={C.purple} />)}
                  </div>
                  <FL>Type de tarification</FL>
                  <div style={{ display: "flex", gap: 8 }}>
                    {PRICING_TYPES.map((pt) => {
                      const active = form.pricingType === pt.value;
                      return <button key={pt.value} type="button" onClick={() => set("pricingType", pt.value)} style={{ flex: 1, padding: 10, borderRadius: 10, fontSize: 12, fontFamily: "inherit", cursor: "pointer", border: `1px solid ${active ? C.purpleBorder : C.border}`, background: active ? C.purpleLight : C.white, color: active ? C.purple : C.muted, fontWeight: active ? 700 : 500 }}>{pt.label}</button>;
                    })}
                  </div>
                </div>
              )}

              {/* Unit picker */}
              {config.hasUnit && selectedCat && !selectedCat.unitMode && selectedCat.units && (
                <div style={{ animation: "fadeIn 0.2s ease" }}>
                  <FL>Unité <span style={{ color: C.gold }}>*</span></FL>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {selectedCat.units.map((u) => <Chip key={u} label={u} selected={form.unit === u} onClick={() => set("unit", u)} />)}
                  </div>
                </div>
              )}

              {/* Size picker (products_seller clothes/shoes only) */}
              {config.hasSizes && selectedCat?.unitMode === "sizes" && !form.hasVariants && (
                <div style={{ animation: "fadeIn 0.2s ease" }}>
                  <FL>Tailles disponibles <span style={{ color: C.gold }}>*</span></FL>
                  {selectedCat.sizeGroups!.map((group) => (
                    <div key={group.label} style={{ marginBottom: 14 }}>
                      <p style={{ fontSize: 11, color: C.muted, marginBottom: 7, fontWeight: 600 }}>{group.label}</p>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                        {group.sizes.map((size) => <Chip key={size} label={size} selected={form.selectedSizes.includes(size)} onClick={() => toggleSize(size)} accent={C.purple} />)}
                      </div>
                    </div>
                  ))}
                  {form.selectedSizes.length > 0 && (
                    <div style={{ background: C.purpleLight, border: `1px solid ${C.purpleBorder}`, borderRadius: 12, padding: "14px 16px", marginTop: 4 }}>
                      <p style={{ fontSize: 12, color: C.purple, marginBottom: 12, fontWeight: 700 }}>Stock par taille :</p>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(90px, 1fr))", gap: 10 }}>
                        {form.selectedSizes.map((size) => (
                          <div key={size}>
                            <p style={{ fontSize: 11, color: C.purple, marginBottom: 5, fontWeight: 700, textAlign: "center" }}>{size}</p>
                            <input type="number" min="0" className="inp" value={form.stockPerSize[size] || ""} onChange={(e) => set("stockPerSize", { ...form.stockPerSize, [size]: e.target.value })} placeholder="0" style={{ ...inp, textAlign: "center", padding: "8px", fontSize: 14, fontWeight: 600 }} />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Price */}
              {form.category && (
                <div style={{ animation: "fadeIn 0.2s ease" }}>
                  <FL>{config.priceLabel} en FCFA{form.unit && config.hasUnit ? ` (par ${form.unit})` : ""} <span style={{ color: C.gold }}>*</span></FL>
                  <div style={{ position: "relative" }}>
                    <input type="number" min="0" className="inp" required value={form.price} onChange={(e) => set("price", e.target.value)} placeholder="Ex: 2500"
                      style={{ ...inp, borderColor: form.price ? C.goldBorder : C.border, paddingRight: 60, fontSize: 16, fontWeight: 600 }} />
                    <span style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", fontSize: 12, fontWeight: 700, color: C.muted }}>FCFA</span>
                  </div>
                  {form.price && !isNaN(parseFloat(form.price)) && (
                    <p style={{ fontSize: 12, color: C.green, marginTop: 5, fontWeight: 600 }}>✓ {parseFloat(form.price).toLocaleString("fr-FR")} FCFA</p>
                  )}
                </div>
              )}

              {/* Global stock */}
              {config.hasStock && selectedCat && selectedCat.unitMode !== "sizes" && form.unit && !form.hasVariants && (
                <div style={{ animation: "fadeIn 0.2s ease" }}>
                  <FL>{bizType === "transport" ? "Nombre de places disponibles" : "Quantité en stock"} <span style={{ color: C.gold }}>*</span></FL>
                  <input type="number" min="0" className="inp" required value={form.globalStock} onChange={(e) => set("globalStock", e.target.value)} placeholder="Ex: 30" style={{ ...inp, borderColor: form.globalStock ? C.greenBorder : C.border }} />
                </div>
              )}

              {/* Variants (products seller mainly) */}
              {form.category && bizType === "products_seller" && (
                <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 20 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 800, color: C.text }}>🎨 Couleurs / Designs / Variantes</p>
                      <p style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>Plusieurs couleurs ou designs ? Ajoutez-les ici.</p>
                    </div>
                    {!form.hasVariants && <button type="button" onClick={() => { set("hasVariants", true); addVariant(); }} style={{ background: C.purpleLight, border: `1px solid ${C.purpleBorder}`, borderRadius: 10, color: C.purple, cursor: "pointer", padding: "8px 14px", fontSize: 13, fontWeight: 700, fontFamily: "inherit", whiteSpace: "nowrap" }}>+ Ajouter</button>}
                  </div>
                  {form.hasVariants && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                      {form.variants.length > 0 && (
                        <div style={{ background: C.purpleLight, border: `1px solid ${C.purpleBorder}`, borderRadius: 10, padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                          <span style={{ fontSize: 13, color: C.purple, fontWeight: 700 }}>{form.variants.length} variante{form.variants.length > 1 ? "s" : ""} — stock total : {variantTotalStock}</span>
                        </div>
                      )}
                      {form.variants.map((v, i) => <VariantRow key={v._key} variant={v} index={i} onChange={changeVariant} onDelete={deleteVariant} onUpload={uploadVariantImage} />)}
                      <button type="button" onClick={addVariant} style={{ width: "100%", padding: "12px", background: C.white, border: `2px dashed ${C.purpleBorder}`, borderRadius: 12, color: C.purple, cursor: "pointer", fontSize: 14, fontWeight: 700, fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>+ Ajouter une variante</button>
                      <button type="button" onClick={() => { set("variants", []); set("hasVariants", false); }} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 12, fontFamily: "inherit", textDecoration: "underline", padding: 0, alignSelf: "center" }}>Supprimer toutes les variantes</button>
                    </div>
                  )}
                </div>
              )}

              {/* Description */}
              {form.category && (
                <div>
                  <button type="button" onClick={() => setShowDesc(!showDesc)} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 13, fontFamily: "inherit", padding: 0, display: "flex", alignItems: "center", gap: 6, fontWeight: 600 }}>
                    <span style={{ display: "inline-block", transition: "transform 0.2s", transform: showDesc ? "rotate(90deg)" : "none" }}>▶</span>
                    {showDesc ? "Masquer la description" : "Ajouter une description (facultatif)"}
                  </button>
                  {showDesc && (
                    <div style={{ marginTop: 10, animation: "fadeIn 0.2s ease" }}>
                      <textarea className="inp" value={form.description} onChange={(e) => set("description", e.target.value)} rows={3} placeholder={config.descPlaceholder} style={{ ...inp, resize: "none", marginTop: 6 }} />
                      <p style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>Le robot utilisera ce texte pour décrire aux clients.</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div style={{ padding: "16px 24px", borderTop: `1px solid ${C.border}`, display: "flex", gap: 10, flexShrink: 0, background: C.white }}>
              <button type="button" onClick={() => setShowModal(false)} style={{ flex: 1, padding: 12, borderRadius: 12, border: `1px solid ${C.border}`, background: C.white, fontSize: 14, fontWeight: 700, cursor: "pointer", color: C.muted, fontFamily: "inherit" }}>Annuler</button>
              <button type="button" onClick={handleSave} disabled={saving || !canSave}
                style={{ flex: 2, padding: 12, borderRadius: 12, border: "none", background: !canSave ? C.bg : saving ? "#9CA3AF" : C.green, color: !canSave ? C.muted : C.white, fontSize: 15, fontWeight: 900, cursor: saving || !canSave ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, boxShadow: (!canSave || saving) ? "none" : "0 4px 14px rgba(27,67,50,0.25)", transition: "all 0.2s", fontFamily: "inherit" }}>
                {saving || form.imageUploading || anyVariantUploading
                  ? <><span style={{ width: 14, height: 14, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.8s linear infinite", display: "inline-block" }} />{anyVariantUploading ? "Upload variante…" : form.imageUploading ? "Upload…" : "Sauvegarde…"}</>
                  : !canSave ? "Remplissez les champs requis"
                  : editing ? "✅ Enregistrer les modifications"
                  : `✅ Ajouter le ${config.itemLabel}`}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}