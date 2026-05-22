import axios from "axios";
import Cookies from "js-cookie";
import { DashboardStats } from "@/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export const api = axios.create({
  baseURL: API_URL,
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config) => {
  const token = Cookies.get("access_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const isLoginPage = window.location.pathname === "/login";
      if (!isLoginPage) {
        Cookies.remove("access_token");
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

// ── Auth ──────────────────────────────────────────────────────────────────────
export const authApi = {
  register: (data: {
    name: string;
    phone_number: string;
    password: string;
    business_type: string;
  }) => api.post("/auth/register", data),

  login: (data: { phone_number: string; password: string }) =>
    api.post("/auth/login", data),

  sendOtp: (phone_number: string) =>
    api.post("/auth/send-otp", { phone_number }),

  verifyOtp: (phone_number: string, code: string) =>
    api.post("/auth/verify-otp", { phone_number, code }),

  me: () => api.get("/auth/me"),

  updateSettings: (data: object) => api.patch("/auth/settings", data),

  connectWhatsAppManual: (data: {
    phone_number_id: string;
    access_token: string;
  }) => api.post("/auth/whatsapp/manual-connect", data),

  disconnectWhatsApp: () => api.delete("/auth/whatsapp/disconnect"),
  connectWhatsAppQr:  () => api.post("/auth/whatsapp/qr-connect"),
  getWhatsAppQrStatus: () => api.get("/auth/whatsapp/qr-status"),
  getWhatsAppFreshQr:  () => api.get("/auth/whatsapp/qr-code"),
  deleteAccount: () => api.delete("/auth/account"),
};

// ── Onboarding ────────────────────────────────────────────────────────────────
export const onboardingApi = {
  start: (mode: "voice" | "text" = "voice") =>
    api.get(`/onboarding/start?mode=${mode}`),

  sendVoice: (formData: FormData) =>
    api.post("/onboarding/voice", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),

  sendText: (data: {
    step: string;
    session_id: string;
    text: string;
    shop_name?: string;
  }) => api.post("/onboarding/text", data),

  status: (sessionId: string) =>
    api.get(`/onboarding/status/${sessionId}`),
};

// ── Products ──────────────────────────────────────────────────────────────────
export const productsApi = {
  list:   ()                         => api.get("/products/"),
  get:    (id: string)               => api.get(`/products/${id}`),
  create: (data: object)             => api.post("/products/", data),
  update: (id: string, data: object) => api.patch(`/products/${id}`, data),
  delete: (id: string)               => api.delete(`/products/${id}`),

  // ── Variant endpoints ────────────────────────────────────────────────────
  addVariant: (productId: string, data: {
    name: string;
    color_hex?: string | null;
    image_url?: string | null;
    stock: number;
    sort_order?: number;
  }) => api.post(`/products/${productId}/variants`, data),

  updateVariant: (productId: string, variantId: string, data: {
    name?: string;
    color_hex?: string | null;
    image_url?: string | null;
    stock?: number;
    sort_order?: number;
    is_active?: boolean;
  }) => api.patch(`/products/${productId}/variants/${variantId}`, data),

  deleteVariant: (productId: string, variantId: string) =>
    api.delete(`/products/${productId}/variants/${variantId}`),
};

// ── Upload ────────────────────────────────────────────────────────────────────
export const uploadApi = {
  uploadImage: (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return api.post<{ url: string }>("/products/upload-image", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },
};

// ── Orders ────────────────────────────────────────────────────────────────────
export const ordersApi = {
  list: (status?: string) =>
    api.get("/orders/", { params: status ? { status } : {} }),
  get: (id: string) => api.get(`/orders/${id}`),
  confirmOrder: (id: string) => api.post(`/orders/${id}/confirm`),
  markPaid: (id: string) => api.post(`/orders/${id}/mark-paid`),
  updateStatus: (id: string, status: string) =>
    api.patch(`/orders/${id}/status`, { status }),
};

// ── Appointments ──────────────────────────────────────────────────────────────
export const appointmentsApi = {
  list: (status?: string) =>
    api.get("/appointments/", { params: status ? { status } : {} }),
  get: (id: string) => api.get(`/appointments/${id}`),
  confirm: (id: string) => api.post(`/appointments/${id}/confirm`),
  markDone: (id: string) => api.post(`/appointments/${id}/done`),
  cancel: (id: string, reason?: string) =>
    api.post(`/appointments/${id}/cancel`, { reason }),
  update: (id: string, data: object) =>
    api.patch(`/appointments/${id}`, data),
};

// ── Conversations ─────────────────────────────────────────────────────────────
export const conversationsApi = {
  list: () => api.get("/conversations/"),
  get:  (id: string) => api.get(`/conversations/${id}`),
  toggleTakeover: (id: string) =>
    api.post(`/conversations/${id}/takeover`),
};

// ── Promotions ────────────────────────────────────────────────────────────────
export const promotionsApi = {
  list:    ()             => api.get("/promotions/"),
  create:  (data: object) => api.post("/promotions/", data),
  sendNow: (id: string)   => api.post(`/promotions/${id}/send`, {}),
  delete:  (id: string)   => api.delete(`/promotions/${id}`),
};

// ── Customers ─────────────────────────────────────────────────────────────────
export const customersApi = {
  list: () => api.get("/customers/"),
};

// ── Analytics ─────────────────────────────────────────────────────────────────
export const analyticsApi = {
  get: () => api.get("/dashboard/analytics"),
};

// ── Dashboard ─────────────────────────────────────────────────────────────────
export const dashboardApi = {
  stats: (period: string = "today") =>
    api.get<DashboardStats>(`/dashboard/stats?period=${period}`),
};