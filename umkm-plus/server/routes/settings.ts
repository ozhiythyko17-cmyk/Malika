import { DEFAULT_SETTINGS, type Settings } from "../../shared/types.js";
import { getDb } from "../db.js";
import { HttpError, int, json, str, type Ctx } from "../http.js";

export async function loadSettings(): Promise<Settings> {
  const { query } = await getDb();
  const [row] = await query<{ data: Partial<Settings> }>("select data from settings where id = 1");
  return { ...DEFAULT_SETTINGS, ...row?.data };
}

export const get = async () => json(await loadSettings());

export async function save(ctx: Ctx) {
  const b = await ctx.body();
  if (!Array.isArray(b.channels) || b.channels.length > 20) throw new HttpError(400, "Daftar saluran tidak valid.");
  const settings: Settings = {
    businessName: str(b.businessName, "Nama usaha", { max: 80, required: true }),
    ownerName: str(b.ownerName, "Nama pemilik", { max: 80 }),
    businessWa: str(b.businessWa, "WhatsApp usaha", { max: 20 }),
    city: str(b.city, "Kota", { max: 80 }),
    brandDescription: str(b.brandDescription, "Tentang usaha", { max: 600 }),
    brandVoice: str(b.brandVoice, "Gaya bahasa", { max: 30 }) || "Santai",
    channels: (b.channels as Record<string, unknown>[])
      .map((c) => ({ name: str(c?.name, "Nama saluran", { max: 40 }), feePct: int(c?.feePct, "Potongan saluran", { max: 100 }) }))
      .filter((c) => c.name),
  };
  if (!settings.channels.length) throw new HttpError(400, "Minimal harus ada satu saluran penjualan.");
  const { query } = await getDb();
  await query(
    "insert into settings (id, data) values (1, $1::jsonb) on conflict (id) do update set data = excluded.data",
    [JSON.stringify(settings)]
  );
  return json(settings);
}
