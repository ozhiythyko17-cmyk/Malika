// Koneksi database. Produksi: PostgreSQL (Neon/Supabase) lewat DATABASE_URL.
// Pengembangan & tes: PGlite (PostgreSQL di dalam proses) bila DATABASE_URL kosong.

export type Row = Record<string, unknown>;
export type Query = <T = Row>(text: string, params?: unknown[]) => Promise<T[]>;

interface Driver {
  query: Query;
  transaction<T>(fn: (q: Query) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

let driver: Promise<Driver> | null = null;

async function connect(): Promise<Driver> {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (url) {
    const { default: postgres } = await import("postgres");
    const sql = postgres(url, { max: 1, prepare: false, idle_timeout: 20 });
    const wrap = (s: typeof sql): Query => (text, params = []) =>
      s.unsafe(text, params as never[]) as unknown as Promise<never[]>;
    return {
      query: wrap(sql),
      transaction: (fn) => sql.begin((tx) => fn(wrap(tx as unknown as typeof sql))) as Promise<never>,
      close: () => sql.end(),
    };
  }
  if (process.env.VERCEL) throw new Error("DATABASE_URL belum diatur di Vercel.");
  const { PGlite } = await import("@electric-sql/pglite");
  // relaxedDurability: di browser (IndexedDB) simpan ke disk tanpa menunggu tiap query — jauh lebih cepat.
  // Versi demo di browser bisa menitipkan opsi tambahan (mis. fsBundle) lewat globalThis.__PGLITE_OPTIONS__.
  const extra = (globalThis as { __PGLITE_OPTIONS__?: object }).__PGLITE_OPTIONS__ ?? {};
  const pg = new PGlite(process.env.PGLITE_DIR || ".data/pglite", { relaxedDurability: true, ...extra });
  await pg.waitReady;
  type PgLike = Pick<typeof pg, "query">;
  const wrap = (p: PgLike): Query => async (text, params = []) => (await p.query(text, params)).rows as never[];
  return {
    query: wrap(pg),
    transaction: (fn) => pg.transaction((tx) => fn(wrap(tx))),
    close: () => pg.close(),
  };
}

let ready: Promise<void> | null = null;

export async function getDb(): Promise<Driver> {
  driver ??= connect();
  const d = await driver;
  ready ??= migrate(d).catch((e) => {
    ready = null;
    throw e;
  });
  await ready;
  return d;
}

/** Untuk tes: tutup koneksi supaya proses bisa selesai. */
export async function closeDb() {
  if (driver) await (await driver).close();
  driver = null;
  ready = null;
}

async function migrate(d: Driver) {
  for (const stmt of SCHEMA) await d.query(stmt);
}

const SCHEMA = [
  `create table if not exists users (
    id serial primary key,
    name text not null,
    username text not null unique,
    password_hash text not null,
    role text not null default 'staf',
    session_version int not null default 1,
    created_at timestamptz not null default now()
  )`,
  `create table if not exists settings (
    id int primary key default 1 check (id = 1),
    data jsonb not null
  )`,
  `create table if not exists products (
    id serial primary key,
    name text not null,
    emoji text not null default '🍱',
    price int not null default 0,
    cost int not null default 0,
    track_stock boolean not null default false,
    stock int not null default 0,
    min_stock int not null default 0,
    active boolean not null default true,
    description text not null default '',
    created_at timestamptz not null default now()
  )`,
  `create table if not exists orders (
    id serial primary key,
    created_at timestamptz not null default now(),
    channel text not null,
    customer_name text not null default '',
    customer_wa text not null default '',
    address text not null default '',
    discount int not null default 0,
    shipping_fee int not null default 0,
    platform_fee int not null default 0,
    payment text not null,
    paid boolean not null default false,
    status text not null default 'baru',
    note text not null default '',
    created_by text not null default ''
  )`,
  `create index if not exists orders_created_at on orders (created_at)`,
  `create table if not exists order_items (
    id serial primary key,
    order_id int not null references orders(id) on delete cascade,
    product_id int not null,
    name text not null,
    price int not null,
    cost int not null,
    qty int not null
  )`,
  `create index if not exists order_items_order on order_items (order_id)`,
  `create table if not exists stock_moves (
    id serial primary key,
    date timestamptz not null default now(),
    product_id int not null references products(id) on delete cascade,
    qty int not null,
    reason text not null
  )`,
  `create table if not exists expenses (
    id serial primary key,
    date timestamptz not null,
    category text not null,
    amount int not null,
    note text not null default ''
  )`,
  `create index if not exists expenses_date on expenses (date)`,
  `create table if not exists contents (
    id serial primary key,
    created_at timestamptz not null default now(),
    product_name text not null,
    platform text not null,
    text text not null
  )`,
  `create table if not exists media (
    id serial primary key,
    created_at timestamptz not null default now(),
    mime text not null,
    data bytea not null,
    prompt text not null default ''
  )`,
  `alter table contents add column if not exists media_id int references media(id) on delete set null`,
  `create table if not exists ad_campaigns (
    id serial primary key,
    name text not null,
    platform text not null,
    start_date timestamptz not null,
    end_date timestamptz not null,
    spend int not null default 0,
    reach int not null default 0,
    chats int not null default 0,
    orders int not null default 0,
    revenue int not null default 0,
    note text not null default ''
  )`,
  // Iklan yang dipasang dari aplikasi ke Meta (Facebook & Instagram).
  `alter table ad_campaigns
     add column if not exists meta_campaign_id text,
     add column if not exists meta_adset_id text,
     add column if not exists meta_ad_id text,
     add column if not exists meta_objective text,
     add column if not exists meta_state text not null default '',
     add column if not exists meta_notice text not null default '',
     add column if not exists daily_budget int,
     add column if not exists clicks int not null default 0,
     add column if not exists autopilot boolean not null default false,
     add column if not exists autopilot_limit int not null default 0,
     add column if not exists synced_at timestamptz`,
];

/** Ekspresi SQL: kolom timestamptz -> milidetik (angka). */
export const ms = (col: string) => `(extract(epoch from ${col}) * 1000)::float8`;
/** Ekspresi SQL: parameter milidetik -> timestamptz. */
export const ts = (param: string) => `to_timestamp(${param}::float8 / 1000)`;
