import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "react-hot-toast";

export const metadata: Metadata = {
  title: "SuguAI — Automatisation WhatsApp par IA",
  description: "Maximisez vos Ventes & Améliorez votre Service client au Mali avec l'IA SuguAI",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* Updated to match your new premium design fonts */}
        <link
          href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&family=Baloo+2:wght@400;600;700;800&display=swap"
          rel="stylesheet"
        />
        <style>{`
          *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
          
          :root {
            --bg:            #FFFFFF;
            --surface-light: #F9FAFB;
            --primary-green: #1B4332; 
            --dark-green:    #0d3320;
            --sugu-gold:     #D4AF37; 
            --sugu-gold-dark: #b8952a;
            
            --text-main:    #1B4332;
            --text-muted:   #6B7280;
            --border-light: #E5E7EB;
            
            /* Font variables updated for the new look */
            --font-head:    'Baloo 2', sans-serif;
            --font-body:    'Nunito', sans-serif;
            
            --radius-md:    12px;
            --radius-lg:    18px;
            --radius-xl:    24px;
            --radius-2xl:   28px;
          }

          html, body {
            background: var(--bg);
            color: var(--text-main);
            font-family: var(--font-body);
            font-size: 15px;
            line-height: 1.5;
            -webkit-font-smoothing: antialiased;
            overflow-x: hidden;
          }

          h1, h2, h3, h4, .brand-font {
            font-family: var(--font-head);
          }

          /* --- REMOVE NEXT.JS INDICATOR --- */
          nextjs-portal, 
          [data-nextjs-static-indicator], 
          #nxt-static-indicator, 
          .__next-static-indicator-wrapper {
            display: none !important;
            visibility: hidden !important;
            pointer-events: none !important;
          }

          ::-webkit-scrollbar { width: 8px; }
          ::-webkit-scrollbar-track { background: var(--bg); }
          ::-webkit-scrollbar-thumb { 
            background: #D1D5DB; 
            border-radius: 10px; 
            border: 2px solid var(--bg);
          }
          ::-webkit-scrollbar-thumb:hover { background: var(--sugu-gold); }

          ::selection { background: rgba(212, 175, 55, 0.2); color: var(--primary-green); }

          button, input, select, textarea {
            font-family: var(--font-body);
          }

          /* Global Animation for page transitions */
          @keyframes slideUp {
            from { opacity: 0; transform: translateY(15px); }
            to { opacity: 1; transform: translateY(0); }
          }
        `}</style>
      </head>
      <body>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                const hide = () => {
                  const el = document.querySelector('nextjs-portal');
                  if (el) el.style.display = 'none';
                };
                const observer = new MutationObserver(hide);
                observer.observe(document.documentElement, { childList: true, subtree: true });
              })();
            `,
          }}
        />
        
        {children}
        
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: '#FFFFFF',
              color: 'var(--primary-green)',
              border: '2px solid var(--border-light)',
              fontFamily: 'var(--font-body)',
              fontWeight: '700',
              fontSize: '14px',
              borderRadius: '18px',
              boxShadow: '0 15px 30px -5px rgba(0, 0, 0, 0.1)',
              padding: '16px 20px',
            },
            success: { 
              iconTheme: { primary: '#22C55E', secondary: '#FFFFFF' },
              style: { border: '2px solid #DCFCE7' }
            },
            error: { 
              iconTheme: { primary: '#EF4444', secondary: '#FFFFFF' },
              style: { border: '2px solid #FEE2E2' }
            },
            duration: 4000,
          }}
        />
      </body>
    </html>
  );
}