import { AD_PLATFORMS, type AdInput } from "../../shared/types.js";
import { getDb, ms, ts } from "../db.js";
import { HttpError, idParam, int, json, oneOf, str, time, type Ctx } from "../http.js";

// ---- Konten tersimpan ----

const CONTENT_COLUMNS = `id, ${ms("created_at")} as "createdAt", product_name as "title", platform, text, media_id as "mediaId"`;

export async function listContents() {
  const { query } = await getDb();
  return json(await query(`select ${CONTENT_COLUMNS} from contents order by created_at desc limit 200`));
}

export async function createContent(ctx: Ctx) {
  const b = await ctx.body();
  const { query } = await getDb();
  const mediaId = b.mediaId == null ? null : int(b.mediaId, "Gambar", { min: 1, max: 2_147_483_647 });
  const [row] = await query(
    `insert into contents (product_name, platform, text, media_id) values ($1, $2, $3, $4) returning ${CONTENT_COLUMNS}`,
    [str(b.title, "Judul", { max: 100 }) || "Konten", str(b.platform, "Platform", { max: 40 }), str(b.text, "Teks", { max: 8000 }), mediaId]
  );
  return json(row, 201);
}

export async function deleteContent(ctx: Ctx) {
  const { query } = await getDb();
  await query("delete from contents where id = $1", [idParam(ctx)]);
  return json({ ok: true });
}

// ---- Catatan iklan ----

const AD_COLUMNS = `id, name, platform, ${ms("start_date")} as "startDate", ${ms("end_date")} as "endDate",
  spend, reach, chats, orders, revenue, note`;

function parseAd(b: Record<string, unknown>): AdInput {
  const big = { max: 1_000_000_000 };
  const ad = {
    name: str(b.name, "Nama iklan", { max: 100 }) || "Iklan",
    platform: oneOf(b.platform, AD_PLATFORMS, "Platform"),
    startDate: time(b.startDate, "Tanggal mulai"),
    endDate: time(b.endDate, "Tanggal selesai"),
    spend: int(b.spend, "Biaya", big),
    reach: int(b.reach, "Jangkauan", big),
    chats: int(b.chats, "Chat masuk", big),
    orders: int(b.orders, "Pesanan", big),
    revenue: int(b.revenue, "Penjualan", big),
    note: str(b.note, "Catatan", { max: 500 }),
  };
  if (ad.endDate < ad.startDate) throw new HttpError(400, "Tanggal selesai sebelum tanggal mulai.");
  return ad;
}

const adValues = (a: AdInput) => [a.name, a.platform, a.startDate, a.endDate, a.spend, a.reach, a.chats, a.orders, a.revenue, a.note];

export async function listAds() {
  const { query } = await getDb();
  return json(await query(`select ${AD_COLUMNS} from ad_campaigns order by start_date desc, id desc`));
}

export async function createAd(ctx: Ctx) {
  const a = parseAd(await ctx.body());
  const { query } = await getDb();
  const [row] = await query(
    `insert into ad_campaigns (name, platform, start_date, end_date, spend, reach, chats, orders, revenue, note)
     values ($1, $2, ${ts("$3")}, ${ts("$4")}, $5, $6, $7, $8, $9, $10) returning ${AD_COLUMNS}`,
    adValues(a)
  );
  return json(row, 201);
}

export async function updateAd(ctx: Ctx) {
  const id = idParam(ctx);
  const a = parseAd(await ctx.body());
  const { query } = await getDb();
  const [row] = await query(
    `update ad_campaigns set name = $1, platform = $2, start_date = ${ts("$3")}, end_date = ${ts("$4")}, spend = $5,
     reach = $6, chats = $7, orders = $8, revenue = $9, note = $10 where id = $11 returning ${AD_COLUMNS}`,
    [...adValues(a), id]
  );
  if (!row) throw new HttpError(404, "Catatan iklan tidak ditemukan.");
  return json(row);
}

export async function deleteAd(ctx: Ctx) {
  const { query } = await getDb();
  await query("delete from ad_campaigns where id = $1", [idParam(ctx)]);
  return json({ ok: true });
}
