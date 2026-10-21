// Data contoh demo Dapur Bakar. Semua angka & nama di sini fiktif.
import { getDb } from "../server/db";
import { DEMO_FOLDER } from "./fake-google";

type Call = (method: string, path: string, body?: unknown) => Promise<any>;

export const DEMO_LOGIN = { owner: ["dapurbakar", "demo1234"], staff: ["sari", "demo1234"] } as const;

const MENU = [
  { name: "Ayam Bakar Madu", emoji: "🍗", price: 25000, cost: 11000, description: "Ayam kampung muda, bumbu madu rempah, dibakar arang" },
  { name: "Ayam Bakar Taliwang", emoji: "🌶️", price: 27000, cost: 12000, description: "Pedas khas Lombok, cabai & terasi bakar" },
  { name: "Ikan Nila Bakar", emoji: "🐟", price: 30000, cost: 14000, description: "Nila segar ±400 g, bumbu kecap manis" },
  { name: "Ikan Gurame Bakar", emoji: "🐟", price: 55000, cost: 28000, description: "Gurame ±600 g, cukup untuk 2–3 orang" },
  { name: "Cumi Bakar Saus Padang", emoji: "🦑", price: 35000, cost: 17000, description: "Cumi segar, saus padang pedas manis" },
  { name: "Udang Bakar Madu", emoji: "🦐", price: 40000, cost: 21000, description: "Udang besar 6 ekor, olesan madu mentega" },
  { name: "Jagung Bakar Pedas Manis", emoji: "🌽", price: 10000, cost: 4000, description: "Jagung manis, olesan sambal mentega" },
  { name: "Nasi Putih", emoji: "🍚", price: 5000, cost: 2000, description: "" },
  { name: "Es Teh Manis Jumbo", emoji: "🧋", price: 6000, cost: 1500, description: "" },
  { name: "Sambal Matah Botol", emoji: "🌶️", price: 20000, cost: 8000, description: "Botol 150 ml, tahan 5 hari di kulkas", trackStock: true, stock: 18, minStock: 5 },
];

const CUSTOMERS = [
  ["Rina", "081200000101"], ["Pak Budi", "081200000102"], ["Dewi", "081200000103"], ["Andi", "081200000104"],
  ["Bu Siti", "081200000105"], ["Yoga", "081200000106"], ["Kantor PT Maju", "081200000107"], ["Lestari", "081200000108"],
  ["", ""], ["", ""], ["", ""],
];
const CHANNELS = ["WhatsApp", "WhatsApp", "WhatsApp", "Instagram", "GoFood", "GoFood", "GrabFood", "ShopeeFood"];

/** Angka acak yang selalu sama setiap kali demo dibuat. */
function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

export async function seedDemo(call: Call) {
  const [username, password] = DEMO_LOGIN.owner;
  await call("POST", "/auth/setup", { businessName: "Dapur Bakar", name: "Pemilik Dapur Bakar", username, password });
  const settings = await call("GET", "/settings");
  await call("PUT", "/settings", {
    ...settings,
    city: "Bekasi",
    businessWa: "0812-0000-0000",
    brandDescription: "Ayam & ikan bakar arang, bumbu rempah resep keluarga, sambal diulek setiap pagi.",
    driveFolderUrl: DEMO_FOLDER,
  });

  const products: { id: number; price: number }[] = [];
  for (const m of MENU) {
    products.push(await call("POST", "/products", { trackStock: false, stock: 0, minStock: 0, active: true, ...m }));
  }
  await call("POST", "/users", { name: "Sari", username: DEMO_LOGIN.staff[0], password: DEMO_LOGIN.staff[1], role: "staf" });

  const { query } = await getDb();
  const rand = rng(42);
  const pick = <T,>(xs: T[]) => xs[Math.floor(rand() * xs.length)];
  const DAY = 86_400_000;
  const today = new Date().setHours(0, 0, 0, 0);

  for (let d = 13; d >= 0; d--) {
    const count = 3 + Math.floor(rand() * (d % 7 === 1 || d % 7 === 2 ? 7 : 4)); // akhir pekan lebih ramai
    for (let n = 0; n < count; n++) {
      const main = pick(products.slice(0, 7));
      const items = [{ productId: main.id, qty: 1 + Math.floor(rand() * 3) }];
      if (rand() < 0.3) items.push({ productId: products[7].id, qty: 1 });
      if (rand() < 0.3) items.push({ productId: products[8].id, qty: 1 });
      if (rand() < 0.12) items.push({ productId: products[9].id, qty: 1 });
      const [customerName, customerWa] = pick(CUSTOMERS);
      const channel = pick(CHANNELS);
      const order = await call("POST", "/orders", {
        channel, customerName, customerWa, address: customerWa ? "Bekasi" : "", note: "",
        items, discount: 0, shippingFee: channel === "WhatsApp" ? 10000 : 0, platformFee: null,
        payment: channel.endsWith("Food") ? "Via aplikasi" : pick(["Tunai", "QRIS", "Transfer"]),
        paid: d > 0 || rand() < 0.7,
      });
      const at = today - d * DAY + (10 + Math.floor(rand() * 10)) * 3_600_000 + Math.floor(rand() * 60) * 60_000;
      await query("update orders set created_at = to_timestamp($1::float8 / 1000) where id = $2", [Math.min(at, Date.now() - 60_000), order.id]);
      const status = d > 0 ? "selesai" : pick(["baru", "diproses", "dikirim", "selesai"]);
      if (status !== "baru") await call("PATCH", `/orders/${order.id}`, { status });
    }
  }

  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();
  const expenses = [
    ["Gas & arang", 180000, "Arang 3 karung"], ["Kemasan", 150000, "Thinwall & paper bag"], ["Listrik & air", 250000, ""],
    ["Gaji", 600000, "Gaji Sari minggu 1–2"], ["Gas & arang", 90000, "Gas 3 kg × 4"],
  ] as const;
  for (const [i, [category, amount, note]] of expenses.entries()) {
    await call("POST", "/expenses", { date: Math.min(monthStart + i * 4 * DAY + DAY, Date.now()), category, amount, note });
  }

  await call("POST", "/ads", {
    name: "Promo Ayam Bakar Madu Jumat", platform: "Instagram/Facebook", startDate: today - 9 * DAY, endDate: today - 3 * DAY,
    spend: 150000, reach: 18400, chats: 41, orders: 19, revenue: 612000, note: "Radius 5 km, umur 20–40",
  });
  await call("POST", "/ads", {
    name: "Video proses bakar", platform: "TikTok", startDate: today - 5 * DAY, endDate: today,
    spend: 100000, reach: 22600, chats: 12, orders: 5, revenue: 160000, note: "Hook asap arang",
  });

  await call("POST", "/auth/logout");
}
