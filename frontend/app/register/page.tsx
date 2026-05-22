"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { authApi } from "@/lib/api";
import Cookies from "js-cookie";
import Link from "next/link";
import Image from "next/image";

type Step = "form" | "otp" | "creating";

/* ── Country list ─────────────────────────────────────────────────────────── */
const COUNTRIES = [
  { code: "ML", dial: "223", flag: "🇲🇱", name: "Mali" },
  { code: "SN", dial: "221", flag: "🇸🇳", name: "Sénégal" },
  { code: "CI", dial: "225", flag: "🇨🇮", name: "Côte d'Ivoire" },
  { code: "GN", dial: "224", flag: "🇬🇳", name: "Guinée" },
  { code: "BF", dial: "226", flag: "🇧🇫", name: "Burkina Faso" },
  { code: "NE", dial: "227", flag: "🇳🇪", name: "Niger" },
  { code: "MR", dial: "222", flag: "🇲🇷", name: "Mauritanie" },
  { code: "TG", dial: "228", flag: "🇹🇬", name: "Togo" },
  { code: "BJ", dial: "229", flag: "🇧🇯", name: "Bénin" },
  { code: "GH", dial: "233", flag: "🇬🇭", name: "Ghana" },
  { code: "NG", dial: "234", flag: "🇳🇬", name: "Nigeria" },
  { code: "CM", dial: "237", flag: "🇨🇲", name: "Cameroun" },
  { code: "FR", dial: "33",  flag: "🇫🇷", name: "France" },
];

/* ── 9 business types ─────────────────────────────────────────────────────── */
const BUSINESS_TYPES = [
  {
    value: "products_seller",
    icon: "🛒",
    label: "Je vends des produits",
    sub: "Habits, téléphones, nourriture, beauté…",
    color: "#1B4332",
    bg: "#F0FDF4",
    border: "#BBF7D0",
  },
  {
    value: "fnb",
    icon: "🍽️",
    label: "Restaurant / Café",
    sub: "Plats à manger, boissons, traiteur…",
    color: "#9A3412",
    bg: "#FFF7ED",
    border: "#FED7AA",
  },
  {
    value: "transport",
    icon: "🚌",
    label: "Transport / Voyages",
    sub: "Bus, minibus, taxi, billets ville à ville…",
    color: "#1E3A5F",
    bg: "#EFF6FF",
    border: "#BFDBFE",
  },
  {
    value: "health",
    icon: "🏥",
    label: "Santé / Clinique",
    sub: "Médecin, pharmacie, laboratoire, clinique…",
    color: "#065F46",
    bg: "#ECFDF5",
    border: "#6EE7B7",
  },
  {
    value: "education",
    icon: "📚",
    label: "École / Formation",
    sub: "Cours, école, université, formation pro…",
    color: "#1E40AF",
    bg: "#EFF6FF",
    border: "#BFDBFE",
  },
  {
    value: "real_estate",
    icon: "🏠",
    label: "Immobilier",
    sub: "Location, vente maison, terrain, agence…",
    color: "#92400E",
    bg: "#FFFBEB",
    border: "#FDE68A",
  },
  {
    value: "events",
    icon: "🎉",
    label: "Événementiel",
    sub: "DJ, photographe, décoration, mariage…",
    color: "#6B21A8",
    bg: "#FAF5FF",
    border: "#E9D5FF",
  },
  {
    value: "service_information",
    icon: "✂️",
    label: "Services à la personne",
    sub: "Coiffure, couture, réparation, coaching…",
    color: "#1E40AF",
    bg: "#EFF6FF",
    border: "#BFDBFE",
  },
  {
    value: "custom",
    icon: "🤖",
    label: "Autre / Bot d'information",
    sub: "Je veux juste un assistant pour répondre aux questions",
    color: "#374151",
    bg: "#F9FAFB",
    border: "#E5E7EB",
  },
];

export default function RegisterPage() {
  const router = useRouter();
  const [step, setStep]             = useState<Step>("form");
  const [country, setCountry]       = useState(COUNTRIES[0]);
  const [showDial, setShowDial]     = useState(false);
  const [localPhone, setLocalPhone] = useState("");
  const [form, setForm] = useState({
    name: "", password: "", business_type: "products_seller",
  });
  const [otp, setOtp]           = useState(["","","","","",""]);
  const [loading, setLoading]   = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [showPass, setShowPass] = useState(false);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading || !localPhone) return;
    setLoading(true);
    try {
      const phone = `${country.dial}${localPhone.replace(/\D/g, "")}`;
      await authApi.sendOtp(phone);
      setStep("otp");
      setResendCooldown(60);
      toast.success("Code envoyé sur WhatsApp ! 📲");
      setTimeout(() => otpRefs.current[0]?.focus(), 300);
    } catch (err: any) {
      const status = err.response?.status;
      const detail = err.response?.data?.detail || "";
      if (status === 400 && detail.includes("déjà enregistré")) {
        toast.error("❌ Ce numéro est déjà inscrit. Connectez-vous à la place.");
        setTimeout(() => router.push("/login"), 2000);
      } else if (status === 503) {
        toast.error("📵 Ce numéro n'existe pas sur WhatsApp ou n'est pas joignable. Vérifiez le numéro.", { duration: 5000 });
      } else if (status === 429) {
        toast.error("⏰ Trop de tentatives. Attendez quelques minutes.");
      } else {
        toast.error(detail || "Erreur. Vérifiez votre numéro et réessayez.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (i: number, val: string) => {
    if (!/^\d*$/.test(val)) return;
    const next = [...otp]; next[i] = val.slice(-1); setOtp(next);
    if (val && i < 5) otpRefs.current[i + 1]?.focus();
    if (val && i === 5 && next.every(d => d) && !loading)
      handleVerifyOtp(next.join(""));
  };

  const handleVerifyOtp = async (code?: string) => {
    if (loading) return;
    const finalCode = code || otp.join("");
    if (finalCode.length < 6) { toast.error("Entrez les 6 chiffres."); return; }
    setLoading(true);
    try {
      const phone = `${country.dial}${localPhone.replace(/\D/g, "")}`;
      await authApi.verifyOtp(phone, finalCode);
      setStep("creating");
      const res = await authApi.register({ ...form, phone_number: phone });
      if (res.data?.access_token) {
        Cookies.set("access_token", res.data.access_token, { expires: 7 });
        toast.success("Bienvenue chez SuguAI ! 🎉");
        router.push("/dashboard");
      }
    } catch (err: any) {
      const status = err.response?.status;
      const detail = err.response?.data?.detail || "";
      if (status === 400 && detail.includes("invalide")) {
        toast.error("❌ Code incorrect. Vérifiez et réessayez.");
        setOtp(["","","","","",""]);
        setTimeout(() => otpRefs.current[0]?.focus(), 100);
      } else if (status === 400 && detail.includes("expiré")) {
        toast.error("⏰ Code expiré. Demandez un nouveau code.");
        setStep("otp");
        setOtp(["","","","","",""]);
      } else if (status === 403) {
        toast.error("⚠️ Numéro non vérifié. Recommencez depuis le début.");
        setStep("form");
      } else {
        toast.error(detail || "Erreur de vérification.");
      }
      setStep("otp");
    } finally {
      setLoading(false);
    }
  };

  const STEPS = [
    { n: 1, icon: "📝", label: "Vos infos" },
    { n: 2, icon: "📱", label: "Vérification" },
    { n: 3, icon: "🚀", label: "C'est parti !" },
  ];
  const currentStep = step === "form" ? 1 : step === "otp" ? 2 : 3;
  const selectedType = BUSINESS_TYPES.find(t => t.value === form.business_type);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&family=Baloo+2:wght@400;600;700;800&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Nunito', sans-serif; }

        .reg-root {
          min-height: 100vh;
          background: linear-gradient(135deg, #0d3320 0%, #1B4332 50%, #2d6a4f 100%);
          display: flex; align-items: center; justify-content: center;
          padding: 24px 16px; position: relative; overflow: hidden;
        }
        .reg-root::before, .reg-root::after {
          content: ""; position: absolute; border-radius: 50%;
          background: rgba(212,175,55,0.07); pointer-events: none;
        }
        .reg-root::before { width: 600px; height: 600px; top: -200px; right: -150px; }
        .reg-root::after  { width: 400px; height: 400px; bottom: -150px; left: -100px; }

        .reg-card {
          width: 100%; max-width: 1020px; background: #fff; border-radius: 28px;
          box-shadow: 0 32px 80px rgba(0,0,0,0.3); overflow: hidden;
          position: relative; z-index: 1;
          animation: slideUp .5s cubic-bezier(.22,1,.36,1) both;
        }
        @keyframes slideUp { from{opacity:0;transform:translateY(40px)} to{opacity:1;transform:translateY(0)} }

        .reg-layout { display: grid; grid-template-columns: 260px 1fr; min-height: 600px; }

        .reg-left {
          background: linear-gradient(180deg, #1B4332 0%, #0d3320 100%);
          padding: 40px 28px; display: flex; flex-direction: column; justify-content: space-between;
        }
        .reg-step-item {
          display: flex; align-items: center; gap: 12px;
          padding: 12px 14px; border-radius: 14px; transition: background .25s;
        }
        .reg-step-item.active { background: rgba(212,175,55,.18); }
        .reg-step-item.done   { background: rgba(212,175,55,.08); }
        .reg-step-bubble {
          width: 36px; height: 36px; border-radius: 50%; flex-shrink: 0;
          display: flex; align-items: center; justify-content: center; font-size: 17px;
          background: rgba(255,255,255,.08); border: 2px solid transparent; transition: all .25s;
        }
        .reg-step-item.active .reg-step-bubble { background: #D4AF37; border-color: #D4AF37; }
        .reg-step-item.done   .reg-step-bubble { background: rgba(212,175,55,.3); border-color: rgba(212,175,55,.5); }
        .reg-step-label h4 { font-size: 13px; font-weight: 700; color: #fff; }
        .reg-step-label p  { font-size: 11px; color: rgba(255,255,255,.45); margin-top:1px; }

        .reg-right { padding: 36px 44px; display: flex; flex-direction: column; justify-content: center; overflow-y: auto; }
        .reg-title { font-family:'Baloo 2',sans-serif; font-size:26px; font-weight:800; color:#1B4332; margin-bottom:4px; }
        .reg-sub   { font-size:14px; color:#6B7280; margin-bottom:24px; }

        .reg-input {
          width:100%; padding:13px 16px; background:#F9FAFB;
          border:2px solid #E5E7EB; border-radius:12px; color:#1B4332;
          font-family:'Nunito',sans-serif; font-size:15px; font-weight:600;
          outline:none; transition:border-color .2s, box-shadow .2s;
        }
        .reg-input:focus { border-color:#D4AF37; box-shadow:0 0 0 4px rgba(212,175,55,.12); }
        .reg-input.filled { border-color:#2d6a4f; }
        .reg-label { display:flex; align-items:center; gap:6px; font-size:13px; font-weight:700; color:#374151; margin-bottom:7px; }

        /* 3-column grid for 9 types */
        .biz-cards { display:grid; grid-template-columns:1fr 1fr 1fr; gap:9px; }
        .biz-card {
          border:2px solid #E5E7EB; border-radius:14px; padding:13px 10px;
          cursor:pointer; transition:all .2s; text-align:center; background:#F9FAFB;
        }
        .biz-card .biz-icon { font-size:28px; margin-bottom:6px; display:block; }
        .biz-card h4 { font-size:12px; font-weight:800; color:#1B4332; margin-bottom:3px; line-height:1.3; }
        .biz-card p  { font-size:10px; color:#6B7280; line-height:1.3; }
        .biz-card.selected { transform:scale(1.03); }

        .reg-phone-row { display:flex; gap:10px; }
        .reg-dial-btn {
          display:flex; align-items:center; gap:8px; padding:12px 14px;
          background:#F9FAFB; border:2px solid #E5E7EB; border-radius:12px;
          cursor:pointer; white-space:nowrap;
          font-family:'Nunito',sans-serif; font-size:14px; font-weight:700; color:#1B4332;
          transition:border-color .2s; flex-shrink:0;
        }
        .reg-dial-btn:hover { border-color:#D4AF37; }
        .reg-dial-dropdown {
          position:absolute; z-index:50; top:calc(100% + 6px); left:0;
          width:250px; background:#fff; border:2px solid #E5E7EB; border-radius:14px;
          box-shadow:0 16px 40px rgba(0,0,0,.14); max-height:260px; overflow-y:auto;
          animation:dropDown .18s ease both;
        }
        @keyframes dropDown { from{opacity:0;transform:translateY(-8px)} to{opacity:1;transform:translateY(0)} }
        .reg-dial-option {
          display:flex; align-items:center; gap:10px; padding:10px 14px;
          cursor:pointer; transition:background .15s; font-size:13px; font-weight:600; color:#1B4332;
        }
        .reg-dial-option:hover { background:#F0FDF4; }
        .reg-dial-option small { color:#6B7280; font-size:12px; margin-left:auto; }

        .reg-btn {
          width:100%; padding:15px; margin-top:18px;
          background:linear-gradient(135deg,#D4AF37,#b8952a);
          border:none; border-radius:14px; color:#fff;
          font-family:'Baloo 2',sans-serif; font-size:17px; font-weight:800;
          cursor:pointer; display:flex; align-items:center; justify-content:center; gap:10px;
          box-shadow:0 6px 20px rgba(212,175,55,.4); transition:all .15s;
        }
        .reg-btn:hover:not(:disabled) { transform:translateY(-2px); }
        .reg-btn:disabled { opacity:.7; cursor:not-allowed; }

        .reg-otp-row { display:flex; gap:10px; justify-content:center; margin:24px 0; }
        .reg-otp-box {
          width:50px; height:58px; background:#F9FAFB; border:2.5px solid #E5E7EB;
          border-radius:14px; color:#1B4332; font-size:24px; font-weight:800;
          text-align:center; outline:none; font-family:'Baloo 2',sans-serif;
          transition:border-color .2s, box-shadow .2s;
        }
        .reg-otp-box:focus { border-color:#D4AF37; box-shadow:0 0 0 4px rgba(212,175,55,.15); }
        .reg-otp-box.filled { border-color:#1B4332; }
        .reg-otp-btn {
          width:100%; padding:16px; background:linear-gradient(135deg,#1B4332,#2d6a4f);
          border:none; border-radius:14px; color:#fff;
          font-family:'Baloo 2',sans-serif; font-size:17px; font-weight:800;
          cursor:pointer; display:flex; align-items:center; justify-content:center; gap:10px;
          box-shadow:0 6px 20px rgba(27,67,50,.3); transition:all .15s;
        }
        .reg-otp-btn:hover:not(:disabled) { transform:translateY(-2px); }
        .reg-otp-btn:disabled { opacity:.7; cursor:not-allowed; }

        .reg-tip {
          background:#F0FDF4; border:1px solid #BBF7D0; border-radius:12px;
          padding:12px 14px; display:flex; gap:10px; align-items:flex-start; margin-top:14px;
        }
        .reg-tip p { font-size:13px; color:#166534; font-weight:600; }

        .reg-creating { text-align:center; padding:60px 20px; }
        .reg-creating .big-emoji { font-size:64px; margin-bottom:20px; animation:bounce 1s infinite; }
        @keyframes bounce { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-12px)} }
        .reg-creating h3 { font-family:'Baloo 2',sans-serif; font-size:22px; font-weight:800; color:#1B4332; }

        .reg-pass-wrap { position:relative; }
        .reg-pass-toggle { position:absolute; right:14px; top:50%; transform:translateY(-50%); background:none; border:none; cursor:pointer; font-size:18px; }

        .reg-login { text-align:center; margin-top:16px; font-size:13px; color:#6B7280; }
        .reg-login a { color:#1B4332; font-weight:700; }

        .reg-feature { display:flex; align-items:center; gap:10px; margin-bottom:10px; }
        .reg-feature-icon { width:30px; height:30px; border-radius:8px; background:rgba(212,175,55,.15); display:flex; align-items:center; justify-content:center; font-size:14px; flex-shrink:0; }
        .reg-feature p { font-size:12px; color:rgba(255,255,255,.65); font-weight:600; }

        @media (max-width:700px) {
          .reg-layout { grid-template-columns:1fr; }
          .reg-left { display:none; }
          .reg-right { padding:28px 20px; }
          .biz-cards { grid-template-columns:1fr 1fr; }
        }
        @media (max-width:440px) {
          .biz-cards { grid-template-columns:1fr 1fr; }
        }
      `}</style>

      <div className="reg-root">
        <div className="reg-card">
          <div className="reg-layout">

            {/* ── LEFT ── */}
            <div className="reg-left">
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 32 }}>
                  <Image src="/logo.jpeg" alt="SuguAI" width={48} height={48} style={{ borderRadius: 12 }} />
                  <div>
                    <h2 style={{ fontFamily: "'Baloo 2'", fontSize: 20, fontWeight: 800, color: "#D4AF37", margin: 0 }}>SuguAI</h2>
                    <p style={{ fontSize: 11, color: "rgba(255,255,255,.5)" }}>Votre assistant WhatsApp</p>
                  </div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {STEPS.map(s => (
                    <div key={s.n} className={`reg-step-item ${currentStep === s.n ? "active" : currentStep > s.n ? "done" : ""}`}>
                      <div className="reg-step-bubble">{currentStep > s.n ? "✓" : s.icon}</div>
                      <div className="reg-step-label">
                        <h4>Étape {s.n} — {s.label}</h4>
                        <p>{s.n === 1 ? "Remplissez vos infos" : s.n === 2 ? "Code sur WhatsApp" : "Votre compte est prêt"}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ borderTop: "1px solid rgba(255,255,255,.1)", paddingTop: 20, marginTop: 28 }}>
                {[
                  { icon: "🔒", text: "Données protégées" },
                  { icon: "📲", text: "Fonctionne sur WhatsApp" },
                  { icon: "🆓", text: "100% Gratuit" },
                ].map((f, i) => (
                  <div className="reg-feature" key={i}>
                    <div className="reg-feature-icon">{f.icon}</div>
                    <p>{f.text}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* ── RIGHT ── */}
            <div className="reg-right">

              {/* STEP 1 */}
              {step === "form" && (
                <>
                  <div className="reg-title">Créer votre compte</div>
                  <p className="reg-sub">C'est rapide  1 minute maximum !</p>

                  <form onSubmit={handleSendOtp}>

                    {/* Name + password */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 18 }}>
                      <div>
                        <label className="reg-label">Nom de votre Entreprise</label>
                        <input
                          required
                          className={`reg-input${form.name ? " filled" : ""}`}
                          placeholder="Ex:Entreprise Aminata"
                          value={form.name}
                          onChange={e => setForm({ ...form, name: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="reg-label">Mot de passe secret</label>
                        <div className="reg-pass-wrap">
                          <input
                            required type={showPass ? "text" : "password"}
                            className={`reg-input${form.password ? " filled" : ""}`}
                            placeholder="Minimum 6 caractères"
                            value={form.password}
                            onChange={e => setForm({ ...form, password: e.target.value })}
                            minLength={6}
                          />
                          <button type="button" className="reg-pass-toggle" onClick={() => setShowPass(p => !p)}>
                            {showPass ? "🙈" : "👁️"}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Business type — 9 cards, 3 columns */}
                    <div style={{ marginBottom: 18 }}>
                      <label className="reg-label" style={{ marginBottom: 10 }}>
                        Qu'est-ce que vous faites ?
                        <span style={{ fontSize: 12, color: "#9CA3AF", fontWeight: 400 }}> (choisissez une option)</span>
                      </label>
                      <div className="biz-cards">
                        {BUSINESS_TYPES.map(bt => (
                          <div
                            key={bt.value}
                            className={`biz-card${form.business_type === bt.value ? " selected" : ""}`}
                            style={{
                              borderColor: form.business_type === bt.value ? bt.color : "#E5E7EB",
                              background:  form.business_type === bt.value ? bt.bg : "#F9FAFB",
                              boxShadow:   form.business_type === bt.value ? `0 0 0 3px ${bt.color}22` : "none",
                            }}
                            onClick={() => setForm({ ...form, business_type: bt.value })}
                          >
                            {form.business_type === bt.value && (
                              <div style={{
                                display: "inline-block", width: 16, height: 16, borderRadius: "50%",
                                background: bt.color, color: "#fff", fontSize: 9,
                                lineHeight: "16px", textAlign: "center", marginBottom: 3,
                              }}>✓</div>
                            )}
                            <span className="biz-icon">{bt.icon}</span>
                            <h4 style={{ color: form.business_type === bt.value ? bt.color : "#1B4332" }}>{bt.label}</h4>
                            <p>{bt.sub}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Phone */}
                    <div style={{ marginBottom: 6 }}>
                      <label className="reg-label">Numéro WhatsApp</label>
                      <div className="reg-phone-row" style={{ position: "relative" }}>
                        <div style={{ position: "relative" }}>
                          <button type="button" className="reg-dial-btn" onClick={() => setShowDial(p => !p)}>
                            <span style={{ fontSize: 20 }}>{country.flag}</span>
                            <small style={{ fontSize: 13 }}>+{country.dial}</small>
                            <span style={{ fontSize: 10, color: "#9CA3AF" }}>▼</span>
                          </button>
                          {showDial && (
                            <div className="reg-dial-dropdown">
                              {COUNTRIES.map(c => (
                                <div key={c.code} className="reg-dial-option" onClick={() => { setCountry(c); setShowDial(false); }}>
                                  <span style={{ fontSize: 20 }}>{c.flag}</span>
                                  {c.name}
                                  <small>+{c.dial}</small>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                        <input
                          required type="tel"
                          className={`reg-input${localPhone ? " filled" : ""}`}
                          placeholder="Ex: 70 12 34 56"
                          value={localPhone}
                          onChange={e => setLocalPhone(e.target.value)}
                          style={{ flex: 1 }}
                        />
                      </div>
                    </div>

                    <div className="reg-tip">
                      <span>💬</span>
                      <p>Entrez votre numéro WhatsApp. Vous recevrez un code de confirmation par message.</p>
                    </div>

                    <button
                      type="submit" className="reg-btn"
                      disabled={loading || !localPhone || !form.name || !form.password}
                    >
                      {loading ? "⏳ Envoi du code…" : <> Recevoir mon code WhatsApp <span>→</span></>}
                    </button>
                  </form>

                  <div className="reg-login">
                    Déjà un compte ? <Link href="/login">Se connecter ici</Link>
                  </div>
                </>
              )}

              {/* STEP 2 — OTP */}
              {step === "otp" && (
                <>
                  <div className="reg-title">📲 Code de confirmation</div>
                  <p className="reg-sub">
                    Regardez WhatsApp sur le <strong>{country.flag} +{country.dial} {localPhone}</strong>
                  </p>

                  <div className="reg-tip" style={{ marginBottom: 8 }}>
                    <span>👀</span>
                    <p>Ouvrez WhatsApp et cherchez un message de SuguAI avec votre code à 6 chiffres.</p>
                  </div>

                  <div className="reg-otp-row">
                    {otp.map((d, i) => (
                      <input
                        key={i}
                        ref={el => { otpRefs.current[i] = el; }}
                        type="text" inputMode="numeric" maxLength={1} value={d}
                        className={`reg-otp-box${d ? " filled" : ""}`}
                        onChange={e => handleOtpChange(i, e.target.value)}
                        onKeyDown={e => { if (e.key === "Backspace" && !d && i > 0) otpRefs.current[i - 1]?.focus(); }}
                      />
                    ))}
                  </div>

                  <button
                    className="reg-otp-btn"
                    disabled={loading || otp.some(d => !d)}
                    onClick={() => handleVerifyOtp()}
                  >
                    {loading ? "⏳ Vérification…" : "✅ Confirmer le code"}
                  </button>

                  <div style={{ textAlign: "center", marginTop: 16, fontSize: 13, color: "#6B7280" }}>
                    {resendCooldown > 0
                      ? `⏰ Renvoyer dans ${resendCooldown}s`
                      : <><span>Pas reçu ? </span>
                          <button onClick={handleSendOtp as any} style={{ background: "none", border: "none", cursor: "pointer", color: "#1B4332", fontWeight: 700, fontSize: 13, textDecoration: "underline" }}>
                            Renvoyer le code
                          </button>
                        </>
                    }
                  </div>

                  <div className="reg-tip" style={{ marginTop: 14 }}>
                    <span>🔢</span>
                    <p>Tapez les 6 chiffres un par un. Le code est valable 5 minutes.</p>
                  </div>

                  <div style={{ textAlign: "center", marginTop: 14 }}>
                    <button
                      style={{ background: "none", border: "none", cursor: "pointer", color: "#6B7280", fontSize: 13 }}
                      onClick={() => setStep("form")}
                    >← Corriger mon numéro</button>
                  </div>
                </>
              )}

              {/* STEP 3 — CREATING */}
              {step === "creating" && (
                <div className="reg-creating">
                  <div className="big-emoji">{selectedType?.icon || "🚀"}</div>
                  <h3>On prépare votre compte…</h3>
                  <p style={{ color: "#6B7280", marginTop: 8 }}>Quelques secondes et vous êtes prêt !</p>
                </div>
              )}

            </div>
          </div>
        </div>
      </div>
    </>
  );
}