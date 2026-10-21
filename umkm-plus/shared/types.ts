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
  title: string;
  platform: string;
  text: string;
  mediaId: number | null;
}

export interface DriveFile {
  id: string;
  name: string;
  kind: "image" | "video" | "audio";
  durationSec: number | null;
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
  /** Terisi bila iklan dipasang dari aplikasi ke Meta (Facebook & Instagram). */
  meta: MetaAdInfo | null;
}

export type AdInput = Omit<AdCampaign, "id" | "meta">;

export type MetaObjective = "whatsapp" | "link";

/** Status iklan Meta dalam bahasa sederhana. */
export type MetaAdState = "review" | "active" | "paused" | "rejected" | "billing" | "issue" | "ended";

export interface MetaAdInfo {
  campaignId: string;
  objective: MetaObjective;
  state: MetaAdState;
  dailyBudget: number;
  clicks: number;
  autopilot: boolean;
  autopilotLimit: number; // jeda otomatis bila biaya mencapai angka ini tanpa satu pun hasil
  syncedAt: number | null;
  notice: string; // pesan terakhir: alasan ditolak, dijeda otomatis, dll.
}

export interface MetaStatus {
  connected: boolean;
  missing: string[]; // pengaturan server yang belum diisi
  account?: { id: string; name: string; currency: string; active: boolean; statusText: string };
  page?: { id: string; name: string };
  error?: string;
}

export interface MetaLaunchInput {
  objective: MetaObjective;
  link: string; // untuk objective "link"
  image: { mediaId: number } | { driveFileId: string } | { dataUrl: string };
  primaryText: string;
  headline: string;
  radiusKm: number;
  ageMin: number;
  ageMax: number;
  dailyBudget: number;
  days: number;
  autopilot: boolean;
  autopilotLimit: number;
}

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
  driveFolderUrl: string; // folder Google Drive berisi foto/video bahan konten
  latitude: number | null; // lokasi usaha, pusat target iklan
  longitude: number | null;
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
  driveFolderUrl: "",
  latitude: null,
  longitude: null,
  channels: [
    { name: "WhatsApp", feePct: 0 },
    { name: "Instagram", feePct: 0 },
    { name: "GoFood", feePct: 20 },
    { name: "GrabFood", feePct: 20 },
    { name: "ShopeeFood", feePct: 20 },
  ],
};
