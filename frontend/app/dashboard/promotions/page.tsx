"use client";
import { useState, useEffect, useCallback } from "react";
import { promotionsApi, customersApi, productsApi } from "@/lib/api";
import { Promotion, Customer, Product } from "@/types";

const G    = "#1B4332";
const GOLD = "#D4AF37";

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  draft:     { label: "Brouillon",  color: "#6B7280", bg: "#F3F4F6" },
  scheduled: { label: "Programmée", color: "#2563EB", bg: "#EFF6FF" },
  sending:   { label: "En cours…",  color: "#D97706", bg: "#FFFBEB" },
  sent:      { label: "Envoyée ✓",  color: "#059669", bg: "#F0FDF4" },
  cancelled: { label: "Annulée",    color: "#DC2626", bg: "#FEF2F2" },
};

function isExpired(expires_at: string | null): boolean {
  if (!expires_at) return false;
  return new Date(expires_at) < new Date();
}

// ── Sélecteur de clients ───────────────────────────────────────────────────────
function CustomerPicker({ customers, selected, onChange }: {
  customers: Customer[];
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const [search, setSearch] = useState("");
  const filtered = customers.filter(c =>
    (c.display_name ?? c.whatsapp_phone).toLowerCase().includes(search.toLowerCase()) ||
    c.whatsapp_phone.includes(search)
  );
  const toggle = (id: string) =>
    onChange(selected.includes(id) ? selected.filter(s => s !== id) : [...selected, id]);
  const toggleAll = () =>
    onChange(selected.length === customers.length ? [] : customers.map(c => c.id));

  return (
    <div style={{ border: "1px solid #D1D5DB", borderRadius: 12, overflow: "hidden" }}>
      <div style={{ padding: "10px 12px", borderBottom: "1px solid #E5E7EB", display: "flex", gap: 10, alignItems: "center", background: "#F9FAFB" }}>
        <input
          placeholder="Rechercher un client…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ flex: 1, border: "1px solid #D1D5DB", borderRadius: 8, padding: "7px 10px", fontSize: 13, outline: "none" }}
        />
        <button type="button" onClick={toggleAll}
          style={{ fontSize: 12, fontWeight: 700, color: G, background: "none", border: "none", cursor: "pointer", whiteSpace: "nowrap" }}>
          {selected.length === customers.length ? "Tout désélectionner" : "Tout sélectionner"}
        </button>
      </div>
      <div style={{ maxHeight: 220, overflowY: "auto" }}>
        {filtered.length === 0 ? (
          <p style={{ textAlign: "center", padding: "20px", color: "#9CA3AF", fontSize: 13, margin: 0 }}>Aucun client trouvé</p>
        ) : filtered.map(c => {
          const checked = selected.includes(c.id);
          return (
            <div key={c.id} onClick={() => toggle(c.id)} style={{
              display: "flex", alignItems: "center", gap: 12, padding: "10px 14px",
              cursor: "pointer", borderBottom: "1px solid #F3F4F6",
              background: checked ? "#F0FDF4" : "white", transition: "background 0.15s",
            }}>
              <div style={{
                width: 18, height: 18, borderRadius: 5,
                border: `2px solid ${checked ? G : "#D1D5DB"}`,
                background: checked ? G : "white",
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
              }}>
                {checked && <span style={{ color: "white", fontSize: 11, fontWeight: 900 }}>✓</span>}
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontWeight: 700, fontSize: 13, color: G }}>{c.display_name ?? "Client sans nom"}</p>
                <p style={{ margin: 0, fontSize: 11, color: "#9CA3AF" }}>+{c.whatsapp_phone.split('@')[0]}</p>
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ padding: "8px 14px", background: "#F9FAFB", borderTop: "1px solid #E5E7EB" }}>
        <span style={{ fontSize: 12, color: "#6B7280", fontWeight: 700 }}>
          {selected.length} client{selected.length > 1 ? "s" : ""} sélectionné{selected.length > 1 ? "s" : ""}
        </span>
      </div>
    </div>
  );
}

// ── Aperçu WhatsApp ────────────────────────────────────────────────────────────
function MessagePreview({ message, product, discount }: {
  message: string; product: Product | null; discount: string;
}) {
  const discountNum = parseFloat(discount) || 0;
  return (
    <div style={{ background: "#ECE5DD", borderRadius: 14, padding: 16 }}>
      <p style={{ margin: "0 0 8px", fontSize: 10, fontWeight: 700, color: "#6B7280", textTransform: "uppercase" }}>
        Aperçu WhatsApp
      </p>
      <div style={{ background: "white", borderRadius: 10, padding: "12px 14px", maxWidth: 300, boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
        {product?.image_url && (
          <img src={product.image_url} alt={product.name}
            style={{ width: "100%", borderRadius: 8, marginBottom: 10, objectFit: "cover", maxHeight: 160 }} />
        )}
        <p style={{ margin: 0, fontSize: 13, color: "#111", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
          {message || "Votre message apparaîtra ici…"}
        </p>
        {product && (
          <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid #F3F4F6" }}>
            <p style={{ margin: "0 0 2px", fontWeight: 800, fontSize: 13, color: G }}>🛍️ {product.name}</p>
            {discountNum > 0 ? (
              <p style={{ margin: 0, fontSize: 13 }}>
                <span style={{ textDecoration: "line-through", color: "#9CA3AF" }}>
                  {Number(product.price).toLocaleString("fr-FR")} FCFA
                </span>
                {" → "}
                <span style={{ fontWeight: 800, color: "#059669" }}>
                  {Math.max(Number(product.price) - discountNum, 0).toLocaleString("fr-FR")} FCFA
                </span>
              </p>
            ) : (
              <p style={{ margin: 0, fontSize: 13, fontWeight: 700 }}>{Number(product.price).toLocaleString("fr-FR")} FCFA</p>
            )}
          </div>
        )}
        <p style={{ margin: "8px 0 0", fontSize: 10, color: "#9CA3AF", textAlign: "right" }}>
          {new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
        </p>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
export default function PromotionsPage() {
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [customers,  setCustomers]  = useState<Customer[]>([]);
  const [products,   setProducts]   = useState<Product[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [showForm,   setShowForm]   = useState(false);
  const [sending,    setSending]    = useState<string | null>(null);
  const [form, setForm] = useState({
    title: "", message: "", scheduled_at: "",
    product_id: "", discount: "",
    expires_at: "",   // ← nouveau
  });
  const [selectedCustomers, setSelectedCustomers] = useState<string[]>([]);
  const selectedProduct = products.find(p => p.id === form.product_id) ?? null;

  const fetchAll = useCallback(async () => {
    const [promoRes, custRes, prodRes] = await Promise.allSettled([
      promotionsApi.list(),
      customersApi.list(),
      productsApi.list(),
    ]);
    if (promoRes.status === "fulfilled") setPromotions(promoRes.value.data);
    if (custRes.status  === "fulfilled") setCustomers(custRes.value.data);
    if (prodRes.status  === "fulfilled") {
      const list = Array.isArray(prodRes.value.data) ? prodRes.value.data : [];
      setProducts(list.filter((p: Product) => p.is_active));
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const resetForm = () => {
    setForm({ title: "", message: "", scheduled_at: "", product_id: "", discount: "", expires_at: "" });
    setSelectedCustomers([]);
    setShowForm(false);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedCustomers.length === 0) {
      alert("Veuillez sélectionner au moins un destinataire.");
      return;
    }
    await promotionsApi.create({
      title:                  form.title,
      message:                form.message,
      product_id:             form.product_id || null,
      discount_amount:        form.discount ? parseFloat(form.discount) : null,
      recipient_customer_ids: selectedCustomers,
      scheduled_at:           form.scheduled_at || null,
      expires_at:             form.expires_at || null,   // ← nouveau
    });
    resetForm();
    fetchAll();
  };

  const handleSendNow = async (id: string) => {
    setSending(id);
    try {
      await promotionsApi.sendNow(id);
      fetchAll();
    } catch (err: any) {
      alert(err?.response?.data?.detail || "Erreur lors de l'envoi");
    } finally {
      setSending(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Supprimer cette promotion ?")) return;
    await promotionsApi.delete(id);
    fetchAll();
  };

  return (
    <div style={{ maxWidth: 900, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 28, gap: 16, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontFamily: "'Baloo 2'", fontSize: 26, fontWeight: 800, color: G, margin: 0 }}>📢 Promotions Automatiques</h1>
          <p style={{ color: "#9CA3AF", fontSize: 14, margin: "4px 0 0" }}>Envoyez des offres personnalisées à vos clients WhatsApp</p>
        </div>
        <button onClick={() => setShowForm(!showForm)}
          style={{ background: G, color: "#fff", padding: "12px 22px", borderRadius: 12, border: "none", cursor: "pointer", fontWeight: 800, fontSize: 14 }}>
          + Nouvelle promotion
        </button>
      </div>

      {/* Formulaire */}
      {showForm && (
        <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 20, padding: 28, marginBottom: 24 }}>
          <h2 style={{ fontFamily: "'Baloo 2'", fontSize: 18, fontWeight: 800, color: G, margin: "0 0 24px" }}>Créer une promotion</h2>
          <form onSubmit={handleCreate}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 28 }}>

              {/* Gauche */}
              <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>

                <div>
                  <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 6 }}>Titre</label>
                  <input
                    style={{ width: "100%", border: "1px solid #D1D5DB", borderRadius: 10, padding: "10px 14px", fontSize: 14, outline: "none", boxSizing: "border-box" }}
                    placeholder="Ex : Promo weekend -1000 FCFA"
                    value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 6 }}>Message WhatsApp</label>
                  <textarea
                    style={{ width: "100%", border: "1px solid #D1D5DB", borderRadius: 10, padding: "10px 14px", fontSize: 14, outline: "none", resize: "none", height: 90, boxSizing: "border-box" }}
                    placeholder="🎉 Profitez de notre offre spéciale ce weekend !"
                    value={form.message} onChange={e => setForm({ ...form, message: e.target.value })} required
                  />
                  <p style={{ margin: "4px 0 0", fontSize: 12, color: "#9CA3AF" }}>{form.message.length} caractères</p>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 6 }}>
                    Produit en promotion <span style={{ color: "#9CA3AF", fontWeight: 400 }}>(optionnel)</span>
                  </label>
                  <select
                    style={{ width: "100%", border: "1px solid #D1D5DB", borderRadius: 10, padding: "10px 14px", fontSize: 14, outline: "none", background: "white", boxSizing: "border-box" }}
                    value={form.product_id} onChange={e => setForm({ ...form, product_id: e.target.value })}>
                    <option value="">— Aucun produit —</option>
                    {products.map(p => (
                      <option key={p.id} value={p.id}>{p.name} — {Number(p.price).toLocaleString("fr-FR")} FCFA</option>
                    ))}
                  </select>
                </div>

                {form.product_id && (
                  <div>
                    <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 6 }}>Réduction fixe (FCFA)</label>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <input type="number" min="0"
                        style={{ width: 150, border: "1px solid #D1D5DB", borderRadius: 10, padding: "10px 14px", fontSize: 14, outline: "none" }}
                        placeholder="1000" value={form.discount} onChange={e => setForm({ ...form, discount: e.target.value })}
                      />
                      <span style={{ fontSize: 13, color: "#6B7280" }}>FCFA de réduction</span>
                      {form.discount && selectedProduct && (
                        <span style={{ fontSize: 13, fontWeight: 800, color: "#059669" }}>
                          → {Math.max(Number(selectedProduct.price) - parseFloat(form.discount), 0).toLocaleString("fr-FR")} FCFA
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Dates côte à côte */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                  <div>
                    <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 6 }}>
                      📅 Début d'envoi <span style={{ color: "#9CA3AF", fontWeight: 400 }}>(optionnel)</span>
                    </label>
                    <input type="datetime-local"
                      style={{ width: "100%", border: "1px solid #D1D5DB", borderRadius: 10, padding: "10px 12px", fontSize: 13, outline: "none", boxSizing: "border-box" }}
                      value={form.scheduled_at} onChange={e => setForm({ ...form, scheduled_at: e.target.value })}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 6 }}>
                      ⏰ Fin de promotion <span style={{ color: "#9CA3AF", fontWeight: 400 }}>(optionnel)</span>
                    </label>
                    <input type="datetime-local"
                      style={{ width: "100%", border: "1px solid #D1D5DB", borderRadius: 10, padding: "10px 12px", fontSize: 13, outline: "none", boxSizing: "border-box" }}
                      value={form.expires_at} onChange={e => setForm({ ...form, expires_at: e.target.value })}
                    />
                    <p style={{ margin: "4px 0 0", fontSize: 11, color: "#9CA3AF" }}>
                      Après cette date, la promo sera marquée expirée
                    </p>
                  </div>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 8 }}>
                    Destinataires <span style={{ color: "#DC2626" }}>*</span>
                  </label>
                  {customers.length === 0 ? (
                    <p style={{ color: "#9CA3AF", fontSize: 13 }}>Aucun client encore. Les clients apparaissent dès qu'ils vous écrivent sur WhatsApp.</p>
                  ) : (
                    <CustomerPicker customers={customers} selected={selectedCustomers} onChange={setSelectedCustomers} />
                  )}
                </div>
              </div>

              {/* Droite : aperçu */}
              <div style={{ position: "sticky", top: 20, alignSelf: "start" }}>
                <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 8 }}>Aperçu</label>
                <MessagePreview message={form.message} product={selectedProduct} discount={form.discount} />
                {selectedCustomers.length > 0 && (
                  <div style={{ marginTop: 12, background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: 10, padding: "10px 14px" }}>
                    <p style={{ margin: 0, fontSize: 13, color: "#065F46", fontWeight: 700 }}>
                      ✅ {selectedCustomers.length} client{selectedCustomers.length > 1 ? "s" : ""} sélectionné{selectedCustomers.length > 1 ? "s" : ""}
                    </p>
                  </div>
                )}
                {form.expires_at && (
                  <div style={{ marginTop: 10, background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 10, padding: "10px 14px" }}>
                    <p style={{ margin: 0, fontSize: 12, color: "#92400E", fontWeight: 700 }}>
                      ⏰ Expire le {new Date(form.expires_at).toLocaleString("fr-FR")}
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: "flex", gap: 12, marginTop: 24, paddingTop: 20, borderTop: "1px solid #E5E7EB" }}>
              <button type="submit"
                style={{ background: G, color: "#fff", padding: "12px 28px", borderRadius: 12, border: "none", cursor: "pointer", fontWeight: 800, fontSize: 14 }}>
                Créer la promotion
              </button>
              <button type="button" onClick={resetForm}
                style={{ background: "#F3F4F6", color: "#374151", padding: "12px 24px", borderRadius: 12, border: "none", cursor: "pointer", fontWeight: 700, fontSize: 14 }}>
                Annuler
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Liste */}
      {loading ? (
        <div style={{ textAlign: "center", padding: "60px 0", color: "#9CA3AF" }}>Chargement…</div>
      ) : promotions.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 20px", background: "#fff", border: "2px dashed #E5E7EB", borderRadius: 20 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📭</div>
          <p style={{ fontWeight: 700, color: G, fontSize: 16, margin: "0 0 4px" }}>Aucune promotion pour l'instant</p>
          <p style={{ color: "#9CA3AF", fontSize: 14, margin: 0 }}>Créez votre première campagne WhatsApp</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {promotions.map(p => {
            const cfg = STATUS_CONFIG[p.status] ?? STATUS_CONFIG.draft;
            const expired = isExpired(p.expires_at);
            const recipientCount = (() => {
              try { return p.recipient_customer_ids ? JSON.parse(p.recipient_customer_ids).length : 0; }
              catch { return 0; }
            })();

            return (
              <div key={p.id} style={{
                background: "#fff",
                border: `1px solid ${expired ? "#FCA5A5" : "#E5E7EB"}`,
                borderRadius: 18, padding: "20px 24px", display: "flex", gap: 16,
                opacity: expired ? 0.85 : 1,
              }}>
                {/* Photo produit */}
                {p.product?.image_url ? (
                  <img src={p.product.image_url} alt={p.product.name}
                    style={{ width: 72, height: 72, borderRadius: 12, objectFit: "cover", flexShrink: 0 }} />
                ) : (
                  <div style={{ width: 72, height: 72, borderRadius: 12, background: "#F3F4F6", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, flexShrink: 0 }}>
                    📢
                  </div>
                )}

                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4, flexWrap: "wrap" }}>
                    <span style={{ fontWeight: 800, fontSize: 15, color: G }}>{p.title}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 100, background: cfg.bg, color: cfg.color }}>
                      {cfg.label}
                    </span>
                    {expired && (
                      <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 100, background: "#FEF2F2", color: "#DC2626" }}>
                        ⏰ Expirée
                      </span>
                    )}
                  </div>

                  {p.product && (
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: "#374151" }}>🛍️ {p.product.name}</span>
                      {p.discount_amount && (
                        <span style={{ fontSize: 11, fontWeight: 800, background: "#F0FDF4", color: "#059669", padding: "2px 8px", borderRadius: 100 }}>
                          -{Number(p.discount_amount).toLocaleString("fr-FR")} FCFA
                        </span>
                      )}
                    </div>
                  )}

                  <p style={{ margin: "0 0 8px", fontSize: 13, color: "#6B7280", lineHeight: 1.5, maxWidth: 500 }}>
                    {p.message.length > 100 ? p.message.slice(0, 100) + "…" : p.message}
                  </p>

                  <div style={{ display: "flex", gap: 14, flexWrap: "wrap", fontSize: 12, color: "#9CA3AF" }}>
                    {p.scheduled_at && <span>📅 Envoi : {new Date(p.scheduled_at).toLocaleString("fr-FR")}</span>}
                    {p.expires_at && (
                      <span style={{ color: expired ? "#DC2626" : "#D97706", fontWeight: expired ? 700 : 400 }}>
                        ⏰ {expired ? "Expirée" : "Expire"} le {new Date(p.expires_at).toLocaleString("fr-FR")}
                      </span>
                    )}
                    <span>👥 {p.status === "sent" ? p.recipient_count : recipientCount} destinataire{recipientCount > 1 ? "s" : ""}</span>
                    {p.status === "sent" && (
                      <span style={{ color: "#059669", fontWeight: 700 }}>
                        ✅ {p.delivered_count} livrés
                        {p.recipient_count > 0 && ` (${Math.round(p.delivered_count / p.recipient_count * 100)}%)`}
                      </span>
                    )}
                    <span>Créée le {new Date(p.created_at).toLocaleDateString("fr-FR")}</span>
                  </div>
                </div>

                {p.status !== "sent" && p.status !== "sending" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, flexShrink: 0, justifyContent: "center" }}>
                    {!expired && (
                      <button onClick={() => handleSendNow(p.id)} disabled={sending === p.id}
                        style={{ background: GOLD, color: "#fff", padding: "9px 18px", borderRadius: 10, border: "none", cursor: "pointer", fontWeight: 800, fontSize: 13, opacity: sending === p.id ? 0.6 : 1, whiteSpace: "nowrap" }}>
                        {sending === p.id ? "Envoi…" : "🚀 Envoyer"}
                      </button>
                    )}
                    <button onClick={() => handleDelete(p.id)}
                      style={{ background: "#FEF2F2", color: "#DC2626", padding: "9px 14px", borderRadius: 10, border: "none", cursor: "pointer", fontWeight: 700, fontSize: 13 }}>
                      🗑 Supprimer
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}