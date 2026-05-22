"use client";
import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";

// ─── Design tokens ────────────────────────────────────────────────────────────
const C = {
  bg:      "#0A0C10",
  panel:   "#111318",
  border:  "#1E2330",
  accent:  "#00FF94",
  gold:    "#FFB800",
  red:     "#FF4444",
  blue:    "#3B82F6",
  purple:  "#8B5CF6",
  text:    "#E8EAF0",
  muted:   "#4A5268",
  green:   "#1B4332",
};

const TYPE_LABELS: Record<string, string> = {
  products_seller:     "🛒 Retail",
  service_information: "💼 Services",
  fnb:                 "🍽️ F&B",
  custom:              "🤖 Custom Bot",
};

// ─── Ban Risk Engine ──────────────────────────────────────────────────────────
function calcBanRisk(b: any): { score: number; level: "low" | "medium" | "high" | "critical"; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];

  if (!b.whatsapp_connected && b.is_active) {
    score += 25; reasons.push("WhatsApp disconnected while active");
  }
  if (b.messages_count > 5000) {
    score += 30; reasons.push(`High message volume (${b.messages_count?.toLocaleString()})`);
  } else if (b.messages_count > 2000) {
    score += 15; reasons.push(`Elevated message volume`);
  }
  if (b.orders_count > 500) {
    score += 10; reasons.push("High order throughput");
  }
  const daysSinceCreation = (Date.now() - new Date(b.created_at).getTime()) / 86400000;
  if (daysSinceCreation < 7) {
    score += 20; reasons.push("Account less than 7 days old");
  } else if (daysSinceCreation < 30) {
    score += 10; reasons.push("Account less than 30 days old");
  }
  if (!b.is_active) {
    score += 15; reasons.push("Account suspended");
  }
  if (b.business_type === "custom") {
    score += 5; reasons.push("Custom bot — unverified flows");
  }

  score = Math.min(score, 100);
  const level = score >= 70 ? "critical" : score >= 45 ? "high" : score >= 20 ? "medium" : "low";
  return { score, level, reasons };
}

const RISK_COLOR = { low: "#00FF94", medium: "#FFB800", high: "#FF8C00", critical: "#FF4444" };
const RISK_BG    = { low: "#00FF9412", medium: "#FFB80012", high: "#FF8C0012", critical: "#FF444412" };

// ─── Components ───────────────────────────────────────────────────────────────
function Pill({ children, color = C.accent, bg }: any) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      fontSize: 10, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase",
      padding: "3px 9px", borderRadius: 100,
      color, background: bg ?? color + "18", border: `1px solid ${color}30`,
    }}>{children}</span>
  );
}

function MetricCard({ icon, label, value, sub, accent = C.accent }: any) {
  return (
    <div style={{
      background: C.panel, border: `1px solid ${C.border}`,
      borderRadius: 16, padding: "20px 22px",
      display: "flex", flexDirection: "column", gap: 6,
      position: "relative", overflow: "hidden",
    }}>
      <div style={{
        position: "absolute", top: -20, right: -20,
        width: 80, height: 80, borderRadius: "50%",
        background: accent + "08",
      }} />
      <span style={{ fontSize: 22 }}>{icon}</span>
      <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.07em" }}>{label}</p>
      <p style={{ margin: 0, fontSize: 28, fontWeight: 800, color: accent, fontFamily: "'Space Mono', monospace", letterSpacing: "-0.02em" }}>{value}</p>
      {sub && <p style={{ margin: 0, fontSize: 11, color: C.muted }}>{sub}</p>}
    </div>
  );
}

function TabBtn({ active, onClick, children }: any) {
  return (
    <button onClick={onClick} style={{
      padding: "9px 18px", borderRadius: 10, border: "none", cursor: "pointer",
      fontWeight: 700, fontSize: 12, letterSpacing: "0.04em", transition: "all 0.15s",
      background: active ? C.accent : "transparent",
      color: active ? C.bg : C.muted,
    }}>{children}</button>
  );
}

function RiskBar({ score, level }: { score: number; level: string }) {
  const color = RISK_COLOR[level as keyof typeof RISK_COLOR];
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ flex: 1, height: 5, background: C.border, borderRadius: 99 }}>
        <div style={{ width: `${score}%`, height: "100%", background: color, borderRadius: 99, transition: "width 0.5s" }} />
      </div>
      <span style={{ fontSize: 11, fontWeight: 800, color, minWidth: 28, textAlign: "right" }}>{score}</span>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function AdminPage() {
  const [authed,      setAuthed]      = useState(false);
  const [key,         setKey]         = useState("");
  const [stats,       setStats]       = useState<any>(null);
  const [businesses,  setBusinesses]  = useState<any[]>([]);
  const [otpStatus,   setOtpStatus]   = useState<any>(null);
  const [qrCode,      setQrCode]      = useState<string | null>(null);
  const [qrLoading,   setQrLoading]   = useState(false);
  const [loading,     setLoading]     = useState(false);
  const [tab,         setTab]         = useState<"overview" | "businesses" | "financials" | "risk" | "technical">("overview");
  const [search,      setSearch]      = useState("");
  const [sortBy,      setSortBy]      = useState<"revenue" | "messages" | "created">("revenue");
  const [expandedId,  setExpandedId]  = useState<string | null>(null);
  const [now,         setNow]         = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const fetchAll = useCallback(async (adminKey: string) => {
    setLoading(true);
    try {
      const h = { "x-admin-key": adminKey };
      const [s, b, o] = await Promise.all([
        api.get("/admin/stats",               { headers: h }),
        api.get("/admin/businesses",          { headers: h }),
        api.get("/admin/otp-instance/status", { headers: h }),
      ]);
      setStats(s.data);
      setBusinesses(b.data);
      setOtpStatus(o.data);
      setAuthed(true);
    } catch (err: any) {
      if (err?.response?.status === 403) alert("❌ Wrong admin key");
      else alert("Server connection error");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleLogin = (e: React.FormEvent) => { e.preventDefault(); fetchAll(key); };

  const toggleBusiness = async (id: string, current: boolean) => {
    await api.patch(`/admin/businesses/${id}`, { is_active: !current }, { headers: { "x-admin-key": key } });
    fetchAll(key);
  };

  const handleCreateInstance = async () => {
    setLoading(true);
    try {
      const res = await api.post("/admin/otp-instance/create", {}, { headers: { "x-admin-key": key } });
      if (res.data.ok) fetchAll(key);
      else alert(`Error: ${res.data.error}`);
    } finally { setLoading(false); }
  };

  const handleGetQr = async () => {
    setQrLoading(true); setQrCode(null);
    try {
      const res = await api.get("/admin/otp-instance/qr", { headers: { "x-admin-key": key } });
      const b64 = res.data?.base64 || res.data?.qrcode?.base64 || null;
      if (b64) setQrCode(b64.startsWith("data:") ? b64 : `data:image/png;base64,${b64}`);
      else alert("QR not available. Check the instance exists.");
    } finally { setQrLoading(false); }
  };

  // ── Derived data ────────────────────────────────────────────────────────────
  const filtered = businesses.filter(b =>
    b.name.toLowerCase().includes(search.toLowerCase()) ||
    b.phone_number?.includes(search)
  );

  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === "revenue") return b.revenue - a.revenue;
    if (sortBy === "messages") return (b.messages_count ?? 0) - (a.messages_count ?? 0);
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  const totalRevenue = businesses.reduce((s, b) => s + b.revenue, 0);
  const avgRevenue   = businesses.length ? totalRevenue / businesses.length : 0;
  const topEarner    = [...businesses].sort((a, b) => b.revenue - a.revenue)[0];
  const connectedPct = businesses.length ? Math.round(businesses.filter(b => b.whatsapp_connected).length / businesses.length * 100) : 0;
  const criticalRisk = businesses.filter(b => calcBanRisk(b).level === "critical");
  const highRisk     = businesses.filter(b => calcBanRisk(b).level === "high");

  // ── Login ───────────────────────────────────────────────────────────────────
  if (!authed) {
    return (
      <div style={{
        minHeight: "100vh", background: C.bg,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: "'Space Mono', monospace",
      }}>
        {/* grid bg */}
        <div style={{
          position: "fixed", inset: 0, opacity: 0.03,
          backgroundImage: "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }} />
        <div style={{
          background: C.panel, border: `1px solid ${C.border}`,
          borderRadius: 24, padding: "48px 40px", width: 380,
          boxShadow: `0 0 80px ${C.accent}18`, position: "relative", zIndex: 1,
        }}>
          <div style={{ textAlign: "center", marginBottom: 36 }}>
            <div style={{
              width: 64, height: 64, borderRadius: 20, background: C.accent + "15",
              border: `1px solid ${C.accent}40`, display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 28, margin: "0 auto 16px",
            }}>🛡</div>
            <h1 style={{ fontFamily: "'Space Mono'", fontSize: 20, fontWeight: 700, color: C.text, margin: 0 }}>SUGUAI ADMIN</h1>
            <p style={{ color: C.muted, fontSize: 12, margin: "6px 0 0", letterSpacing: "0.1em" }}>SECURE CONTROL PANEL</p>
          </div>
          <form onSubmit={handleLogin}>
            <input
              type="password" placeholder="Enter admin key"
              value={key} onChange={e => setKey(e.target.value)}
              style={{
                width: "100%", background: C.bg, border: `1px solid ${C.border}`,
                borderRadius: 12, padding: "13px 16px", fontSize: 14, outline: "none",
                boxSizing: "border-box", marginBottom: 14, color: C.text,
                fontFamily: "'Space Mono'", letterSpacing: "0.08em",
              }}
              required
            />
            <button type="submit" disabled={loading} style={{
              width: "100%", background: C.accent, color: C.bg,
              border: "none", borderRadius: 12, padding: "14px",
              fontSize: 13, fontWeight: 700, cursor: "pointer",
              fontFamily: "'Space Mono'", letterSpacing: "0.08em",
            }}>
              {loading ? "AUTHENTICATING…" : "ACCESS PANEL →"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ── Dashboard ────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "'Space Mono', monospace", color: C.text }}>

      {/* grid overlay */}
      <div style={{
        position: "fixed", inset: 0, opacity: 0.025, pointerEvents: "none",
        backgroundImage: "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)",
        backgroundSize: "40px 40px", zIndex: 0,
      }} />

      {/* ── Header ── */}
      <div style={{
        position: "sticky", top: 0, zIndex: 100,
        background: C.panel + "EE", borderBottom: `1px solid ${C.border}`,
        backdropFilter: "blur(12px)",
        padding: "0 32px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 60,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <span style={{ fontSize: 20 }}>🛡</span>
          <div>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: C.accent, letterSpacing: "0.1em" }}>SUGUAI ADMIN</p>
            <p style={{ margin: 0, fontSize: 10, color: C.muted, letterSpacing: "0.08em" }}>
              {now.toLocaleTimeString("en-GB")} · {businesses.length} tenants
            </p>
          </div>
        </div>

        {/* alert pills */}
        <div style={{ display: "flex", gap: 8 }}>
          {criticalRisk.length > 0 && (
            <Pill color={C.red}>🚨 {criticalRisk.length} CRITICAL RISK</Pill>
          )}
          {!otpStatus?.connected && (
            <Pill color={C.gold}>⚠ OTP OFFLINE</Pill>
          )}
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => fetchAll(key)} style={{
            background: C.accent + "18", color: C.accent,
            border: `1px solid ${C.accent}30`, borderRadius: 8,
            padding: "6px 14px", cursor: "pointer", fontSize: 11, fontWeight: 700,
          }}>↺ REFRESH</button>
          <button onClick={() => { setAuthed(false); setKey(""); }} style={{
            background: C.red + "18", color: C.red,
            border: `1px solid ${C.red}30`, borderRadius: 8,
            padding: "6px 14px", cursor: "pointer", fontSize: 11, fontWeight: 700,
          }}>✕ LOGOUT</button>
        </div>
      </div>

      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "28px 28px", position: "relative", zIndex: 1 }}>

        {/* ── Tabs ── */}
        <div style={{
          display: "inline-flex", background: C.panel, border: `1px solid ${C.border}`,
          borderRadius: 14, padding: 5, gap: 3, marginBottom: 28,
        }}>
          {([
            { k: "overview",    label: "◈ Overview" },
            { k: "businesses",  label: "▦ Businesses" },
            { k: "financials",  label: "◎ Financials" },
            { k: "risk",        label: "⬡ Risk Monitor" },
            { k: "technical",   label: "⌬ Technical" },
          ] as const).map(t => (
            <TabBtn key={t.k} active={tab === t.k} onClick={() => setTab(t.k)}>{t.label}</TabBtn>
          ))}
        </div>

        {/* ══════════ OVERVIEW TAB ══════════ */}
        {tab === "overview" && stats && (
          <div>
            {/* top metrics */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 14 }}>
              <MetricCard icon="🏪" label="Total Tenants"    value={stats.total_businesses}  accent={C.accent} />
              <MetricCard icon="✅" label="WA Connected"     value={`${connectedPct}%`}       accent="#00CC77"
                sub={`${stats.active_businesses} of ${stats.total_businesses}`} />
              <MetricCard icon="⛔" label="Suspended"        value={stats.suspended_businesses} accent={C.red} />
              <MetricCard icon="👥" label="Total Customers"  value={stats.total_customers.toLocaleString()} accent={C.purple} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 28 }}>
              <MetricCard icon="🛒" label="Total Orders"     value={stats.total_orders.toLocaleString()} accent={C.blue} />
              <MetricCard icon="💰" label="Platform Revenue" value={`${(totalRevenue / 1000).toFixed(1)}K`}
                sub="FCFA total across all businesses" accent={C.gold} />
              <MetricCard icon="💬" label="Messages Sent"    value={stats.total_messages.toLocaleString()} accent="#EC4899" />
              <MetricCard icon="🎯" label="Promotions"       value={stats.total_promotions} accent="#F97316" />
            </div>

            {/* quick summary table */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              {/* top earners */}
              <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 16, padding: 22 }}>
                <p style={{ margin: "0 0 16px", fontSize: 11, fontWeight: 700, color: C.muted, letterSpacing: "0.1em", textTransform: "uppercase" }}>
                  💰 Top Earners
                </p>
                {[...businesses].sort((a, b) => b.revenue - a.revenue).slice(0, 5).map((b, i) => (
                  <div key={b.id} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                    <span style={{ fontSize: 11, color: C.muted, minWidth: 16, fontWeight: 700 }}>#{i + 1}</span>
                    <div style={{
                      width: 32, height: 32, borderRadius: 10, background: C.gold + "20",
                      color: C.gold, display: "flex", alignItems: "center", justifyContent: "center",
                      fontWeight: 800, fontSize: 13, flexShrink: 0,
                    }}>{b.name.charAt(0)}</div>
                    <div style={{ flex: 1 }}>
                      <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: C.text }}>{b.name}</p>
                      <p style={{ margin: 0, fontSize: 10, color: C.muted }}>{TYPE_LABELS[b.business_type] ?? b.business_type}</p>
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 700, color: C.gold }}>
                      {b.revenue.toLocaleString()} <span style={{ fontSize: 9, color: C.muted }}>FCFA</span>
                    </span>
                  </div>
                ))}
              </div>

              {/* risk summary */}
              <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 16, padding: 22 }}>
                <p style={{ margin: "0 0 16px", fontSize: 11, fontWeight: 700, color: C.muted, letterSpacing: "0.1em", textTransform: "uppercase" }}>
                  ⬡ Risk Distribution
                </p>
                {(["critical", "high", "medium", "low"] as const).map(level => {
                  const count = businesses.filter(b => calcBanRisk(b).level === level).length;
                  const color = RISK_COLOR[level];
                  return (
                    <div key={level} style={{ marginBottom: 14 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color, textTransform: "uppercase" }}>{level}</span>
                        <span style={{ fontSize: 11, color: C.muted }}>{count} businesses</span>
                      </div>
                      <div style={{ height: 4, background: C.border, borderRadius: 99 }}>
                        <div style={{
                          width: businesses.length ? `${count / businesses.length * 100}%` : "0%",
                          height: "100%", background: color, borderRadius: 99,
                        }} />
                      </div>
                    </div>
                  );
                })}

                {criticalRisk.length > 0 && (
                  <div style={{ marginTop: 16, padding: "12px 14px", background: C.red + "12", border: `1px solid ${C.red}30`, borderRadius: 10 }}>
                    <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: C.red }}>
                      🚨 {criticalRisk.length} business{criticalRisk.length > 1 ? "es" : ""} at CRITICAL ban risk
                    </p>
                    <p style={{ margin: "4px 0 0", fontSize: 10, color: C.muted }}>
                      {criticalRisk.map(b => b.name).join(", ")}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ══════════ BUSINESSES TAB ══════════ */}
        {tab === "businesses" && (
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18, flexWrap: "wrap" }}>
              <input
                placeholder="Search by name or phone…"
                value={search} onChange={e => setSearch(e.target.value)}
                style={{
                  flex: 1, minWidth: 200, background: C.panel, border: `1px solid ${C.border}`,
                  borderRadius: 10, padding: "9px 14px", fontSize: 12, outline: "none", color: C.text,
                  fontFamily: "'Space Mono'",
                }}
              />
              <div style={{ display: "flex", gap: 6 }}>
                {(["revenue", "messages", "created"] as const).map(s => (
                  <button key={s} onClick={() => setSortBy(s)} style={{
                    padding: "8px 14px", borderRadius: 8, border: "none", cursor: "pointer",
                    fontSize: 11, fontWeight: 700,
                    background: sortBy === s ? C.accent : C.panel,
                    color: sortBy === s ? C.bg : C.muted,
                  }}>{s === "created" ? "newest" : s}</button>
                ))}
              </div>
              <span style={{ fontSize: 11, color: C.muted }}>{sorted.length} results</span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {sorted.map(b => {
                const risk = calcBanRisk(b);
                const expanded = expandedId === b.id;
                const daysSince = Math.floor((Date.now() - new Date(b.created_at).getTime()) / 86400000);

                return (
                  <div key={b.id} style={{
                    background: C.panel, border: `1px solid ${expanded ? C.accent + "40" : C.border}`,
                    borderRadius: 14, overflow: "hidden",
                    transition: "border-color 0.2s",
                  }}>
                    {/* main row */}
                    <div
                      style={{ padding: "14px 18px", display: "flex", alignItems: "center", gap: 14, cursor: "pointer" }}
                      onClick={() => setExpandedId(expanded ? null : b.id)}
                    >
                      {/* avatar */}
                      <div style={{
                        width: 40, height: 40, borderRadius: 12,
                        background: RISK_BG[risk.level], border: `1px solid ${RISK_COLOR[risk.level]}30`,
                        color: RISK_COLOR[risk.level],
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontWeight: 800, fontSize: 16, flexShrink: 0,
                      }}>{b.name.charAt(0)}</div>

                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap", marginBottom: 4 }}>
                          <span style={{ fontWeight: 700, fontSize: 13, color: C.text }}>{b.name}</span>
                          <Pill color={b.whatsapp_connected ? "#00CC77" : C.gold}>
                            {b.whatsapp_connected ? "✅ WA Live" : "⚠ WA Off"}
                          </Pill>
                          {!b.is_active && <Pill color={C.red}>⛔ Suspended</Pill>}
                          <Pill color={C.muted}>{TYPE_LABELS[b.business_type] ?? b.business_type}</Pill>
                          <Pill color={RISK_COLOR[risk.level]}>
                            {risk.level.toUpperCase()} RISK · {risk.score}
                          </Pill>
                        </div>
                        <div style={{ display: "flex", gap: 16, fontSize: 11, color: C.muted, flexWrap: "wrap" }}>
                          <span>📱 {b.phone_number || "—"}</span>
                          <span>👥 {b.customers_count} customers</span>
                          <span>🛒 {b.orders_count} orders</span>
                          <span>💰 {b.revenue.toLocaleString()} FCFA</span>
                          <span>📅 {daysSince}d ago</span>
                        </div>
                      </div>

                      <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                        <button
                          onClick={e => { e.stopPropagation(); toggleBusiness(b.id, b.is_active); }}
                          style={{
                            padding: "7px 14px", borderRadius: 8, border: "none", cursor: "pointer",
                            fontWeight: 700, fontSize: 11,
                            background: b.is_active ? C.red + "18" : "#00CC7718",
                            color: b.is_active ? C.red : "#00CC77",
                          }}>
                          {b.is_active ? "⛔ Suspend" : "✅ Reactivate"}
                        </button>
                        <span style={{ fontSize: 18, color: C.muted, userSelect: "none" }}>{expanded ? "▲" : "▼"}</span>
                      </div>
                    </div>

                    {/* expanded detail */}
                    {expanded && (
                      <div style={{ borderTop: `1px solid ${C.border}`, padding: "16px 18px", display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
                        {/* Identity */}
                        <div>
                          <p style={{ margin: "0 0 10px", fontSize: 10, color: C.muted, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>Identity</p>
                          {[
                            ["ID",         b.id?.substring(0, 8) + "…"],
                            ["Type",       TYPE_LABELS[b.business_type] ?? b.business_type],
                            ["Status",     b.is_active ? "Active" : "Suspended"],
                            ["Created",    new Date(b.created_at).toLocaleDateString("en-GB")],
                            ["Age",        `${daysSince} days`],
                          ].map(([k, v]) => (
                            <div key={k} style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                              <span style={{ fontSize: 11, color: C.muted }}>{k}</span>
                              <span style={{ fontSize: 11, color: C.text, fontWeight: 600 }}>{v}</span>
                            </div>
                          ))}
                        </div>

                        {/* Technical */}
                        <div>
                          <p style={{ margin: "0 0 10px", fontSize: 10, color: C.muted, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>WhatsApp / Technical</p>
                          {[
                            ["WA Connected",  b.whatsapp_connected ? "Yes" : "No"],
                            ["Instance ID",   b.evolution_instance_id?.substring(0, 16) + "…" || "—"],
                            ["Phone",         b.phone_number || "—"],
                          ].map(([k, v]) => (
                            <div key={k} style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                              <span style={{ fontSize: 11, color: C.muted }}>{k}</span>
                              <span style={{ fontSize: 11, color: C.text, fontWeight: 600 }}>{v}</span>
                            </div>
                          ))}
                        </div>

                        {/* Ban Risk */}
                        <div>
                          <p style={{ margin: "0 0 10px", fontSize: 10, color: C.muted, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                            Ban Risk Analysis
                          </p>
                          <RiskBar score={risk.score} level={risk.level} />
                          <div style={{ marginTop: 10 }}>
                            {risk.reasons.map((r, i) => (
                              <div key={i} style={{ display: "flex", gap: 6, marginBottom: 5, alignItems: "flex-start" }}>
                                <span style={{ color: RISK_COLOR[risk.level], fontSize: 9, marginTop: 2 }}>●</span>
                                <span style={{ fontSize: 10, color: C.muted }}>{r}</span>
                              </div>
                            ))}
                            {risk.reasons.length === 0 && (
                              <p style={{ fontSize: 10, color: "#00CC77", margin: 0 }}>✅ No risk factors detected</p>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ══════════ FINANCIALS TAB ══════════ */}
        {tab === "financials" && (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 24 }}>
              <MetricCard icon="💰" label="Total Platform GMV" value={`${(totalRevenue / 1000).toFixed(1)}K FCFA`} accent={C.gold} />
              <MetricCard icon="📈" label="Avg Revenue / Biz"  value={`${Math.round(avgRevenue).toLocaleString()}`}
                sub="FCFA per business" accent={C.accent} />
              <MetricCard icon="🏆" label="Top Earner"
                value={topEarner?.revenue ? `${(topEarner.revenue / 1000).toFixed(1)}K` : "—"}
                sub={topEarner?.name ?? "—"} accent={C.gold} />
              <MetricCard icon="🛒" label="Total Orders"       value={stats?.total_orders?.toLocaleString() ?? "—"} accent={C.blue} />
            </div>

            {/* Revenue table */}
            <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 16, overflow: "hidden" }}>
              <div style={{ padding: "16px 20px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: C.muted, letterSpacing: "0.1em", textTransform: "uppercase" }}>
                  Revenue Breakdown — All Businesses
                </p>
                <span style={{ fontSize: 11, color: C.muted }}>Sorted by revenue</span>
              </div>

              {/* header */}
              <div style={{
                display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr 100px",
                padding: "10px 20px", fontSize: 10, fontWeight: 700, color: C.muted,
                textTransform: "uppercase", letterSpacing: "0.08em", borderBottom: `1px solid ${C.border}`,
              }}>
                <span>Business</span><span>Revenue</span><span>Orders</span><span>Customers</span><span>Avg Order</span><span>Share</span>
              </div>

              {[...businesses].sort((a, b) => b.revenue - a.revenue).map((b, i) => {
                const share = totalRevenue > 0 ? (b.revenue / totalRevenue * 100) : 0;
                const avgOrder = b.orders_count > 0 ? Math.round(b.revenue / b.orders_count) : 0;
                return (
                  <div key={b.id} style={{
                    display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr 100px",
                    padding: "13px 20px", fontSize: 12, alignItems: "center",
                    borderBottom: `1px solid ${C.border}`,
                    background: i === 0 ? C.gold + "06" : "transparent",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontSize: 10, color: C.muted, minWidth: 16 }}>#{i + 1}</span>
                      <div style={{
                        width: 28, height: 28, borderRadius: 8, background: C.gold + "20",
                        color: C.gold, display: "flex", alignItems: "center", justifyContent: "center",
                        fontWeight: 800, fontSize: 12, flexShrink: 0,
                      }}>{b.name.charAt(0)}</div>
                      <div>
                        <p style={{ margin: 0, fontWeight: 700, color: C.text, fontSize: 12 }}>{b.name}</p>
                        <p style={{ margin: 0, fontSize: 10, color: C.muted }}>{TYPE_LABELS[b.business_type] ?? b.business_type}</p>
                      </div>
                    </div>
                    <span style={{ fontWeight: 700, color: C.gold }}>{b.revenue.toLocaleString()}</span>
                    <span style={{ color: C.text }}>{b.orders_count}</span>
                    <span style={{ color: C.text }}>{b.customers_count}</span>
                    <span style={{ color: C.muted }}>{avgOrder > 0 ? avgOrder.toLocaleString() : "—"}</span>
                    <div>
                      <div style={{ height: 4, background: C.border, borderRadius: 99, marginBottom: 3 }}>
                        <div style={{ width: `${share}%`, height: "100%", background: C.gold, borderRadius: 99 }} />
                      </div>
                      <span style={{ fontSize: 10, color: C.muted }}>{share.toFixed(1)}%</span>
                    </div>
                  </div>
                );
              })}

              {/* totals */}
              <div style={{
                display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr 100px",
                padding: "13px 20px", fontSize: 12, alignItems: "center",
                background: C.accent + "08", borderTop: `2px solid ${C.accent}30`,
              }}>
                <span style={{ fontWeight: 700, color: C.accent, fontSize: 11, letterSpacing: "0.06em" }}>TOTAL</span>
                <span style={{ fontWeight: 800, color: C.accent }}>{totalRevenue.toLocaleString()}</span>
                <span style={{ fontWeight: 700, color: C.text }}>{stats?.total_orders ?? "—"}</span>
                <span style={{ fontWeight: 700, color: C.text }}>{stats?.total_customers ?? "—"}</span>
                <span style={{ color: C.muted }}>—</span>
                <span style={{ color: C.muted }}>100%</span>
              </div>
            </div>
          </div>
        )}

        {/* ══════════ RISK MONITOR TAB ══════════ */}
        {tab === "risk" && (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 24 }}>
              <MetricCard icon="🚨" label="Critical Risk" value={criticalRisk.length}       accent={C.red} />
              <MetricCard icon="⚠️" label="High Risk"     value={highRisk.length}           accent="#FF8C00" />
              <MetricCard icon="⬡"  label="Medium Risk"   value={businesses.filter(b => calcBanRisk(b).level === "medium").length} accent={C.gold} />
              <MetricCard icon="✅" label="Low Risk"       value={businesses.filter(b => calcBanRisk(b).level === "low").length}    accent={C.accent} />
            </div>

            {/* risk info card */}
            <div style={{
              background: C.red + "0A", border: `1px solid ${C.red}25`,
              borderRadius: 14, padding: "16px 20px", marginBottom: 20,
              display: "flex", gap: 14, alignItems: "flex-start",
            }}>
              <span style={{ fontSize: 20 }}>ℹ</span>
              <div>
                <p style={{ margin: "0 0 4px", fontWeight: 700, fontSize: 12, color: C.red }}>WhatsApp Ban Risk Factors</p>
                <p style={{ margin: 0, fontSize: 11, color: C.muted, lineHeight: 1.8 }}>
                  Risk is calculated from: high message volume (2K+ = elevated, 5K+ = high), new accounts (&lt;7d = +20pts, &lt;30d = +10pts),
                  disconnected but active instance (+25pts), suspended status (+15pts), custom bot type (+5pts). Max score 100.
                </p>
              </div>
            </div>

            {/* risk list — sorted by score */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[...businesses].sort((a, b) => calcBanRisk(b).score - calcBanRisk(a).score).map(b => {
                const risk = calcBanRisk(b);
                const color = RISK_COLOR[risk.level];
                return (
                  <div key={b.id} style={{
                    background: C.panel, border: `1px solid ${color}25`,
                    borderRadius: 14, padding: "16px 20px",
                    display: "grid", gridTemplateColumns: "1fr 180px 1fr", gap: 20, alignItems: "center",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div style={{
                        width: 36, height: 36, borderRadius: 10,
                        background: color + "18", color, display: "flex",
                        alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 14,
                      }}>{b.name.charAt(0)}</div>
                      <div>
                        <p style={{ margin: 0, fontWeight: 700, fontSize: 13, color: C.text }}>{b.name}</p>
                        <p style={{ margin: 0, fontSize: 10, color: C.muted }}>{b.phone_number || "No phone"}</p>
                      </div>
                    </div>

                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                        <Pill color={color}>{risk.level.toUpperCase()}</Pill>
                        <span style={{ fontSize: 14, fontWeight: 800, color }}>{risk.score}<span style={{ fontSize: 10, color: C.muted }}>/100</span></span>
                      </div>
                      <RiskBar score={risk.score} level={risk.level} />
                    </div>

                    <div>
                      {risk.reasons.length === 0
                        ? <span style={{ fontSize: 11, color: C.accent }}>✅ No risk factors</span>
                        : risk.reasons.map((r, i) => (
                          <div key={i} style={{ display: "flex", gap: 6, marginBottom: 3, alignItems: "flex-start" }}>
                            <span style={{ color, fontSize: 9, marginTop: 2 }}>●</span>
                            <span style={{ fontSize: 11, color: C.muted }}>{r}</span>
                          </div>
                        ))
                      }
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ══════════ TECHNICAL TAB ══════════ */}
        {tab === "technical" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>

            {/* OTP Instance */}
            <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 16, padding: 24, gridColumn: "span 2" }}>
              <p style={{ margin: "0 0 16px", fontSize: 11, fontWeight: 700, color: C.muted, letterSpacing: "0.1em", textTransform: "uppercase" }}>
                📱 OTP WhatsApp Instance
              </p>
              <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{
                    width: 10, height: 10, borderRadius: "50%",
                    background: otpStatus?.connected ? C.accent : otpStatus?.configured ? C.gold : C.muted,
                    boxShadow: otpStatus?.connected ? `0 0 8px ${C.accent}` : "none",
                  }} />
                  <span style={{ fontWeight: 700, fontSize: 13, color: C.text }}>
                    {otpStatus?.connected ? "Connected & Ready"
                     : otpStatus?.configured ? "Configured — Disconnected"
                     : "Not Configured"}
                  </span>
                </div>
                {otpStatus?.instance && (
                  <Pill color={C.muted}>Instance: {otpStatus.instance}</Pill>
                )}
                {otpStatus?.state && (
                  <Pill color={otpStatus.state === "open" ? C.accent : C.gold}>
                    Evolution state: {otpStatus.state}
                  </Pill>
                )}
              </div>

              <div style={{ display: "flex", gap: 10, marginTop: 18, flexWrap: "wrap" }}>
                {!otpStatus?.connected && (
                  <button onClick={handleCreateInstance} disabled={loading} style={{
                    background: C.accent, color: C.bg, border: "none", borderRadius: 10,
                    padding: "10px 18px", cursor: "pointer", fontWeight: 700, fontSize: 11,
                    fontFamily: "'Space Mono'",
                  }}>
                    {loading ? "CREATING…" : "+ CREATE INSTANCE"}
                  </button>
                )}
                <button onClick={handleGetQr} disabled={qrLoading} style={{
                  background: C.gold + "20", color: C.gold, border: `1px solid ${C.gold}40`,
                  borderRadius: 10, padding: "10px 18px", cursor: "pointer", fontWeight: 700, fontSize: 11,
                  fontFamily: "'Space Mono'",
                }}>
                  {qrLoading ? "LOADING…" : "📷 SHOW QR CODE"}
                </button>
                <button onClick={() => fetchAll(key)} style={{
                  background: C.panel, color: C.muted, border: `1px solid ${C.border}`,
                  borderRadius: 10, padding: "10px 18px", cursor: "pointer", fontWeight: 700, fontSize: 11,
                  fontFamily: "'Space Mono'",
                }}>↺ REFRESH</button>
              </div>

              {qrCode && (
                <div style={{ marginTop: 20, display: "flex", gap: 20, alignItems: "flex-start", flexWrap: "wrap" }}>
                  <div style={{ background: "#fff", padding: 12, borderRadius: 14 }}>
                    <img src={qrCode} alt="QR" style={{ width: 200, height: 200, display: "block" }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontWeight: 700, color: C.accent, margin: "0 0 8px", fontSize: 13 }}>📷 Scan with WhatsApp</p>
                    <ol style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: C.muted, lineHeight: 2 }}>
                      <li>Open WhatsApp on your phone</li>
                      <li>Tap ⋮ → Linked Devices</li>
                      <li>Tap "Link a Device"</li>
                      <li>Scan this QR code</li>
                    </ol>
                    <button onClick={() => setQrCode(null)} style={{
                      marginTop: 12, background: C.border, color: C.muted, border: "none",
                      borderRadius: 8, padding: "7px 14px", cursor: "pointer", fontSize: 11,
                    }}>✕ Close QR</button>
                  </div>
                </div>
              )}

              {otpStatus?.message && (
                <div style={{ marginTop: 16, padding: "12px 14px", background: C.red + "12", border: `1px solid ${C.red}30`, borderRadius: 10 }}>
                  <p style={{ margin: 0, fontSize: 12, color: C.red }}>{otpStatus.message}</p>
                </div>
              )}
            </div>

            {/* WhatsApp Connection Summary */}
            <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 16, padding: 24 }}>
              <p style={{ margin: "0 0 16px", fontSize: 11, fontWeight: 700, color: C.muted, letterSpacing: "0.1em", textTransform: "uppercase" }}>
                📶 Tenant WA Connection Summary
              </p>
              {[
                { label: "Connected",    count: businesses.filter(b => b.whatsapp_connected).length,  color: C.accent },
                { label: "Disconnected", count: businesses.filter(b => !b.whatsapp_connected && b.is_active).length, color: C.gold },
                { label: "Suspended",    count: businesses.filter(b => !b.is_active).length,          color: C.red },
              ].map(row => (
                <div key={row.label} style={{ marginBottom: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                    <span style={{ fontSize: 12, color: row.color, fontWeight: 700 }}>{row.label}</span>
                    <span style={{ fontSize: 12, color: C.text, fontWeight: 700 }}>{row.count}</span>
                  </div>
                  <div style={{ height: 5, background: C.border, borderRadius: 99 }}>
                    <div style={{
                      width: businesses.length ? `${row.count / businesses.length * 100}%` : "0%",
                      height: "100%", background: row.color, borderRadius: 99,
                    }} />
                  </div>
                </div>
              ))}
              <div style={{ marginTop: 10, padding: "10px 14px", background: C.accent + "08", border: `1px solid ${C.accent}20`, borderRadius: 10 }}>
                <p style={{ margin: 0, fontSize: 12, color: C.accent, fontWeight: 700 }}>
                  {connectedPct}% tenant connectivity rate
                </p>
              </div>
            </div>

            {/* Setup guide */}
            <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 16, padding: 24 }}>
              <p style={{ margin: "0 0 16px", fontSize: 11, fontWeight: 700, color: C.muted, letterSpacing: "0.1em", textTransform: "uppercase" }}>
                📋 OTP Instance Setup Guide
              </p>
              {[
                { n: "01", label: "Add env var", detail: "OTP_EVOLUTION_INSTANCE=suguai-otp in .env" },
                { n: "02", label: "Create instance", detail: "Click CREATE INSTANCE above" },
                { n: "03", label: "Scan QR", detail: "Click SHOW QR CODE → scan with WhatsApp" },
                { n: "04", label: "Verify", detail: "Status shows Connected & Ready with green light" },
              ].map(step => (
                <div key={step.n} style={{ display: "flex", gap: 12, marginBottom: 14 }}>
                  <span style={{ fontWeight: 800, color: C.accent, fontSize: 12, minWidth: 24 }}>{step.n}</span>
                  <div>
                    <p style={{ margin: 0, fontWeight: 700, fontSize: 12, color: C.text }}>{step.label}</p>
                    <p style={{ margin: 0, fontSize: 11, color: C.muted }}>{step.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}