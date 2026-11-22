<div align="center">
  <h1>🌍 SuguAI</h1>
  <p>
    <strong>Voice-First Multilingual AI Commerce Assistant for African Merchants</strong>
  </p>
  <p>
    Enabling merchants in Mali to sell, manage inventory, and grow their businesses on <strong>WhatsApp</strong> using natural voice and text conversations in <strong>Bambara</strong> and <strong>French</strong>.
  </p>

  <p>
    <img src="https://img.shields.io/badge/Languages-Bambara%20%7C%20French-009639?style=for-the-badge" alt="Languages" />
    <img src="https://img.shields.io/badge/Channel-WhatsApp%20Business-25D366?style=for-the-badge&logo=whatsapp&logoColor=white" alt="WhatsApp" />
    <img src="https://img.shields.io/badge/Backend-FastAPI%20%7C%20PostgreSQL%20%7C%20Redis-009688?style=for-the-badge&logo=fastapi&logoColor=white" alt="Backend" />
    <img src="https://img.shields.io/badge/Frontend-Next.js%20%7C%20TypeScript-000000?style=for-the-badge&logo=nextdotjs&logoColor=white" alt="Frontend" />
    <img src="https://img.shields.io/badge/License-MIT-blue?style=for-the-badge" alt="License" />
  </p>
</div>

---

## 📖 Overview

**SuguAI** is an intelligent conversational AI commerce platform built specifically for small and medium businesses across Mali and West Africa. Designed for environments with varying levels of digital literacy, SuguAI removes technical barriers by allowing business owners to manage daily operations simply by speaking in their native language—no complex dashboards or typing required.

> Instead of learning complicated software, merchants simply talk to SuguAI on WhatsApp just like they would talk to a trusted store employee.

---

## 🌟 Why SuguAI?

Many small merchants in Mali receive dozens of WhatsApp inquiries every day that go unanswered during busy hours, while traditional POS and ERP software often require reading, typing, or technical training.

| Challenge | How SuguAI Solves It |
| :--- | :--- |
| **Missed Customer Messages** | Responds automatically to buyer inquiries on WhatsApp **24/7** |
| **Literacy & Typing Barriers** | Custom **Bambara & French speech-to-text** enables pure voice interaction |
| **Manual Stock & Sales Tracking** | Merchants add products, log sales, and check daily revenue via voice notes |
| **Complex Software Overhead** | Works natively inside WhatsApp alongside a clean web dashboard for deeper analytics |

---

## ✨ Key Features

- 🗣️ **Voice-First Bambara & French AI** — Custom speech recognition and multilingual NLP tailored for low-resource West African speech patterns
- 🤖 **24/7 WhatsApp Customer Assistant** — Answers product questions, shares prices, and captures orders automatically
- 📦 **Voice Inventory & Product Management** — Add, update, and check stock levels through natural voice messages
- 🛒 **Automated Order & Customer Tracking** — Logs orders, tracks fulfillment status, and organizes customer history
- 📊 **Sales Analytics & Revenue Summaries** — Instant daily/weekly performance reports via WhatsApp or the web dashboard
- 🧾 **Receipt & Document OCR** — Extracts product and transaction details from photos of invoices or handwritten notes
- 🔔 **Smart Business Alerts** — Real-time notifications for new orders, low inventory, and daily summaries

---

## 🏗️ System Architecture

```text
                      ┌─────────────────────────┐
                      │  Merchant / Customer    │
                      │ (WhatsApp Voice & Text) │
                      └────────────┬────────────┘
                                   │
                                   ▼
                      ┌─────────────────────────┐
                      │  WhatsApp Business API  │
                      └────────────┬────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        SuguAI Core (FastAPI)                        │
│                                                                     │
│  ┌───────────────────────────┐     ┌─────────────────────────────┐  │
│  │  Speech & AI Engine       │     │  Commerce & Operations      │  │
│  │  • Bambara / French ASR   │────▶│  • Product & Stock Service  │  │
│  │  • Intent & LLM Reasoning │     │  • Order & CRM Engine       │  │
│  │  • OCR Document Parser    │     │  • Analytics & Alerts       │  │
│  └───────────────────────────┘     └──────────────┬──────────────┘  │
└───────────────────────────────────────────────────┼─────────────────┘
                                                    │
                       ┌────────────────────────────┼────────────────┐
                       ▼                            ▼                ▼
             ┌──────────────────┐         ┌──────────────────┐  ┌──────────────────┐
             │    PostgreSQL    │         │      Redis       │  │ Next.js Web App  │
             │  (Core Storage)  │         │ (Cache & Queues) │  │   (Dashboard)    │
             └──────────────────┘         └──────────────────┘  └──────────────────┘
