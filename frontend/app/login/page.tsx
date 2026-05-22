"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { authApi } from "@/lib/api";
import Cookies from "js-cookie";
import Link from "next/link";
import Image from "next/image";

export default function LoginPage() {
  const router = useRouter();
  const [form, setForm] = useState({ phone_number: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Voice agent support
  useEffect(() => {
    const handler = (e: CustomEvent) => {
      const { action, field, value, path } = e.detail;
      if (action === "fill_field" && field && value !== undefined) {
        setForm((prev) => ({ ...prev, [field]: value }));
      }
      if (action === "submit_form") document.getElementById("login-submit")?.click();
      if (action === "navigate" && path) router.push(path);
    };
    window.addEventListener("voiceagent:action", handler as EventListener);
    return () => window.removeEventListener("voiceagent:action", handler as EventListener);
  }, [router]);

 const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  setErrorMsg("");
  setLoading(true);

  try {
    const res = await authApi.login(form);
    Cookies.set("access_token", res.data.access_token, { expires: 7 });
    toast.success("Content de vous revoir ! 🎉");
    router.push("/dashboard");
  } catch (err: any) {
    const status = err.response?.status;
    const detail = err.response?.data?.detail || "";

    if (status === 401) {
      setErrorMsg(" Numéro ou mot de passe incorrect.");
    } else if (status === 403 && detail.includes("suspendu")) {
      setErrorMsg(" Votre compte est suspendu. Contactez le support.");
    } else if (status === 429) {
      setErrorMsg("Trop de tentatives. Attendez 1 minute.");
    } else if (status === 404 || detail.includes("introuvable")) {
      setErrorMsg(" Numéro non reconnu. Créez un compte d'abord.");
    } else {
      setErrorMsg(detail || "Une erreur est survenue. Réessayez.");
    }
    toast.error("Échec de la connexion");
  } finally {
    setLoading(false);
  }
};

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&family=Baloo+2:wght@400;600;700;800&display=swap');

        .reg-root {
          min-height: 100vh;
          background: linear-gradient(135deg, #0d3320 0%, #1B4332 40%, #2d6a4f 100%);
          display: flex; align-items: center; justify-content: center;
          padding: 24px 16px; font-family: 'Nunito', sans-serif;
          position: relative; overflow: hidden;
        }

        .reg-card {
          width: 100%; max-width: 850px;
          background: #fff; border-radius: 28px;
          box-shadow: 0 32px 80px rgba(0,0,0,0.35);
          overflow: hidden; z-index: 1;
          animation: slideUp .5s cubic-bezier(.22,1,.36,1) both;
        }

        @keyframes slideUp { from { opacity:0; transform:translateY(40px); } to { opacity:1; transform:translateY(0); } }

        .reg-layout { display: grid; grid-template-columns: 300px 1fr; min-height: 500px; }

        .reg-left {
          background: linear-gradient(180deg, #1B4332 0%, #0d3320 100%);
          padding: 48px 36px; display: flex; flex-direction: column; justify-content: space-between;
        }

        .reg-left-brand { display: flex; align-items: center; gap: 14px; }
        .reg-left-brand h2 { font-family: 'Baloo 2', sans-serif; font-size: 24px; font-weight: 800; color: #D4AF37; }

        .reg-right { padding: 48px 40px; display: flex; flex-direction: column; justify-content: center; }
        .reg-right-title { font-family: 'Baloo 2', sans-serif; font-size: 28px; font-weight: 800; color: #1B4332; margin-bottom: 4px; }
        .reg-right-sub { font-size: 15px; color: #6B7280; margin-bottom: 32px; }

        .reg-field { margin-bottom: 20px; }
        .reg-field label { display: block; font-size: 13px; font-weight: 700; color: #374151; margin-bottom: 7px; }
        
        .reg-input {
          width: 100%; padding: 14px 16px;
          background: #F9FAFB; border: 2px solid #E5E7EB;
          border-radius: 12px; color: #1B4332; font-size: 15px; font-weight: 600; outline: none;
          transition: all .2s;
        }
        .reg-input:focus { border-color: #D4AF37; box-shadow: 0 0 0 4px rgba(212,175,55,.12); }

        .reg-pass-wrap { position: relative; }
        .reg-pass-toggle {
          position: absolute; right: 14px; top: 50%; transform: translateY(-50%);
          background: none; border: none; cursor: pointer; font-size: 18px;
        }

        .reg-btn {
          width: 100%; padding: 16px; margin-top: 10px;
          background: linear-gradient(135deg, #D4AF37, #b8952a);
          border: none; border-radius: 14px; color: #fff;
          font-family: 'Baloo 2', sans-serif; font-size: 17px; font-weight: 800;
          cursor: pointer; transition: transform .15s;
          box-shadow: 0 6px 20px rgba(212,175,55,.4);
        }
        .reg-btn:hover:not(:disabled) { transform: translateY(-2px); }
        .reg-btn:disabled { opacity: .7; cursor: not-allowed; }

        .reg-error {
          background: #FEF2F2; color: #B91C1C; padding: 12px;
          border-radius: 12px; font-size: 13px; font-weight: 600;
          margin-bottom: 20px; border: 1px solid #FEE2E2; text-align: center;
        }

        .reg-login-link { text-align: center; margin-top: 24px; font-size: 14px; color: #6B7280; }
        .reg-login-link a { color: #1B4332; font-weight: 700; text-decoration: none; }

        @media (max-width: 700px) {
          .reg-layout { grid-template-columns: 1fr; }
          .reg-left { display: none; }
          .reg-right { padding: 32px 24px; }
        }
      `}</style>

      <div className="reg-root">
        <div className="reg-card">
          <div className="reg-layout">
            
            {/* Left Panel */}
            <div className="reg-left">
              <div className="reg-left-brand">
                <Image src="/logo.jpeg" alt="Logo" width={50} height={50} style={{ borderRadius: "12px" }} />
                <div>
                  <h2>SuguAI</h2>
                  <p style={{ color: "rgba(255,255,255,0.6)", fontSize: "12px" }}>Gérez votre business simplement</p>
                </div>
              </div>
              
              <div style={{ marginBottom: "20px" }}>
                <div style={{ background: "rgba(212,175,55,0.1)", padding: "20px", borderRadius: "16px", border: "1px solid rgba(212,175,55,0.2)" }}>
                  <p style={{ color: "#D4AF37", fontWeight: 800, fontSize: "14px", marginBottom: "8px" }}>💡 Le saviez-vous ?</p>
                  <p style={{ color: "#fff", fontSize: "13px", lineHeight: "1.5", opacity: 0.9 }}>
                    Votre WhatsApp répond à vos messages et enregistre vos commandes pour vous. Vous n'avez plus qu'à les valider sur le site web SuguAi.
                  </p>
                </div>
              </div>
            </div>

            {/* Right Panel */}
            <div className="reg-right">
              <div className="reg-right-title">Ravi de vous revoir !</div>
              <p className="reg-right-sub">Connectez-vous pour accéder à votre boutique.</p>

              {errorMsg && (
  <div className="reg-error" style={{
    background: "#FEF2F2", color: "#B91C1C", padding: "14px 16px",
    borderRadius: 12, fontSize: 14, fontWeight: 600,
    marginBottom: 20, border: "1px solid #FEE2E2",
    display: "flex", alignItems: "center", gap: 10,
  }}>
    <span style={{ fontSize: 18, flexShrink: 0 }}>⚠️</span>
    <span>{errorMsg}</span>
  </div>
)}

              <form onSubmit={handleSubmit}>
                <div className="reg-field">
                  <label>Numéro WhatsApp</label>
                  <input
                    required
                    type="tel"
                    className="reg-input"
                    placeholder="Ex: +22370123456"
                    value={form.phone_number}
                    onChange={(e) => setForm({ ...form, phone_number: e.target.value })}
                  />
                </div>

                <div className="reg-field">
                  <label> Mot de passe</label>
                  <div className="reg-pass-wrap">
                    <input
                      required
                      type={showPass ? "text" : "password"}
                      className="reg-input"
                      placeholder="Votre mot de passe secret"
                      value={form.password}
                      onChange={(e) => setForm({ ...form, password: e.target.value })}
                    />
                    <button 
                      type="button" 
                      className="reg-pass-toggle" 
                      onClick={() => setShowPass(!showPass)}
                    >
                      {showPass ? "🙈" : "👁️"}
                    </button>
                  </div>
                </div>

                <button 
                  id="login-submit" 
                  type="submit" 
                  className="reg-btn" 
                  disabled={loading}
                >
                  {loading ? "Connexion en cours..." : "Se connecter →"}
                </button>
              </form>

              <div className="reg-login-link">
                Nouveau ici ? <Link href="/register">Créer mon compte en 2 min</Link>
              </div>
            </div>

          </div>
        </div>
      </div>
    </>
  );
}