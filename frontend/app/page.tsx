"use client";
import React from "react";
import Chatbot from "@/components/Chatbot";

export default function Page() {
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@600;700;800&family=DM+Sans:wght@400;500;600;700&display=swap');

        :root {
          --green: #1a5c38;
          --green-dark: #0e3822;
          --green-mid: #1e6b41;
          --green-light: #2a8050;
          --gold: #c9a227;
          --gold-light: #e4b93a;
          --gold-pale: #f5e9c0;
          --white: #ffffff;
          --off-white: #f9f7f2;
          --cream: #f3efe6;
          --text-dark: #111b14;
          --text-muted: #556b5e;
          --border: #ddd8cb;
        }

        * { margin: 0; padding: 0; box-sizing: border-box; }

        body {
          font-family: 'DM Sans', sans-serif;
          background: var(--white);
          color: var(--text-dark);
          overflow-x: hidden;
        }

        /* ─── NAV ─── */
        nav {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 64px;
          background: var(--white);
          border-bottom: 1px solid var(--border);
          position: sticky;
          top: 0;
          z-index: 100;
        }

        .logo-area {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .logo-text {
          font-family: 'Cormorant Garamond', serif;
          font-size: 1.7rem;
          font-weight: 800;
          color: var(--green);
          letter-spacing: -0.5px;
        }

        .logo-text span { color: var(--gold); }

        nav ul {
          list-style: none;
          display: flex;
          gap: 36px;
          align-items: center;
        }

        nav ul li a {
          text-decoration: none;
          color: var(--text-muted);
          font-weight: 500;
          font-size: 0.92rem;
          transition: color 0.2s;
          letter-spacing: 0.01em;
        }

        nav ul li a:hover { color: var(--green); }

        .nav-cta {
          background: var(--green) !important;
          color: var(--white) !important;
          padding: 10px 24px;
          border-radius: 8px;
          font-weight: 700 !important;
          transition: background 0.2s !important;
        }

        .nav-cta:hover { background: var(--green-light) !important; color: var(--white) !important; }

        /* ─── HERO ─── */
        .hero-section {
          background: var(--off-white);
          padding: 72px 64px 64px;
        }

        .hero-inner {
          max-width: 1280px;
          margin: 0 auto;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 64px;
          align-items: center;
        }

        .hero-badge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background: var(--gold-pale);
          color: var(--green-dark);
          font-size: 0.72rem;
          font-weight: 700;
          padding: 5px 14px;
          border-radius: 20px;
          margin-bottom: 20px;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          border: 1px solid var(--gold);
        }

        .hero h1 {
          font-family: 'Cormorant Garamond', serif;
          font-size: 3.4rem;
          font-weight: 700;
          color: var(--green-dark);
          line-height: 1.1;
          margin-bottom: 20px;
          letter-spacing: -0.5px;
        }

        .hero h1 em {
          font-style: italic;
          color: var(--gold);
        }

        .hero-desc {
          font-size: 1.05rem;
          color: var(--text-muted);
          line-height: 1.75;
          margin-bottom: 32px;
          max-width: 480px;
        }

        .hero-actions {
          display: flex;
          align-items: center;
          gap: 16px;
          margin-bottom: 40px;
          flex-wrap: wrap;
        }

        .btn-primary {
          display: inline-block;
          background: var(--green);
          color: var(--white);
          font-weight: 700;
          font-size: 0.95rem;
          padding: 15px 32px;
          border-radius: 10px;
          text-decoration: none;
          box-shadow: 0 4px 16px rgba(26,92,56,0.25);
          transition: transform 0.2s, box-shadow 0.2s;
          letter-spacing: 0.01em;
        }

        .btn-primary:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(26,92,56,0.3);
        }

        .btn-secondary {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          color: var(--green);
          font-weight: 600;
          font-size: 0.92rem;
          text-decoration: none;
          border-bottom: 2px solid var(--gold);
          padding-bottom: 2px;
          transition: color 0.2s;
        }

        .btn-secondary:hover { color: var(--gold); }

        .hero-stats {
          display: flex;
          gap: 32px;
          flex-wrap: wrap;
        }

        .stat-item {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .stat-number {
          font-family: 'Cormorant Garamond', serif;
          font-size: 2rem;
          font-weight: 700;
          color: var(--green-dark);
          line-height: 1;
        }

        .stat-label {
          font-size: 0.78rem;
          color: var(--text-muted);
          font-weight: 500;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        /* Hero Right */
        .hero-visual {
          position: relative;
        }

        .hero-img-wrap {
          position: relative;
          border-radius: 20px;
          overflow: hidden;
          box-shadow: 0 24px 64px rgba(14,56,34,0.18);
        }

        .hero-main-img {
          width: 100%;
          display: block;
          border-radius: 20px;
          object-fit: cover;
          max-height: 580px;
        }

        .hero-bubble {
          position: absolute;
          bottom: -18px;
          left: -24px;
          background: var(--white);
          border-radius: 14px;
          padding: 14px 18px;
          box-shadow: 0 8px 32px rgba(0,0,0,0.12);
          display: flex;
          align-items: center;
          gap: 12px;
          max-width: 280px;
          border-left: 4px solid var(--gold);
        }

        .bubble-avatar {
          width: 42px;
          height: 42px;
          border-radius: 50%;
          background: var(--green);
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 800;
          font-size: 1.1rem;
          color: white;
          flex-shrink: 0;
          border: 2px solid var(--gold);
        }

        .bubble-text {
          font-size: 0.78rem;
          color: var(--text-muted);
          line-height: 1.45;
        }

        .bubble-name {
          font-weight: 700;
          font-size: 0.8rem;
          color: var(--green-dark);
          margin-top: 4px;
        }

        /* ─── SECTION COMMON ─── */
        .section-label {
          display: inline-block;
          font-size: 0.7rem;
          font-weight: 700;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: var(--gold);
          margin-bottom: 10px;
        }

        .section-title {
          font-family: 'Cormorant Garamond', serif;
          font-size: 2.4rem;
          font-weight: 700;
          color: var(--green-dark);
          line-height: 1.15;
          margin-bottom: 16px;
        }

        .section-sub {
          font-size: 1rem;
          color: var(--text-muted);
          line-height: 1.7;
          max-width: 560px;
          margin-bottom: 56px;
        }

        /* ─── INCLUSION SECTION ─── */
        .inclusion-section {
          padding: 88px 64px;
          background: var(--green-dark);
          color: var(--white);
        }

        .inclusion-inner {
          max-width: 860px;
          margin: 0 auto;
          text-align: center;
        }

        .inclusion-section .section-label { color: var(--gold); display: block; margin-bottom: 12px; }
        .inclusion-section .section-title { color: var(--white); margin-bottom: 20px; }

        .inclusion-desc {
          font-size: 1.05rem;
          color: rgba(255,255,255,0.72);
          line-height: 1.8;
          margin-bottom: 40px;
          max-width: 640px;
          margin-left: auto;
          margin-right: auto;
        }

        .lang-row {
          display: flex;
          justify-content: center;
          gap: 20px;
          flex-wrap: wrap;
        }

        .lang-card {
          background: rgba(255,255,255,0.07);
          border: 1px solid rgba(255,255,255,0.15);
          border-radius: 14px;
          padding: 24px 32px;
          min-width: 200px;
          text-align: center;
        }

        .lang-card-flag {
          font-size: 2rem;
          margin-bottom: 8px;
          display: block;
        }

        .lang-card-name {
          font-weight: 700;
          font-size: 1rem;
          color: var(--gold);
          margin-bottom: 6px;
        }

        .lang-card-phonetic {
          font-size: 0.82rem;
          color: rgba(255,255,255,0.55);
          font-style: italic;
          line-height: 1.5;
        }

        /* ─── HOW IT WORKS ─── */
        .how-section {
          padding: 88px 64px;
          background: var(--cream);
        }

        .how-inner {
          max-width: 1000px;
          margin: 0 auto;
          text-align: center;
        }

        .how-inner .section-sub {
          margin: 0 auto 56px;
        }

        .steps {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 0;
          position: relative;
        }

        .steps::before {
          content: '';
          position: absolute;
          top: 44px;
          left: calc(16.6% + 20px);
          right: calc(16.6% + 20px);
          height: 2px;
          background: var(--gold);
          z-index: 0;
        }

        .step {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 18px;
          padding: 0 24px;
          position: relative;
          z-index: 1;
        }

        .step-num {
          width: 88px;
          height: 88px;
          border-radius: 50%;
          background: var(--white);
          border: 2px solid var(--gold);
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: 'Cormorant Garamond', serif;
          font-size: 1.8rem;
          font-weight: 700;
          color: var(--green-dark);
          box-shadow: 0 4px 16px rgba(0,0,0,0.08);
        }

        .step-title {
          font-weight: 700;
          font-size: 1rem;
          color: var(--green-dark);
          line-height: 1.35;
        }

        .step-desc {
          font-size: 0.86rem;
          color: var(--text-muted);
          line-height: 1.6;
        }

        /* ─── FEATURES ─── */
        .features-section {
          padding: 88px 64px;
          background: var(--white);
        }

        .features-inner {
          max-width: 1200px;
          margin: 0 auto;
        }

        .features-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 24px;
        }

        .feature-card {
          border: 1.5px solid var(--border);
          border-radius: 16px;
          padding: 32px 26px;
          background: var(--white);
          transition: box-shadow 0.25s, transform 0.25s, border-color 0.25s;
          position: relative;
          overflow: hidden;
        }

        .feature-card::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 3px;
          background: var(--gold);
          transform: scaleX(0);
          transition: transform 0.25s;
        }

        .feature-card:hover {
          box-shadow: 0 12px 36px rgba(0,0,0,0.09);
          transform: translateY(-4px);
          border-color: var(--gold);
        }

        .feature-card:hover::before { transform: scaleX(1); }

        .feature-icon {
          font-size: 2.2rem;
          margin-bottom: 16px;
          display: block;
        }

        .feature-card h3 {
          font-weight: 700;
          font-size: 1rem;
          color: var(--green-dark);
          margin-bottom: 10px;
          line-height: 1.35;
        }

        .feature-card p {
          font-size: 0.86rem;
          color: var(--text-muted);
          line-height: 1.65;
        }

        /* ─── TESTIMONIALS ─── */
        .testimonials-section {
          padding: 88px 64px;
          background: var(--off-white);
        }

        .testimonials-inner {
          max-width: 1100px;
          margin: 0 auto;
        }

        .testimonials-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 24px;
        }

        .tcard {
          background: var(--white);
          border-radius: 16px;
          padding: 30px 26px;
          border-top: 3px solid var(--gold);
          box-shadow: 0 2px 16px rgba(0,0,0,0.06);
          transition: transform 0.2s;
        }

        .tcard:hover { transform: translateY(-4px); }

        .tcard-stars {
          color: var(--gold);
          font-size: 0.9rem;
          margin-bottom: 14px;
          letter-spacing: 2px;
        }

        .tcard-quote {
          font-size: 0.9rem;
          color: var(--text-dark);
          line-height: 1.75;
          margin-bottom: 20px;
          font-style: italic;
        }

        .tcard-author {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .tcard-avatar {
          width: 44px;
          height: 44px;
          border-radius: 50%;
          background: var(--green);
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 800;
          font-size: 1rem;
          color: var(--white);
          flex-shrink: 0;
          border: 2px solid var(--gold);
        }

        .tcard-name {
          font-weight: 700;
          font-size: 0.88rem;
          color: var(--green-dark);
        }

        .tcard-role {
          font-size: 0.76rem;
          color: var(--text-muted);
          margin-top: 2px;
        }

        /* ─── TECH STRIP ─── */
        .tech-strip {
          background: var(--cream);
          padding: 48px 64px;
          border-top: 1px solid var(--border);
          border-bottom: 1px solid var(--border);
        }

        .tech-strip-inner {
          max-width: 1000px;
          margin: 0 auto;
          text-align: center;
        }

        .tech-strip p {
          font-size: 0.82rem;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.1em;
          font-weight: 600;
          margin-bottom: 24px;
        }

        .tech-logos {
          display: flex;
          justify-content: center;
          gap: 32px;
          flex-wrap: wrap;
          align-items: center;
        }

        .tech-pill {
          background: var(--white);
          border: 1.5px solid var(--border);
          border-radius: 50px;
          padding: 8px 20px;
          font-size: 0.82rem;
          font-weight: 700;
          color: var(--green-dark);
          display: flex;
          align-items: center;
          gap: 6px;
        }

        /* ─── CTA BANNER ─── */
        .cta-section {
          background: linear-gradient(135deg, var(--green-dark) 0%, var(--green-mid) 60%, var(--green-dark) 100%);
          padding: 96px 64px;
          text-align: center;
          color: var(--white);
          position: relative;
          overflow: hidden;
        }

        .cta-section::before {
          content: '';
          position: absolute;
          top: -120px;
          right: -120px;
          width: 400px;
          height: 400px;
          border-radius: 50%;
          background: rgba(201,162,39,0.08);
        }

        .cta-section::after {
          content: '';
          position: absolute;
          bottom: -80px;
          left: -80px;
          width: 320px;
          height: 320px;
          border-radius: 50%;
          background: rgba(201,162,39,0.06);
        }

        .cta-section .section-label { color: var(--gold); display: block; margin-bottom: 12px; }

        .cta-section h2 {
          font-family: 'Cormorant Garamond', serif;
          font-size: 3rem;
          font-weight: 700;
          margin-bottom: 18px;
          line-height: 1.15;
        }

        .cta-section p {
          font-size: 1.05rem;
          opacity: 0.75;
          max-width: 520px;
          margin: 0 auto 40px;
          line-height: 1.75;
        }

        .cta-actions {
          display: flex;
          gap: 16px;
          justify-content: center;
          flex-wrap: wrap;
        }

        .btn-gold {
          display: inline-block;
          background: var(--gold);
          color: var(--white);
          font-weight: 700;
          font-size: 1rem;
          padding: 16px 40px;
          border-radius: 10px;
          text-decoration: none;
          box-shadow: 0 6px 24px rgba(201,162,39,0.35);
          transition: transform 0.2s, box-shadow 0.2s;
        }

        .btn-gold:hover {
          transform: translateY(-3px);
          box-shadow: 0 12px 36px rgba(201,162,39,0.45);
        }

        .btn-outline-white {
          display: inline-block;
          background: transparent;
          color: var(--white);
          font-weight: 600;
          font-size: 1rem;
          padding: 15px 36px;
          border-radius: 10px;
          text-decoration: none;
          border: 2px solid rgba(255,255,255,0.4);
          transition: border-color 0.2s, background 0.2s;
        }

        .btn-outline-white:hover {
          border-color: rgba(255,255,255,0.7);
          background: rgba(255,255,255,0.07);
        }

        /* ─── FOOTER ─── */
        footer {
          background: var(--green-dark);
          color: rgba(255,255,255,0.55);
          padding: 40px 64px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 16px;
        }

        .footer-logo {
          font-family: 'Cormorant Garamond', serif;
          font-size: 1.3rem;
          font-weight: 700;
          color: white;
        }

        .footer-logo span { color: var(--gold); }

        footer p { font-size: 0.82rem; }

        .footer-links {
          display: flex;
          gap: 24px;
        }

        .footer-links a {
          color: rgba(255,255,255,0.55);
          text-decoration: none;
          font-size: 0.82rem;
          transition: color 0.2s;
        }

        .footer-links a:hover { color: var(--gold); }

        /* ─── WA FLOAT ─── */
        .wa-float {
          position: fixed;
          bottom: 28px;
          right: 28px;
          width: 60px;
          height: 60px;
          background: #25d366;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 6px 24px rgba(0,0,0,0.2);
          cursor: pointer;
          z-index: 999;
          transition: transform 0.2s;
        }

        .wa-float:hover { transform: scale(1.1); }

        html { scroll-behavior: smooth; }

        /* ─── RESPONSIVE ─── */
        @media (max-width: 960px) {
          nav { padding: 16px 24px; }
          nav ul { display: none; }
          .hero-inner { grid-template-columns: 1fr; gap: 40px; padding: 0; }
          .hero-section, .inclusion-section, .how-section, .features-section,
          .testimonials-section, .tech-strip, .cta-section { padding: 56px 24px; }
          .steps { grid-template-columns: 1fr; }
          .steps::before { display: none; }
          .features-grid, .testimonials-grid { grid-template-columns: 1fr; }
          footer { flex-direction: column; text-align: center; padding: 32px 24px; }
          .hero h1 { font-size: 2.4rem; }
          .cta-section h2 { font-size: 2.2rem; }
          .hero-bubble { position: relative; bottom: auto; left: auto; margin-top: 20px; }
        }
      `}</style>

      {/* ─── NAV ─── */}
      <nav>
        <div className="logo-area">
          <svg width="42" height="42" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
            <circle cx="50" cy="46" r="44" fill="#1a5c38"/>
            <path d="M18 82 Q14 94 28 90 L38 76 Q28 80 18 82Z" fill="#1a5c38"/>
            <path d="M30 32 Q26 24 34 20 Q40 16 44 22 L44 62 Q40 66 34 62 Q26 56 28 48 Q24 44 26 38 Q24 34 30 32Z" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round"/>
            <path d="M56 22 Q60 16 66 20 Q74 24 70 32 Q76 34 74 38 Q76 44 72 48 Q74 56 66 62 Q60 66 56 62 L56 22Z" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round"/>
            <line x1="50" y1="22" x2="50" y2="62" stroke="white" strokeWidth="2.5"/>
            <path d="M20 46 Q28 38 36 46 Q44 54 52 46 Q60 38 68 46 Q76 52 82 46" fill="none" stroke="#c9a227" strokeWidth="3.5" strokeLinecap="round"/>
            <circle cx="20" cy="46" r="4" fill="#c9a227"/>
            <circle cx="82" cy="46" r="10" fill="none" stroke="#c9a227" strokeWidth="3"/>
            <path d="M77 46 L80 49 L87 42" fill="none" stroke="#c9a227" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span className="logo-text">Sugu<span>AI</span></span>
        </div>
        <ul>
          <li><a href="#accueil">Accueil</a></li>
          <li><a href="#fonctionnalites">Fonctionnalités</a></li>
          <li><a href="#comment-ca-marche">Comment ça marche</a></li>
          <li><a href="#temoignages">À Propos</a></li>
          <li><a href="/login" className="nav-cta">Démarrer gratuitement</a></li>
        </ul>
      </nav>

      {/* ─── HERO ─── */}
      <section id="accueil" className="hero-section">
        <div className="hero-inner">
          <div className="hero">
            <div className="hero-badge">🇲🇱 Conçu pour les commerçants maliens</div>
            <h1>
              Votre commerce, ouvert<br/>
              <em>24h/24</em>, sans effort
            </h1>
            <p className="hero-desc">
              SuguAI transforme votre WhatsApp en un assistant commercial intelligent. 
              Il répond à vos clients, confirme les commandes, gère les paiements 
              et envoie vos promotions même quand vous dormez.
            </p>
            <div className="hero-actions">
              <a href="/login" className="btn-primary">Créer mon assistant IA →</a>
              <a href="#" className="btn-secondary">📹 Voir la démo</a>
            </div>
            <div className="hero-stats">
              <div className="stat-item">
                <div className="stat-number">24/7</div>
                <div className="stat-label">Disponibilité</div>
              </div>
              <div className="stat-item">
                <div className="stat-number">-70%</div>
                <div className="stat-label">Appels manqués</div>
              </div>
              <div className="stat-item">
                <div className="stat-number">+3×</div>
                <div className="stat-label">Ventes confirmées</div>
              </div>
            </div>
          </div>
          <div className="hero-visual">
            <div className="hero-img-wrap">
              <img
                className="hero-main-img"
                src="/hero.png"
                alt="Commerçant utilisant SuguAI sur WhatsApp"
              />
            </div>
            <div className="hero-bubble">
              <div className="bubble-avatar">F</div>
              <div>
                <div className="bubble-text">
                  «Je me réveille chaque matin avec des commandes déjà confirmées. SuguAI ne dort jamais.»
                </div>
                <div className="bubble-name">Fatoumata D. Bamako</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── LANGUAGE INCLUSION ─── */}
      <section className="inclusion-section">
        <div className="inclusion-inner">
          <span className="section-label">Inclusion & accessibilité</span>
          <h2 className="section-title">
            SuguAI parle votre langue
          </h2>
          <p className="inclusion-desc">
            Nous savons que le Bambara est la langue du commerce au Mali. SuguAI est le 
            premier assistant IA formé pour comprendre et répondre en <strong style={{color: 'white'}}>Bambara phonétique</strong> et 
            en <strong style={{color: 'white'}}>français</strong> comme vous le parlez réellement, 
            sans formalité, sans barrière.
          </p>
          <div className="lang-row">
            <div className="lang-card">
              <span className="lang-card-flag">🇲🇱</span>
              <div className="lang-card-name">Bambara</div>
              <div className="lang-card-phonetic">
                «I ka kɛnɛ?» · «Jɔli b'a la?»<br/>
                «A bɛ yen»
              </div>
            </div>
            <div className="lang-card">
              <span className="lang-card-flag">🇫🇷</span>
              <div className="lang-card-name">Français</div>
              <div className="lang-card-phonetic">
                «C'est combien?» · «C'est disponible?»<br/>
                «Je veux commander»
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── HOW IT WORKS ─── */}
      <section id="comment-ca-marche" className="how-section">
        <div className="how-inner">
          <div className="section-label">Mise en service rapide</div>
          <h2 className="section-title">Opérationnel en 3 étapes</h2>
          <p className="section-sub">
            Pas d'application à télécharger, pas de formation technique. 
            SuguAI s'installe directement dans votre WhatsApp habituel.
          </p>
          <div className="steps">
            <div className="step">
              <div className="step-num">01</div>
              <div className="step-title">Connectez votre WhatsApp</div>
              <div className="step-desc">Scannez un QR code depuis votre téléphone. Votre numéro existant est conservé, rien ne change pour vos clients.</div>
            </div>
            <div className="step">
              <div className="step-num">02</div>
              <div className="step-title">Décrivez votre boutique</div>
              <div className="step-desc">Renseignez vos produits, vos prix et vos horaires de livraison par écrit ou par message vocal en Bambara.</div>
            </div>
            <div className="step">
              <div className="step-num">03</div>
              <div className="step-title">L'IA prend le relais</div>
              <div className="step-desc">Dès la première seconde, SuguAI répond à vos clients, confirme les commandes et envoie les rappels de paiement à votre place.</div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── FEATURES ─── */}
      <section id="fonctionnalites" className="features-section">
        <div className="features-inner">
          <div className="section-label">Ce que SuguAI fait pour vous</div>
          <h2 className="section-title">Un assistant complet,<br/>pas juste un chatbot</h2>
          <p className="section-sub">
            SuguAI prend en charge l'intégralité de votre relation client, 
            de la première question à la livraison finale.
          </p>
          <div className="features-grid">
            {[
              {
                icon: "🛒",
                title: "Tunnel de vente automatisé",
                desc: "SuguAI accueille vos clients, présente vos produits, répond aux questions sur les prix et les stocks, et guide chaque acheteur jusqu'à la commande sans que vous ayez à intervenir."
              },
              {
                icon: "💸",
                title: "Paiements Mobile Money & COD",
                desc: "Générez des liens de paiement, vérifiez automatiquement les transactions et gérez les paiements à la livraison (COD). Compatible Orange Money, Moov Money et espèces."
              },
              {
                icon: "📋",
                title: "Confirmations de commande instantanées",
                desc: "Chaque commande passée génère une confirmation automatique avec récapitulatif, numéro de référence et instructions de livraison envoyés directement au client."
              },
              {
                icon: "📦",
                title: "Suivi des livraisons en temps réel",
                desc: "Tenez vos clients informés à chaque étape : préparation, expédition, livraison. Réduisez les appels entrants de 70% grâce aux notifications proactives."
              },
              {
                icon: "📣",
                title: "Campagnes promotionnelles automatiques",
                desc: "Programmez vos soldes, nouveautés et offres spéciales à l'avance. SuguAI les envoie au bon moment à toute votre liste de clients WhatsApp."
              },
              {
                icon: "📊",
                title: "Tableau de bord & Rapports",
                desc: "Suivez en temps réel vos ventes, le volume de messages traités, les commandes en cours et les performances de votre assistant IA depuis un tableau de bord simple et clair."
              }
            ].map((f, i) => (
              <div className="feature-card" key={i}>
                <span className="feature-icon">{f.icon}</span>
                <h3>{f.title}</h3>
                <p>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── TECH STRIP ─── */}
      <div className="tech-strip">
        <div className="tech-strip-inner">
          <p>Technologies de pointe au cœur de SuguAI</p>
          <div className="tech-logos">
            {[
              { icon: "🧠", label: "Claude 3.5 (Anthropic)" },
              { icon: "🎙️", label: "Faster-Whisper" },
              { icon: "🌍", label: "Meta MMS" },
              { icon: "⚡", label: "FastAPI" },
              { icon: "💬", label: "WhatsApp Business API" },
            ].map((t, i) => (
              <div className="tech-pill" key={i}>{t.icon} {t.label}</div>
            ))}
          </div>
        </div>
      </div>

      {/* ─── TESTIMONIALS ─── */}
      <section id="temoignages" className="testimonials-section">
        <div className="testimonials-inner">
          <div className="section-label">Témoignages</div>
          <h2 className="section-title">Des commerçants maliens<br/>qui ont transformé leur business</h2>
          <p className="section-sub" style={{marginBottom: '48px'}}>
            Ils ont fait confiance à SuguAI. Voici ce qu'ils en disent.
          </p>
          <div className="testimonials-grid">
            {[
              {
                initial: "K",
                name: "Koné Mamadou",
                role: "Propriétaire de boutique, Ségou",
                stars: "★★★★★",
                quote: "Avant SuguAI, je ratais des clients chaque nuit. Maintenant mon assistant répond en Bambara à 3h du matin et je me réveille avec des commandes déjà confirmées. C'est révolutionnaire."
              },
              {
                initial: "F",
                name: "Fatoumata Diallo",
                role: "Vendeuse de tissu en ligne, Bamako",
                stars: "★★★★★",
                quote: "Je ne savais pas trop me servir d'un ordinateur. Avec SuguAI j'ai tout configuré en envoyant des messages vocaux. En deux jours mes ventes avaient déjà doublé."
              },
              {
                initial: "I",
                name: "Ibrahim Traoré",
                role: "E-commerce & livraison, Mopti",
                stars: "★★★★★",
                quote: "Le suivi des paiements COD est exceptionnel. Mes livreurs, mes clients et moi sommes tous synchronisés automatiquement. Je recommande SuguAI à tous les entrepreneurs maliens."
              }
            ].map((t, i) => (
              <div className="tcard" key={i}>
                <div className="tcard-stars">{t.stars}</div>
                <div className="tcard-quote">«{t.quote}»</div>
                <div className="tcard-author">
                  <div className="tcard-avatar">{t.initial}</div>
                  <div>
                    <div className="tcard-name">{t.name}</div>
                    <div className="tcard-role">{t.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── CTA ─── */}
      <section className="cta-section">
        <span className="section-label">Rejoignez le mouvement</span>
        <h2>Votre commerce mérite<br/>de ne jamais dormir</h2>
        <p>
          Des centaines de commerçants maliens utilisent déjà SuguAI pour 
          vendre plus, mieux et sans stress. Rejoignez-les dès aujourd'hui.
        </p>
        <div className="cta-actions">
          <a href="/login" className="btn-gold">Créer mon assistant gratuitement →</a>
          <a href="#" className="btn-outline-white">Voir une démo en direct</a>
        </div>
      </section>

      {/* ─── FOOTER ─── */}
      <footer>
        <div>
          <div className="footer-logo">Sugu<span>AI</span></div>
          <p style={{marginTop: '6px'}}>Un produit Mali Diawara Digital & Software (DDS)</p>
        </div>
        <p>© 2026 SuguAI. Tous droits réservés.</p>
        <div className="footer-links">
          <a href="#">Confidentialité</a>
          <a href="#">Conditions d'utilisation</a>
          <a href="#">Contact</a>
        </div>
      </footer>

      {/* ─── WhatsApp Float ─── */}
      <div className="wa-float" title="Discutez avec SuguAI sur WhatsApp">
        <Chatbot />
      </div>
    </>
  );
}
