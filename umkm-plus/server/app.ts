// Router API. Dipanggil oleh api/app.ts (Vercel) dan plugin dev di vite.config.ts.
import type { User } from "../shared/types.js";
import { userFromRequest } from "./auth.js";
import { getDb } from "./db.js";
import { HttpError, json, readBody, type Ctx } from "./http.js";
import * as auth from "./routes/auth.js";
import * as finance from "./routes/finance.js";
import * as marketing from "./routes/marketing.js";
import * as metaAds from "./routes/metaAds.js";
import * as orders from "./routes/orders.js";
import * as products from "./routes/products.js";
import * as settings from "./routes/settings.js";
import * as studio from "./routes/studio.js";

type Access = "masuk" | "pemilik"; // masuk = semua akun yang login; pemilik = khusus pemilik
type Handler = (ctx: Ctx) => Promise<Response> | Response;

const routes: [method: string, path: string, access: Access, handler: Handler][] = [
  ["PUT", "/auth/password", "masuk", auth.changePassword],
  ["GET", "/users", "pemilik", auth.listUsers],
  ["POST", "/users", "pemilik", auth.createUser],
  ["DELETE", "/users/:id", "pemilik", auth.deleteUser],

  ["GET", "/settings", "masuk", settings.get],
  ["PUT", "/settings", "pemilik", settings.save],

  ["GET", "/products", "masuk", products.list],
  ["POST", "/products", "pemilik", products.create],
  ["PUT", "/products/:id", "pemilik", products.update],
  ["DELETE", "/products/:id", "pemilik", products.remove],
  ["POST", "/products/:id/stock", "masuk", products.adjustStock],
  ["GET", "/products/:id/moves", "masuk", products.moves],

  ["GET", "/orders", "masuk", orders.list],
  ["POST", "/orders", "masuk", orders.create],
  ["GET", "/orders/:id", "masuk", orders.get],
  ["PATCH", "/orders/:id", "masuk", orders.update],
  ["DELETE", "/orders/:id", "pemilik", orders.remove],
  ["GET", "/customers", "masuk", orders.customers],

  ["GET", "/dashboard", "masuk", finance.dashboard],
  ["GET", "/report", "pemilik", finance.report],
  ["GET", "/transactions", "pemilik", finance.transactions],
  ["GET", "/expenses", "pemilik", finance.listExpenses],
  ["POST", "/expenses", "pemilik", finance.createExpense],
  ["PUT", "/expenses/:id", "pemilik", finance.updateExpense],
  ["DELETE", "/expenses/:id", "pemilik", finance.deleteExpense],

  ["POST", "/ai/generate", "masuk", studio.generate],
  ["POST", "/ai/image", "masuk", studio.image],
  ["POST", "/ai/prompt", "masuk", studio.manualPrompt],
  ["GET", "/media/:id", "masuk", studio.media],
  ["GET", "/drive/files", "masuk", studio.driveFiles],
  ["GET", "/drive/thumb/:id", "masuk", studio.driveThumb],
  ["GET", "/drive/file/:id", "masuk", studio.driveFile],
  ["GET", "/contents", "masuk", marketing.listContents],
  ["POST", "/contents", "masuk", marketing.createContent],
  ["DELETE", "/contents/:id", "masuk", marketing.deleteContent],
  ["GET", "/ads", "pemilik", marketing.listAds],
  ["POST", "/ads", "pemilik", marketing.createAd],
  ["PUT", "/ads/:id", "pemilik", marketing.updateAd],
  ["DELETE", "/ads/:id", "pemilik", marketing.deleteAd],

  ["GET", "/meta/status", "pemilik", metaAds.status],
  ["POST", "/meta/campaigns", "pemilik", metaAds.launch],
  ["POST", "/meta/sync", "pemilik", metaAds.sync],
  ["POST", "/meta/campaigns/:id/running", "pemilik", metaAds.setRunning],
  ["POST", "/meta/campaigns/:id/budget", "pemilik", metaAds.setBudget],
  ["POST", "/meta/campaigns/:id/autopilot", "pemilik", metaAds.setAutopilot],

  ["GET", "/backup", "pemilik", backup],
];

function match(pattern: string, path: string): Record<string, string> | null {
  const a = pattern.split("/");
  const b = path.split("/");
  if (a.length !== b.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < a.length; i++) {
    if (a[i].startsWith(":")) params[a[i].slice(1)] = decodeURIComponent(b[i]);
    else if (a[i] !== b[i]) return null;
  }
  return params;
}

/** `path` adalah bagian setelah /api, mis. "/orders/12". `url` dipakai untuk membaca query string. */
export async function handle(req: Request, path: string, url = new URL(req.url)): Promise<Response> {
  try {
    const method = req.method.toUpperCase();
    path = "/" + path.replace(/^\/+|\/+$/g, "");

    // Rute tanpa login
    if (path === "/auth/status" && method === "GET") return await auth.status(await userFromRequest(req));
    if (path === "/auth/setup" && method === "POST") return await auth.setup(req);
    if (path === "/auth/login" && method === "POST") return await auth.login(req);
    if (path === "/auth/logout" && method === "POST") return auth.logout(req);
    if (path === "/cron/meta-sync" && method === "GET") return await metaAds.cron(req);
    if (path === "/health" && method === "GET") {
      await getDb();
      return json({ ok: true });
    }

    let allowed = false;
    for (const [m, pattern, access, handler] of routes) {
      const params = match(pattern, path);
      if (!params) continue;
      allowed = true;
      if (m !== method) continue;

      const user = await userFromRequest(req);
      if (!user) throw new HttpError(401, "Silakan masuk dulu.");
      if (access === "pemilik" && user.role !== "pemilik") throw new HttpError(403, "Menu ini khusus pemilik.");
      const ctx: Ctx = { req, url, params, user: user as User, body: () => readBody(req) };
      return await handler(ctx);
    }
    throw new HttpError(allowed ? 405 : 404, allowed ? "Metode tidak didukung." : "Alamat API tidak ditemukan.");
  } catch (e) {
    if (e instanceof HttpError) return json({ error: e.message }, e.status);
    console.error(e);
    return json({ error: "Terjadi kesalahan di server. Coba lagi." }, 500);
  }
}

async function backup() {
  const { query } = await getDb();
  const tables = ["settings", "products", "orders", "order_items", "stock_moves", "expenses", "contents", "ad_campaigns"];
  // Gambar AI (tabel media) tidak ikut karena besar; bisa diunduh satu per satu dari menu Tersimpan.
  const data: Record<string, unknown[]> = {};
  for (const t of tables) data[t] = await query(`select * from ${t} order by 1`);
  data.users = await query("select id, name, username, role, created_at from users order by id");
  return json({ app: "umkm-plus", exportedAt: Date.now(), data });
}
