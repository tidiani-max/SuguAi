"use client";
import { useEffect, useState, useRef } from "react";
import { conversationsApi } from "@/lib/api";
import { Conversation, Message } from "@/types";
import toast from "react-hot-toast";

const STATE_LABEL: Record<string, string> = {
  browsing:             "👀 Regarde le catalogue",
  awaiting_payment:     "⏳ En attente de paiement",
  payment_verification: "🔍 Vérification reçu",
  completed:            "✅ Commande validée",
  human_takeover:       "🙋 Main libre",
};

const STATE_COLOR: Record<string, string> = {
  browsing:             "#3B82F6",
  awaiting_payment:     "#F59E0B",
  payment_verification: "#D97706",
  completed:            "#10B981",
  human_takeover:       "#EF4444",
};

export default function ConversationsPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selected, setSelected] = useState<Conversation | null>(null);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    conversationsApi.list()
      .then((r) => setConversations(r.data))
      .catch(() => toast.error("Erreur de chargement"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [selected?.messages]);

  const openConv = async (c: Conversation) => {
    try {
      const r = await conversationsApi.get(c.id);
      setSelected(r.data);
    } catch {
      toast.error("Impossible d'ouvrir la discussion");
    }
  };

  const toggleAI = async () => {
    if (!selected) return;
    try {
      const r = await conversationsApi.toggleTakeover(selected.id);
      setSelected({ ...selected, ai_enabled: r.data.ai_enabled });
      toast.success(r.data.ai_enabled ? "Robot réactivé" : "Relais humain activé");
    } catch {
      toast.error("Action impossible");
    }
  };

  return (
    <div style={{ height: "calc(100vh - 120px)", display: "flex", flexDirection: "column" }}>
      <header style={{ marginBottom: "24px" }}>
        <h1 style={{ fontSize: "24px", fontWeight: 800, color: "#1B4332", fontFamily: "var(--font-head)" }}>Conversations</h1>
        <p style={{ color: "#6B7280", fontSize: "14px" }}>Suivez les échanges automatiques de votre robot WhatsApp.</p>
      </header>

      <div style={{ flex: 1, display: "flex", gap: "24px", minHeight: 0 }}>
        
        {/* Sidebar: Liste des clients */}
        <div style={{ 
          width: "320px", background: "#FFF", border: "1px solid #E5E7EB", 
          borderRadius: "20px", display: "flex", flexDirection: "column", overflow: "hidden" 
        }}>
          <div style={{ padding: "16px", borderBottom: "1px solid #F3F4F6", fontWeight: 700, fontSize: "14px", color: "#1B4332" }}>
            Messages récents
          </div>
          <div style={{ flex: 1, overflowY: "auto" }}>
            {loading ? (
              <div style={{ padding: "20px", color: "#9CA3AF", textAlign: "center" }}>Chargement...</div>
            ) : conversations.map((c) => (
              <div 
                key={c.id}
                onClick={() => openConv(c)}
                style={{ 
                  padding: "16px", borderBottom: "1px solid #F9FAFB", cursor: "pointer",
                  background: selected?.id === c.id ? "#F0FDF4" : "transparent",
                  transition: "all 0.2s"
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                  <span style={{ fontWeight: 700, fontSize: "14px", color: "#111827" }}>
                    +{c.customer_name || c.customer_phone?.split('@')[0] || "Client"}
                  </span>
                  <span style={{ fontSize: "10px", color: "#9CA3AF" }}>
                    {new Date(c.last_message_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: STATE_COLOR[c.state] || "#CCC" }} />
                  <span style={{ fontSize: "12px", color: "#6B7280" }}>{STATE_LABEL[c.state]}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Main Chat Area */}
        <div style={{ 
          flex: 1, background: "#FFF", border: "1px solid #E5E7EB", 
          borderRadius: "20px", display: "flex", flexDirection: "column", overflow: "hidden" 
        }}>
          {!selected ? (
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", color: "#9CA3AF" }}>
              <div style={{ fontSize: "40px", marginBottom: "12px" }}>💬</div>
              <p>Sélectionnez une conversation pour voir l'historique</p>
            </div>
          ) : (
            <>
              {/* Chat Header */}
              <div style={{ padding: "16px 24px", borderBottom: "1px solid #F3F4F6", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <h3 style={{ fontWeight: 800, fontSize: "16px", color: "#1B4332" }}>
                    {selected.customer_name || "Client WhatsApp"}
                  </h3>
                  <span style={{ fontSize: "12px", color: "#6B7280" }}>+{selected.customer_phone?.split('@')[0]}</span>
                </div>
                <button 
                  onClick={toggleAI}
                  style={{ 
                    padding: "8px 16px", borderRadius: "10px", fontSize: "12px", fontWeight: 700,
                    border: "1px solid", cursor: "pointer", transition: "all 0.2s",
                    background: selected.ai_enabled ? "#FEF2F2" : "#ECFDF5",
                    color: selected.ai_enabled ? "#991B1B" : "#065F46",
                    borderColor: selected.ai_enabled ? "#FCA5A5" : "#6EE7B7"
                  }}
                >
                  {selected.ai_enabled ? "🙋 Prendre le relais" : "🤖 Réactiver l'IA"}
                </button>
              </div>

              {/* Messages List */}
              <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: "24px", display: "flex", flexDirection: "column", gap: "12px", background: "#FAFAFA" }}>
                {selected.messages?.map((msg) => {
                  const isOut = msg.direction === "outbound";
                  return (
                    <div key={msg.id} style={{ alignSelf: isOut ? "flex-end" : "flex-start", maxWidth: "80%" }}>
                      <div style={{ 
                        padding: "12px 16px", borderRadius: "16px", fontSize: "14px", lineHeight: "1.5",
                        background: isOut ? "#1B4332" : "#FFF",
                        color: isOut ? "#FFF" : "#1F2937",
                        boxShadow: isOut ? "0 4px 6px -1px rgba(27, 67, 50, 0.2)" : "0 1px 3px rgba(0,0,0,0.1)",
                        border: isOut ? "none" : "1px solid #E5E7EB",
                        borderBottomRightRadius: isOut ? "4px" : "16px",
                        borderBottomLeftRadius: !isOut ? "4px" : "16px"
                      }}>
                        {msg.content}
                        <div style={{ fontSize: "10px", marginTop: "4px", opacity: 0.7, textAlign: "right" }}>
                          {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          {isOut && " • SuguAI"}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Footer Notice */}
              <div style={{ padding: "12px", textAlign: "center", background: "#F9FAFB", borderTop: "1px solid #F3F4F6", fontSize: "12px", color: "#9CA3AF" }}>
                Répondez directement sur WhatsApp pour communiquer avec le client.
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}