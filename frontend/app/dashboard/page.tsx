"use client";
import { useEffect, useState, useCallback } from "react";
import { api, authApi } from "@/lib/api";
import Link from "next/link";
import {
  Business, DashboardStats,
  SellDashboardStats, ServiceDashboardStats, CustomDashboardStats,
} from "@/types";

// ── Design tokens ─────────────────────────────────────────────────────────────
const G    = "#1B4332";
const GOLD = "#D4AF37";

// ── Period filter ─────────────────────────────────────────────────────────────
type Period = "today" | "week" | "month" | "all";
const PERIODS: { key: Period; label: string }[] = [
  { key: "today", label: "Aujourd'hui" },
  { key: "week",  label: "7 jours" },
  { key: "month", label: "30 jours" },
  { key: "all",   label: "Tout" },
];
const PERIOD_LABELS: Record<Period, string> = {
  today: "aujourd'hui",
  week:  "ces 7 derniers jours",
  month: "ces 30 derniers jours",
  all:   "depuis le début",
};

function PeriodFilter({ value, onChange }: { value: Period; onChange: (p: Period) => void }) {
  return (
    <div style={{ display: "inline-flex", background: "#F3F4F6", borderRadius: 12, padding: 4, gap: 2 }}>
      {PERIODS.map(({ key, label }) => (
        <button key={key} onClick={() => onChange(key)} style={{
          padding: "7px 16px", borderRadius: 9, border: "none", cursor: "pointer",
          fontWeight: 700, fontSize: 13, transition: "all 0.2s",
          background: value === key ? G : "transparent",
          color: value === key ? "#fff" : "#6B7280",
          boxShadow: value === key ? "0 2px 8px rgba(27,67,50,.2)" : "none",
        }}>{label}</button>
      ))}
    </div>
  );
}

// ── Stat card ─────────────────────────────────────────────────────────────────
function StatCard({ icon, label, value, sub, color, badge }: {
  icon: string; label: string; value: string | number;
  sub?: string; color: string; badge?: string;
}) {
  return (
    <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 20, padding: "22px 24px", display: "flex", alignItems: "flex-start", gap: 14 }}>
      <div style={{ width: 48, height: 48, borderRadius: 14, flexShrink: 0, background: color + "18", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>{icon}</div>
      <div style={{ flex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</p>
          {badge && <span style={{ background: color + "18", color, fontSize: 10, fontWeight: 800, padding: "2px 8px", borderRadius: 100 }}>{badge}</span>}
        </div>
        <p style={{ margin: 0, fontFamily: "'Baloo 2', sans-serif", fontSize: 26, fontWeight: 800, color: G, lineHeight: 1.2 }}>{value}</p>
        {sub && <p style={{ margin: "4px 0 0", fontSize: 12, color: "#9CA3AF" }}>{sub}</p>}
      </div>
    </div>
  );
}

// ── Quick link ────────────────────────────────────────────────────────────────
function QuickLink({ href, icon, title, sub }: { href: string; icon: string; title: string; sub: string }) {
  return (
    <Link href={href} style={{ background: "#fff", border: "2px solid #F3F4F6", borderRadius: 18, padding: 18, textDecoration: "none", display: "flex", alignItems: "center", gap: 14, transition: "all 0.2s" }}
      onMouseEnter={e => { const el = e.currentTarget as HTMLAnchorElement; el.style.borderColor = GOLD; el.style.background = "#FFFCF5"; }}
      onMouseLeave={e => { const el = e.currentTarget as HTMLAnchorElement; el.style.borderColor = "#F3F4F6"; el.style.background = "#fff"; }}
    >
      <span style={{ fontSize: 24 }}>{icon}</span>
      <div style={{ flex: 1 }}>
        <p style={{ margin: 0, fontWeight: 800, color: G, fontSize: 14 }}>{title}</p>
        <p style={{ margin: "3px 0 0", fontSize: 12, color: "#9CA3AF" }}>{sub}</p>
      </div>
      <span style={{ color: GOLD, fontWeight: 900, fontSize: 18 }}>→</span>
    </Link>
  );
}

// ── WhatsApp alert ────────────────────────────────────────────────────────────
function WhatsAppAlert() {
  return (
    <div style={{ background: "#FFFBEB", border: "2px solid #FEF3C7", borderRadius: 20, padding: "20px 24px", marginBottom: 24, display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
      <span style={{ fontSize: 26 }}>⚠️</span>
      <div style={{ flex: 1 }}>
        <p style={{ margin: 0, fontWeight: 800, color: "#92400E", fontSize: 15 }}>WhatsApp non connecté</p>
        <p style={{ margin: "3px 0 0", fontSize: 13, color: "#B45309" }}>L'assistant est en pause. Connectez-le pour recevoir les messages de vos clients.</p>
      </div>
      <Link href="/dashboard/settings" style={{ background: GOLD, color: "#fff", padding: "12px 22px", borderRadius: 12, textDecoration: "none", fontWeight: 800, fontSize: 14 }}>Activer →</Link>
    </div>
  );
}

// ── Unpaid revenue warning ────────────────────────────────────────────────────
// Shows when there are pending orders with money not yet confirmed.
function UnpaidRevenueAlert({
  unpaidRevenue, pendingCount, period,
}: {
  unpaidRevenue: number; pendingCount: number; period: Period;
}) {
  if (unpaidRevenue <= 0) return null;
  return (
    <div style={{
      background: "#FFFBEB", border: "2px solid #FDE68A", borderRadius: 20,
      padding: "18px 24px", marginBottom: 24,
      display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap",
    }}>
      <div style={{ width: 44, height: 44, borderRadius: 12, background: "#FEF3C7", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>
        💳
      </div>
      <div style={{ flex: 1 }}>
        <p style={{ margin: 0, fontWeight: 800, color: "#92400E", fontSize: 15 }}>
          {unpaidRevenue.toLocaleString("fr-FR")} FCFA en attente de paiement
        </p>
        <p style={{ margin: "4px 0 0", fontSize: 13, color: "#B45309", lineHeight: 1.5 }}>
          {pendingCount} commande{pendingCount > 1 ? "s" : ""} {PERIOD_LABELS[period]} n'ont pas encore été payées.
          Ce montant n'est <strong>pas inclus</strong> dans votre chiffre d'affaires.
        </p>
      </div>
      <Link href="/dashboard/orders" style={{
        background: "#D97706", color: "#fff", padding: "10px 18px",
        borderRadius: 12, textDecoration: "none", fontWeight: 800, fontSize: 13,
        whiteSpace: "nowrap",
      }}>
        Voir les commandes →
      </Link>
    </div>
  );
}

// ── Bot banner ────────────────────────────────────────────────────────────────
function BotBanner({ connected }: { connected: boolean }) {
  if (!connected) return null;
  return (
    <div style={{ background: `linear-gradient(135deg, ${G} 0%, #0d3320 100%)`, borderRadius: 24, padding: "28px 36px", color: "#fff", display: "flex", alignItems: "center", justifyContent: "space-between", boxShadow: "0 16px 32px rgba(13,51,32,.18)" }}>
      <div>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(34,197,94,.18)", color: "#4ade80", padding: "4px 12px", borderRadius: 100, fontSize: 11, fontWeight: 800, marginBottom: 12 }}>
          <div style={{ width: 7, height: 7, background: "#22C55E", borderRadius: "50%" }} />
          SUGUAI ACTIF
        </div>
        <h4 style={{ fontFamily: "'Baloo 2'", fontSize: 20, margin: "0 0 6px" }}>Votre assistant travaille pour vous</h4>
        <p style={{ opacity: 0.65, fontSize: 13, maxWidth: 420, margin: 0, lineHeight: 1.6 }}>L'IA répond à vos clients sur WhatsApp 24h/24, même quand vous dormez.</p>
      </div>
      <span style={{ fontSize: 52, flexShrink: 0, marginLeft: 20 }}>🤖</span>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// SELL DASHBOARD (products_seller + fnb)
// ═════════════════════════════════════════════════════════════════════════════
function SellDashboard({ stats, business, period, onPeriodChange, loading }: {
  stats: SellDashboardStats; business: Business;
  period: Period; onPeriodChange: (p: Period) => void; loading: boolean;
}) {
  const isFnb = business.business_type === "fnb";
  const unpaidRevenue = (stats as any).unpaid_revenue ?? 0;

  return (
    <div style={{ animation: "fadeIn 0.4s ease" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 28, flexWrap: "wrap", gap: 14 }}>
        <div>
          <h2 style={{ fontFamily: "'Baloo 2'", fontSize: 28, fontWeight: 800, color: G, margin: 0 }}>
            Bonjour, {business.name} ✨
          </h2>
          <p style={{ color: "#9CA3AF", fontSize: 14, margin: "4px 0 0" }}>
            {isFnb ? "Commandes et recettes" : "Ventes"} {PERIOD_LABELS[period]}
          </p>
        </div>
        <PeriodFilter value={period} onChange={onPeriodChange} />
      </div>

      {!business.whatsapp_connected && <WhatsAppAlert />}

      {/* ── Unpaid revenue alert — shown above stats when money is pending ── */}
      <UnpaidRevenueAlert
        unpaidRevenue={unpaidRevenue}
        pendingCount={stats.pending_orders}
        period={period}
      />

      {/* 4 stat cards */}
      <div className="dash-stats-grid" style={{
        display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16, marginBottom: 28,
        opacity: loading ? 0.5 : 1, transition: "opacity 0.3s",
      }}>
        <StatCard
          icon={isFnb ? "🧾" : "🛍️"}
          label={isFnb ? "Commandes" : "Commandes"}
          value={stats.orders_count}
          sub="Total sur la période"
          color={G}
        />
        <StatCard
          icon="⏳"
          label="En attente de paiement"
          value={stats.pending_orders}
          sub="Clients n'ont pas encore payé"
          color="#F59E0B"
          badge="Live"
        />
        <StatCard
          icon="💬"
          label="Messages reçus"
          value={stats.messages_count}
          sub="Messages WhatsApp entrants"
          color="#3B82F6"
        />
        {/* Revenue card — clearly labelled as confirmed payments only */}
        <div style={{ background: "#fff", border: `2px solid ${G}20`, borderRadius: 20, padding: "22px 24px", display: "flex", alignItems: "flex-start", gap: 14, position: "relative", overflow: "hidden" }}>
          {/* Green accent bar on left */}
          <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 4, background: G, borderRadius: "20px 0 0 20px" }} />
          <div style={{ width: 48, height: 48, borderRadius: 14, flexShrink: 0, background: "#2d6a4f18", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>💰</div>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.05em" }}>Chiffre d'affaires</p>
              <span style={{ background: "#2d6a4f18", color: G, fontSize: 10, fontWeight: 800, padding: "2px 8px", borderRadius: 100 }}>Payé ✓</span>
            </div>
            <p style={{ margin: 0, fontFamily: "'Baloo 2', sans-serif", fontSize: 26, fontWeight: 800, color: G, lineHeight: 1.2 }}>
              {stats.total_revenue.toLocaleString("fr-FR")} F
            </p>
            <p style={{ margin: "4px 0 0", fontSize: 12, color: "#9CA3AF" }}>
              Paiements confirmés uniquement
              {unpaidRevenue > 0 && (
                <span style={{ color: "#D97706", fontWeight: 700 }}>
                  {" "}· +{unpaidRevenue.toLocaleString("fr-FR")} F en attente
                </span>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Top products + quick links */}
      <div className="dash-main-grid" style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 22, marginBottom: 28 }}>
        <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 20, padding: "24px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
            <span style={{ fontSize: 20 }}>🏆</span>
            <h3 style={{ margin: 0, fontFamily: "'Baloo 2'", fontSize: 17, fontWeight: 800, color: G }}>
              {isFnb ? "Plats les plus commandés" : "Produits les plus vendus"}
            </h3>
            <span style={{ fontSize: 11, color: "#9CA3AF", marginLeft: "auto" }}>Sur commandes payées</span>
          </div>
          {stats.top_products.length === 0 ? (
            <div style={{ textAlign: "center", padding: "24px 0", color: "#9CA3AF" }}>
              <div style={{ fontSize: 36, marginBottom: 8 }}>{isFnb ? "🍽️" : "📦"}</div>
              <p style={{ margin: 0, fontWeight: 600, fontSize: 14 }}>Aucune vente confirmée sur cette période</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {stats.top_products.map((p, i) => {
                const medals = ["🥇","🥈","🥉"];
                const colors = [GOLD, G, "#6B7280", "#9CA3AF", "#D1D5DB"];
                const max = Math.max(...stats.top_products.map(x => x.total_sold));
                const pct = Math.round((p.total_sold / max) * 100);
                return (
                  <div key={p.product_name}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 16 }}>{i < 3 ? medals[i] : `${i + 1}.`}</span>
                        <span style={{ fontWeight: 700, color: G, fontSize: 14 }}>{p.product_name}</span>
                      </div>
                      <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
                        <span style={{ fontSize: 13, color: "#6B7280" }}>{p.total_sold} vendu{p.total_sold > 1 ? "s" : ""}</span>
                        <span style={{ fontFamily: "'Baloo 2'", fontSize: 14, fontWeight: 800, color: G }}>{p.revenue.toLocaleString("fr-FR")} F</span>
                      </div>
                    </div>
                    <div style={{ height: 6, background: "#F3F4F6", borderRadius: 100, overflow: "hidden" }}>
                      <div style={{ width: `${pct}%`, height: "100%", background: colors[i] ?? "#E5E7EB", borderRadius: 100 }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <QuickLink href="/dashboard/orders" icon={isFnb ? "🧾" : "💳"} title={isFnb ? "Voir les commandes" : "Suivi des commandes"} sub="Gérer paiements et livraisons" />
          <QuickLink href="/dashboard/products" icon={isFnb ? "🍽️" : "📦"} title={isFnb ? "Mon menu" : "Mes produits"} sub={isFnb ? "Ajouter ou modifier les plats" : "Ajouter ou modifier le stock"} />
          <QuickLink href="/dashboard/conversations" icon="💬" title="Conversations" sub="Voir les échanges clients" />
        </div>
      </div>

      <BotBanner connected={business.whatsapp_connected} />
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// SERVICE DASHBOARD
// ═════════════════════════════════════════════════════════════════════════════
function ServiceDashboard({ stats, business, period, onPeriodChange, loading }: {
  stats: ServiceDashboardStats; business: Business;
  period: Period; onPeriodChange: (p: Period) => void; loading: boolean;
}) {
  return (
    <div style={{ animation: "fadeIn 0.4s ease" }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 28, flexWrap: "wrap", gap: 14 }}>
        <div>
          <h2 style={{ fontFamily: "'Baloo 2'", fontSize: 28, fontWeight: 800, color: G, margin: 0 }}>Bonjour, {business.name} ✨</h2>
          <p style={{ color: "#9CA3AF", fontSize: 14, margin: "4px 0 0" }}>Rendez-vous {PERIOD_LABELS[period]}</p>
        </div>
        <PeriodFilter value={period} onChange={onPeriodChange} />
      </div>

      {!business.whatsapp_connected && <WhatsAppAlert />}

      {stats.today_appointments > 0 && (
        <div style={{ background: "#F0FDF4", border: "2px solid #BBF7D0", borderRadius: 18, padding: "18px 24px", marginBottom: 24, display: "flex", alignItems: "center", gap: 16 }}>
          <span style={{ fontSize: 32 }}>📅</span>
          <div>
            <p style={{ margin: 0, fontWeight: 800, color: "#065F46", fontSize: 16 }}>{stats.today_appointments} rendez-vous aujourd'hui</p>
            <p style={{ margin: "3px 0 0", fontSize: 13, color: "#059669" }}>Consultez votre agenda pour les détails</p>
          </div>
          <Link href="/dashboard/appointments" style={{ marginLeft: "auto", background: G, color: "#fff", padding: "10px 20px", borderRadius: 12, textDecoration: "none", fontWeight: 800, fontSize: 13 }}>Voir →</Link>
        </div>
      )}

      <div className="dash-stats-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16, marginBottom: 28, opacity: loading ? 0.5 : 1, transition: "opacity 0.3s" }}>
        <StatCard icon="📋" label="Total demandes" value={stats.total_appointments} sub="Reçues sur la période" color={G} />
        <StatCard icon="⏳" label="À confirmer" value={stats.pending_appointments} sub="Attendent votre réponse" color="#F59E0B" badge="Live" />
        <StatCard icon="✅" label="Confirmés" value={stats.confirmed_appointments} sub="Rendez-vous à venir" color="#2d6a4f" />
        <StatCard icon="💬" label="Messages reçus" value={stats.messages_count} sub="Messages WhatsApp" color="#3B82F6" />
      </div>

      <div className="dash-main-grid" style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 22, marginBottom: 28 }}>
        <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 20, padding: "24px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
            <span style={{ fontSize: 20 }}>🏆</span>
            <h3 style={{ margin: 0, fontFamily: "'Baloo 2'", fontSize: 17, fontWeight: 800, color: G }}>Services les plus demandés</h3>
          </div>
          {(stats.top_services ?? []).length === 0 ? (
            <div style={{ textAlign: "center", padding: "24px 0", color: "#9CA3AF" }}>
              <div style={{ fontSize: 36, marginBottom: 8 }}>🛠️</div>
              <p style={{ margin: 0, fontWeight: 600, fontSize: 14 }}>Aucun rendez-vous sur cette période</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {(stats.top_services ?? []).map((s, i) => {
                const medals = ["🥇","🥈","🥉"];
                const max = Math.max(...(stats.top_services ?? []).map(x => x.total_bookings));
                const pct = Math.round((s.total_bookings / max) * 100);
                return (
                  <div key={s.service_name}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 5 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span>{i < 3 ? medals[i] : `${i + 1}.`}</span>
                        <span style={{ fontWeight: 700, color: G, fontSize: 14 }}>{s.service_name}</span>
                      </div>
                      <span style={{ fontSize: 13, color: "#6B7280" }}>{s.total_bookings} fois</span>
                    </div>
                    <div style={{ height: 6, background: "#F3F4F6", borderRadius: 100, overflow: "hidden" }}>
                      <div style={{ width: `${pct}%`, height: "100%", background: i === 0 ? GOLD : G, borderRadius: 100 }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <QuickLink href="/dashboard/appointments" icon="📅" title="Mes rendez-vous" sub="Confirmer ou annuler" />
          <QuickLink href="/dashboard/products" icon="🛠️" title="Mes services" sub="Modifier les prestations" />
          <QuickLink href="/dashboard/conversations" icon="💬" title="Conversations" sub="Voir les échanges clients" />
        </div>
      </div>

      <BotBanner connected={business.whatsapp_connected} />
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// CUSTOM DASHBOARD
// ═════════════════════════════════════════════════════════════════════════════
function CustomDashboard({ stats, business, period, onPeriodChange, loading }: {
  stats: CustomDashboardStats; business: Business;
  period: Period; onPeriodChange: (p: Period) => void; loading: boolean;
}) {
  return (
    <div style={{ animation: "fadeIn 0.4s ease" }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 28, flexWrap: "wrap", gap: 14 }}>
        <div>
          <h2 style={{ fontFamily: "'Baloo 2'", fontSize: 28, fontWeight: 800, color: G, margin: 0 }}>Bonjour, {business.name} ✨</h2>
          <p style={{ color: "#9CA3AF", fontSize: 14, margin: "4px 0 0" }}>Activité {PERIOD_LABELS[period]}</p>
        </div>
        <PeriodFilter value={period} onChange={onPeriodChange} />
      </div>

      {!business.whatsapp_connected && <WhatsAppAlert />}

      <div className="dash-stats-grid" style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 16, marginBottom: 28, opacity: loading ? 0.5 : 1, transition: "opacity 0.3s" }}>
        <StatCard icon="💬" label="Messages reçus" value={stats.messages_count} sub="Messages clients entrants" color="#3B82F6" />
        <StatCard icon="🗣️" label="Conversations actives" value={stats.active_conversations} sub="Sur la période" color={G} />
      </div>

      <div className="dash-main-grid" style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 22, marginBottom: 28 }}>
        <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 20, padding: "32px 28px" }}>
          <div style={{ fontSize: 40, marginBottom: 16, textAlign: "center" }}>🤖</div>
          <h3 style={{ textAlign: "center", fontFamily: "'Baloo 2'", fontSize: 20, color: G, margin: "0 0 10px" }}>Votre bot répond aux questions</h3>
          <p style={{ textAlign: "center", color: "#6B7280", fontSize: 14, lineHeight: 1.7, maxWidth: 400, margin: "0 auto" }}>
            L'assistant répond automatiquement à vos clients sur WhatsApp en utilisant les informations que vous avez configurées dans les réglages.
          </p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <QuickLink href="/dashboard/conversations" icon="💬" title="Conversations" sub="Voir les échanges clients" />
          <QuickLink href="/dashboard/settings" icon="⚙️" title="Réglages du bot" sub="Modifier les réponses de l'IA" />
        </div>
      </div>

      <BotBanner connected={business.whatsapp_connected} />
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═════════════════════════════════════════════════════════════════════════════
export default function DashboardPage() {
  const [stats, setStats]       = useState<DashboardStats | null>(null);
  const [business, setBusiness] = useState<Business | null>(null);
  const [period, setPeriod]     = useState<Period>("today");
  const [loading, setLoading]   = useState(true);
  const [statsLoading, setStatsLoading] = useState(false);

  const fetchStats = useCallback(async (p: Period) => {
    setStatsLoading(true);
    try {
      const res = await api.get<DashboardStats>(`/dashboard/stats?period=${p}`);
      setStats(res.data);
    } catch (err) { console.error(err); }
    finally { setStatsLoading(false); }
  }, []);

  useEffect(() => {
    Promise.all([
      api.get<DashboardStats>("/dashboard/stats?period=today"),
      authApi.me(),
    ])
      .then(([statsRes, bizRes]) => { setStats(statsRes.data); setBusiness(bizRes.data); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handlePeriodChange = (p: Period) => { setPeriod(p); fetchStats(p); };

  if (loading) return null;
  if (!stats || !business) return <div style={{ padding: 40, textAlign: "center", color: "#6B7280" }}>Erreur de chargement…</div>;

  const props = { business, period, onPeriodChange: handlePeriodChange, loading: statsLoading };

  return (
    <>
      <style>{`
        @keyframes fadeIn { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
        @media (max-width: 1100px) {
          .dash-stats-grid { grid-template-columns: 1fr 1fr !important; }
          .dash-main-grid  { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 600px) {
          .dash-stats-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>

      {(business.business_type === "products_seller" || 
  business.business_type === "fnb") && (
  <SellDashboard stats={stats as SellDashboardStats} {...props} />
)}
{(business.business_type === "service_information" ||
  business.business_type === "health" ||
  business.business_type === "education" ||
  business.business_type === "real_estate" ||
  business.business_type === "events" ||
  business.business_type === "transport") && (
  <ServiceDashboard stats={stats as ServiceDashboardStats} {...props} />
)}
{business.business_type === "custom" && (
  <CustomDashboard stats={stats as CustomDashboardStats} {...props} />
)}
    </>
  );
}