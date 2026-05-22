"use client";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import Cookies from "js-cookie";
import { authApi } from "@/lib/api";
import { Business, BusinessType } from "@/types";
import Image from "next/image";

interface NavItem {
  href: string;
  label: string;
  icon: string;
}

function getNavItems(type: BusinessType): NavItem[] {
  const shared: NavItem[] = [
    { href: "/dashboard",               label: "Accueil",    icon: "🏠" },
    { href: "/dashboard/settings",      label: "Réglages",   icon: "⚙️" },
    { href: "/dashboard/conversations", label: "Messages",   icon: "💬" },
    { href: "/dashboard/promotions",    label: "Promotions", icon: "📢" },
    { href: "/dashboard/analytics",     label: "Analytique", icon: "📊" },
    { href: "/dashboard/account",       label: "Mon compte", icon: "👤" },
  ];

  if (type === "products_seller") {
    return [
      { href: "/dashboard",          label: "Accueil",   icon: "🏠" },
      { href: "/dashboard/products", label: "Produits",  icon: "📦" },
      { href: "/dashboard/orders",   label: "Commandes", icon: "💳" },
      ...shared.slice(1),
    ];
  }

  if (type === "fnb") {
    return [
      { href: "/dashboard",          label: "Accueil",   icon: "🏠" },
      { href: "/dashboard/products", label: "Menu",      icon: "🍽️" },
      { href: "/dashboard/orders",   label: "Commandes", icon: "🧾" },
      ...shared.slice(1),
    ];
  }

  if (type === "service_information") {
    return [
      { href: "/dashboard",              label: "Accueil",      icon: "🏠" },
      { href: "/dashboard/appointments", label: "Rendez-vous",  icon: "📅" },
      { href: "/dashboard/products",     label: "Mes services", icon: "🛠️" },
      ...shared.slice(1),
    ];
  }

  if (type === "health") {
    return [
      { href: "/dashboard",              label: "Accueil",      icon: "🏠" },
      { href: "/dashboard/appointments", label: "Rendez-vous",  icon: "📅" },
      { href: "/dashboard/products",     label: "Mes services", icon: "🏥" },
      ...shared.slice(1),
    ];
  }

  if (type === "education") {
    return [
      { href: "/dashboard",              label: "Accueil",      icon: "🏠" },
      { href: "/dashboard/appointments", label: "Rendez-vous",  icon: "📅" },
      { href: "/dashboard/products",     label: "Mes services", icon: "📚" },
      ...shared.slice(1),
    ];
  }

  if (type === "real_estate") {
    return [
      { href: "/dashboard",              label: "Accueil",      icon: "🏠" },
      { href: "/dashboard/appointments", label: "Rendez-vous",  icon: "📅" },
      { href: "/dashboard/products",     label: "Mes biens",    icon: "🏠" },
      ...shared.slice(1),
    ];
  }

  if (type === "events") {
    return [
      { href: "/dashboard",              label: "Accueil",         icon: "🏠" },
      { href: "/dashboard/appointments", label: "Réservations",    icon: "🎟️" },
      { href: "/dashboard/products",     label: "Mes événements",  icon: "🎉" },
      ...shared.slice(1),
    ];
  }

  if (type === "transport") {
    return [
      { href: "/dashboard",              label: "Accueil",      icon: "🏠" },
      { href: "/dashboard/appointments", label: "Réservations", icon: "📅" },
      { href: "/dashboard/products",     label: "Mes services", icon: "🚗" },
      ...shared.slice(1),
    ];
  }

  return shared;
}

const TYPE_LABELS: Record<BusinessType, string> = {
  products_seller:     "🛒 Vente",
  service_information: "💼 Services",
  fnb:                 "🍽️ Resto / Café",
  custom:              "🤖 Bot info",
  transport:           "🚗 Transport",
  health:              "🏥 Santé",
  education:           "📚 Éducation",
  real_estate:         "🏠 Immobilier",
  events:              "🎉 Événements",
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [business, setBusiness] = useState<Business | null>(null);
  const [loading, setLoading]   = useState(true);
  const router   = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const token = Cookies.get("access_token");
    if (!token) { router.push("/login"); return; }
    authApi.me()
      .then((res) => setBusiness(res.data))
      .catch(() => { Cookies.remove("access_token"); router.push("/login"); })
      .finally(() => setLoading(false));
  }, [router]);

  const logout = () => { Cookies.remove("access_token"); router.push("/login"); };

  if (loading || !business) return null;

  const isConnected = business.whatsapp_connected === true;
  const navItems    = getNavItems(business.business_type);
  const pageLabel   = navItems.find((n) => n.href === pathname)?.label || "Tableau de bord";

  return (
    <div className="dash-container">
      <style>{`
        .dash-container {
          display: flex;
          min-height: 100vh;
          background-color: #F3F4F6;
        }

        .dash-sidebar {
          width: 280px;
          height: 100vh;
          background: #0d3320;
          color: white;
          position: fixed;
          top: 0; left: 0;
          display: flex;
          flex-direction: column;
          z-index: 100;
        }

        .sidebar-header { padding: 28px 20px 20px; }

        .sidebar-logo {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 20px;
        }
        .sidebar-logo h2 {
          font-family: 'Baloo 2', sans-serif;
          font-size: 22px;
          font-weight: 800;
          margin: 0;
        }
        .sidebar-logo span { color: #D4AF37; }

        .biz-badge {
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.1);
          padding: 14px 16px;
          border-radius: 14px;
        }
        .biz-badge-name {
          font-size: 15px;
          font-weight: 700;
          margin: 0 0 6px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .biz-type-pill {
          display: inline-block;
          background: rgba(212,175,55,0.15);
          color: #D4AF37;
          font-size: 11px;
          font-weight: 700;
          padding: 3px 10px;
          border-radius: 100px;
          margin-bottom: 8px;
        }
        .status-indicator {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
        }
        .dot { width: 7px; height: 7px; border-radius: 50%; }

        .sidebar-nav {
          flex: 1;
          padding: 8px 14px;
          overflow-y: auto;
        }

        .nav-btn {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 13px 16px;
          border-radius: 12px;
          color: rgba(255,255,255,0.6);
          text-decoration: none;
          font-weight: 600;
          font-size: 15px;
          margin-bottom: 3px;
          transition: all 0.2s;
        }
        .nav-btn:hover {
          background: rgba(255,255,255,0.06);
          color: white;
        }
        .nav-btn.active {
          background: #D4AF37;
          color: #0d3320;
          font-weight: 800;
        }
        .nav-icon { font-size: 20px; flex-shrink: 0; }

        .sidebar-footer {
          padding: 16px;
          border-top: 1px solid rgba(255,255,255,0.1);
        }
        .btn-logout {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px 16px;
          background: none;
          border: none;
          color: #ff6b6b;
          font-weight: 700;
          font-size: 14px;
          cursor: pointer;
          border-radius: 12px;
          transition: background 0.2s;
        }
        .btn-logout:hover { background: rgba(255,107,107,0.1); }

        .dash-main {
          flex: 1;
          margin-left: 280px;
          width: calc(100% - 280px);
          min-height: 100vh;
          display: flex;
          flex-direction: column;
        }

        .dash-header {
          height: 72px;
          background: white;
          border-bottom: 1px solid #E5E7EB;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 36px;
          position: sticky;
          top: 0;
          z-index: 90;
        }
        .header-title {
          font-family: 'Baloo 2', sans-serif;
          font-size: 20px;
          font-weight: 800;
          color: #1B4332;
        }
        .avatar {
          width: 40px; height: 40px;
          background: #1B4332;
          color: #D4AF37;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 800;
          font-size: 16px;
        }

        .dash-content { padding: 36px; flex: 1; }

        @media (max-width: 1024px) {
          .dash-sidebar { width: 72px; }
          .dash-main { margin-left: 72px; width: calc(100% - 72px); }
          .sidebar-logo h2,
          .biz-badge,
          .nav-btn span:not(.nav-icon),
          .btn-logout span:not(.nav-icon) { display: none; }
          .nav-btn { justify-content: center; padding: 14px; }
          .btn-logout { justify-content: center; }
          .sidebar-header { padding: 20px 10px; }
        }
      `}</style>

      <aside className="dash-sidebar">
        <div className="sidebar-header">
          <div className="sidebar-logo">
            {/* <Image src="/logo.jpeg" alt="Logo" width={38} height={38} style={{ borderRadius: "8px" }} /> */}
            
            <h2>IntaraSales<span> AI</span></h2>
          </div>

          <div className="biz-badge">
            <p className="biz-badge-name">{business.name}</p>
            <div className="biz-type-pill">{TYPE_LABELS[business.business_type]}</div>
            <div className="status-indicator">
              <div className="dot" style={{ background: isConnected ? "#22C55E" : "#F59E0B" }} />
              <span style={{ color: isConnected ? "#22C55E" : "#F59E0B" }}>
                {isConnected ? "WhatsApp actif" : "Déconnecté"}
              </span>
            </div>
          </div>
        </div>

        <nav className="sidebar-nav">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`nav-btn ${pathname === item.href ? "active" : ""}`}
            >
              <span className="nav-icon">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>

        <div className="sidebar-footer">
          <button onClick={logout} className="btn-logout">
            <span className="nav-icon">🚪</span>
            <span>Déconnexion</span>
          </button>
        </div>
      </aside>

      <main className="dash-main">
        <header className="dash-header">
          <div className="header-title">{pageLabel}</div>
          <div className="avatar">{business.name.charAt(0).toUpperCase()}</div>
        </header>
        <div className="dash-content">{children}</div>
      </main>
    </div>
  );
}