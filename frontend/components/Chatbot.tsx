"use client";
import { useState, useRef, useEffect } from "react";

export default function Chatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'Bonjour ! Je suis l\'assistant SuguAI. Comment puis-je vous aider à transformer votre WhatsApp en commerce intelligent ?' }
  ]);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, isOpen]);

 const getAiResponse = (text: string) => {
    const query = text.toLowerCase().trim();

    // 1. DÉFINITION GLOBALE (Ce qu'est SuguAI)
    if (query.includes("c'est quoi") || query.includes("qu'est-ce que") || query.includes("sugu ai")) {
      return "SuguAI est une plateforme SaaS qui transforme votre WhatsApp classique en un véritable commerce automatisé. Son nom vient du mot 'Sugu' (marché en bambara). L'IA gère vos ventes 24h/24 de manière fluide et éthique.";
    }

    // 2. SALUTATIONS & POLITESSE (Fixe le bug du "cv" et "merci")
    if (query === "cv" || query === "ca va" || query === "ça va" || query === "salut" || query === "bonjour") {
      return "Ça va très bien, merci ! Je suis prêt à vous aider à configurer votre boutique SuguAI. Que souhaitez-vous savoir ?";
    }
    if (query.includes("merci") || query === "ok" || query === "super") {
      return "Je vous en prie ! Je reste à votre disposition si vous avez d'autres questions sur votre catalogue ou la connexion WhatsApp.";
    }

    // 3. INSCRIPTION & COMPTE
    if (query.includes("inscription") || query.includes("créer") || query.includes("compte")) {
      return "Rendez-vous sur le portail web de SuguAI. Vous devrez fournir votre nom, celui de votre entreprise et vos coordonnées. Une fois validé, vous accédez à votre Dashboard personnel.";
    }

    // 4. CONFIGURATION DU DASHBOARD (Le "Cerveau")
    if (query.includes("configurer") || query.includes("dashboard") || query.includes("cerveau")) {
      return "Pour configurer le 'Cerveau', renseignez vos horaires, vos zones de livraison et vos méthodes de paiement (Orange Money, Wave). Vous pouvez aussi choisir le ton de l'IA : Professionnel, Amical ou Formel.";
    }

    // 5. CATALOGUE & PRODUITS
    if (query.includes("catalogue") || query.includes("produit") || query.includes("stock")) {
      return "Dans votre Dashboard, créez des fiches pour chaque article (nom, prix, photo). Vous pouvez gérer vos stocks par tailles et activer ou masquer des produits en un clic.";
    }

    // 6. CONNEXION WHATSAPP
    if (query.includes("whatsapp") || query.includes("connecter") || query.includes("qr code") || query.includes("scan")) {
      return "Allez sur votre dashboard > 'Connecter WhatsApp' pour générer un QR Code. Scannez-le avec l'option 'Appareils liés' de votre application WhatsApp mobile. L'indicateur passera au vert !";
    }

    // 7. ÉTHIQUE & MOGOBAYA
    if (query.includes("éthique") || query.includes("mogobaya") || query.includes("maaya")) {
      return "SuguAI intègre le concept 'Algorithmic Mogobaya' : une IA conçue pour respecter les valeurs de courtoisie et de respect social maliennes, évitant les comportements intrusifs.";
    }

    // RÉPONSE GÉNÉRIQUE AMÉLIORÉE
    return "Je peux vous donner des détails sur : l'inscription, la configuration du 'Cerveau' (Dashboard), la gestion de votre catalogue ou la connexion WhatsApp par QR Code. Dites-moi ce qui vous intéresse !";
  };

  const handleSend = () => {
    if (!input.trim()) return;
    const userMsg = { role: 'user', content: input };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    
    setTimeout(() => {
      const response = getAiResponse(userMsg.content);
      setMessages(prev => [...prev, { role: 'assistant', content: response }]);
    }, 500);
  };

  return (
    <div style={{ position: 'fixed', bottom: '20px', right: '20px', zIndex: 99999, fontFamily: 'inherit' }}>
      {isOpen && (
        <div style={{
          width: '340px', height: '480px', backgroundColor: 'white', borderRadius: '20px',
          display: 'flex', flexDirection: 'column', boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
          overflow: 'hidden', border: '1px solid #eee', marginBottom: '15px'
        }}>
          {/* Header */}
          <div style={{ backgroundColor: '#1B4332', padding: '15px', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '30px', height: '30px', backgroundColor: '#D4AF37', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', color: 'white' }}>S</div>
              <span style={{ fontWeight: '600', fontSize: '14px' }}>Expert SuguAI</span>
            </div>
            <button onClick={() => setIsOpen(false)} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', fontSize: '18px' }}>✕</button>
          </div>

          {/* Chat area */}
          <div ref={scrollRef} style={{ flex: 1, padding: '15px', overflowY: 'auto', backgroundColor: '#fdfdfd', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {messages.map((m, i) => (
              <div key={i} style={{ alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '85%' }}>
                <div style={{
                  padding: '10px 14px', borderRadius: '15px', fontSize: '13px', lineHeight: '1.4',
                  backgroundColor: m.role === 'user' ? '#D4AF37' : '#f0f0f0',
                  color: m.role === 'user' ? 'white' : '#1B4332',
                  borderRadius: m.role === 'user' ? '15px 15px 0 15px' : '0 15px 15px 15px'
                }}>
                  {m.content}
                </div>
              </div>
            ))}
          </div>

          {/* Input */}
          <div style={{ padding: '12px', borderTop: '1px solid #eee', display: 'flex', gap: '8px' }}>
            <input 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Posez votre question..."
              style={{ flex: 1, padding: '10px', borderRadius: '10px', border: '1px solid #ddd', outline: 'none', fontSize: '13px' }}
            />
            <button onClick={handleSend} style={{ backgroundColor: '#1B4332', color: 'white', border: 'none', padding: '0 15px', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold' }}>
              Envoyer
            </button>
          </div>
        </div>
      )}

      {/* Toggle Button */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: '60px', height: '60px', borderRadius: '50%', backgroundColor: isOpen ? '#1B4332' : '#D4AF37',
          border: 'none', color: 'white', fontSize: '24px', cursor: 'pointer', boxShadow: '0 4px 15px rgba(0,0,0,0.2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', transition: '0.3s'
        }}
      >
        {isOpen ? '✕' : '💬'}
      </button>
    </div>
  );
}