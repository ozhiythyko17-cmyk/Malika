// Tiruan Meta Marketing API untuk demo: tidak ada iklan sungguhan dan tidak ada biaya.
// Waktu dipercepat: 1 menit nyata = 2 jam iklan, supaya hasil terlihat bergerak saat dicoba.

const KEY = "umkm-demo-meta";
const REVIEW_MS = 45_000; // "ditinjau Meta" selama 45 detik
const SPEEDUP = 120;

interface FakeCampaign {
  status: "ACTIVE" | "PAUSED";
  dailyBudget: number;
  objective: string;
  createdAt: number;
  endTime: number;
  activeMs: number;
  activeSince: number | null;
  quality: number; // 1 = normal, 0 = iklan yang tidak menghasilkan apa-apa
}

let memory: Record<string, FakeCampaign> = {};
function load(): Record<string, FakeCampaign> {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "{}");
  } catch {
    return memory;
  }
}
function save(all: Record<string, FakeCampaign>) {
  memory = all;
  try {
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    // penyimpanan diblokir: cukup di memori
  }
}
const pendingAdsets: Record<string, string> = {}; // adset → campaign

function activeTime(c: FakeCampaign, now: number) {
  return c.activeMs + (c.activeSince ? now - c.activeSince : 0);
}

/** Untuk data contoh: anggap kampanye sudah berjalan beberapa hari. */
export function ageDemoCampaign(id: string, days: number, quality = 1) {
  const all = load();
  const c = all[id];
  if (!c) return;
  c.createdAt -= days * 86_400_000 + REVIEW_MS;
  c.activeMs += Math.round((days * 86_400_000) / SPEEDUP) + REVIEW_MS;
  c.endTime = Math.max(c.endTime - days * 86_400_000, Date.now() + 3_600_000);
  c.quality = quality;
  save(all);
}

function params(url: URL, init?: RequestInit): Record<string, string> {
  const out: Record<string, string> = {};
  const src = init?.body ? new URLSearchParams(String(init.body)) : url.searchParams;
  src.forEach((v, k) => (out[k] = v));
  return out;
}

const id = (prefix: string) => `${prefix}${Date.now()}${Math.floor(Math.random() * 1000)}`;

export async function fakeMetaFetch(input: string, init?: RequestInit): Promise<Response | null> {
  if (!input.startsWith("https://graph.facebook.com/")) return null;
  await new Promise((r) => setTimeout(r, 250));
  const url = new URL(input);
  const path = url.pathname.replace(/^\/v[\d.]+\//, "");
  const method = (init?.method ?? "GET").toUpperCase();
  const p = params(url, init);
  const now = Date.now();
  const all = load();
  const ok = (body: object) => Response.json(body);

  if (method === "GET" && path.startsWith("act_")) return ok({ id: path, name: "Iklan Dapur Bakar (demo)", currency: "IDR", account_status: 1 });
  if (method === "GET" && path === "demo_page") return ok({ id: "demo_page", name: "Dapur Bakar" });
  if (path.endsWith("/adimages")) return ok({ images: { [p.name ?? "gambar"]: { hash: id("hash") } } });
  if (path.endsWith("/campaigns")) {
    const cid = id("demoC");
    all[cid] = {
      status: "PAUSED", dailyBudget: Number(p.daily_budget), objective: p.objective, createdAt: now,
      endTime: now + 7 * 86_400_000, activeMs: 0, activeSince: null, quality: 1,
    };
    save(all);
    return ok({ id: cid });
  }
  if (path.endsWith("/adsets")) {
    const sid = id("demoS");
    pendingAdsets[sid] = p.campaign_id;
    const c = all[p.campaign_id];
    if (c && p.end_time) {
      c.endTime = Date.parse(p.end_time);
      save(all);
    }
    return ok({ id: sid });
  }
  if (path.endsWith("/adcreatives")) return ok({ id: id("demoCr") });
  if (path.endsWith("/ads")) return ok({ id: id("demoA") });

  const [cid, sub] = path.split("/");
  const c = all[cid];
  if (!c) return Response.json({ error: { message: "Tidak ditemukan", code: 100 } }, { status: 400 });

  if (method === "DELETE") {
    delete all[cid];
    save(all);
    return ok({ success: true });
  }
  if (method === "POST") {
    if (p.status === "ACTIVE" && c.status !== "ACTIVE") {
      c.status = "ACTIVE";
      c.activeSince = now;
    } else if (p.status === "PAUSED" && c.status === "ACTIVE") {
      c.activeMs = activeTime(c, now);
      c.activeSince = null;
      c.status = "PAUSED";
    }
    if (p.daily_budget) c.dailyBudget = Number(p.daily_budget);
    save(all);
    return ok({ success: true });
  }

  const ms = Math.max(0, activeTime(c, now) - REVIEW_MS);
  const simDays = Math.min((ms * SPEEDUP) / 86_400_000, Math.max(0, (c.endTime - c.createdAt) / 86_400_000));
  const spend = Math.round(c.dailyBudget * simDays);

  if (sub === "insights") {
    const wa = c.objective === "OUTCOME_ENGAGEMENT";
    const results = c.quality ? Math.floor(spend / (wa ? 9_000 : 1_400)) : 0;
    return ok({
      data: spend
        ? [{
            spend: String(spend),
            reach: String(Math.round(spend / 11)),
            inline_link_clicks: String(wa ? Math.floor(results * 1.6) : results),
            actions: wa && results ? [{ action_type: "onsite_conversion.messaging_conversation_started_7d", value: String(results) }] : [],
          }]
        : [],
    });
  }

  const reviewing = now - c.createdAt < REVIEW_MS;
  return ok({
    effective_status: c.status,
    daily_budget: String(c.dailyBudget),
    adsets: { data: [{ end_time: new Date(c.endTime).toISOString(), effective_status: c.status }] },
    ads: { data: [{ effective_status: reviewing ? "PENDING_REVIEW" : c.status === "ACTIVE" ? "ACTIVE" : "CAMPAIGN_PAUSED" }] },
  });
}
