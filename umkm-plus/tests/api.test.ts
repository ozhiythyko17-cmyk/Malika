// Tes backend end-to-end. Bawaan: PostgreSQL di memori (PGlite).
// Untuk menguji ke PostgreSQL sungguhan: TEST_DATABASE_URL=postgres://... npm test (database harus kosong).
import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";

process.env.PGLITE_DIR = "memory://";
if (process.env.TEST_DATABASE_URL) process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
else delete process.env.DATABASE_URL;
delete process.env.ANTHROPIC_API_KEY;

const { handle } = await import("../server/app.js");
const { closeDb } = await import("../server/db.js");
after(closeDb);

function client() {
  let cookie = "";
  return async function call<T = any>(method: string, path: string, body?: unknown): Promise<{ status: number; data: T }> {
    const res = await handle(
      new Request(`http://localhost/api${path}`, {
        method,
        headers: { "content-type": "application/json", cookie },
        body: body === undefined ? undefined : JSON.stringify(body),
      }),
      path.split("?")[0]
    );
    const set = res.headers.get("set-cookie");
    if (set) cookie = set.split(";")[0];
    return { status: res.status, data: (await res.json()) as T };
  };
}

const owner = client();
const staff = client();
const guest = client();
const DAY = 86_400_000;
const today = new Date().setHours(0, 0, 0, 0);

describe("UMKM Plus API", () => {
  let geprek: number, esTeh: number;

  before(async () => {
    const s = await owner("GET", "/auth/status");
    assert.equal(s.data.needsSetup, true);
  });

  test("setup akun pemilik, lalu setup kedua ditolak", async () => {
    const r = await owner("POST", "/auth/setup", { name: "Pemilik", username: "pemilik", password: "rahasia123", businessName: "Dapur Bakar" });
    assert.equal(r.status, 201);
    const me = await owner("GET", "/auth/status");
    assert.equal(me.data.user.role, "pemilik");
    const again = await guest("POST", "/auth/setup", { name: "X", username: "xx1", password: "rahasia123" });
    assert.equal(again.status, 409);
    const settings = await owner("GET", "/settings");
    assert.equal(settings.data.businessName, "Dapur Bakar");
    const saved = await owner("PUT", "/settings", { ...settings.data, city: "Bekasi" });
    assert.equal(saved.status, 200);
    assert.equal((await owner("GET", "/settings")).data.city, "Bekasi");
  });

  test("tanpa login ditolak, kata sandi salah ditolak", async () => {
    assert.equal((await guest("GET", "/products")).status, 401);
    assert.equal((await guest("POST", "/auth/login", { username: "pemilik", password: "salah1234" })).status, 401);
  });

  test("produk dibuat dengan validasi", async () => {
    const bad = await owner("POST", "/products", { name: "", price: 1, cost: 1, trackStock: false, active: true });
    assert.equal(bad.status, 400);
    const a = await owner("POST", "/products", { name: "Ayam Bakar Madu", emoji: "🍗", price: 25000, cost: 11000, trackStock: false, stock: 0, minStock: 0, active: true, description: "" });
    const b = await owner("POST", "/products", { name: "Es Teh Jumbo", emoji: "🧋", price: 6000, cost: 1500, trackStock: true, stock: 10, minStock: 5, active: true, description: "" });
    assert.equal(a.status, 201);
    geprek = a.data.id;
    esTeh = b.data.id;
    assert.equal(b.data.stock, 10);
  });

  test("pesanan GoFood: harga dari server, potongan 20%, stok berkurang", async () => {
    const r = await owner("POST", "/orders", {
      channel: "GoFood", customerName: "Rina", customerWa: "0812-3456-7890", address: "", note: "",
      items: [{ productId: geprek, qty: 2 }, { productId: esTeh, qty: 6 }],
      discount: 0, shippingFee: 0, platformFee: null, payment: "Via aplikasi", paid: true,
    });
    assert.equal(r.status, 201);
    assert.equal(r.data.platformFee, (2 * 25000 + 6 * 6000) * 0.2);
    assert.equal(r.data.customerWa, "6281234567890");
    assert.equal(r.data.items[0].price, 25000);
    const products = await owner("GET", "/products");
    assert.equal(products.data.find((p: any) => p.id === esTeh).stock, 4);

    const dash = await owner("GET", `/dashboard?today=${today}`);
    assert.equal(dash.data.todayRevenue, 86000);
    assert.equal(dash.data.todayProfit, 86000 - (2 * 11000 + 6 * 1500) - 17200);
    assert.deepEqual(dash.data.lowStock, [{ name: "Es Teh Jumbo", stock: 4 }]);
    assert.equal(dash.data.week[6].revenue, 86000);
  });

  test("batal mengembalikan stok, dibuka lagi memotong stok", async () => {
    const list = await owner("GET", "/orders?filter=semua");
    const id = list.data[0].id;
    await owner("PATCH", `/orders/${id}`, { status: "batal" });
    let p = await owner("GET", "/products");
    assert.equal(p.data.find((x: any) => x.id === esTeh).stock, 10);
    await owner("PATCH", `/orders/${id}`, { status: "selesai" });
    p = await owner("GET", "/products");
    assert.equal(p.data.find((x: any) => x.id === esTeh).stock, 4);
  });

  test("laporan bulanan: omzet − HPP − potongan − biaya − iklan", async () => {
    const now = Date.now();
    assert.equal((await owner("POST", "/expenses", { date: now, category: "Gas & arang", amount: 50000, note: "" })).status, 201);
    assert.equal((await owner("POST", "/ads", { name: "Promo", platform: "TikTok", startDate: now, endDate: now + DAY, spend: 100000, reach: 0, chats: 3, orders: 2, revenue: 50000, note: "" })).status, 201);
    const r = await owner("GET", `/report?from=${now - 2 * DAY}&to=${now + 2 * DAY}`);
    assert.equal(r.data.revenue, 86000);
    assert.equal(r.data.cost, 31000);
    assert.equal(r.data.platformFees, 17200);
    assert.deepEqual(r.data.expenses, [{ category: "Gas & arang", amount: 50000 }]);
    assert.equal(r.data.adSpend, 100000);
    const c = await owner("GET", "/customers");
    assert.equal(c.data[0].orders, 1);
  });

  test("akun staf tidak bisa membuka keuangan, tapi bisa mencatat pesanan", async () => {
    assert.equal((await owner("POST", "/users", { name: "Sari", username: "sari", password: "staf12345", role: "staf" })).status, 201);
    assert.equal((await staff("POST", "/auth/login", { username: "sari", password: "staf12345" })).status, 200);
    assert.equal((await staff("GET", `/report?from=0&to=${Date.now()}`)).status, 403);
    assert.equal((await staff("PUT", `/products/${geprek}`, {})).status, 403);
    const o = await staff("POST", "/orders", {
      channel: "WhatsApp", customerName: "", customerWa: "", address: "", note: "",
      items: [{ productId: geprek, qty: 1 }], discount: 0, shippingFee: 10000, platformFee: null, payment: "Tunai", paid: false,
    });
    assert.equal(o.status, 201);
    assert.equal(o.data.createdBy, "Sari");
  });

  test("ganti kata sandi mengeluarkan sesi lama", async () => {
    const old = client();
    await old("POST", "/auth/login", { username: "pemilik", password: "rahasia123" });
    assert.equal((await owner("PUT", "/auth/password", { currentPassword: "rahasia123", newPassword: "barubaru123" })).status, 200);
    assert.equal((await old("GET", "/products")).status, 401);
    assert.equal((await owner("GET", "/products")).status, 200);
  });

  test("AI tanpa kunci API memberi pesan jelas", async () => {
    const req = { source: "prompt", brief: "Kenalkan menu baru", productId: geprek, platform: "TikTok", style: "Santai", wantImage: false, wantVideo: false };
    const r = await owner("POST", "/ai/generate", req);
    assert.equal(r.status, 503);
    const m = await owner("POST", "/ai/prompt", req);
    assert.match(m.data.text, /Ayam Bakar Madu/);
  });
});
