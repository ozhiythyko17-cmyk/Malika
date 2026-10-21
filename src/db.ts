import Dexie, { type EntityTable } from "dexie";

export interface Product {
  id?: number;
  name: string;
  emoji: string;
  price: number; // harga jual per porsi
  cost: number; // modal (HPP) per porsi
  trackStock: boolean;
  stock: number;
  minStock: number;
  active: boolean;
  description?: string;
}

export interface OrderItem {
  productId: number;
  name: string;
  price: number;
  cost: number;
  qty: number;
}

export type OrderStatus = "baru" | "diproses" | "dikirim" | "selesai" | "batal";

export interface Order {
  id?: number;
  createdAt: number;
  channel: string;
  customerName: string;
  customerWa: string;
  address: string;
  items: OrderItem[];
  discount: number;
  shippingFee: number; // ongkir yang dibayar pembeli (diteruskan ke kurir, bukan omzet)
  platformFee: number; // potongan aplikasi (GoFood, ShopeeFood, dll.)
  payment: string;
  paid: boolean;
  status: OrderStatus;
  note: string;
}

export interface Expense {
  id?: number;
  date: number;
  category: string;
  amount: number;
  note: string;
}

export interface StockMove {
  id?: number;
  date: number;
  productId: number;
  qty: number; // + masuk, - keluar
  reason: string;
}

export interface Content {
  id?: number;
  createdAt: number;
  productName: string;
  platform: string;
  text: string;
}

export interface AdCampaign {
  id?: number;
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

export interface Channel {
  name: string;
  feePct: number;
}

export interface Settings {
  id: "main";
  businessName: string;
  ownerName: string;
  businessWa: string;
  city: string;
  brandDescription: string;
  brandVoice: string;
  channels: Channel[];
  lastBackup?: number;
}

export const db = new Dexie("umkm-plus") as Dexie & {
  products: EntityTable<Product, "id">;
  orders: EntityTable<Order, "id">;
  expenses: EntityTable<Expense, "id">;
  stockMoves: EntityTable<StockMove, "id">;
  contents: EntityTable<Content, "id">;
  ads: EntityTable<AdCampaign, "id">;
  settings: EntityTable<Settings, "id">;
};

db.version(1).stores({
  products: "++id, name",
  orders: "++id, createdAt, status",
  expenses: "++id, date",
  stockMoves: "++id, date, productId",
  contents: "++id, createdAt",
  ads: "++id, startDate",
  settings: "id",
});

export const PAYMENT_METHODS = ["Tunai", "QRIS", "Transfer", "E-wallet", "Via aplikasi"];

export const EXPENSE_CATEGORIES = [
  "Bahan baku",
  "Kemasan",
  "Gas & listrik",
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

export const DEFAULT_SETTINGS: Settings = {
  id: "main",
  businessName: "Usaha Saya",
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

export async function getSettings(): Promise<Settings> {
  return (await db.settings.get("main")) ?? DEFAULT_SETTINGS;
}

export function orderSubtotal(o: Pick<Order, "items">) {
  return o.items.reduce((s, i) => s + i.price * i.qty, 0);
}

export function orderRevenue(o: Order) {
  return orderSubtotal(o) - o.discount;
}

export function orderCost(o: Order) {
  return o.items.reduce((s, i) => s + i.cost * i.qty, 0);
}

/** Simpan pesanan baru dan kurangi stok produk yang dilacak. */
export async function createOrder(order: Omit<Order, "id">) {
  return db.transaction("rw", db.orders, db.products, db.stockMoves, async () => {
    const id = await db.orders.add(order);
    await applyStock(order.items, -1, `Pesanan #${id}`);
    return id;
  });
}

/** Ubah status; batal mengembalikan stok, membatalkan "batal" memotong lagi. */
export async function setOrderStatus(order: Order, status: OrderStatus) {
  await db.transaction("rw", db.orders, db.products, db.stockMoves, async () => {
    if (order.status !== "batal" && status === "batal") {
      await applyStock(order.items, 1, `Batal pesanan #${order.id}`);
    } else if (order.status === "batal" && status !== "batal") {
      await applyStock(order.items, -1, `Pesanan #${order.id} dibuka lagi`);
    }
    await db.orders.update(order.id!, { status });
  });
}

async function applyStock(items: OrderItem[], sign: 1 | -1, reason: string) {
  for (const item of items) {
    const p = await db.products.get(item.productId);
    if (!p?.trackStock) continue;
    await db.products.update(p.id!, { stock: p.stock + sign * item.qty });
    await db.stockMoves.add({ date: Date.now(), productId: p.id!, qty: sign * item.qty, reason });
  }
}

export async function addStock(productId: number, qty: number, reason: string) {
  await db.transaction("rw", db.products, db.stockMoves, async () => {
    const p = await db.products.get(productId);
    if (!p) return;
    await db.products.update(productId, { stock: p.stock + qty });
    await db.stockMoves.add({ date: Date.now(), productId, qty, reason });
  });
}

const TABLES = ["products", "orders", "expenses", "stockMoves", "contents", "ads", "settings"] as const;

export async function exportBackup() {
  const data: Record<string, unknown[]> = {};
  for (const t of TABLES) data[t] = await db.table(t).toArray();
  return { app: "umkm-plus", version: 1, exportedAt: Date.now(), data };
}

export async function importBackup(json: unknown) {
  const backup = json as { app?: string; data?: Record<string, unknown[]> };
  if (backup.app !== "umkm-plus" || !backup.data) throw new Error("File ini bukan backup UMKM Plus.");
  await db.transaction("rw", TABLES.map((t) => db.table(t)), async () => {
    for (const t of TABLES) {
      await db.table(t).clear();
      await db.table(t).bulkAdd(backup.data![t] ?? []);
    }
  });
}
