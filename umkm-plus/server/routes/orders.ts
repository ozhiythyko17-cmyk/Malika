import { ORDER_STATUSES, PAYMENT_METHODS, type Order, type OrderItem, type OrderStatus } from "../../shared/types.js";
import { getDb, ms, type Query } from "../db.js";
import { bool, HttpError, idParam, int, json, oneOf, str, type Ctx } from "../http.js";
import { normalizeWa } from "../../shared/format.js";
import { loadSettings } from "./settings.js";

const STATUSES = ORDER_STATUSES.map((s) => s.value);

const ORDER_COLUMNS = `o.id, ${ms("o.created_at")} as "createdAt", o.channel, o.customer_name as "customerName",
  o.customer_wa as "customerWa", o.address, o.discount, o.shipping_fee as "shippingFee",
  o.platform_fee as "platformFee", o.payment, o.paid, o.status, o.note, o.created_by as "createdBy",
  coalesce((select json_agg(json_build_object('productId', i.product_id, 'name', i.name, 'price', i.price,
    'cost', i.cost, 'qty', i.qty) order by i.id) from order_items i where i.order_id = o.id), '[]'::json) as items`;

async function fetchOrder(q: Query, id: number) {
  const [o] = await q<Order>(`select ${ORDER_COLUMNS} from orders o where o.id = $1`, [id]);
  if (!o) throw new HttpError(404, "Pesanan tidak ditemukan.");
  return o;
}

/** Kurangi (sign = -1) atau kembalikan (sign = 1) stok produk yang dilacak. */
async function applyStock(q: Query, items: OrderItem[], sign: 1 | -1, reason: string) {
  for (const i of items) {
    const [p] = await q<{ id: number }>(
      "update products set stock = stock + $1 where id = $2 and track_stock returning id",
      [sign * i.qty, i.productId]
    );
    if (p) await q("insert into stock_moves (product_id, qty, reason) values ($1, $2, $3)", [p.id, sign * i.qty, reason]);
  }
}

export async function list(ctx: Ctx) {
  const filter = oneOf(ctx.url.searchParams.get("filter") ?? "aktif", ["aktif", "selesai", "batal", "semua"] as const, "Filter");
  const where = {
    aktif: "o.status in ('baru','diproses','dikirim') or (not o.paid and o.status <> 'batal')",
    selesai: "o.status = 'selesai'",
    batal: "o.status = 'batal'",
    semua: "true",
  }[filter];
  const { query } = await getDb();
  return json(await query(`select ${ORDER_COLUMNS} from orders o where ${where} order by o.created_at desc limit 300`));
}

export async function get(ctx: Ctx) {
  const { query } = await getDb();
  return json(await fetchOrder(query, idParam(ctx)));
}

export async function create(ctx: Ctx) {
  const b = await ctx.body();
  const settings = await loadSettings();
  const channel = str(b.channel, "Saluran", { max: 40, required: true });
  const payment = oneOf(b.payment, PAYMENT_METHODS, "Metode pembayaran");
  if (!Array.isArray(b.items) || b.items.length === 0 || b.items.length > 50) {
    throw new HttpError(400, "Pilih minimal satu produk.");
  }
  const wanted = (b.items as Record<string, unknown>[]).map((i) => ({
    productId: int(i?.productId, "Produk", { min: 1, max: 2_147_483_647 }),
    qty: int(i?.qty, "Jumlah", { min: 1, max: 10_000 }),
  }));
  const discount = int(b.discount ?? 0, "Diskon", { max: 100_000_000 });
  const shippingFee = int(b.shippingFee ?? 0, "Ongkir", { max: 100_000_000 });
  const fields = {
    customerName: str(b.customerName, "Nama pelanggan", { max: 80 }),
    customerWa: normalizeWa(str(b.customerWa, "No. WhatsApp", { max: 20 })),
    address: str(b.address, "Alamat", { max: 300 }),
    note: str(b.note, "Catatan", { max: 300 }),
    paid: bool(b.paid, "Status bayar"),
  };

  const { transaction } = await getDb();
  const order = await transaction(async (q) => {
    // Harga & modal diambil dari database saat ini, lalu dibekukan di pesanan.
    const items: OrderItem[] = [];
    for (const w of wanted) {
      const [p] = await q<{ name: string; price: number; cost: number }>(
        "select name, price, cost from products where id = $1",
        [w.productId]
      );
      if (!p) throw new HttpError(400, "Ada produk yang sudah dihapus. Muat ulang halaman.");
      items.push({ productId: w.productId, name: p.name, price: p.price, cost: p.cost, qty: w.qty });
    }
    const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
    if (discount > subtotal) throw new HttpError(400, "Diskon lebih besar dari total belanja.");
    const feePct = settings.channels.find((c) => c.name === channel)?.feePct ?? 0;
    const platformFee =
      b.platformFee == null ? Math.round(((subtotal - discount) * feePct) / 100) : int(b.platformFee, "Potongan aplikasi", { max: 100_000_000 });

    const [{ id }] = await q<{ id: number }>(
      `insert into orders (channel, customer_name, customer_wa, address, discount, shipping_fee, platform_fee,
       payment, paid, note, created_by) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) returning id`,
      [channel, fields.customerName, fields.customerWa, fields.address, discount, shippingFee, platformFee,
        payment, fields.paid, fields.note, ctx.user.name]
    );
    for (const i of items) {
      await q("insert into order_items (order_id, product_id, name, price, cost, qty) values ($1,$2,$3,$4,$5,$6)", [
        id, i.productId, i.name, i.price, i.cost, i.qty,
      ]);
    }
    await applyStock(q, items, -1, `Pesanan #${id}`);
    return fetchOrder(q, id);
  });
  return json(order, 201);
}

/** Ubah status dan/atau status bayar. Batal mengembalikan stok; membuka lagi pesanan batal memotong stok lagi. */
export async function update(ctx: Ctx) {
  const id = idParam(ctx);
  const b = await ctx.body();
  const status = b.status === undefined ? undefined : oneOf<OrderStatus>(b.status, STATUSES, "Status");
  const paid = b.paid === undefined ? undefined : bool(b.paid, "Status bayar");
  const { transaction } = await getDb();
  const order = await transaction(async (q) => {
    const [cur] = await q<{ status: OrderStatus }>("select status from orders where id = $1 for update", [id]);
    if (!cur) throw new HttpError(404, "Pesanan tidak ditemukan.");
    if (status && status !== cur.status) {
      const { items } = await fetchOrder(q, id);
      if (status === "batal") await applyStock(q, items, 1, `Batal pesanan #${id}`);
      else if (cur.status === "batal") await applyStock(q, items, -1, `Pesanan #${id} dibuka lagi`);
      await q("update orders set status = $1 where id = $2", [status, id]);
    }
    if (paid !== undefined) await q("update orders set paid = $1 where id = $2", [paid, id]);
    return fetchOrder(q, id);
  });
  return json(order);
}

export async function remove(ctx: Ctx) {
  const id = idParam(ctx);
  const { transaction } = await getDb();
  await transaction(async (q) => {
    const [cur] = await q<{ status: OrderStatus }>("select status from orders where id = $1 for update", [id]);
    if (!cur) return;
    if (cur.status !== "batal") await applyStock(q, (await fetchOrder(q, id)).items, 1, `Hapus pesanan #${id}`);
    await q("delete from orders where id = $1", [id]);
  });
  return json({ ok: true });
}

export async function customers() {
  const { query } = await getDb();
  return json(
    await query(`
      select o.customer_wa as wa,
        (array_agg(o.customer_name order by o.created_at desc))[1] as name,
        count(*)::int as orders,
        sum((select coalesce(sum(i.price * i.qty), 0) from order_items i where i.order_id = o.id) - o.discount)::float8 as spent,
        ${ms("max(o.created_at)")} as "lastOrder"
      from orders o
      where o.customer_wa <> '' and o.status <> 'batal'
      group by o.customer_wa
      order by max(o.created_at) desc
      limit 500`)
  );
}
