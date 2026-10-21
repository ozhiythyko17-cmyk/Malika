import { EXPENSE_CATEGORIES, type Dashboard, type ExpenseInput, type Report } from "../../shared/types.js";
import { getDb, ms, ts } from "../db.js";
import { HttpError, idParam, int, json, oneOf, str, time, type Ctx } from "../http.js";

const DAY = 86_400_000;

// Omzet pesanan = subtotal item − diskon (ongkir tidak termasuk). Pesanan batal tidak dihitung.
const ORDER_TOTALS = `
  select o.id, o.created_at, o.channel, o.discount, o.platform_fee, o.paid, o.status, o.shipping_fee,
    coalesce(sum(i.price * i.qty), 0) - o.discount as revenue,
    coalesce(sum(i.cost * i.qty), 0) as cost
  from orders o left join order_items i on i.order_id = o.id
  group by o.id`;

function range(ctx: Ctx) {
  const from = time(ctx.url.searchParams.get("from"), "Tanggal awal");
  const to = time(ctx.url.searchParams.get("to"), "Tanggal akhir");
  if (to <= from) throw new HttpError(400, "Rentang tanggal tidak valid.");
  return { from, to };
}

/** Ringkasan Beranda. `today` = awal hari ini menurut jam HP pengguna (ms). */
export async function dashboard(ctx: Ctx) {
  const today = time(ctx.url.searchParams.get("today"), "Tanggal");
  const weekStart = today - 6 * DAY;
  const { query } = await getDb();

  const [t] = await query<{ revenue: number; profit: number; orders: number }>(
    `select coalesce(sum(revenue), 0)::float8 as revenue,
       coalesce(sum(revenue - cost - platform_fee), 0)::float8 as profit, count(*)::int as orders
     from (${ORDER_TOTALS}) x where status <> 'batal' and created_at >= ${ts("$1")}`,
    [today]
  );
  const [counts] = await query<{ active: number; unpaid: number; products: number }>(
    `select (select count(*) from orders where status in ('baru','diproses','dikirim'))::int as active,
       (select count(*) from orders where not paid and status <> 'batal')::int as unpaid,
       (select count(*) from products)::int as products`
  );
  const days = await query<{ day: number; revenue: number }>(
    `select floor((${ms("created_at")} - $1::float8) / ${DAY})::int as day, sum(revenue)::float8 as revenue
     from (${ORDER_TOTALS}) x where status <> 'batal' and created_at >= ${ts("$1")} group by 1`,
    [weekStart]
  );
  const top = await query<{ name: string; qty: number }>(
    `select i.name, sum(i.qty)::int as qty from order_items i join orders o on o.id = i.order_id
     where o.status <> 'batal' and o.created_at >= ${ts("$1")} group by i.name order by qty desc limit 3`,
    [weekStart]
  );
  const lowStock = await query<{ name: string; stock: number }>(
    "select name, stock from products where active and track_stock and stock <= min_stock order by stock"
  );

  const result: Dashboard = {
    todayRevenue: t.revenue,
    todayProfit: ctx.user.role === "pemilik" ? t.profit : null, // untung hanya untuk pemilik
    todayOrders: t.orders,
    activeOrders: counts.active,
    unpaidOrders: counts.unpaid,
    week: Array.from({ length: 7 }, (_, i) => ({
      day: weekStart + i * DAY,
      revenue: days.find((d) => d.day === i)?.revenue ?? 0,
    })),
    top,
    lowStock,
    productCount: counts.products,
  };
  return json(result);
}

export async function report(ctx: Ctx) {
  const { from, to } = range(ctx);
  const { query } = await getDb();
  const p = [from, to];
  const inRange = (col: string) => `${col} >= ${ts("$1")} and ${col} < ${ts("$2")}`;

  const [o] = await query<{ orders: number; revenue: number; cost: number; fees: number }>(
    `select count(*)::int as orders, coalesce(sum(revenue), 0)::float8 as revenue,
       coalesce(sum(cost), 0)::float8 as cost, coalesce(sum(platform_fee), 0)::float8 as fees
     from (${ORDER_TOTALS}) x where status <> 'batal' and ${inRange("created_at")}`,
    p
  );
  const expenses = await query<{ category: string; amount: number }>(
    `select category, sum(amount)::float8 as amount from expenses where ${inRange("date")}
     group by category order by amount desc`,
    p
  );
  const [ads] = await query<{ spend: number }>(
    `select coalesce(sum(spend), 0)::float8 as spend from ad_campaigns where ${inRange("start_date")}`,
    p
  );
  const byChannel = await query<{ channel: string; revenue: number }>(
    `select channel, sum(revenue)::float8 as revenue from (${ORDER_TOTALS}) x
     where status <> 'batal' and ${inRange("created_at")} group by channel order by revenue desc`,
    p
  );
  const [unpaid] = await query<{ count: number; amount: number }>(
    `select count(*)::int as count, coalesce(sum(revenue + shipping_fee), 0)::float8 as amount
     from (${ORDER_TOTALS}) x where not paid and status <> 'batal'`
  );

  const result: Report = {
    orders: o.orders,
    revenue: o.revenue,
    cost: o.cost,
    platformFees: o.fees,
    expenses,
    adSpend: ads.spend,
    byChannel,
    unpaid,
  };
  return json(result);
}

/** Semua transaksi dalam rentang, untuk diunduh sebagai CSV. */
export async function transactions(ctx: Ctx) {
  const { from, to } = range(ctx);
  const { query } = await getDb();
  return json(
    await query(
      `select * from (
         select ${ms("created_at")} as date, 'Penjualan' as kind,
           '#' || id || ' ' || channel as note, revenue::float8 as amount
         from (${ORDER_TOTALS}) x where status <> 'batal' and created_at >= ${ts("$1")} and created_at < ${ts("$2")}
         union all
         select ${ms("date")}, category, note, -amount::float8 from expenses where date >= ${ts("$1")} and date < ${ts("$2")}
         union all
         select ${ms("start_date")}, 'Iklan', name, -spend::float8 from ad_campaigns where start_date >= ${ts("$1")} and start_date < ${ts("$2")}
       ) t order by date`,
      [from, to]
    )
  );
}

function parseExpense(b: Record<string, unknown>): ExpenseInput {
  return {
    date: time(b.date, "Tanggal"),
    category: oneOf(b.category, EXPENSE_CATEGORIES, "Kategori"),
    amount: int(b.amount, "Jumlah", { min: 1, max: 1_000_000_000 }),
    note: str(b.note, "Keterangan", { max: 200 }),
  };
}

const EXPENSE_COLUMNS = `id, ${ms("date")} as date, category, amount, note`;

export async function listExpenses(ctx: Ctx) {
  const { from, to } = range(ctx);
  const { query } = await getDb();
  return json(
    await query(
      `select ${EXPENSE_COLUMNS} from expenses where date >= ${ts("$1")} and date < ${ts("$2")} order by date desc, id desc`,
      [from, to]
    )
  );
}

export async function createExpense(ctx: Ctx) {
  const e = parseExpense(await ctx.body());
  const { query } = await getDb();
  const [row] = await query(
    `insert into expenses (date, category, amount, note) values (${ts("$1")}, $2, $3, $4) returning ${EXPENSE_COLUMNS}`,
    [e.date, e.category, e.amount, e.note]
  );
  return json(row, 201);
}

export async function updateExpense(ctx: Ctx) {
  const id = idParam(ctx);
  const e = parseExpense(await ctx.body());
  const { query } = await getDb();
  const [row] = await query(
    `update expenses set date = ${ts("$1")}, category = $2, amount = $3, note = $4 where id = $5 returning ${EXPENSE_COLUMNS}`,
    [e.date, e.category, e.amount, e.note, id]
  );
  if (!row) throw new HttpError(404, "Catatan tidak ditemukan.");
  return json(row);
}

export async function deleteExpense(ctx: Ctx) {
  const { query } = await getDb();
  await query("delete from expenses where id = $1", [idParam(ctx)]);
  return json({ ok: true });
}
