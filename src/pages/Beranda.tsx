import { useLiveQuery } from "dexie-react-hooks";
import { db, orderCost, orderRevenue } from "../db";
import { num, rp, startOfDay } from "../utils";
import type { Page } from "../App";

const DAY = 86_400_000;

export default function Beranda({ go }: { go: (p: Page) => void }) {
  const data = useLiveQuery(async () => {
    const since = startOfDay() - 6 * DAY;
    const [orders, products, settings, productCount] = await Promise.all([
      db.orders.where("createdAt").aboveOrEqual(since).toArray(),
      db.products.toArray(),
      db.settings.get("main"),
      db.products.count(),
    ]);
    const active = await db.orders.where("status").anyOf("baru", "diproses", "dikirim").count();
    const unpaid = await db.orders.filter((o) => !o.paid && o.status !== "batal").count();
    return { orders: orders.filter((o) => o.status !== "batal"), products, settings, productCount, active, unpaid };
  });

  if (!data) return null;
  const { orders, products, settings, productCount, active, unpaid } = data;

  const today = startOfDay();
  const todayOrders = orders.filter((o) => o.createdAt >= today);
  const omzet = todayOrders.reduce((s, o) => s + orderRevenue(o), 0);
  const untung = todayOrders.reduce((s, o) => s + orderRevenue(o) - orderCost(o) - o.platformFee, 0);

  const days = Array.from({ length: 7 }, (_, i) => {
    const start = today - (6 - i) * DAY;
    const total = orders
      .filter((o) => o.createdAt >= start && o.createdAt < start + DAY)
      .reduce((s, o) => s + orderRevenue(o), 0);
    return { label: new Date(start).toLocaleDateString("id-ID", { weekday: "short" }), total };
  });
  const maxDay = Math.max(1, ...days.map((d) => d.total));
  const week = days.reduce((s, d) => s + d.total, 0);

  const sold = new Map<string, number>();
  for (const o of orders) for (const i of o.items) sold.set(i.name, (sold.get(i.name) ?? 0) + i.qty);
  const top = [...sold.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);

  const low = products.filter((p) => p.active && p.trackStock && p.stock <= p.minStock);
  const backupOld = !settings?.lastBackup || Date.now() - settings.lastBackup > 7 * DAY;

  if (productCount === 0) {
    return (
      <div className="stack">
        <div className="card hero-card">
          <h2>Selamat datang di UMKM Plus 👋</h2>
          <p>Tiga langkah supaya aplikasi siap dipakai jualan:</p>
          <ol>
            <li>Isi nama usaha & nomor WhatsApp di <b>Pengaturan</b>.</li>
            <li>Masukkan produk (menu) beserta harga jual & modalnya.</li>
            <li>Catat pesanan pertama di menu <b>Pesanan</b>.</li>
          </ol>
          <div className="row gap">
            <button className="btn" onClick={() => go("pengaturan")}>⚙️ Pengaturan</button>
            <button className="btn primary" onClick={() => go("produk")}>🍱 Tambah Produk</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="stack">
      <div className="kpis">
        <div className="card kpi">
          <span>Omzet hari ini</span>
          <b>{rp(omzet)}</b>
        </div>
        <div className="card kpi">
          <span>Untung kotor hari ini</span>
          <b className="pos">{rp(untung)}</b>
        </div>
        <div className="card kpi">
          <span>Pesanan hari ini</span>
          <b>{num(todayOrders.length)}</b>
        </div>
        <button className="card kpi link" onClick={() => go("pesanan")}>
          <span>Pesanan aktif</span>
          <b>{num(active)}</b>
          {unpaid > 0 && <small className="neg">{unpaid} belum dibayar</small>}
        </button>
      </div>

      <div className="card">
        <div className="row between">
          <b>Penjualan 7 hari</b>
          <small className="muted">{rp(week)}</small>
        </div>
        <div className="bars">
          {days.map((d, i) => (
            <div key={i} className="bar-col" title={rp(d.total)}>
              <div className={i === 6 ? "bar today" : "bar"} style={{ height: `${(d.total / maxDay) * 100}%` }} />
              <small>{d.label}</small>
            </div>
          ))}
        </div>
      </div>

      {low.length > 0 && (
        <button className="alert warn" onClick={() => go("produk")}>
          ⚠️ <b>Stok menipis:</b> {low.map((p) => `${p.name} (${p.stock})`).join(", ")}
        </button>
      )}

      <div className="card">
        <b>🔥 Terlaris 7 hari</b>
        {top.length === 0 ? (
          <p className="muted">Belum ada penjualan minggu ini.</p>
        ) : (
          <ol className="top-list">
            {top.map(([name, qty]) => (
              <li key={name}>
                <span>{name}</span>
                <b>{num(qty)} porsi</b>
              </li>
            ))}
          </ol>
        )}
        {top.length > 0 && (
          <button className="btn small" onClick={() => go("marketing")}>
            ✨ Buat konten promo untuk {top[0][0]}
          </button>
        )}
      </div>

      {backupOld && (
        <button className="alert info" onClick={() => go("pengaturan")}>
          💾 Data tersimpan di HP ini saja.{" "}
          {settings?.lastBackup ? "Sudah lebih dari seminggu belum backup" : "Kamu belum pernah backup"} — <u>backup sekarang</u>.
        </button>
      )}
    </div>
  );
}
