// Tipe data yang dipakai bersama oleh frontend (src/) dan backend (server/).
// Semua uang dalam rupiah (bilangan bulat), semua waktu dalam milidetik epoch.

export type Role = "pemilik" | "staf";

export interface User {
  id: number;
  name: string;
  username: string;
  role: Role;
}

export interface Product {
  id: number;
  name: string;
  emoji: string;
  price: number; // harga jual per porsi
  cost: number; // modal (HPP) per porsi
  trackStock: boolean;
  stock: number;
  minStock: number;
  active: boolean;
  description: string;
}

export type ProductInput = Omit<Product, "id">;

export interface OrderItem {
  productId: number;
  name: string;
  price: number;
  cost: number;
  qty: number;
}

export type OrderStatus = "baru" | "diproses" | "dikirim" | "selesai" | "batal";

export interface Order {
  id: number;
  createdAt: number;
  channel: string;
  customerName: string;
  customerWa: string;
  address: string;
  items: OrderItem[];
  discount: number;
  shippingFee: number; // ongkir dibayar pembeli (diteruskan ke kurir, bukan omzet)
  platformFee: number; // potongan aplikasi (GoFood, ShopeeFood, dll.)
  payment: string;
  paid: boolean;
  status: OrderStatus;
  note: string;
  createdBy: string;
}

export interface OrderInput {
  channel: string;
  customerName: string;
  customerWa: string;
  address: string;
  items: { productId: number; qty: number }[];
  discount: number;
  shippingFee: number;
  platformFee: number | null; // null = hitung otomatis dari persen saluran
  payment: string;
  paid: boolean;
  note: string;
}

export interface Expense {
  id: number;
  date: number;
  category: string;
  amount: number;
  note: string;
}

export type ExpenseInput = Omit<Expense, "id">;

export interface StockMove {
  id: number;
  date: number;
  qty: number;
  reason: string;
}

export interface Content {
  id: number;
  createdAt: number;
  productName: string;
  platform: string;
  text: string;
}

export interface AdCampaign {
  id: number;
  name: string;
  platform: string;
  startDate: number;
  endDate: number;
  spend: number;
  reach: number;
  chats: number;
  orders: number;
  revenue: number;
  note: string;
}

export type AdInput = Omit<AdCampaign, "id">;

export interface Channel {
  name: string;
  feePct: number;
}

export interface Settings {
  businessName: string;
  ownerName: string;
  businessWa: string;
  city: string;
  brandDescription: string;
  brandVoice: string;
  channels: Channel[];
}

export interface Customer {
  wa: string;
  name: string;
  orders: number;
  spent: number;
  lastOrder: number;
}

export interface Dashboard {
  todayRevenue: number;
  todayProfit: number | null;
  todayOrders: number;
  activeOrders: number;
  unpaidOrders: number;
  week: { day: number; revenue: number }[];
  top: { name: string; qty: number }[];
  lowStock: { name: string; stock: number }[];
  productCount: number;
}

export interface Report {
  orders: number;
  revenue: number;
  cost: number;
  platformFees: number;
  expenses: { category: string; amount: number }[];
  adSpend: number;
  byChannel: { channel: string; revenue: number }[];
  unpaid: { count: number; amount: number };
}

export const PAYMENT_METHODS = ["Tunai", "QRIS", "Transfer", "E-wallet", "Via aplikasi"];

export const EXPENSE_CATEGORIES = [
  "Bahan baku",
  "Kemasan",
  "Gas & arang",
  "Listrik & air",
  "Gaji",
  "Sewa",
  "Ongkir & transport",
  "Peralatan",
  "Lainnya",
];

export const ORDER_STATUSES: { value: OrderStatus; label: string }[] = [
  { value: "baru", label: "Baru" },
  { value: "diproses", label: "Diproses" },
  { value: "dikirim", label: "Dikirim" },
  { value: "selesai", label: "Selesai" },
  { value: "batal", label: "Batal" },
];

export const AD_PLATFORMS = ["Instagram/Facebook", "TikTok", "GoFood", "GrabFood", "ShopeeFood", "Lainnya"];

export const DEFAULT_SETTINGS: Settings = {
  businessName: "Dapur Bakar",
  ownerName: "",
  businessWa: "",
  city: "",
  brandDescription: "",
  brandVoice: "Santai",
  channels: [
    { name: "WhatsApp", feePct: 0 },
    { name: "Instagram", feePct: 0 },
    { name: "GoFood", feePct: 20 },
    { name: "GrabFood", feePct: 20 },
    { name: "ShopeeFood", feePct: 20 },
  ],
};
