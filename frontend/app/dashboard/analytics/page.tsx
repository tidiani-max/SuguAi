"use client";
import { useState, useEffect } from "react";
import { analyticsApi } from "@/lib/api";
import { AnalyticsData } from "@/types";

const G    = "#1B4332";
const GOLD = "#D4AF37";

function StatCard({ icon, label, value, sub, color = G }: {
  icon: string; label: string; value: string | number; sub?: string; color?: string;
}) {
  return (
    <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 18, padding: "20px 22px", display: "flex", alignItems: "flex-start", gap: 14 }}>
      <div style={{ width: 46, height: 46, borderRadius: 13, background: color + "18", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>
        {icon}
      </div>
      <div>
        <p style={{ margin: "0 0 4px", fontSize: 11, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</p>
        <p style={{ margin: 0, fontFamily: "'Baloo 2'", fontSize: 24, fontWeight: 800, color: G, lineHeight: 1.2 }}>{value}</p>
        {sub && <p style={{ margin: "3px 0 0", fontSize: 12, color: "#9CA3AF" }}>{sub}</p>}
      </div>
    </div>
  );
}

function BarChart({ data, valueKey, color, label }: {
  data: { date: string; [k: string]: any }[];
  valueKey: string;
  color: string;
  label: string;
}) {
  const max = Math.max(...data.map(d => d[valueKey]), 1);
  return (
    <div>
      <p style={{ margin: "0 0 12px", fontSize: 13, fontWeight: 700, color: "#374151" }}>{label}</p>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 120 }}>
        {data.map((d, i) => {
          const pct = (d[valueKey] / max) * 100;
          return (
            <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, height: "100%", justifyContent: "flex-end" }}>
              <span style={{ fontSize: 9, color: "#9CA3AF", fontWeight: 700 }}>{d[valueKey] > 0 ? d[valueKey] : ""}</span>
              <div style={{ width: "100%", background: color, borderRadius: "4px 4px 0 0", height: `${Math.max(pct, d[valueKey] > 0 ? 4 : 0)}%`, transition: "height 0.4s ease", opacity: 0.85 }} />
              <span style={{ fontSize: 10, color: "#9CA3AF" }}>{d.date}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function AnalyticsPage() {
  const [data,    setData]    = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    analyticsApi.get()
      .then(res => setData(res.data))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 300 }}>
        <p style={{ color: "#9CA3AF", fontSize: 16 }}>Chargement des données…</p>
      </div>
    );
  }

  if (!data) return null;

  const { totals, charts } = data;

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontFamily: "'Baloo 2'", fontSize: 26, fontWeight: 800, color: G, margin: 0 }}>
          📊 Rapport & Analytique
        </h1>
        <p style={{ color: "#9CA3AF", fontSize: 14, margin: "4px 0 0" }}>
          Toutes vos performances en un seul endroit
        </p>
      </div>

      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 24 }}>
        <StatCard icon="💰" label="Chiffre d'affaires" value={`${totals.revenue.toLocaleString("fr-FR")} F`} sub="Paiements confirmés" color={G} />
        <StatCard icon="🛒" label="Commandes" value={totals.orders} sub="Total depuis le début" color="#2563EB" />
        <StatCard icon="👥" label="Clients" value={totals.customers} sub="Dans votre base" color="#7C3AED" />
        <StatCard icon="💬" label="Messages" value={totals.messages} sub="Échanges WhatsApp" color="#D97706" />
      </div>

      {/* Charts */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
        <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 18, padding: 24 }}>
          <BarChart data={charts.daily_messages} valueKey="messages" color="#3B82F6" label="Messages / jour (7 derniers jours)" />
        </div>
        <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 18, padding: 24 }}>
          <BarChart data={charts.daily_revenue} valueKey="revenue" color={G} label="Revenus / jour (7 derniers jours)" />
        </div>
      </div>

      {/* AI + Promos */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {/* AI */}
        <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 18, padding: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
            <span style={{ fontSize: 22 }}>🤖</span>
            <h3 style={{ margin: 0, fontFamily: "'Baloo 2'", fontSize: 16, fontWeight: 800, color: G }}>Performance de l'IA</h3>
          </div>
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ fontSize: 13, color: "#6B7280" }}>Messages envoyés par l'IA</span>
              <span style={{ fontWeight: 800, color: G }}>{totals.outbound_messages}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
              <span style={{ fontSize: 13, color: "#6B7280" }}>Taux de réponse automatique</span>
              <span style={{ fontWeight: 800, color: "#059669", fontSize: 16 }}>{totals.ai_rate}%</span>
            </div>
            <div style={{ height: 10, background: "#F3F4F6", borderRadius: 100, overflow: "hidden" }}>
              <div style={{ width: `${totals.ai_rate}%`, height: "100%", background: totals.ai_rate >= 60 ? "#22C55E" : totals.ai_rate >= 30 ? GOLD : "#EF4444", borderRadius: 100, transition: "width 0.6s ease" }} />
            </div>
          </div>
          <p style={{ margin: 0, fontSize: 12, color: "#9CA3AF", lineHeight: 1.6, padding: "12px", background: "#F9FAFB", borderRadius: 10 }}>
            {totals.ai_rate >= 70
              ? "🚀 Excellent ! Votre IA gère parfaitement les conversations."
              : totals.ai_rate >= 40
              ? "👍 Bien. L'IA est bien utilisée pour répondre aux clients."
              : "⚙️ L'IA répond peu. Vérifiez les réglages de votre bot."}
          </p>
        </div>

        {/* Promos */}
        <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 18, padding: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
            <span style={{ fontSize: 22 }}>📢</span>
            <h3 style={{ margin: 0, fontFamily: "'Baloo 2'", fontSize: 16, fontWeight: 800, color: G }}>Promotions</h3>
          </div>
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ fontSize: 13, color: "#6B7280" }}>Total créées</span>
              <span style={{ fontWeight: 800, color: G }}>{totals.promotions_total}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
              <span style={{ fontSize: 13, color: "#6B7280" }}>Envoyées avec succès</span>
              <span style={{ fontWeight: 800, color: "#059669", fontSize: 16 }}>{totals.promotions_sent}</span>
            </div>
            <div style={{ height: 10, background: "#F3F4F6", borderRadius: 100, overflow: "hidden" }}>
              <div style={{
                width: totals.promotions_total > 0 ? `${Math.round(totals.promotions_sent / totals.promotions_total * 100)}%` : "0%",
                height: "100%", background: GOLD, borderRadius: 100, transition: "width 0.6s ease"
              }} />
            </div>
          </div>
          <p style={{ margin: 0, fontSize: 12, color: "#9CA3AF", lineHeight: 1.6, padding: "12px", background: "#F9FAFB", borderRadius: 10 }}>
            {totals.promotions_sent === 0
              ? "💡 Vous n'avez pas encore envoyé de promotion. Essayez !"
              : `✅ ${totals.promotions_sent} campagne${totals.promotions_sent > 1 ? "s" : ""} diffusée${totals.promotions_sent > 1 ? "s" : ""} à vos clients.`}
          </p>
        </div>
      </div>
    </div>
  );
}