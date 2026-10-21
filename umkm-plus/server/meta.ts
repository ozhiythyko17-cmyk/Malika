// Klien Meta Marketing API (Graph API) untuk memasang & memantau iklan Facebook/Instagram.
// Kredensial dari environment server — token tidak pernah dikirim ke HP.
import { createHmac } from "node:crypto";
import { HttpError } from "./http.js";

export interface MetaConfig {
  token: string;
  adAccountId: string; // selalu berawalan "act_"
  pageId: string;
  instagramUserId: string;
  appSecret: string;
  version: string;
}

export function metaConfig(): { config: MetaConfig | null; missing: string[] } {
  const env = process.env;
  const missing = ["META_ACCESS_TOKEN", "META_AD_ACCOUNT_ID", "META_PAGE_ID"].filter((k) => !env[k]);
  if (missing.length) return { config: null, missing };
  const account = env.META_AD_ACCOUNT_ID!.trim();
  return {
    missing,
    config: {
      token: env.META_ACCESS_TOKEN!.trim(),
      adAccountId: account.startsWith("act_") ? account : `act_${account}`,
      pageId: env.META_PAGE_ID!.trim(),
      instagramUserId: env.META_INSTAGRAM_USER_ID?.trim() ?? "",
      appSecret: env.META_APP_SECRET?.trim() ?? "",
      version: env.META_GRAPH_VERSION?.trim() || "v25.0",
    },
  };
}

export function requireMeta(): MetaConfig {
  const { config } = metaConfig();
  if (!config) throw new HttpError(503, "Akun iklan Meta belum dihubungkan. Lihat panduan di README (bagian Meta Ads).");
  return config;
}

interface GraphError {
  message?: string;
  code?: number;
  error_subcode?: number;
  error_user_title?: string;
  error_user_msg?: string;
}

/** Ubah error Graph API menjadi pesan yang bisa dipahami pemilik usaha. */
function friendly(err: GraphError): string {
  if (err.code === 190) return "Token Meta tidak berlaku atau sudah kedaluwarsa. Buat token baru di Business Manager.";
  if (err.code === 10 || ((err.code ?? 0) >= 200 && (err.code ?? 0) < 300)) {
    return "Token Meta tidak punya izin yang cukup (perlu ads_management & akses ke akun iklan/Page).";
  }
  if (err.code === 17 || err.code === 80004 || err.code === 613) return "Terlalu banyak permintaan ke Meta. Coba lagi beberapa menit lagi.";
  const detail = [err.error_user_title, err.error_user_msg].filter(Boolean).join(": ");
  return `Meta menolak: ${detail || err.message || "kesalahan tidak dikenal"}`;
}

type Params = Record<string, string | number | boolean | object | undefined>;

function encode(params: Params) {
  const out = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined) continue;
    out.set(k, typeof v === "object" ? JSON.stringify(v) : String(v));
  }
  return out;
}

export async function graph<T = Record<string, unknown>>(
  config: MetaConfig,
  method: "GET" | "POST" | "DELETE",
  path: string,
  params: Params = {}
): Promise<T> {
  const auth: Params = { access_token: config.token };
  if (config.appSecret) auth.appsecret_proof = createHmac("sha256", config.appSecret).update(config.token).digest("hex");
  const url = new URL(`https://graph.facebook.com/${config.version}/${path}`);
  let init: RequestInit = { method };
  if (method === "POST") {
    init = { method, body: encode({ ...params, ...auth }), headers: { "Content-Type": "application/x-www-form-urlencoded" } };
  } else {
    url.search = encode({ ...params, ...auth }).toString();
  }

  let res: Response;
  try {
    res = await fetch(url, init);
  } catch {
    throw new HttpError(502, "Tidak bisa terhubung ke Meta. Coba lagi.");
  }
  const body = (await res.json().catch(() => ({}))) as T & { error?: GraphError };
  if (!res.ok || body.error) {
    const err = body.error ?? { message: `HTTP ${res.status}` };
    console.error("Meta", method, path, JSON.stringify(err).slice(0, 500));
    throw new HttpError(err.code === 190 ? 502 : res.status >= 500 ? 502 : 400, friendly(err));
  }
  return body;
}

const ACCOUNT_STATUS: Record<number, string> = {
  1: "Aktif",
  2: "Dinonaktifkan Meta",
  3: "Ada tagihan belum dibayar",
  7: "Sedang ditinjau Meta",
  8: "Menunggu penyelesaian pembayaran",
  9: "Masa tenggang pembayaran",
  100: "Menunggu ditutup",
  101: "Ditutup",
};

export async function accountInfo(config: MetaConfig) {
  const a = await graph<{ id: string; name: string; currency: string; account_status: number }>(config, "GET", config.adAccountId, {
    fields: "name,currency,account_status",
  });
  return {
    id: a.id,
    name: a.name,
    currency: a.currency,
    active: a.account_status === 1,
    statusText: ACCOUNT_STATUS[a.account_status] ?? `Status ${a.account_status}`,
  };
}

/** Unggah gambar ke perpustakaan gambar akun iklan; hasilnya hash untuk materi iklan. */
export async function uploadImage(config: MetaConfig, data: Buffer, filename: string): Promise<string> {
  const r = await graph<{ images?: Record<string, { hash: string }> }>(config, "POST", `${config.adAccountId}/adimages`, {
    bytes: data.toString("base64"),
    name: filename,
  });
  const hash = Object.values(r.images ?? {})[0]?.hash;
  if (!hash) throw new HttpError(502, "Meta tidak mengembalikan hash gambar.");
  return hash;
}

export interface CampaignSnapshot {
  effectiveStatus: string;
  dailyBudget: number;
  adStatus: string;
  reviewFeedback: string;
  endTime: number | null;
  spend: number;
  reach: number;
  clicks: number;
  conversations: number;
}

/** Status & hasil terbaru sebuah kampanye. */
export async function campaignSnapshot(config: MetaConfig, campaignId: string): Promise<CampaignSnapshot> {
  const c = await graph<{
    effective_status?: string;
    daily_budget?: string;
    adsets?: { data?: { end_time?: string }[] };
    ads?: { data?: { effective_status?: string; ad_review_feedback?: Record<string, Record<string, string>> }[] };
  }>(config, "GET", campaignId, {
    fields: "effective_status,daily_budget,adsets{end_time,effective_status},ads{effective_status,ad_review_feedback}",
  });
  const insights = await graph<{ data?: { spend?: string; reach?: string; inline_link_clicks?: string; actions?: { action_type: string; value: string }[] }[] }>(
    config,
    "GET",
    `${campaignId}/insights`,
    { fields: "spend,reach,inline_link_clicks,actions", date_preset: "maximum" }
  );
  const i = insights.data?.[0] ?? {};
  const action = (pred: (t: string) => boolean) =>
    Math.round(Number(i.actions?.find((a) => pred(a.action_type))?.value ?? 0));
  const ad = c.ads?.data?.[0];
  const feedback = Object.values(ad?.ad_review_feedback ?? {})
    .flatMap((group) => Object.values(group))
    .join(" ");
  const end = c.adsets?.data?.[0]?.end_time;
  return {
    effectiveStatus: c.effective_status ?? "UNKNOWN",
    dailyBudget: Math.round(Number(c.daily_budget ?? 0)),
    adStatus: ad?.effective_status ?? "UNKNOWN",
    reviewFeedback: feedback,
    endTime: end ? Date.parse(end) : null,
    spend: Math.round(Number(i.spend ?? 0)),
    reach: Math.round(Number(i.reach ?? 0)),
    clicks: Math.round(Number(i.inline_link_clicks ?? 0)),
    conversations:
      action((t) => t.includes("messaging_conversation_started")) || action((t) => t === "onsite_conversion.total_messaging_connection"),
  };
}
