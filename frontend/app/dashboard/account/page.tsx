"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Cookies from "js-cookie";
import { authApi } from "@/lib/api";
import { Business } from "@/types";

const BUSINESS_TYPE_LABELS: Record<string, string> = {
  products_seller:     "🛒 Vente de produits",
  service_information: "💼 Service / Information",
};

const STATUS_THEME: Record<string, { label: string; color: string; bg: string }> = {
  connected:     { label: "Opérationnel", color: "#1B4332", bg: "#D1FAE5" },
  not_connected: { label: "Non configuré", color: "#92400E", bg: "#FEF3C7" },
  suspended:     { label: "Suspendu",      color: "#991B1B", bg: "#FEE2E2" },
};

function InfoRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div style={{ 
      display: "flex", alignItems: "center", justifyContent: "space-between", 
      padding: "16px 0", borderBottom: "1px solid #F3F4F6" 
    }}>
      <span style={{ fontSize: "14px", fontWeight: 500, color: "#6B7280" }}>{label}</span>
      <span style={{ 
        fontSize: "14px", fontWeight: 600, color: "#111827", 
        fontFamily: mono ? "var(--font-mono)" : "inherit" 
      }}>
        {value || "—"}
      </span>
    </div>
  );
}

function DeleteModal({ onConfirm, onCancel, loading }: { onConfirm: () => void; onCancel: () => void; loading: boolean }) {
  const [input, setInput] = useState("");
  const confirmed = input.trim().toLowerCase() === "supprimer";

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(17, 24, 39, 0.7)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
      <div style={{ background: "#FFFFFF", borderRadius: "24px", padding: "32px", width: "100%", maxWidth: "400px", boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1)" }}>
        <h2 style={{ fontSize: "20px", fontWeight: 800, color: "#111827", marginBottom: "12px", fontFamily: "var(--font-head)" }}>Supprimer le compte ?</h2>
        <p style={{ fontSize: "14px", color: "#4B5563", lineHeight: "1.6", marginBottom: "20px" }}>
          Cette action effacera définitivement votre boutique **SuguAI**, vos produits et votre historique de vente.
        </p>

        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Tapez 'supprimer' pour confirmer"
          style={{
            width: "100%", padding: "14px", background: "#F9FAFB", border: "1px solid #E5E7EB",
            borderRadius: "12px", marginBottom: "24px", outline: "none", fontSize: "14px"
          }}
        />

        <div style={{ display: "flex", gap: "12px" }}>
          <button onClick={onCancel} style={{ flex: 1, padding: "12px", borderRadius: "12px", border: "1px solid #E5E7EB", background: "#FFF", fontWeight: 600, cursor: "pointer" }}>Annuler</button>
          <button 
            onClick={onConfirm} 
            disabled={!confirmed || loading}
            style={{ 
              flex: 1, padding: "12px", borderRadius: "12px", border: "none", 
              background: confirmed ? "#EF4444" : "#F3F4F6", color: "#FFF", 
              fontWeight: 700, cursor: confirmed ? "pointer" : "not-allowed" 
            }}
          >
            {loading ? "Suppression..." : "Confirmer"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AccountPage() {
  const [business, setBusiness] = useState<Business | null>(null);
  const [loading, setLoading] = useState(true);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    authApi.me()
      .then((res) => setBusiness(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return null;
  if (!business) return <p>Erreur.</p>;

  const status = STATUS_THEME[business.status] || STATUS_THEME.not_connected;

  return (
    <div style={{ maxWidth: "700px", animation: "fadeUp 0.4s ease-out" }}>
      <header style={{ marginBottom: "32px" }}>
        <h1 style={{ fontSize: "28px", fontWeight: 800, color: "#1B4332", fontFamily: "var(--font-head)" }}>Mon Compte</h1>
        <p style={{ color: "#6B7280" }}>Gérez l'identité de votre entreprise sur SuguAI.</p>
      </header>

      {/* Profile Header Card */}
      <div style={{ 
        background: "#FFF", border: "1px solid #E5E7EB", borderRadius: "24px", 
        padding: "32px", marginBottom: "24px", display: "flex", alignItems: "center", gap: "24px" 
      }}>
        <div style={{ 
          width: "80px", height: "80px", background: "#F3F4F6", borderRadius: "20px", 
          display: "flex", alignItems: "center", justifyContent: "center", fontSize: "32px",
          border: "1px solid #E5E7EB"
        }}>
          {business.business_type === "products_seller" ? "🛒" : "💼"}
        </div>
        <div>
          <h2 style={{ fontSize: "22px", fontWeight: 800, color: "#111827", marginBottom: "8px" }}>{business.name}</h2>
          <div style={{ display: "flex", gap: "8px" }}>
            <span style={{ 
              background: status.bg, color: status.color, padding: "4px 12px", 
              borderRadius: "20px", fontSize: "12px", fontWeight: 700 
            }}>
              {status.label}
            </span>
          </div>
        </div>
      </div>

      {/* Details Section */}
      <div style={{ background: "#FFF", border: "1px solid #E5E7EB", borderRadius: "24px", padding: "32px", marginBottom: "40px" }}>
        <h3 style={{ fontSize: "16px", fontWeight: 700, color: "#1B4332", marginBottom: "20px" }}>Détails de l'entreprise</h3>
        <InfoRow label="Nom légal" value={business.name} />
        <InfoRow label="Contact Propriétaire" value={business.phone_number} mono />
        <InfoRow label="Secteur d'activité" value={BUSINESS_TYPE_LABELS[business.business_type]} />
        <InfoRow label="Date d'inscription" value={new Date(business.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })} />
      </div>

      {/* Danger Zone */}
      <div style={{ borderTop: "1px solid #FEE2E2", paddingTop: "32px" }}>
        <h3 style={{ fontSize: "16px", fontWeight: 700, color: "#991B1B", marginBottom: "8px" }}>Zone de danger</h3>
        <p style={{ fontSize: "14px", color: "#6B7280", marginBottom: "20px" }}>
          La suppression de votre compte entraînera la perte immédiate de toutes vos données. Cette action ne peut pas être annulée.
        </p>
        <button 
          onClick={() => setShowDeleteModal(true)}
          style={{ 
            padding: "12px 24px", borderRadius: "12px", border: "1px solid #FCA5A5", 
            background: "#FEF2F2", color: "#991B1B", fontWeight: 700, cursor: "pointer",
            transition: "all 0.2s"
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "#FEE2E2")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "#FEF2F2")}
        >
          Supprimer définitivement mon compte
        </button>
      </div>

      {showDeleteModal && (
        <DeleteModal
          onCancel={() => setShowDeleteModal(false)}
          onConfirm={async () => {
            setDeleteLoading(true);
            try {
              await authApi.deleteAccount();
              Cookies.remove("access_token");
              router.push("/login");
            } catch (err) {
              setDeleteLoading(false);
            }
          }}
          loading={deleteLoading}
        />
      )}
    </div>
  );
}