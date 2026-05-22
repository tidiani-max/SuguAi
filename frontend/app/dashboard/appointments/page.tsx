"use client";
import { useEffect, useState } from "react";
import { appointmentsApi } from "@/lib/api";
import { Appointment, AppointmentStatus } from "@/types";
import toast from "react-hot-toast";

// ── Design tokens ─────────────────────────────────────────────────────────────
const G    = "#1B4332";
const GOLD = "#D4AF37";

// ── Status config ─────────────────────────────────────────────────────────────
const STATUS: Record<AppointmentStatus, { label: string; color: string; bg: string; border: string }> = {
  pending:   { label: "⏳ En attente",  color: "#92400E", bg: "#FFFBEB", border: "#FDE68A" },
  confirmed: { label: "✅ Confirmé",    color: "#065F46", bg: "#ECFDF5", border: "#6EE7B7" },
  done:      { label: "🏁 Terminé",     color: "#1E40AF", bg: "#EFF6FF", border: "#BFDBFE" },
  cancelled: { label: "❌ Annulé",      color: "#991B1B", bg: "#FEF2F2", border: "#FECACA" },
};

const TABS: { key: string; label: string }[] = [
  { key: "all",       label: "Tous" },
  { key: "pending",   label: "⏳ En attente" },
  { key: "confirmed", label: "✅ Confirmés" },
  { key: "done",      label: "🏁 Terminés" },
];

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(diff / 86400000);
  if (m < 1)   return "À l'instant";
  if (m < 60)  return `Il y a ${m} min`;
  if (h < 24)  return `Il y a ${h}h`;
  if (d === 1) return "Hier";
  return new Date(dateStr).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
}

function formatScheduled(dateStr?: string | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("fr-FR", {
    weekday: "short", day: "2-digit", month: "long",
    hour: "2-digit", minute: "2-digit",
  });
}

// ── Empty state ───────────────────────────────────────────────────────────────
function EmptyState() {
  return (
    <div style={{
      background: "white", borderRadius: 20, border: "1px solid #E5E7EB",
      padding: "72px 40px", textAlign: "center",
    }}>
      <div style={{ fontSize: 60, marginBottom: 16 }}>📅</div>
      <h2 style={{ fontSize: 20, fontWeight: 800, color: G, marginBottom: 8 }}>
        Prêt pour votre premier rendez-vous ?
      </h2>
      <p style={{ color: "#6B7280", maxWidth: 360, margin: "0 auto", lineHeight: 1.6 }}>
        Quand un client demande un rendez-vous sur WhatsApp, il apparaîtra ici automatiquement.
      </p>
    </div>
  );
}

// ── Detail panel ──────────────────────────────────────────────────────────────
function DetailPanel({
  appt, onClose, onConfirm, onDone, onCancel, acting,
}: {
  appt: Appointment;
  onClose: () => void;
  onConfirm: (id: string) => Promise<void>;
  onDone: (id: string) => Promise<void>;
  onCancel: (id: string) => Promise<void>;
  acting: string | null;
}) {
  const st = STATUS[appt.status];
  const canConfirm = appt.status === "pending";
  const canDone    = appt.status === "confirmed";
  const canCancel  = appt.status === "pending" || appt.status === "confirmed";
  const isActing   = acting === appt.id;

  return (
    <div style={{
      width: 360, flexShrink: 0, background: "white",
      border: "1px solid #E5E7EB", borderRadius: 20,
      boxShadow: "0 8px 32px rgba(0,0,0,0.08)",
      position: "sticky", top: 20, maxHeight: "calc(100vh - 40px)",
      display: "flex", flexDirection: "column", overflow: "hidden",
    }}>
      {/* Header */}
      <div style={{
        padding: "18px 22px", borderBottom: "1px solid #E5E7EB",
        background: "#FFFCF5", flexShrink: 0,
        display: "flex", justifyContent: "space-between", alignItems: "center",
      }}>
        <div>
          <p style={{ fontSize: 11, color: "#9CA3AF", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>Rendez-vous</p>
          <h3 style={{ fontSize: 17, fontWeight: 900, color: G, marginTop: 2 }}>{appt.service_name}</h3>
        </div>
        <button onClick={onClose} style={{
          background: "#E5E7EB", border: "none", borderRadius: "50%",
          width: 30, height: 30, cursor: "pointer", fontSize: 14,
          display: "flex", alignItems: "center", justifyContent: "center", color: "#6B7280",
        }}>✕</button>
      </div>

      <div style={{ padding: 22, overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: 18 }}>

        {/* Status badge */}
        <span style={{
          display: "inline-block", padding: "6px 16px", borderRadius: 100,
          fontSize: 13, fontWeight: 700,
          color: st.color, background: st.bg, border: `1px solid ${st.border}`,
          alignSelf: "flex-start",
        }}>
          {st.label}
        </span>

        {/* Client info */}
        <div style={{ background: "#F9FAFB", borderRadius: 14, padding: 16 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>Client</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            {appt.customer_name && (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 16 }}>👤</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: G }}>{appt.customer_name}</span>
              </div>
            )}
            {appt.customer_phone && (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 16 }}>📞</span>
                <a href={`tel:${appt.customer_phone}`} style={{ fontSize: 14, color: GOLD, fontWeight: 700, textDecoration: "none" }}>
                  {appt.customer_phone}
                </a>
              </div>
            )}
            {!appt.customer_name && !appt.customer_phone && (
              <p style={{ fontSize: 13, color: "#9CA3AF", fontStyle: "italic" }}>Informations non collectées</p>
            )}
          </div>
        </div>

        {/* Appointment details */}
        <div style={{ background: "#F9FAFB", borderRadius: 14, padding: 16 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>Détails</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", gap: 8 }}>
              <span>🛠️</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: G }}>{appt.service_name}</span>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <span>📅</span>
              <span style={{ fontSize: 14, color: "#374151" }}>{formatScheduled(appt.scheduled_at)}</span>
            </div>
            {appt.duration_minutes && (
              <div style={{ display: "flex", gap: 8 }}>
                <span>⏱️</span>
                <span style={{ fontSize: 14, color: "#374151" }}>{appt.duration_minutes} minutes</span>
              </div>
            )}
            {appt.price && (
              <div style={{ display: "flex", gap: 8 }}>
                <span>💰</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: G }}>{appt.price}</span>
              </div>
            )}
            {appt.notes && (
              <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                <span>📝</span>
                <span style={{ fontSize: 13, color: "#6B7280", lineHeight: 1.5 }}>{appt.notes}</span>
              </div>
            )}
          </div>
        </div>

        {/* Action buttons */}
        {canConfirm && (
          <div style={{ background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: 14, padding: 16 }}>
            <p style={{ fontSize: 13, color: "#065F46", marginBottom: 12, lineHeight: 1.5, fontWeight: 600 }}>
              📲 Le client recevra un message WhatsApp de confirmation.
            </p>
            <button
              onClick={() => onConfirm(appt.id)}
              disabled={isActing}
              style={{
                width: "100%", padding: 14, borderRadius: 12,
                background: isActing ? "#9CA3AF" : G, color: "white",
                border: "none", fontWeight: 900, fontSize: 15,
                cursor: isActing ? "not-allowed" : "pointer",
                boxShadow: isActing ? "none" : "0 4px 14px rgba(27,67,50,.25)",
              }}
            >
              {isActing ? "En cours…" : "✅ Confirmer le rendez-vous"}
            </button>
          </div>
        )}

        {canDone && (
          <button
            onClick={() => onDone(appt.id)}
            disabled={isActing}
            style={{
              width: "100%", padding: 14, borderRadius: 12,
              background: isActing ? "#9CA3AF" : "#1E40AF", color: "white",
              border: "none", fontWeight: 900, fontSize: 14,
              cursor: isActing ? "not-allowed" : "pointer",
            }}
          >
            {isActing ? "En cours…" : "🏁 Marquer comme terminé"}
          </button>
        )}

        {canCancel && (
          <button
            onClick={() => onCancel(appt.id)}
            disabled={isActing}
            style={{
              width: "100%", padding: 12, borderRadius: 12,
              background: "white", color: "#991B1B",
              border: "2px solid #FECACA", fontWeight: 700, fontSize: 14,
              cursor: isActing ? "not-allowed" : "pointer",
            }}
          >
            {isActing ? "En cours…" : "❌ Annuler ce rendez-vous"}
          </button>
        )}

        <p style={{ fontSize: 12, color: "#9CA3AF", textAlign: "center" }}>
          Reçu le {new Date(appt.created_at).toLocaleDateString("fr-FR", {
            day: "2-digit", month: "long", hour: "2-digit", minute: "2-digit",
          })}
        </p>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function AppointmentsPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading]   = useState(true);
  const [selected, setSelected] = useState<Appointment | null>(null);
  const [filter, setFilter]     = useState("all");
  const [acting, setActing]     = useState<string | null>(null);

  const load = () =>
    appointmentsApi.list()
      .then(res => setAppointments(res.data))
      .catch(() => toast.error("Impossible de charger les rendez-vous."))
      .finally(() => setLoading(false));

  useEffect(() => { load(); }, []);

  const handleConfirm = async (id: string) => {
    setActing(id);
    try {
      const res = await appointmentsApi.confirm(id);
      const updated: Appointment = res.data;
      toast.success("✅ Rendez-vous confirmé ! WhatsApp envoyé au client.");
      setAppointments(prev => prev.map(a => a.id === id ? updated : a));
      setSelected(updated);
    } catch { toast.error("Erreur lors de la confirmation."); }
    finally { setActing(null); }
  };

  const handleDone = async (id: string) => {
    setActing(id);
    try {
      const res = await appointmentsApi.markDone(id);
      const updated: Appointment = res.data;
      toast.success("🏁 Rendez-vous terminé !");
      setAppointments(prev => prev.map(a => a.id === id ? updated : a));
      setSelected(updated);
    } catch { toast.error("Erreur."); }
    finally { setActing(null); }
  };

  const handleCancel = async (id: string) => {
    if (!confirm("Annuler ce rendez-vous ?")) return;
    setActing(id);
    try {
      const res = await appointmentsApi.cancel(id);
      const updated: Appointment = res.data;
      toast.success("❌ Rendez-vous annulé.");
      setAppointments(prev => prev.map(a => a.id === id ? updated : a));
      setSelected(updated);
    } catch { toast.error("Erreur."); }
    finally { setActing(null); }
  };

  const pendingCount = appointments.filter(a => a.status === "pending").length;

  const filtered = filter === "all"
    ? appointments
    : appointments.filter(a => a.status === filter);

  const tabCounts: Record<string, number> = {
    all:       appointments.length,
    pending:   appointments.filter(a => a.status === "pending").length,
    confirmed: appointments.filter(a => a.status === "confirmed").length,
    done:      appointments.filter(a => a.status === "done").length,
  };

  return (
    <div style={{ maxWidth: 1280, margin: "0 auto", padding: "24px 20px" }}>
      <style>{`
        .appt-row { transition: background 0.15s; cursor: pointer; }
        .appt-row:hover { background: #FFFCF5 !important; }
        .appt-row.sel { background: #FFFCF5 !important; }
        .ftab { padding: 8px 16px; border-radius: 100px; border: 1px solid #E5E7EB; background: white; cursor: pointer; font-size: 13px; font-weight: 600; color: #6B7280; transition: all 0.2s; }
        .ftab:hover { border-color: ${GOLD}; color: ${GOLD}; }
        .ftab.on { background: ${G}; color: white; border-color: ${G}; }
      `}</style>

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 12 }}>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 900, color: G, marginBottom: 4 }}>Rendez-vous</h1>
            <p style={{ color: "#6B7280", fontSize: 14 }}>Gérez les demandes de vos clients.</p>
          </div>
          {pendingCount > 0 && (
            <div style={{
              background: "#FFFBEB", border: "1px solid #FDE68A",
              borderRadius: 12, padding: "10px 16px",
            }}>
              <span style={{ fontSize: 13, color: "#92400E", fontWeight: 700 }}>
                ⏳ {pendingCount} rendez-vous à confirmer
              </span>
            </div>
          )}
        </div>

        <div style={{ display: "flex", gap: 8, marginTop: 18, flexWrap: "wrap" }}>
          {TABS.map(tab => (
            <button
              key={tab.key}
              className={`ftab${filter === tab.key ? " on" : ""}`}
              onClick={() => setFilter(tab.key)}
            >
              {tab.label}
              {tabCounts[tab.key] > 0 && (
                <span style={{
                  marginLeft: 6, borderRadius: 100, padding: "1px 7px", fontSize: 11, fontWeight: 800,
                  background: filter === tab.key ? "rgba(255,255,255,0.25)" : "#F3F4F6",
                  color: filter === tab.key ? "white" : "#6B7280",
                }}>
                  {tabCounts[tab.key]}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: "100px 0", color: "#6B7280" }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
          Chargement des rendez-vous…
        </div>
      ) : appointments.length === 0 ? <EmptyState /> : (
        <div style={{ display: "flex", gap: 24, alignItems: "flex-start" }}>

          {/* Table */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              background: "white", borderRadius: 20, border: "1px solid #E5E7EB",
              boxShadow: "0 2px 12px rgba(0,0,0,0.04)", overflow: "hidden",
            }}>
              {filtered.length === 0 ? (
                <div style={{ padding: "60px 40px", textAlign: "center", color: "#6B7280" }}>
                  Aucun rendez-vous dans cette catégorie.
                </div>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "#F9FAFB", borderBottom: "1px solid #E5E7EB" }}>
                      {["Service", "Client", "Date souhaitée", "Prix", "Statut", "Reçu"].map(h => (
                        <th key={h} style={{
                          padding: "13px 18px", textAlign: "left",
                          fontSize: 11, color: "#9CA3AF", fontWeight: 700,
                          textTransform: "uppercase", letterSpacing: 0.5,
                        }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(a => {
                      const st = STATUS[a.status];
                      const isSel = selected?.id === a.id;
                      return (
                        <tr
                          key={a.id}
                          className={`appt-row${isSel ? " sel" : ""}`}
                          onClick={() => setSelected(isSel ? null : a)}
                          style={{ borderBottom: "1px solid #E5E7EB" }}
                        >
                          <td style={{ padding: "15px 18px" }}>
                            <p style={{ fontWeight: 800, color: G, fontSize: 14 }}>{a.service_name}</p>
                          </td>
                          <td style={{ padding: "15px 18px" }}>
                            {a.customer_name ? (
                              <div>
                                <p style={{ fontWeight: 700, color: "#111827", fontSize: 14 }}>{a.customer_name}</p>
                                {a.customer_phone && (
                                  <p style={{ color: GOLD, fontSize: 12, marginTop: 2, fontWeight: 600 }}>{a.customer_phone}</p>
                                )}
                              </div>
                            ) : <span style={{ color: "#9CA3AF", fontStyle: "italic", fontSize: 13 }}>—</span>}
                          </td>
                          <td style={{ padding: "15px 18px" }}>
                            <p style={{ fontSize: 13, color: "#374151" }}>{formatScheduled(a.scheduled_at)}</p>
                          </td>
                          <td style={{ padding: "15px 18px" }}>
                            <p style={{ fontWeight: 700, color: a.price ? G : "#9CA3AF", fontSize: 14 }}>
                              {a.price || "—"}
                            </p>
                          </td>
                          <td style={{ padding: "15px 18px" }}>
                            <span style={{
                              display: "inline-block", padding: "4px 12px", borderRadius: 100,
                              fontSize: 11, fontWeight: 700,
                              color: st.color, background: st.bg, border: `1px solid ${st.border}`,
                            }}>
                              {st.label}
                            </span>
                          </td>
                          <td style={{ padding: "15px 18px", color: "#9CA3AF", fontSize: 13 }}>
                            {timeAgo(a.created_at)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Detail panel */}
          {selected && (
            <DetailPanel
              appt={selected}
              onClose={() => setSelected(null)}
              onConfirm={handleConfirm}
              onDone={handleDone}
              onCancel={handleCancel}
              acting={acting}
            />
          )}
        </div>
      )}
    </div>
  );
}