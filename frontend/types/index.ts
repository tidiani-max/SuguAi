// frontend/types/index.ts

export type BusinessType =
  | "products_seller"
  | "service_information"
  | "fnb"
  | "transport"
  | "health"
  | "education"
  | "real_estate"
  | "events"
  | "custom";

export type BusinessStatus = "not_connected" | "connected" | "suspended";
export type OrderStatus = "pending_payment" | "paid" | "processing" | "shipped" | "delivered" | "cancelled";
export type AppointmentStatus = "pending" | "confirmed" | "done" | "cancelled";
export type ConversationState = "browsing" | "awaiting_payment" | "payment_verification" | "completed" | "human_takeover";
export type MessageDirection = "inbound" | "outbound";
export type PromotionStatus = "draft" | "scheduled" | "sending" | "sent" | "cancelled";

export interface Business {
  id: string;
  name: string;
  phone_number: string;
  email?: string;
  business_type: BusinessType;
  status: BusinessStatus;
  whatsapp_connected: boolean;
  whatsapp_phone_number_id?: string;
  whatsapp_business_phone?: string;
  description?: string;
  payment_instructions?: string;
  faq?: string;
  ai_tone?: string;
  created_at: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  business: Business;
}

export interface ProductVariant {
  id: string;
  product_id: string;
  name: string;
  color_hex?: string | null;
  image_url?: string | null;
  stock: number;
  sort_order: number;
  is_active: boolean;
  created_at: string;
}

export interface Product {
  id: string;
  business_id: string;
  name: string;
  description?: string;
  price: number;
  stock: number;
  unit: string;
  image_url?: string | null;
  is_active: boolean;
  created_at: string;
  variants: ProductVariant[];
}

export interface OrderItem {
  id: string;
  product_name: string;
  unit_price: number;
  quantity: number;
  subtotal: number;
  color?: string | null;
  size?: string | null;
}

export interface Order {
  id: string;
  order_number: string;
  status: OrderStatus;
  total_amount: number;
  payment_screenshot_url?: string | null;
  payment_verified_at?: string | null;
  created_at: string;
  items: OrderItem[];
  customer_name?: string | null;
  customer_phone?: string | null;
  delivery_address?: string | null;
  customer_language?: string | null;
  promotion_id?:       string | null;
  promotion_discount?: number | null;
  promotion?: {
    id:              string;
    title:           string;
    discount_amount: number | null;
    expires_at:      string | null;
  } | null;
}

export interface Appointment {
  id: string;
  service_name: string;
  scheduled_at?: string | null;
  duration_minutes?: number | null;
  status: AppointmentStatus;
  price?: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  notes?: string | null;
  created_at: string;
}

export interface Message {
  id: string;
  direction: MessageDirection;
  message_type: string;
  content?: string;
  media_url?: string;
  is_payment_screenshot: boolean;
  created_at: string;
}

export interface Conversation {
  id: string;
  customer_id: string;
  state: ConversationState;
  ai_enabled: boolean;
  last_message_at: string;
  messages?: Message[];
}

export interface TopProduct {
  product_name: string;
  total_sold: number;
  revenue: number;
}

export interface TopService {
  service_name: string;
  total_bookings: number;
}

export interface SellDashboardStats {
  type: "sell";
  orders_count: number;
  pending_orders: number;
  total_revenue: number;
  messages_count: number;
  top_products: TopProduct[];
  period: string;
}

export interface ServiceDashboardStats {
  type: "service";
  total_appointments: number;
  pending_appointments: number;
  confirmed_appointments: number;
  done_appointments: number;
  today_appointments: number;
  top_services: TopService[];
  messages_count: number;
  period: string;
}

export interface CustomDashboardStats {
  type: "custom";
  messages_count: number;
  active_conversations: number;
  period: string;
}

export interface PromotionProduct {
  id:        string;
  name:      string;
  price:     number;
  image_url: string | null;
}

export interface Promotion {
  id:                     string;
  title:                  string;
  message:                string;
  status:                 PromotionStatus;
  product_id:             string | null;
  discount_amount:        number | null;
  recipient_customer_ids: string | null;
  scheduled_at:           string | null;
  expires_at:             string | null;
  sent_at:                string | null;
  recipient_count:        number;
  delivered_count:        number;
  created_at:             string;
  product:                PromotionProduct | null;
}

export interface Customer {
  id:             string;
  whatsapp_phone: string;
  display_name:   string | null;
  is_blocked:     boolean;
  created_at:     string;
  last_seen:      string;
}

export interface AnalyticsData {
  totals: {
    customers:         number;
    messages:          number;
    outbound_messages: number;
    orders:            number;
    revenue:           number;
    ai_rate:           number;
    promotions_sent:   number;
    promotions_total:  number;
  };
  charts: {
    daily_messages: { date: string; messages: number }[];
    daily_revenue:  { date: string; revenue:  number }[];
  };
}

export type DashboardStats = SellDashboardStats | ServiceDashboardStats | CustomDashboardStats;