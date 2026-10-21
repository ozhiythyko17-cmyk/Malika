// Iklan otomatis di Meta (Facebook & Instagram): pasang dari aplikasi, pantau hasil, jeda/lanjut,
// ubah anggaran, dan "autopilot hemat" yang menjeda iklan yang menghabiskan biaya tanpa hasil.
import type { MetaAdState, MetaLaunchInput, MetaObjective, MetaStatus } from "../../shared/types.js";
import { getDb, type Query } from "../db.js";
import { driveThumbnail } from "../google.js";
import { bool, HttpError, idParam, int, json, oneOf, str, type Ctx } from "../http.js";
import { accountInfo, campaignSnapshot, graph, metaConfig, requireMeta, uploadImage, type CampaignSnapshot, type MetaConfig } from "../meta.js";
import { AD_COLUMNS } from "./marketing.js";
import { loadSettings } from "./settings.js";
import { folderFiles } from "./studio.js";

const DAY = 86_400_000;
const MIN_DAILY = 10_000;
const MAX_DAILY = 10_000_000;
const SYNC_EVERY_MS = 3 * 60_000;

export async function status() {
  const { config, missing } = metaConfig();
  if (!config) return json({ connected: false, missing } satisfies MetaStatus);
  try {
    const [account, page] = await Promise.all([
      accountInfo(config),
      graph<{ id: string; name: string }>(config, "GET", config.pageId, { fields: "name" }),
    ]);
    return json({ connected: true, missing: [], account, page: { id: page.id, name: page.name } } satisfies MetaStatus);
  } catch (e) {
    return json({ connected: false, missing: [], error: (e as Error).message } satisfies MetaStatus);
  }
}

function parseLaunch(b: Record<string, unknown>): MetaLaunchInput {
  const objective = oneOf<MetaObjective>(b.objective, ["whatsapp", "link"], "Tujuan iklan");
  const link = str(b.link, "Link tujuan", { max: 500 });
  if (objective === "link" && !/^https:\/\/\S+\.\S+/.test(link)) throw new HttpError(400, "Isi link tujuan yang diawali https://");

  const img = (b.image ?? {}) as Record<string, unknown>;
  let image: MetaLaunchInput["image"];
  if (img.mediaId != null) image = { mediaId: int(img.mediaId, "Gambar", { min: 1, max: 2_147_483_647 }) };
  else if (img.driveFileId != null) image = { driveFileId: str(img.driveFileId, "Gambar", { max: 100, required: true }) };
  else if (typeof img.dataUrl === "string") image = { dataUrl: img.dataUrl };
  else throw new HttpError(400, "Pilih gambar untuk iklan.");

  const ageMin = int(b.ageMin, "Umur minimal", { min: 18, max: 65 });
  const ageMax = int(b.ageMax, "Umur maksimal", { min: 18, max: 65 });
  if (ageMin > ageMax) throw new HttpError(400, "Umur minimal lebih besar dari umur maksimal.");
  const dailyBudget = int(b.dailyBudget, "Anggaran harian", { min: 0, max: MAX_DAILY });
  if (dailyBudget < MIN_DAILY) throw new HttpError(400, `Anggaran harian minimal Rp${MIN_DAILY.toLocaleString("id-ID")}.`);

  return {
    objective,
    link,
    image,
    primaryText: str(b.primaryText, "Teks iklan", { max: 2000, required: true }),
    headline: str(b.headline, "Judul iklan", { max: 80 }),
    radiusKm: int(b.radiusKm, "Jangkauan lokasi", { min: 1, max: 80 }),
    ageMin,
    ageMax,
    dailyBudget,
    days: int(b.days, "Lama iklan", { min: 1, max: 30 }),
    autopilot: bool(b.autopilot, "Autopilot"),
    autopilotLimit: int(b.autopilotLimit ?? 0, "Batas autopilot", { max: MAX_DAILY * 30 }),
  };
}

/** Ambil isi gambar iklan: gambar AI tersimpan, foto Drive, atau gambar dari HP (poster). */
async function adImage(image: MetaLaunchInput["image"]): Promise<{ data: Buffer; name: string }> {
  if ("mediaId" in image) {
    const { query } = await getDb();
    const [row] = await query<{ mime: string; data: Uint8Array }>("select mime, data from media where id = $1", [image.mediaId]);
    if (!row) throw new HttpError(404, "Gambar tidak ditemukan.");
    return { data: Buffer.from(row.data), name: `gambar-${image.mediaId}.${row.mime.includes("png") ? "png" : "jpg"}` };
  }
  if ("driveFileId" in image) {
    if (!(await folderFiles(false)).some((f) => f.id === image.driveFileId && f.kind === "image")) {
      throw new HttpError(400, "Foto tidak ditemukan di folder Drive usaha.");
    }
    const img = await driveThumbnail(image.driveFileId, 1600);
    return { data: img.data, name: `drive-${image.driveFileId}.${img.mime.includes("png") ? "png" : "jpg"}` };
  }
  const m = image.dataUrl.match(/^data:image\/(png|jpeg|jpg|webp);base64,([A-Za-z0-9+/=]+)$/);
  if (!m) throw new HttpError(400, "Format gambar tidak didukung (pakai PNG atau JPG).");
  const data = Buffer.from(m[2], "base64");
  if (data.length > 3_000_000) throw new HttpError(413, "Gambar terlalu besar (maksimal 3 MB).");
  return { data, name: `poster-${Date.now()}.${m[1] === "png" ? "png" : "jpg"}` };
}

export async function launch(ctx: Ctx) {
  const config = requireMeta();
  const input = parseLaunch(await ctx.body());
  const s = await loadSettings();
  if (s.latitude == null || s.longitude == null) {
    throw new HttpError(400, "Lokasi usaha belum diisi di Pengaturan. Lokasi ini dipakai sebagai pusat target iklan.");
  }
  const account = await accountInfo(config);
  if (!account.active) throw new HttpError(400, `Akun iklan belum bisa dipakai: ${account.statusText}.`);
  if (account.currency !== "IDR") {
    throw new HttpError(400, `Akun iklan memakai mata uang ${account.currency}. Aplikasi ini hanya mendukung akun iklan Rupiah (IDR).`);
  }

  const image = await adImage(input.image);
  const hash = await uploadImage(config, image.data, image.name);

  const wa = input.objective === "whatsapp";
  const now = Date.now();
  const end = now + input.days * DAY;
  // Nama yang dilihat pemilik di aplikasi = judul iklan; di Meta Ads Manager ditambah nama usaha & tanggal.
  const title = input.headline || (wa ? "Iklan chat WhatsApp" : "Iklan kunjungan link");
  const label = `${s.businessName} · ${title} · ${new Date(now).toLocaleDateString("id-ID")}`;
  const act = config.adAccountId;

  // Kampanye dibuat dalam keadaan dijeda dan baru diaktifkan setelah semua bagian berhasil dibuat.
  // Bila ada yang gagal, kampanye dihapus supaya tidak ada iklan setengah jadi yang memakan biaya.
  let campaignId: string | null = null;
  try {
    ({ id: campaignId } = await graph<{ id: string }>(config, "POST", `${act}/campaigns`, {
      name: label,
      objective: wa ? "OUTCOME_ENGAGEMENT" : "OUTCOME_TRAFFIC",
      status: "PAUSED",
      special_ad_categories: [],
      daily_budget: input.dailyBudget, // Rupiah: Meta memakai rupiah utuh (offset 1)
      bid_strategy: "LOWEST_COST_WITHOUT_CAP",
    }));

    const adset = await graph<{ id: string }>(config, "POST", `${act}/adsets`, {
      name: `${label} · target`,
      campaign_id: campaignId,
      billing_event: "IMPRESSIONS",
      optimization_goal: wa ? "CONVERSATIONS" : "LINK_CLICKS",
      destination_type: wa ? "WHATSAPP" : "WEBSITE",
      promoted_object: wa ? { page_id: config.pageId } : undefined,
      targeting: {
        geo_locations: {
          custom_locations: [{ latitude: s.latitude, longitude: s.longitude, radius: input.radiusKm, distance_unit: "kilometer" }],
        },
        age_min: input.ageMin,
        age_max: input.ageMax,
        // Wajib diisi sejak v23; 0 = pakai target umur & lokasi persis seperti yang dipilih.
        targeting_automation: { advantage_audience: 0 },
      },
      start_time: new Date(now).toISOString(),
      end_time: new Date(end).toISOString(),
      status: "ACTIVE",
    });

    const creative = await graph<{ id: string }>(config, "POST", `${act}/adcreatives`, {
      name: `${label} · materi`,
      object_story_spec: {
        page_id: config.pageId,
        instagram_user_id: config.instagramUserId || undefined,
        link_data: {
          image_hash: hash,
          link: wa ? "https://api.whatsapp.com/send" : input.link,
          message: input.primaryText,
          name: input.headline || undefined,
          call_to_action: wa
            ? { type: "WHATSAPP_MESSAGE", value: { app_destination: "WHATSAPP" } }
            : { type: "ORDER_NOW", value: { link: input.link } },
        },
      },
    });

    const ad = await graph<{ id: string }>(config, "POST", `${act}/ads`, {
      name: `${label} · iklan`,
      adset_id: adset.id,
      creative: { creative_id: creative.id },
      status: "ACTIVE",
    });

    await graph(config, "POST", campaignId!, { status: "ACTIVE" });

    const { query } = await getDb();
    const [row] = await query(
      `insert into ad_campaigns (name, platform, start_date, end_date, note, meta_campaign_id, meta_adset_id, meta_ad_id,
         meta_objective, meta_state, daily_budget, autopilot, autopilot_limit)
       values ($1, 'Instagram/Facebook', to_timestamp($2::float8 / 1000), to_timestamp($3::float8 / 1000), $4, $5, $6, $7, $8, 'review', $9, $10, $11)
       returning ${AD_COLUMNS}`,
      [title, now, end, "", campaignId, adset.id, ad.id, input.objective, input.dailyBudget, input.autopilot,
        input.autopilot ? Math.max(input.autopilotLimit, MIN_DAILY) : 0]
    );
    return json(row, 201);
  } catch (e) {
    if (campaignId) await graph(config, "DELETE", campaignId).catch(() => {});
    throw e;
  }
}

function toState(s: CampaignSnapshot, now: number): MetaAdState {
  if (s.adStatus === "DISAPPROVED") return "rejected";
  if (s.adStatus === "PENDING_BILLING_INFO") return "billing";
  if (s.effectiveStatus === "DELETED" || s.effectiveStatus === "ARCHIVED") return "ended";
  if (s.endTime && s.endTime <= now) return "ended";
  if (s.effectiveStatus === "PAUSED" || ["PAUSED", "CAMPAIGN_PAUSED", "ADSET_PAUSED"].includes(s.adStatus)) return "paused";
  if (["PENDING_REVIEW", "IN_PROCESS", "PREAPPROVED"].includes(s.adStatus) || s.effectiveStatus === "IN_PROCESS") return "review";
  if (s.effectiveStatus === "ACTIVE" && s.adStatus === "ACTIVE") return "active";
  return "issue";
}

interface MetaRow {
  id: number;
  meta_campaign_id: string;
  meta_objective: MetaObjective;
  meta_notice: string;
  autopilot: boolean;
  autopilot_limit: number;
}

async function syncRow(config: MetaConfig, q: Query, row: MetaRow) {
  const snap = await campaignSnapshot(config, row.meta_campaign_id);
  let state = toState(snap, Date.now());
  let notice = row.meta_notice;
  if (state === "rejected") notice = `Ditolak Meta${snap.reviewFeedback ? `: ${snap.reviewFeedback}` : ". Cek detailnya di Meta Ads Manager."}`;
  if (state === "billing") notice = "Meta butuh info pembayaran. Tambahkan metode pembayaran di akun iklan.";

  // Autopilot hemat: biaya sudah mencapai batas tapi belum ada satu pun hasil → jeda.
  const results = row.meta_objective === "whatsapp" ? snap.conversations : snap.clicks;
  if (row.autopilot && state === "active" && results === 0 && row.autopilot_limit > 0 && snap.spend >= row.autopilot_limit) {
    await graph(config, "POST", row.meta_campaign_id, { status: "PAUSED" });
    state = "paused";
    notice = `Dijeda otomatis oleh autopilot: Rp${snap.spend.toLocaleString("id-ID")} terpakai tanpa satu pun ${
      row.meta_objective === "whatsapp" ? "chat" : "klik"
    }. Coba ganti gambar, teks, atau perluas jangkauan lalu buat iklan baru.`;
  }

  await q(
    `update ad_campaigns set spend = $1, reach = $2, chats = $3, clicks = $4, meta_state = $5, daily_budget = $6,
       meta_notice = $7, synced_at = now() where id = $8`,
    [snap.spend, snap.reach, snap.conversations, snap.clicks, state, snap.dailyBudget || null, notice, row.id]
  );
  return state;
}

async function syncAll(force: boolean) {
  const config = requireMeta();
  const { query } = await getDb();
  const rows = await query<MetaRow>(
    `select id, meta_campaign_id, meta_objective, meta_notice, autopilot, autopilot_limit from ad_campaigns
     where meta_campaign_id is not null and meta_state <> 'ended'
       and ($1 or synced_at is null or synced_at < now() - make_interval(secs => $2::float8))`,
    [force, SYNC_EVERY_MS / 1000]
  );
  const errors: string[] = [];
  for (const row of rows) {
    try {
      await syncRow(config, query, row);
    } catch (e) {
      errors.push((e as Error).message);
    }
  }
  return { synced: rows.length - errors.length, errors };
}

/** Perbarui hasil semua iklan Meta (dipanggil saat tab Iklan dibuka; dibatasi tiap 3 menit kecuali force). */
export async function sync(ctx: Ctx) {
  return json(await syncAll(ctx.url.searchParams.get("force") === "1"));
}

async function metaRow(ctx: Ctx) {
  const { query } = await getDb();
  const [row] = await query<{ meta_campaign_id: string | null; meta_state: MetaAdState }>(
    "select meta_campaign_id, meta_state from ad_campaigns where id = $1",
    [idParam(ctx)]
  );
  if (!row?.meta_campaign_id) throw new HttpError(404, "Iklan Meta tidak ditemukan.");
  return { campaignId: row.meta_campaign_id, state: row.meta_state };
}

async function returnRow(id: number) {
  const { query } = await getDb();
  const [row] = await query(`select ${AD_COLUMNS} from ad_campaigns where id = $1`, [id]);
  return json(row);
}

export async function setRunning(ctx: Ctx) {
  const config = requireMeta();
  const { campaignId, state } = await metaRow(ctx);
  const action = oneOf((await ctx.body()).action, ["pause", "resume"] as const, "Aksi");
  if (action === "resume" && ["ended", "rejected"].includes(state)) {
    throw new HttpError(400, state === "ended" ? "Periode iklan sudah selesai. Buat iklan baru." : "Iklan ditolak Meta. Buat iklan baru dengan materi lain.");
  }
  await graph(config, "POST", campaignId, { status: action === "pause" ? "PAUSED" : "ACTIVE" });
  const { query } = await getDb();
  await query("update ad_campaigns set meta_state = $1, meta_notice = $2 where id = $3", [
    action === "pause" ? "paused" : "active",
    action === "pause" ? "Dijeda oleh pemilik." : "",
    idParam(ctx),
  ]);
  return returnRow(idParam(ctx));
}

export async function setBudget(ctx: Ctx) {
  const config = requireMeta();
  const { campaignId } = await metaRow(ctx);
  const dailyBudget = int((await ctx.body()).dailyBudget, "Anggaran harian", { min: MIN_DAILY, max: MAX_DAILY });
  await graph(config, "POST", campaignId, { daily_budget: dailyBudget });
  const { query } = await getDb();
  await query("update ad_campaigns set daily_budget = $1 where id = $2", [dailyBudget, idParam(ctx)]);
  return returnRow(idParam(ctx));
}

export async function setAutopilot(ctx: Ctx) {
  await metaRow(ctx);
  const b = await ctx.body();
  const autopilot = bool(b.autopilot, "Autopilot");
  const limit = int(b.autopilotLimit ?? 0, "Batas autopilot", { max: MAX_DAILY * 30 });
  const { query } = await getDb();
  await query("update ad_campaigns set autopilot = $1, autopilot_limit = $2 where id = $3", [
    autopilot,
    autopilot ? Math.max(limit, MIN_DAILY) : 0,
    idParam(ctx),
  ]);
  return returnRow(idParam(ctx));
}

/** Dipanggil Vercel Cron sekali sehari (lihat vercel.json) supaya autopilot tetap jalan walau aplikasi tidak dibuka. */
export async function cron(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) throw new HttpError(401, "Tidak diizinkan.");
  if (!metaConfig().config) return json({ synced: 0, errors: [], skipped: "Meta belum dihubungkan" });
  return json(await syncAll(true));
}
