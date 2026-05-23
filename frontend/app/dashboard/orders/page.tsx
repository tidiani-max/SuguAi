"use client";
import { useEffect, useState, useRef } from "react";
import { ordersApi, authApi } from "@/lib/api";
import { Order, OrderStatus, Business, BusinessType } from "@/types";
import toast from "react-hot-toast";
import Cookies from "js-cookie";

function getBusinessId(): string | null {
  try {
    const token = Cookies.get("access_token");
    if (!token) return null;
    return JSON.parse(atob(token.split(".")[1])).sub || null;
  } catch { return null; }
}
function logoKey(id: string | null) { return id ? `suguai_logo_${id}` : "suguai_logo_unknown"; }

const C = {
  gold: "#C5A034", goldLight: "#FFF8E7", goldBorder: "#F0D88A",
  green: "#1B4332", greenLight: "#F0FDF4", greenBorder: "#BBF7D0",
  text: "#111827", muted: "#6B7280", border: "#E5E7EB",
  bg: "#F9FAFB", white: "#FFFFFF",
};

// ── Per-type vocabulary ───────────────────────────────────────────────────────
interface OrderVocab {
  pageTitle: string;
  pageIcon: string;
  pageDesc: string;
  itemLabel: string;        // "commande", "ticket", "réservation"
  emptyTitle: string;
  emptyDesc: string;
  addressLabel: string;     // "Adresse de livraison", "Destination", "Lieu du rendez-vous"
  customerLabel: string;    // "Client", "Passager", "Patient"
  confirmLabel: string;     // "Confirmer la commande", "Valider le billet"
  confirmDesc: (lang: string) => string;
  shippedLabel: string;     // "En livraison", "En route", "En cours"
}

function getVocab(type: BusinessType | null): OrderVocab {
  switch (type) {
    case "transport":
      return {
        pageTitle: "Réservations", pageIcon: "🚌",
        pageDesc: "Gérez les billets et réservations de vos passagers.",
        itemLabel: "réservation",
        emptyTitle: "Prêt pour votre premier passager ?",
        emptyDesc: "Dès qu'un client réserve une place sur WhatsApp, tous les détails apparaîtront ici.",
        addressLabel: "Destination",
        customerLabel: "Passager",
        confirmLabel: "✅ Confirmer la réservation",
        confirmDesc: (lang) => lang === "bambara"
          ? "🇲🇱 Le passager recevra un message en Bambara : place confirmée !"
          : "🇫🇷 Le passager recevra un WhatsApp : sa place est confirmée. Inch'Allah bon voyage !",
        shippedLabel: "🚌 En route",
      };
    case "health":
      return {
        pageTitle: "Rendez-vous", pageIcon: "🏥",
        pageDesc: "Gérez les demandes de consultation de vos patients.",
        itemLabel: "rendez-vous",
        emptyTitle: "Prêt pour votre premier patient ?",
        emptyDesc: "Dès qu'un patient demande un rendez-vous sur WhatsApp, il apparaîtra ici.",
        addressLabel: "Service consulté",
        customerLabel: "Patient",
        confirmLabel: "✅ Confirmer le rendez-vous",
        confirmDesc: (lang) => lang === "bambara"
          ? "🇲🇱 Le patient recevra un message en Bambara : rendez-vous confirmé !"
          : "🇫🇷 Le patient recevra un WhatsApp confirmant son rendez-vous. Inch'Allah !",
        shippedLabel: "🏥 En salle",
      };
    case "education":
      return {
        pageTitle: "Inscriptions", pageIcon: "📚",
        pageDesc: "Gérez les demandes d'inscription de vos élèves.",
        itemLabel: "inscription",
        emptyTitle: "Prêt pour votre premier élève ?",
        emptyDesc: "Dès qu'un élève s'inscrit via WhatsApp, son dossier apparaîtra ici.",
        addressLabel: "Formation souhaitée",
        customerLabel: "Élève",
        confirmLabel: "✅ Confirmer l'inscription",
        confirmDesc: (lang) => lang === "bambara"
          ? "🇲🇱 L'élève recevra un message en Bambara : inscription confirmée !"
          : "🇫🇷 L'élève recevra un WhatsApp confirmant son inscription. Inch'Allah !",
        shippedLabel: "📚 En cours",
      };
    case "real_estate":
      return {
        pageTitle: "Demandes de visite", pageIcon: "🏠",
        pageDesc: "Gérez les demandes de visite de vos clients.",
        itemLabel: "demande",
        emptyTitle: "Prêt pour votre premier client ?",
        emptyDesc: "Dès qu'un client demande une visite via WhatsApp, elle apparaîtra ici.",
        addressLabel: "Bien souhaité",
        customerLabel: "Client",
        confirmLabel: "✅ Confirmer la visite",
        confirmDesc: (lang) => lang === "bambara"
          ? "🇲🇱 Le client recevra un message en Bambara : visite confirmée !"
          : "🇫🇷 Le client recevra un WhatsApp confirmant la visite. Inch'Allah !",
        shippedLabel: "🏠 Visite planifiée",
      };
    case "events":
      return {
        pageTitle: "Devis & Réservations", pageIcon: "🎉",
        pageDesc: "Gérez les demandes de devis et réservations événementielles.",
        itemLabel: "devis",
        emptyTitle: "Prêt pour votre premier événement ?",
        emptyDesc: "Dès qu'un client demande un devis via WhatsApp, il apparaîtra ici.",
        addressLabel: "Lieu de l'événement",
        customerLabel: "Client",
        confirmLabel: "✅ Confirmer le devis",
        confirmDesc: (lang) => lang === "bambara"
          ? "🇲🇱 Le client recevra un message en Bambara : réservation confirmée !"
          : "🇫🇷 Le client recevra un WhatsApp confirmant sa réservation. Inch'Allah !",
        shippedLabel: "🎉 Préparation",
      };
    default: // products_seller, fnb, service_information, custom
      return {
        pageTitle: "Commandes", pageIcon: "🛍️",
        pageDesc: "Gérez vos ventes et confirmez les livraisons.",
        itemLabel: "commande",
        emptyTitle: "Prêt pour votre première vente ?",
        emptyDesc: "Dès qu'un client passe commande sur WhatsApp, tous les détails apparaîtront ici instantanément.",
        addressLabel: "Adresse de livraison",
        customerLabel: "Client",
        confirmLabel: "✅ Confirmer la commande",
        confirmDesc: (lang) => lang === "bambara"
          ? "🇲🇱 Le client recevra un message en Bambara : livreur en route !"
          : "🇫🇷 Le client recevra un WhatsApp : son livreur arrive bientôt.",
        shippedLabel: "🚚 En livraison",
      };
  }
}

// ── Payment / fulfillment helpers ─────────────────────────────────────────────
function isPaid(order: Order): boolean {
  return order.status === "paid" || !!order.payment_verified_at || ["processing","shipped","delivered"].includes(order.status);
}

const FULFILLMENT_STATUS: Record<string, { label: string; color: string; bg: string; border: string }> = {
  pending_payment: { label: "🕐 En attente",   color: "#6B7280", bg: "#F9FAFB", border: "#E5E7EB" },
  paid:            { label: "🕐 En attente",   color: "#6B7280", bg: "#F9FAFB", border: "#E5E7EB" },
  processing:      { label: "🔧 Préparation",  color: "#1E40AF", bg: "#EFF6FF", border: "#BFDBFE" },
  shipped:         { label: "🚚 En livraison", color: "#6D28D9", bg: "#F5F3FF", border: "#C4B5FD" },
  delivered:       { label: "📦 Livré",        color: "#065F46", bg: "#ECFDF5", border: "#6EE7B7" },
  cancelled:       { label: "❌ Annulé",       color: "#991B1B", bg: "#FEF2F2", border: "#FECACA" },
};
const FULFILLMENT_OPTIONS = ["processing","shipped","delivered","cancelled"] as const;

function formatPhone(raw: string | null | undefined): string {
  if (!raw) return "—";
  let num = raw.split("@")[0].replace(/[^\d+]/g, "");
  if (num && !num.startsWith("+")) num = "+" + num;
  const m = num.match(/^(\+\d{1,3})(\d{2,3})(\d{2})(\d{2})(\d{0,2})$/);
  if (m) return [m[1],m[2],m[3],m[4],m[5]].filter(Boolean).join(" ");
  return num;
}
function timeAgo(date: string): string {
  const diff = Date.now() - new Date(date).getTime();
  const m = Math.floor(diff/60000), h = Math.floor(diff/3600000), d = Math.floor(diff/86400000);
  if (m < 1) return "À l'instant";
  if (m < 60) return `Il y a ${m} min`;
  if (h < 24) return `Il y a ${h}h`;
  if (d === 1) return "Hier";
  if (d < 7) return `Il y a ${d} jours`;
  return new Date(date).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
}
const STATUS_PRINT: Record<string,string> = {
  pending_payment:"En attente", paid:"Payé", processing:"En préparation",
  shipped:"En livraison", delivered:"Livré", cancelled:"Annulé",
};

// ── Receipt builder ───────────────────────────────────────────────────────────
function buildReceiptHtml(order: Order, business: Business, vocab: OrderVocab, logoDataUrl?: string): string {
  const total = Number(order.total_amount).toLocaleString("fr-FR");
  const date  = new Date(order.created_at).toLocaleDateString("fr-FR", { day:"2-digit", month:"long", year:"numeric", hour:"2-digit", minute:"2-digit" });
  const logoSection = logoDataUrl
    ? `<img src="${logoDataUrl}" alt="${business.name}" style="height:72px;width:auto;object-fit:contain;display:block;margin:0 auto 10px;" />`
    : `<div style="width:72px;height:72px;background:#1B4332;border-radius:14px;display:flex;align-items:center;justify-content:center;margin:0 auto 10px;font-size:32px;font-weight:900;color:#C5A034;line-height:72px;text-align:center;">${business.name.charAt(0).toUpperCase()}</div>`;
  const itemRows = order.items.map(item => `
    <tr>
      <td style="padding:9px 6px;border-bottom:1px solid #F3F4F6;vertical-align:top;">
        <div style="font-weight:700;color:#111827;font-size:13px;">${item.product_name}</div>
        ${(item.color||item.size)?`<div style="font-size:11px;color:#9CA3AF;margin-top:2px;">${[item.color&&`🎨 ${item.color}`,item.size&&`📏 ${item.size}`].filter(Boolean).join("  ")}</div>`:""}
      </td>
      <td style="padding:9px 6px;border-bottom:1px solid #F3F4F6;text-align:center;color:#6B7280;font-size:13px;">×${item.quantity}</td>
      <td style="padding:9px 6px;border-bottom:1px solid #F3F4F6;text-align:right;font-weight:800;color:#1B4332;font-size:13px;">${Number(item.subtotal).toLocaleString("fr-FR")} FCFA</td>
    </tr>`).join("");
  const customerSection = (order.customer_name||order.customer_phone||order.delivery_address)?`
    <div style="margin-bottom:18px;">
      <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#9CA3AF;margin-bottom:8px;">${vocab.customerLabel}</div>
      <div style="background:#F9FAFB;border-radius:10px;padding:12px 14px;">
        ${order.customer_name?`<div style="margin-bottom:5px;font-size:13px;font-weight:700;color:#111827;">👤 ${order.customer_name}</div>`:""}
        ${order.customer_phone?`<div style="margin-bottom:5px;font-size:13px;color:#6B7280;">📞 ${formatPhone(order.customer_phone)}</div>`:""}
        ${order.delivery_address?`<div style="font-size:13px;color:#6B7280;">📍 ${order.delivery_address}</div>`:""}
      </div>
     </div>` : "";
  return `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"/>
  <title>Reçu ${order.order_number} — ${business.name}</title>
  <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=Outfit:wght@400;600;700;800;900&display=swap" rel="stylesheet">
  <style>
    *{margin:0;padding:0;box-sizing:border-box;}
    body{font-family:'Outfit',sans-serif;background:#F3F4F6;display:flex;justify-content:center;padding:24px 16px;}
    @media print{body{background:white;padding:0;}.no-print{display:none!important;}.receipt{border:none!important;box-shadow:none!important;}}
    .receipt{background:white;max-width:420px;width:100%;border-radius:20px;overflow:hidden;box-shadow:0 8px 40px rgba(0,0,0,0.12);}
    .header{background:linear-gradient(135deg,#1B4332,#2D6A4F);padding:28px 24px 24px;text-align:center;}
    .biz-name{font-family:'Playfair Display',serif;font-size:28px;color:white;margin-bottom:4px;}
    .body{padding:24px;}
    .order-bar{display:flex;justify-content:space-between;align-items:center;background:#F9FAFB;border-radius:10px;padding:12px 14px;margin-bottom:20px;}
    .total-bar{display:flex;justify-content:space-between;align-items:center;background:#FFF8E7;border:1px solid #F0D88A;border-radius:12px;padding:14px 16px;margin-bottom:20px;}
    .total-val{font-family:'Playfair Display',serif;font-size:24px;color:#C5A034;}
    table{width:100%;border-collapse:collapse;margin-bottom:18px;}
    hr{border:none;border-top:1px dashed #E5E7EB;margin:20px 0;}
    .footer{text-align:center;padding-bottom:4px;font-size:12px;color:#D1D5DB;}
    .print-btn{display:block;width:calc(100% - 48px);margin:0 24px 24px;background:#1B4332;color:white;border:none;padding:14px;border-radius:12px;font-size:15px;font-weight:700;cursor:pointer;font-family:'Outfit',sans-serif;}
  </style></head><body>
  <div class="receipt">
    <div class="header">${logoSection}<div class="biz-name">${business.name}</div></div>
    <div class="body">
      <div class="order-bar">
        <div><div style="font-size:15px;font-weight:800;color:#1B4332;">#${order.order_number}</div><div style="font-size:11px;color:#9CA3AF;">${date}</div></div>
        <span style="padding:4px 12px;border-radius:100px;font-size:11px;font-weight:700;background:#ECFDF5;color:#065F46;">${STATUS_PRINT[order.status]||order.status}</span>
      </div>
      ${customerSection}
      <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#9CA3AF;margin-bottom:8px;">Articles</div>
      <table><tbody>${itemRows}</tbody></table>
      ${Number(order.total_amount)>0?`<div class="total-bar"><span style="font-weight:700;font-size:14px;">Total</span><span class="total-val">${total} FCFA</span></div>`:""}
      <hr/>
      <div class="footer">Propulsé par <strong style="color:#C5A034;">SuguAI</strong></div>
    </div>
    <button class="print-btn no-print" onclick="window.print()">🖨️ Imprimer</button>
  </div>
</body></html>`;
}
function openReceipt(order: Order, business: Business, vocab: OrderVocab, logoDataUrl?: string) {
  const win = window.open("","_blank","width=540,height=860,scrollbars=yes");
  if (win) { win.document.write(buildReceiptHtml(order,business,vocab,logoDataUrl)); win.document.close(); }
}

// ── Logo uploader ─────────────────────────────────────────────────────────────
function LogoUploader({ current, onLogo }: { current?: string; onLogo: (url: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    if (file.size > 2*1024*1024) { toast.error("Image trop grande (max 2 Mo)"); return; }
    setUploading(true);
    const reader = new FileReader();
    reader.onload = (ev) => { onLogo(ev.target?.result as string); setUploading(false); toast.success("Logo enregistré !"); };
    reader.readAsDataURL(file);
  };
  return (
    <div style={{ display:"flex", alignItems:"center", gap:8 }}>
      <input ref={inputRef} type="file" accept="image/*" onChange={handleFile} style={{ display:"none" }} />
      {current && <img src={current} alt="logo" style={{ height:32, width:32, borderRadius:6, objectFit:"cover", border:`1px solid ${C.border}` }} />}
      <button onClick={() => inputRef.current?.click()} disabled={uploading}
        style={{ background:C.bg, border:`1px solid ${C.border}`, borderRadius:8, padding:"6px 12px", fontSize:12, fontWeight:600, cursor:"pointer", color:C.muted }}>
        {uploading ? "..." : current ? "✏️ Changer logo" : "📷 Logo"}
      </button>
    </div>
  );
}

// ── Detail panel ──────────────────────────────────────────────────────────────
interface DetailPanelProps {
  order: Order; business: Business | null; vocab: OrderVocab;
  logoDataUrl?: string; onClose: () => void;
  onMarkPaid: (id: string) => Promise<void>;
  onConfirm:  (id: string) => Promise<void>;
  onStatusChange: (id: string, status: string) => Promise<void>;
  markingPaid: string | null; confirming: string | null; updating: string | null;
}

function DetailPanel({ order, business, vocab, logoDataUrl, onClose, onMarkPaid, onConfirm, onStatusChange, markingPaid, confirming, updating }: DetailPanelProps) {
  const paid = isPaid(order);
  const canConfirm = order.status === "pending_payment" || order.status === "paid";
  const showFulfillmentDropdown = ["processing","shipped","delivered","cancelled"].includes(order.status);
  const ff = FULFILLMENT_STATUS[order.status] || FULFILLMENT_STATUS.pending_payment;

  // Override shipped label with type-specific one
  const fulfillmentStatusOverridden = { ...FULFILLMENT_STATUS, shipped: { ...FULFILLMENT_STATUS.shipped, label: vocab.shippedLabel } };
  const ffLabel = (fulfillmentStatusOverridden as any)[order.status]?.label || ff.label;

  return (
    <div style={{ width:390, flexShrink:0, background:C.white, border:`1px solid ${C.border}`, borderRadius:20, boxShadow:"0 8px 32px rgba(0,0,0,0.08)", position:"sticky", top:20, display:"flex", flexDirection:"column", overflow:"hidden", maxHeight:"calc(100vh - 40px)" }}>
      {/* Header */}
      <div style={{ padding:"20px 24px", borderBottom:`1px solid ${C.border}`, display:"flex", justifyContent:"space-between", alignItems:"center", background:C.goldLight, flexShrink:0 }}>
        <div>
          <p style={{ fontSize:11, color:C.muted, fontWeight:700, textTransform:"uppercase", letterSpacing:1 }}>{vocab.itemLabel}</p>
          <h3 style={{ fontSize:18, fontWeight:900, color:C.green, marginTop:2 }}>#{order.order_number}</h3>
        </div>
        <div style={{ display:"flex", gap:8 }}>
          {business && <button onClick={() => openReceipt(order,business,vocab,logoDataUrl)} style={{ background:C.gold, color:C.white, border:"none", borderRadius:8, padding:"7px 13px", cursor:"pointer", fontSize:13, fontWeight:700 }}>🖨️ Reçu</button>}
          <button onClick={onClose} style={{ background:C.border, border:"none", borderRadius:"50%", width:32, height:32, cursor:"pointer", color:C.muted, fontSize:16, display:"flex", alignItems:"center", justifyContent:"center" }}>✕</button>
        </div>
      </div>

      {order.promotion && (
        <div style={{ margin:"8px 16px 0", display:"inline-flex", alignItems:"center", gap:6, background:"#FFF8E7", border:"1px solid #F0D88A", borderRadius:100, padding:"3px 10px" }}>
          <span style={{ fontSize:12 }}>🏷️</span>
          <span style={{ fontSize:11, fontWeight:800, color:"#92400E" }}>Promo : -{Number(order.promotion_discount).toLocaleString("fr-FR")} FCFA</span>
        </div>
      )}

      <div style={{ padding:24, overflowY:"auto", flex:1, display:"flex", flexDirection:"column", gap:20 }}>

        {/* Status grid */}
        <div>
          <p style={{ fontSize:11, fontWeight:700, color:C.muted, textTransform:"uppercase", letterSpacing:1, marginBottom:10 }}>État</p>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
            <div style={{ background:paid?"#ECFDF5":"#FFFBEB", border:`1px solid ${paid?"#6EE7B7":"#FDE68A"}`, borderRadius:12, padding:"14px" }}>
              <p style={{ fontSize:10, fontWeight:700, textTransform:"uppercase", letterSpacing:1, color:C.muted, marginBottom:8 }}>Paiement</p>
              <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                <span style={{ fontSize:20 }}>{paid?"💳":"⏳"}</span>
                <span style={{ fontSize:14, fontWeight:800, color:paid?"#065F46":"#92400E" }}>{paid?"Payé":"Non payé"}</span>
              </div>
            </div>
            <div style={{ background:ff.bg, border:`1px solid ${ff.border}`, borderRadius:12, padding:"14px" }}>
              <p style={{ fontSize:10, fontWeight:700, textTransform:"uppercase", letterSpacing:1, color:C.muted, marginBottom:8 }}>Statut</p>
              <span style={{ fontSize:14, fontWeight:800, color:ff.color }}>{ffLabel}</span>
            </div>
          </div>
        </div>

        {/* Customer */}
        <div style={{ background:C.bg, borderRadius:14, padding:16 }}>
          <p style={{ fontSize:11, fontWeight:700, color:C.muted, textTransform:"uppercase", letterSpacing:1, marginBottom:10 }}>{vocab.customerLabel}</p>
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {order.customer_name && <div style={{ display:"flex", alignItems:"center", gap:8 }}><span style={{ fontSize:16 }}>👤</span><span style={{ fontSize:14, fontWeight:700, color:C.text }}>{order.customer_name}</span></div>}
            {order.customer_phone && (
              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                <span style={{ fontSize:16 }}>📞</span>
                <div>
                  <a href={`tel:${formatPhone(order.customer_phone).replace(/\s/g,"")}`} style={{ fontSize:14, color:C.gold, fontWeight:700, textDecoration:"none", display:"block" }}>{formatPhone(order.customer_phone)}</a>
                  <span style={{ fontSize:11, color:C.muted }}>Numéro de contact</span>
                </div>
              </div>
            )}
            {order.delivery_address && (
              <div style={{ display:"flex", alignItems:"flex-start", gap:8 }}>
                <span style={{ fontSize:16, marginTop:1 }}>📍</span>
                <div>
                  <span style={{ fontSize:10, color:C.muted, display:"block", marginBottom:2 }}>{vocab.addressLabel}</span>
                  <span style={{ fontSize:14, color:C.text, lineHeight:1.4 }}>{order.delivery_address}</span>
                </div>
              </div>
            )}
            {!order.customer_name && !order.customer_phone && !order.delivery_address && (
              <p style={{ fontSize:13, color:C.muted, fontStyle:"italic" }}>Informations non collectées</p>
            )}
          </div>
        </div>

        {/* Items */}
        <div>
          <p style={{ fontSize:11, fontWeight:700, color:C.muted, textTransform:"uppercase", letterSpacing:1, marginBottom:10 }}>Détail</p>
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {order.items.map((item) => (
              <div key={item.id} style={{ background:C.bg, borderRadius:12, padding:"12px 14px", border:`1px solid ${C.border}` }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                  <div style={{ flex:1 }}>
                    <p style={{ fontSize:14, fontWeight:700, color:C.text, marginBottom:4 }}>{item.product_name} <span style={{ color:C.muted, fontWeight:500 }}>×{item.quantity}</span></p>
                    {(item.color||item.size) && (
                      <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                        {item.color && <span style={{ fontSize:11, fontWeight:600, padding:"2px 8px", borderRadius:100, background:"#F3F4F6", color:C.muted }}>🎨 {item.color}</span>}
                        {item.size  && <span style={{ fontSize:11, fontWeight:600, padding:"2px 8px", borderRadius:100, background:"#F3F4F6", color:C.muted }}>📏 {item.size}</span>}
                      </div>
                    )}
                  </div>
                  {Number(item.subtotal) > 0 && <p style={{ fontSize:14, fontWeight:800, color:C.green, marginLeft:8 }}>{Number(item.subtotal).toLocaleString("fr-FR")}</p>}
                </div>
              </div>
            ))}
          </div>
          {Number(order.total_amount) > 0 && (
            <div style={{ marginTop:12, padding:"12px 14px", background:C.goldLight, borderRadius:12, border:`1px solid ${C.goldBorder}`, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <span style={{ fontWeight:700, color:C.text }}>Total</span>
              <span style={{ fontSize:20, fontWeight:900, color:C.gold }}>{Number(order.total_amount).toLocaleString("fr-FR")} FCFA</span>
            </div>
          )}
        </div>

        {/* Payment proof */}
        {order.payment_screenshot_url && (
          <a href={order.payment_screenshot_url} target="_blank" rel="noopener noreferrer"
            style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:8, padding:"12px", background:C.bg, border:`1px solid ${C.border}`, borderRadius:12, color:C.text, textDecoration:"none", fontSize:13, fontWeight:700 }}>
            📷 Voir la preuve de paiement
          </a>
        )}

        {/* Mark as paid */}
        {!paid && Number(order.total_amount) > 0 && (
          <div style={{ background:"#FFFBEB", border:"1px solid #FDE68A", borderRadius:14, padding:16 }}>
            <p style={{ fontSize:12, color:"#92400E", marginBottom:12, lineHeight:1.5 }}>💳 Le client a envoyé le paiement ? Marquez comme payé.</p>
            <button onClick={() => onMarkPaid(order.id)} disabled={markingPaid===order.id}
              style={{ width:"100%", padding:"12px", borderRadius:12, background:markingPaid===order.id?"#9CA3AF":"#D97706", color:C.white, border:"none", fontWeight:800, fontSize:14, cursor:markingPaid===order.id?"not-allowed":"pointer", transition:"all 0.2s" }}>
              {markingPaid===order.id ? "En cours..." : "💳 Marquer comme payé"}
            </button>
          </div>
        )}

        {/* Confirm */}
        {canConfirm && (
          <div style={{ background:C.greenLight, border:`1px solid ${C.greenBorder}`, borderRadius:14, padding:16 }}>
            <p style={{ fontSize:12, color:"#065F46", marginBottom:4, fontWeight:700 }}>{vocab.confirmLabel}</p>
            <p style={{ fontSize:12, color:"#065F46", marginBottom:12, lineHeight:1.5 }}>{vocab.confirmDesc(order.customer_language || "french")}</p>
            <button onClick={() => onConfirm(order.id)} disabled={confirming===order.id}
              style={{ width:"100%", padding:"14px", borderRadius:12, background:confirming===order.id?"#9CA3AF":C.green, color:C.white, border:"none", fontWeight:900, fontSize:15, cursor:confirming===order.id?"not-allowed":"pointer", boxShadow:confirming===order.id?"none":"0 4px 14px rgba(27,67,50,0.3)", transition:"all 0.2s" }}>
              {confirming===order.id ? "Envoi en cours..." : vocab.confirmLabel}
            </button>
            <p style={{ fontSize:11, color:C.muted, textAlign:"center", marginTop:8 }}>Envoie un WhatsApp automatique au client</p>
          </div>
        )}

        {/* Fulfillment dropdown */}
        {showFulfillmentDropdown && (
          <div>
            <label style={{ display:"block", fontSize:11, fontWeight:700, color:C.muted, textTransform:"uppercase", letterSpacing:1, marginBottom:8 }}>Statut de traitement</label>
            <select value={order.status} disabled={updating===order.id} onChange={(e) => onStatusChange(order.id,e.target.value)}
              style={{ width:"100%", padding:"11px 14px", borderRadius:10, border:`1px solid ${C.border}`, background:C.white, fontSize:14, cursor:"pointer", outline:"none", color:C.text, fontWeight:600 }}>
              {FULFILLMENT_OPTIONS.map((v) => (
                <option key={v} value={v}>{(fulfillmentStatusOverridden as any)[v]?.label || (FULFILLMENT_STATUS as any)[v].label}</option>
              ))}
            </select>
          </div>
        )}

        <p style={{ fontSize:12, color:C.muted, textAlign:"center" }}>
          {vocab.itemLabel.charAt(0).toUpperCase()+vocab.itemLabel.slice(1)} créée le {new Date(order.created_at).toLocaleDateString("fr-FR",{ day:"2-digit", month:"long", year:"numeric", hour:"2-digit", minute:"2-digit" })}
        </p>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function OrdersPage() {
  const [orders, setOrders]           = useState<Order[]>([]);
  const [business, setBusiness]       = useState<Business | null>(null);
  const [loading, setLoading]         = useState(true);
  const [selected, setSelected]       = useState<Order | null>(null);
  const [updating, setUpdating]       = useState<string | null>(null);
  const [confirming, setConfirming]   = useState<string | null>(null);
  const [markingPaid, setMarkingPaid] = useState<string | null>(null);
  const [filter, setFilter]           = useState<string>("all");
  const [search, setSearch]           = useState<string>("");
  const [showSearch, setShowSearch]   = useState(false);
  const [logoDataUrl, setLogoDataUrl] = useState<string | undefined>(undefined);

  const bizId = getBusinessId();
  const vocab = getVocab(business?.business_type ?? null);

  useEffect(() => {
    const saved = localStorage.getItem(logoKey(bizId));
    if (saved) setLogoDataUrl(saved);
    Promise.all([ordersApi.list(), authApi.me()])
      .then(([ordRes, bizRes]) => {
        setOrders(ordRes.data); setBusiness(bizRes.data);
        const serverLogo = bizRes.data?.logo_url;
        if (serverLogo && !saved) { setLogoDataUrl(serverLogo); localStorage.setItem(logoKey(bizId), serverLogo); }
      })
      .catch(() => toast.error("Impossible de charger les données."))
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line

  const handleLogo = (url: string) => { setLogoDataUrl(url); localStorage.setItem(logoKey(bizId), url); };

  const handleMarkPaid = async (id: string) => {
    setMarkingPaid(id);
    try { const res = await ordersApi.markPaid(id); const updated: Order = res.data; toast.success("💳 Marqué comme payé !"); setOrders((prev) => prev.map((o) => o.id===id?updated:o)); setSelected(updated); }
    catch { toast.error("Erreur lors du marquage."); }
    finally { setMarkingPaid(null); }
  };

  const confirmOrder = async (id: string) => {
    setConfirming(id);
    try { const res = await ordersApi.confirmOrder(id); const updated: Order = res.data; toast.success("✅ Confirmé ! WhatsApp envoyé."); setOrders((prev) => prev.map((o) => o.id===id?updated:o)); setSelected(updated); }
    catch { toast.error("Erreur lors de la confirmation."); }
    finally { setConfirming(null); }
  };

  const updateStatus = async (id: string, status: string) => {
    setUpdating(id);
    try { await ordersApi.updateStatus(id,status); toast.success("Statut mis à jour"); setOrders((prev) => prev.map((o) => o.id===id?{...o,status:status as OrderStatus}:o)); setSelected((p) => p?.id===id?{...p,status:status as OrderStatus}:p); }
    catch { toast.error("Erreur lors de la mise à jour."); }
    finally { setUpdating(null); }
  };

  const q = search.trim().toLowerCase();
  const matchesSearch = (o: Order) => {
    if (!q) return true;
    const date = new Date(o.created_at).toLocaleDateString("fr-FR").toLowerCase();
    return o.order_number.toLowerCase().includes(q) || (o.customer_name||"").toLowerCase().includes(q) ||
      formatPhone(o.customer_phone).toLowerCase().includes(q) || (o.customer_phone||"").toLowerCase().includes(q) ||
      (o.delivery_address||"").toLowerCase().includes(q) || date.includes(q) ||
      o.items.some(i => i.product_name.toLowerCase().includes(q));
  };

  const unpaidCount  = orders.filter(o => !isPaid(o)).length;
  const pendingCount = orders.filter(o => o.status==="pending_payment").length;
  const statusFiltered = filter==="all" ? orders : filter==="unpaid" ? orders.filter(o=>!isPaid(o)) : orders.filter(o=>o.status===filter);
  const filteredOrders = statusFiltered.filter(matchesSearch);

  const TABS = [
    { key:"all",             label:"Toutes",           count:orders.length },
    { key:"unpaid",          label:"⏳ Non payées",    count:unpaidCount },
    { key:"pending_payment", label:"🕐 En attente",    count:pendingCount },
    { key:"processing",      label:"🔧 En traitement", count:orders.filter(o=>o.status==="processing").length },
    { key:"delivered",       label:"✅ Terminées",     count:orders.filter(o=>o.status==="delivered").length },
  ];

  return (
    <div style={{ maxWidth:1280, margin:"0 auto", padding:"24px 20px" }}>
      <style>{`
        .order-row{transition:background 0.15s;cursor:pointer;}
        .order-row:hover{background:${C.goldLight}!important;}
        .order-row.sel{background:${C.goldLight}!important;}
        .ftab{padding:8px 16px;border-radius:100px;border:1px solid ${C.border};background:${C.white};cursor:pointer;font-size:13px;font-weight:600;color:${C.muted};transition:all 0.2s;white-space:nowrap;}
        .ftab:hover{border-color:${C.gold};color:${C.gold};}
        .ftab.on{background:${C.gold};color:white;border-color:${C.gold};}
        .badge{display:inline-flex;align-items:center;padding:3px 10px;border-radius:100px;font-size:11px;font-weight:700;}
      `}</style>

      <div style={{ marginBottom:28 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-end", flexWrap:"wrap", gap:12 }}>
          <div>
            <h1 style={{ fontSize:28, fontWeight:900, color:C.text, marginBottom:4 }}>{vocab.pageIcon} {vocab.pageTitle}</h1>
            <p style={{ color:C.muted, fontSize:14 }}>{vocab.pageDesc}</p>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:12, flexWrap:"wrap" }}>
            <LogoUploader current={logoDataUrl} onLogo={handleLogo} />
            <button onClick={() => { setShowSearch(s=>!s); if (showSearch) setSearch(""); }}
              style={{ background:showSearch?C.green:C.bg, color:showSearch?C.white:C.muted, border:`1px solid ${showSearch?C.green:C.border}`, borderRadius:8, padding:"6px 14px", fontSize:13, fontWeight:700, cursor:"pointer", display:"flex", alignItems:"center", gap:6, transition:"all 0.2s" }}>
              🔍 {showSearch?"Fermer":"Rechercher"}
            </button>
            {unpaidCount > 0 && (
              <div style={{ background:"#FFFBEB", border:"1px solid #FDE68A", borderRadius:12, padding:"10px 16px" }}>
                <span style={{ fontSize:13, color:"#92400E", fontWeight:700 }}>💳 {unpaidCount} non payée{unpaidCount>1?"s":""}</span>
              </div>
            )}
          </div>
        </div>

        <div style={{ display:"flex", gap:8, marginTop:20, flexWrap:"wrap" }}>
          {TABS.map((tab) => (
            <button key={tab.key} className={`ftab${filter===tab.key?" on":""}`} onClick={() => setFilter(tab.key)}>
              {tab.label}
              {tab.count > 0 && <span style={{ marginLeft:6, background:filter===tab.key?"rgba(255,255,255,0.3)":C.bg, color:filter===tab.key?"white":C.muted, borderRadius:100, padding:"1px 7px", fontSize:11, fontWeight:800 }}>{tab.count}</span>}
            </button>
          ))}
        </div>

        {showSearch && (
          <div style={{ marginTop:16, display:"flex", gap:10, alignItems:"center", background:C.white, border:`2px solid ${C.gold}`, borderRadius:14, padding:"10px 16px", boxShadow:"0 4px 20px rgba(197,160,52,0.12)" }}>
            <span style={{ fontSize:18 }}>🔍</span>
            <input autoFocus value={search} onChange={(e) => setSearch(e.target.value)} placeholder="N° référence, nom, téléphone, date..."
              style={{ flex:1, border:"none", outline:"none", fontSize:15, color:C.text, background:"transparent", fontFamily:"inherit" }} />
            {search && <button onClick={() => setSearch("")} style={{ background:C.bg, border:"none", borderRadius:"50%", width:24, height:24, cursor:"pointer", color:C.muted, fontSize:14, display:"flex", alignItems:"center", justifyContent:"center" }}>✕</button>}
            {q && <span style={{ fontSize:12, color:C.muted, whiteSpace:"nowrap", fontWeight:600 }}>{filteredOrders.length} résultat{filteredOrders.length!==1?"s":""}</span>}
          </div>
        )}
      </div>

      {loading ? (
        <div style={{ textAlign:"center", padding:"100px 0", color:C.muted }}><div style={{ fontSize:32, marginBottom:12 }}>⏳</div>Chargement...</div>
      ) : orders.length === 0 ? (
        <div style={{ background:C.white, borderRadius:20, border:`1px solid ${C.border}`, padding:"80px 40px", textAlign:"center" }}>
          <div style={{ fontSize:64, marginBottom:16 }}>{vocab.pageIcon}</div>
          <h2 style={{ fontSize:20, fontWeight:800, color:C.text, marginBottom:8 }}>{vocab.emptyTitle}</h2>
          <p style={{ color:C.muted, maxWidth:380, margin:"0 auto", lineHeight:1.6 }}>{vocab.emptyDesc}</p>
        </div>
      ) : (
        <div style={{ display:"flex", gap:24, alignItems:"flex-start" }}>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ background:C.white, borderRadius:20, border:`1px solid ${C.border}`, overflow:"hidden" }}>
              {filteredOrders.length === 0 ? (
                <div style={{ padding:"60px 40px", textAlign:"center", color:C.muted }}>{q?`Aucun résultat pour "${search}"`:"Aucun élément dans cette catégorie."}</div>
              ) : (
                <table style={{ width:"100%", borderCollapse:"collapse" }}>
                  <thead>
                    <tr style={{ background:C.bg, borderBottom:`1px solid ${C.border}` }}>
                      {["Référence", vocab.customerLabel, "Détail", "Montant", "Paiement", "Statut", "Date"].map((h) => (
                        <th key={h} style={{ padding:"14px 16px", textAlign:"left", fontSize:11, color:C.muted, fontWeight:700, textTransform:"uppercase", letterSpacing:0.5 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredOrders.map((o) => {
                      const paid = isPaid(o);
                      const ff = FULFILLMENT_STATUS[o.status] || FULFILLMENT_STATUS.pending_payment;
                      const isSel = selected?.id === o.id;
                      return (
                        <tr key={o.id} className={`order-row${isSel?" sel":""}`} onClick={() => setSelected(isSel?null:o)} style={{ borderBottom:`1px solid ${C.border}` }}>
                          <td style={{ padding:"14px 16px" }}><p style={{ fontWeight:800, color:C.green, fontSize:14 }}>#{o.order_number}</p></td>
                          <td style={{ padding:"14px 16px" }}>
                            {o.customer_name
                              ? <div><p style={{ fontWeight:700, color:C.text, fontSize:14 }}>{o.customer_name}</p>{o.customer_phone&&<p style={{ color:C.gold, fontSize:12, marginTop:2, fontWeight:600 }}>{formatPhone(o.customer_phone)}</p>}</div>
                              : <span style={{ color:C.muted, fontSize:13, fontStyle:"italic" }}>—</span>}
                          </td>
                          <td style={{ padding:"14px 16px" }}>
                            <p style={{ color:C.text, fontSize:13 }}>{o.items.length} article{o.items.length>1?"s":""}</p>
                            {o.items[0]&&<p style={{ color:C.muted, fontSize:12, marginTop:2 }}>{o.items[0].product_name}</p>}
                          </td>
                          <td style={{ padding:"14px 16px" }}>
                            {Number(o.total_amount)>0
                              ? <p style={{ fontWeight:900, color:C.gold, fontSize:15 }}>{Number(o.total_amount).toLocaleString("fr-FR")} FCFA</p>
                              : <span style={{ color:C.muted, fontSize:13 }}>—</span>}
                          </td>
                          <td style={{ padding:"14px 16px" }}>
                            <span className="badge" style={{ color:paid?"#065F46":"#92400E", background:paid?"#ECFDF5":"#FFFBEB", border:`1px solid ${paid?"#6EE7B7":"#FDE68A"}` }}>
                              {paid?"💳 Payé":"⏳ Non payé"}
                            </span>
                          </td>
                          <td style={{ padding:"14px 16px" }}>
                            <span className="badge" style={{ color:ff.color, background:ff.bg, border:`1px solid ${ff.border}` }}>{ff.label}</span>
                          </td>
                          <td style={{ padding:"14px 16px", color:C.muted, fontSize:13 }}>{timeAgo(o.created_at)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {selected && (
            <DetailPanel
              order={selected} business={business} vocab={vocab} logoDataUrl={logoDataUrl}
              onClose={() => setSelected(null)} onMarkPaid={handleMarkPaid} onConfirm={confirmOrder}
              onStatusChange={updateStatus} markingPaid={markingPaid} confirming={confirming} updating={updating}
            />
          )}
        </div>
      )}
    </div>
  );
}