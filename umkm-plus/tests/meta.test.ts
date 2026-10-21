// Tes iklan otomatis Meta: Graph API ditiru (fetch palsu), database PGlite di memori.
import assert from "node:assert/strict";
import { after, describe, test } from "node:test";

process.env.PGLITE_DIR = "memory://";
if (process.env.TEST_DATABASE_URL) process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
else delete process.env.DATABASE_URL;
for (const k of ["META_ACCESS_TOKEN", "META_AD_ACCOUNT_ID", "META_PAGE_ID", "META_APP_SECRET", "META_INSTAGRAM_USER_ID", "CRON_SECRET"]) delete process.env[k];

type Call = { method: string; path: string; params: Record<string, any> };
const calls: Call[] = [];
const fake = {
  currency: "IDR",
  failCreative: false,
  campaign: { effective_status: "ACTIVE", daily_budget: "50000", adsets: { data: [{ end_time: new Date(Date.now() + 5 * 86_400_000).toISOString() }] }, ads: { data: [{ effective_status: "PENDING_REVIEW" }] } } as any,
  insights: { data: [] } as any,
};

const realFetch = globalThis.fetch;
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const req = new Request(input, init);
  const url = new URL(req.url);
  if (url.hostname !== "graph.facebook.com") return realFetch(input, init);
  const raw = req.method === "POST" ? new URLSearchParams(await req.text()) : url.searchParams;
  const params: Record<string, any> = {};
  raw.forEach((v, k) => {
    try {
      params[k] = /^[[{]/.test(v) ? JSON.parse(v) : v;
    } catch {
      params[k] = v;
    }
  });
  const path = url.pathname.replace(/^\/v[\d.]+\//, "");
  calls.push({ method: req.method, path, params });

  const ok = (body: object) => Response.json(body);
  if (req.method === "GET" && path === "act_123") return ok({ id: "act_123", name: "Iklan Dapur Bakar", currency: fake.currency, account_status: 1 });
  if (req.method === "GET" && path === "999") return ok({ id: "999", name: "Dapur Bakar" });
  if (path === "act_123/adimages") return ok({ images: { [params.name]: { hash: "HASH123" } } });
  if (path === "act_123/campaigns") return ok({ id: "C1" });
  if (path === "act_123/adsets") return ok({ id: "S1" });
  if (path === "act_123/adcreatives") {
    if (fake.failCreative) {
      return Response.json({ error: { message: "Invalid", code: 100, error_user_title: "Halaman belum terhubung", error_user_msg: "Hubungkan WhatsApp ke Page." } }, { status: 400 });
    }
    return ok({ id: "CR1" });
  }
  if (path === "act_123/ads") return ok({ id: "A1" });
  if (path === "C1" && req.method === "GET") return ok(fake.campaign);
  if (path === "C1/insights") return ok(fake.insights);
  if (path === "C1") return ok({ success: true });
  return Response.json({ error: { message: `unexpected ${req.method} ${path}`, code: 100 } }, { status: 400 });
}) as typeof fetch;

const { handle } = await import("../server/app.js");
const { closeDb, getDb } = await import("../server/db.js");
after(closeDb);

function client() {
  let cookie = "";
  return async (method: string, path: string, body?: unknown, headers: Record<string, string> = {}) => {
    const res = await handle(
      new Request(`http://localhost/api${path}`, {
        method,
        headers: { "content-type": "application/json", cookie, ...headers },
        body: body === undefined ? undefined : JSON.stringify(body),
      }),
      path.split("?")[0]
    );
    const set = res.headers.get("set-cookie");
    if (set) cookie = set.split(";")[0];
    return { status: res.status, data: (await res.json()) as any };
  };
}
const owner = client();
const staff = client();
const anon = client();

const PNG = "data:image/png;base64," + Buffer.from([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]).toString("base64");
const launchBody = (over: object = {}) => ({
  objective: "whatsapp", link: "", image: { dataUrl: PNG }, primaryText: "Ayam bakar madu, pesan via WA!", headline: "Ayam Bakar Madu",
  radiusKm: 5, ageMin: 20, ageMax: 45, dailyBudget: 50000, days: 7, autopilot: true, autopilotLimit: 40000, ...over,
});
const find = (method: string, path: string) => calls.find((c) => c.method === method && c.path === path)!;

describe("Iklan otomatis Meta", () => {
  test("belum dihubungkan: status menyebut pengaturan yang kurang", async () => {
    await owner("POST", "/auth/setup", { name: "Pemilik", username: "pemilik", password: "rahasia123" });
    const r = await owner("GET", "/meta/status");
    assert.equal(r.data.connected, false);
    assert.deepEqual(r.data.missing, ["META_ACCESS_TOKEN", "META_AD_ACCOUNT_ID", "META_PAGE_ID"]);
    assert.equal((await owner("POST", "/meta/campaigns", launchBody())).status, 503);
  });

  test("terhubung: nama akun iklan & Page tampil", async () => {
    Object.assign(process.env, { META_ACCESS_TOKEN: "TOKEN", META_AD_ACCOUNT_ID: "123", META_PAGE_ID: "999", META_APP_SECRET: "rahasia-app" });
    const r = await owner("GET", "/meta/status");
    assert.equal(r.data.connected, true);
    assert.equal(r.data.account.currency, "IDR");
    assert.equal(r.data.page.name, "Dapur Bakar");
    const c = find("GET", "act_123");
    assert.equal(c.params.access_token, "TOKEN");
    assert.match(c.params.appsecret_proof, /^[0-9a-f]{64}$/);
  });

  test("lokasi usaha wajib, akun non-Rupiah ditolak", async () => {
    assert.equal((await owner("POST", "/meta/campaigns", launchBody())).status, 400);
    const s = (await owner("GET", "/settings")).data;
    assert.equal((await owner("PUT", "/settings", { ...s, latitude: -6.2383, longitude: null })).status, 400);
    assert.equal((await owner("PUT", "/settings", { ...s, latitude: -6.2383, longitude: 106.9756 })).status, 200);
    fake.currency = "USD";
    const r = await owner("POST", "/meta/campaigns", launchBody());
    assert.equal(r.status, 400);
    assert.match(r.data.error, /IDR/);
    fake.currency = "IDR";
    assert.equal((await owner("POST", "/meta/campaigns", launchBody({ dailyBudget: 5000 }))).status, 400);
  });

  test("pasang iklan Chat WhatsApp: kampanye → target → materi → iklan → aktif", async () => {
    calls.length = 0;
    const r = await owner("POST", "/meta/campaigns", launchBody());
    assert.equal(r.status, 201, JSON.stringify(r.data));
    assert.deepEqual(calls.filter((c) => c.method === "POST").map((c) => c.path), [
      "act_123/adimages", "act_123/campaigns", "act_123/adsets", "act_123/adcreatives", "act_123/ads", "C1",
    ]);
    const camp = find("POST", "act_123/campaigns").params;
    assert.equal(camp.objective, "OUTCOME_ENGAGEMENT");
    assert.equal(camp.status, "PAUSED");
    assert.equal(camp.daily_budget, "50000");
    assert.deepEqual(camp.special_ad_categories, []);
    const adset = find("POST", "act_123/adsets").params;
    assert.equal(adset.destination_type, "WHATSAPP");
    assert.equal(adset.optimization_goal, "CONVERSATIONS");
    assert.deepEqual(adset.promoted_object, { page_id: "999" });
    assert.deepEqual(adset.targeting.geo_locations.custom_locations[0], { latitude: -6.2383, longitude: 106.9756, radius: 5, distance_unit: "kilometer" });
    assert.deepEqual(adset.targeting.targeting_automation, { advantage_audience: 0 });
    assert.equal(adset.targeting.age_min, 20);
    assert.ok(Date.parse(adset.end_time) - Date.parse(adset.start_time) === 7 * 86_400_000);
    const creative = find("POST", "act_123/adcreatives").params.object_story_spec;
    assert.equal(creative.page_id, "999");
    assert.equal(creative.instagram_user_id, undefined);
    assert.equal(creative.link_data.image_hash, "HASH123");
    assert.deepEqual(creative.link_data.call_to_action, { type: "WHATSAPP_MESSAGE", value: { app_destination: "WHATSAPP" } });
    assert.deepEqual(find("POST", "act_123/ads").params.creative, { creative_id: "CR1" });
    assert.equal(calls.at(-1)!.params.status, "ACTIVE");
    assert.equal(r.data.meta.state, "review");
    assert.equal(r.data.meta.objective, "whatsapp");
    assert.equal(r.data.meta.autopilotLimit, 40000);
  });

  test("pasang iklan ke link (mis. GoFood): Traffic + tombol Pesan Sekarang, gambar dari galeri", async () => {
    const { query } = await getDb();
    const [m] = await query<{ id: number }>("insert into media (mime, data) values ('image/png', $1::bytea) returning id", [Buffer.from([1, 2, 3])]);
    assert.equal((await owner("POST", "/meta/campaigns", launchBody({ objective: "link", link: "gofood.co.id/x" }))).status, 400);
    calls.length = 0;
    const r = await owner("POST", "/meta/campaigns", launchBody({ objective: "link", link: "https://gofood.co.id/dapur-bakar", image: { mediaId: m.id } }));
    assert.equal(r.status, 201, JSON.stringify(r.data));
    assert.equal(find("POST", "act_123/adimages").params.bytes, Buffer.from([1, 2, 3]).toString("base64"));
    assert.equal(find("POST", "act_123/campaigns").params.objective, "OUTCOME_TRAFFIC");
    const adset = find("POST", "act_123/adsets").params;
    assert.equal(adset.optimization_goal, "LINK_CLICKS");
    assert.equal(adset.promoted_object, undefined);
    const cta = find("POST", "act_123/adcreatives").params.object_story_spec.link_data;
    assert.equal(cta.link, "https://gofood.co.id/dapur-bakar");
    assert.deepEqual(cta.call_to_action, { type: "ORDER_NOW", value: { link: "https://gofood.co.id/dapur-bakar" } });
  });

  test("gagal di tengah jalan: kampanye setengah jadi dihapus, pesan Meta diteruskan", async () => {
    fake.failCreative = true;
    calls.length = 0;
    const before = (await owner("GET", "/ads")).data.length;
    const r = await owner("POST", "/meta/campaigns", launchBody());
    fake.failCreative = false;
    assert.equal(r.status, 400);
    assert.match(r.data.error, /Hubungkan WhatsApp ke Page/);
    assert.ok(calls.some((c) => c.method === "DELETE" && c.path === "C1"));
    assert.ok(!calls.some((c) => c.path === "act_123/ads"));
    assert.equal((await owner("GET", "/ads")).data.length, before);
  });

  test("sinkron hasil: biaya, jangkauan, chat WhatsApp, status berjalan", async () => {
    const { query } = await getDb();
    await query("delete from ad_campaigns where meta_objective = 'link'");
    fake.campaign.ads.data[0].effective_status = "ACTIVE";
    fake.insights = { data: [{ spend: "45000", reach: "9100", inline_link_clicks: "70", actions: [{ action_type: "onsite_conversion.messaging_conversation_started_7d", value: "12" }] }] };
    const r = await owner("POST", "/meta/sync");
    assert.deepEqual(r.data, { synced: 1, errors: [] });
    const ad = (await owner("GET", "/ads")).data.find((a: any) => a.meta);
    assert.equal(ad.spend, 45000);
    assert.equal(ad.reach, 9100);
    assert.equal(ad.chats, 12);
    assert.equal(ad.meta.state, "active");
    assert.ok(ad.meta.syncedAt > 0);
    assert.equal((await owner("POST", "/meta/sync")).data.synced, 0, "dibatasi tiap 3 menit");
  });

  test("autopilot hemat: biaya mencapai batas tanpa chat → iklan dijeda otomatis", async () => {
    fake.insights = { data: [{ spend: "41000", reach: "8000", actions: [] }] };
    calls.length = 0;
    await owner("POST", "/meta/sync?force=1");
    assert.equal(find("POST", "C1").params.status, "PAUSED");
    const ad = (await owner("GET", "/ads")).data.find((a: any) => a.meta);
    assert.equal(ad.meta.state, "paused");
    assert.match(ad.meta.notice, /Dijeda otomatis/);
  });

  test("jeda/lanjut, ubah anggaran, catat penjualan manual", async () => {
    const id = (await owner("GET", "/ads")).data.find((a: any) => a.meta).id;
    calls.length = 0;
    const resumed = await owner("POST", `/meta/campaigns/${id}/running`, { action: "resume" });
    assert.equal(resumed.data.meta.state, "active");
    assert.equal(find("POST", "C1").params.status, "ACTIVE");
    const budget = await owner("POST", `/meta/campaigns/${id}/budget`, { dailyBudget: 75000 });
    assert.equal(budget.data.meta.dailyBudget, 75000);
    assert.equal(calls.at(-1)!.params.daily_budget, "75000");
    const row = (await owner("GET", "/ads")).data.find((a: any) => a.id === id);
    const upd = await owner("PUT", `/ads/${id}`, { ...row, spend: 1, orders: 9, revenue: 270000 });
    assert.equal(upd.data.orders, 9);
    assert.equal(upd.data.spend, row.spend, "biaya tetap dari Meta");
  });

  test("iklan ditolak Meta: alasan ditampilkan dan tidak bisa dilanjutkan", async () => {
    fake.campaign.ads.data[0] = { effective_status: "DISAPPROVED", ad_review_feedback: { global: { "Klaim berlebihan": "Teks iklan memuat klaim yang tidak bisa dibuktikan." } } };
    await owner("POST", "/meta/sync?force=1");
    const ad = (await owner("GET", "/ads")).data.find((a: any) => a.meta);
    assert.equal(ad.meta.state, "rejected");
    assert.match(ad.meta.notice, /klaim yang tidak bisa dibuktikan/);
    assert.equal((await owner("POST", `/meta/campaigns/${ad.id}/running`, { action: "resume" })).status, 400);
  });

  test("staf tidak bisa memasang iklan; cron butuh kunci rahasia", async () => {
    await owner("POST", "/users", { name: "Sari", username: "sari", password: "staf12345", role: "staf" });
    await staff("POST", "/auth/login", { username: "sari", password: "staf12345" });
    assert.equal((await staff("POST", "/meta/campaigns", launchBody())).status, 403);
    assert.equal((await staff("GET", "/meta/status")).status, 403);
    assert.equal((await anon("GET", "/cron/meta-sync")).status, 401);
    process.env.CRON_SECRET = "cron-rahasia";
    assert.equal((await anon("GET", "/cron/meta-sync", undefined, { authorization: "Bearer salah" })).status, 401);
    const ok = await anon("GET", "/cron/meta-sync", undefined, { authorization: "Bearer cron-rahasia" });
    assert.equal(ok.status, 200);
    assert.deepEqual(ok.data, { synced: 1, errors: [] }, "cron menyinkron semua iklan yang belum berakhir");
  });
});
