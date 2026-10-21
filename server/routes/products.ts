import type { ProductInput } from "../../shared/types.js";
import { getDb, ms } from "../db.js";
import { bool, HttpError, idParam, int, json, oneOf, str, type Ctx } from "../http.js";

export const PRODUCT_COLUMNS = `id, name, emoji, price, cost, track_stock as "trackStock", stock,
  min_stock as "minStock", active, description`;

function parseProduct(b: Record<string, unknown>): ProductInput {
  return {
    name: str(b.name, "Nama produk", { max: 100, required: true }),
    emoji: str(b.emoji, "Ikon", { max: 16 }) || "🍱",
    price: int(b.price, "Harga jual", { max: 100_000_000 }),
    cost: int(b.cost, "Modal", { max: 100_000_000 }),
    trackStock: bool(b.trackStock, "Lacak stok"),
    stock: int(b.stock ?? 0, "Stok", { min: -1_000_000, max: 1_000_000 }),
    minStock: int(b.minStock ?? 0, "Batas stok", { max: 1_000_000 }),
    active: bool(b.active, "Status jual"),
    description: str(b.description, "Deskripsi", { max: 500 }),
  };
}

export async function list() {
  const { query } = await getDb();
  return json(await query(`select ${PRODUCT_COLUMNS} from products order by active desc, name`));
}

export async function create(ctx: Ctx) {
  const p = parseProduct(await ctx.body());
  const { transaction } = await getDb();
  const row = await transaction(async (q) => {
    const [r] = await q<{ id: number }>(
      `insert into products (name, emoji, price, cost, track_stock, stock, min_stock, active, description)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9) returning ${PRODUCT_COLUMNS}`,
      [p.name, p.emoji, p.price, p.cost, p.trackStock, p.trackStock ? p.stock : 0, p.minStock, p.active, p.description]
    );
    if (p.trackStock && p.stock) {
      await q("insert into stock_moves (product_id, qty, reason) values ($1, $2, 'Stok awal')", [r.id, p.stock]);
    }
    return r;
  });
  return json(row, 201);
}

/** Ubah data produk. Stok tidak diubah di sini (pakai endpoint stok agar tercatat riwayatnya). */
export async function update(ctx: Ctx) {
  const id = idParam(ctx);
  const p = parseProduct(await ctx.body());
  const { query } = await getDb();
  const [row] = await query(
    `update products set name = $1, emoji = $2, price = $3, cost = $4, track_stock = $5, min_stock = $6,
     active = $7, description = $8 where id = $9 returning ${PRODUCT_COLUMNS}`,
    [p.name, p.emoji, p.price, p.cost, p.trackStock, p.minStock, p.active, p.description, id]
  );
  if (!row) throw new HttpError(404, "Produk tidak ditemukan.");
  return json(row);
}

export async function remove(ctx: Ctx) {
  const { query } = await getDb();
  await query("delete from products where id = $1", [idParam(ctx)]);
  return json({ ok: true });
}

export async function adjustStock(ctx: Ctx) {
  const id = idParam(ctx);
  const body = await ctx.body();
  const mode = oneOf(body.mode, ["masuk", "koreksi"] as const, "Jenis");
  const qty = int(body.qty, "Jumlah", { min: mode === "masuk" ? 1 : 0, max: 1_000_000 });
  const { transaction } = await getDb();
  const row = await transaction(async (q) => {
    const [p] = await q<{ stock: number }>("select stock from products where id = $1 for update", [id]);
    if (!p) throw new HttpError(404, "Produk tidak ditemukan.");
    const delta = mode === "masuk" ? qty : qty - p.stock;
    const [r] = await q(`update products set stock = stock + $1 where id = $2 returning ${PRODUCT_COLUMNS}`, [delta, id]);
    if (delta !== 0) {
      await q("insert into stock_moves (product_id, qty, reason) values ($1, $2, $3)", [
        id, delta, mode === "masuk" ? "Stok masuk" : "Koreksi hitung ulang",
      ]);
    }
    return r;
  });
  return json(row);
}

export async function moves(ctx: Ctx) {
  const { query } = await getDb();
  return json(
    await query(`select id, ${ms("date")} as date, qty, reason from stock_moves where product_id = $1 order by date desc, id desc limit 20`, [
      idParam(ctx),
    ])
  );
}
