import type { Dashboard } from "../../shared/types";
import { useApi } from "../api";
import { useSession } from "../App";
import { LoadError } from "../components/ui";
import { num, rp, startOfDay } from "../utils";

export default function Beranda() {
  const { go, isOwner } = useSession();
  const { data, error } = useApi<Dashboard>(`/dashboard?today=${startOfDay()}`);

  if (!data) return <LoadError error={error} />;

  if (data.productCount === 0) {
    return (
      <div className="card hero-card">
        <h2>Selamat datang di UMKM Plus 👋</h2>
        <p>Tiga langkah supaya aplikasi siap dipakai jualan:</p>
        <ol>
          <li>Cek nama usaha, nomor WhatsApp, dan potongan GoFood/GrabFood/ShopeeFood di <b>Pengaturan</b>.</li>
          <li>Masukkan menu beserta harga jual & modal per porsi.</li>
          <li>Catat pesanan pertama di menu <b>Pesanan</b>.</li>
        </ol>
        <div className="row gap">
          <button className="btn" onClick={() => go("pengaturan")}>⚙️ Pengaturan</button>
          <button className="btn primary" onClick={() => go("produk")}>🍱 Tambah Produk</button>
        </div>
      </div>
    );
  }

  const maxDay = Math.max(1, ...data.week.map((d) => d.revenue));
  const weekTotal = data.week.reduce((s, d) => s + d.revenue, 0);

  return (
    <div className="stack">
      <div className="kpis">
        <div className="card kpi">
          <span>Omzet hari ini</span>
          <b>{rp(data.todayRevenue)}</b>
        </div>
        {data.todayProfit !== null ? (
          <div className="card kpi">
            <span>Untung kotor hari ini</span>
            <b className="pos">{rp(data.todayProfit)}</b>
          </div>
        ) : (
          <div className="card kpi">
            <span>Belum dibayar</span>
            <b className={data.unpaidOrders ? "neg" : ""}>{num(data.unpaidOrders)}</b>
          </div>
        )}
        <div className="card kpi">
          <span>Pesanan hari ini</span>
          <b>{num(data.todayOrders)}</b>
        </div>
        <button className="card kpi link" onClick={() => go("pesanan")}>
          <span>Pesanan aktif</span>
          <b>{num(data.activeOrders)}</b>
          {isOwner && data.unpaidOrders > 0 && <small className="neg">{data.unpaidOrders} belum dibayar</small>}
        </button>
      </div>

      <div className="card">
        <div className="row between">
          <b>Penjualan 7 hari</b>
          <small className="muted">{rp(weekTotal)}</small>
        </div>
        <div className="bars">
          {data.week.map((d, i) => (
            <div key={d.day} className="bar-col" title={rp(d.revenue)}>
              <div className={i === 6 ? "bar today" : "bar"} style={{ height: `${(d.revenue / maxDay) * 100}%` }} />
              <small>{new Date(d.day).toLocaleDateString("id-ID", { weekday: "short" })}</small>
            </div>
          ))}
        </div>
      </div>

      {data.lowStock.length > 0 && (
        <button className="alert warn" onClick={() => go("produk")}>
          ⚠️ <b>Stok menipis:</b> {data.lowStock.map((p) => `${p.name} (${p.stock})`).join(", ")}
        </button>
      )}

      <div className="card">
        <b>🔥 Terlaris 7 hari</b>
        {data.top.length === 0 ? (
          <p className="muted">Belum ada penjualan minggu ini.</p>
        ) : (
          <ol className="top-list">
            {data.top.map((t) => (
              <li key={t.name}>
                <span>{t.name}</span>
                <b>{num(t.qty)} porsi</b>
              </li>
            ))}
          </ol>
        )}
        {data.top.length > 0 && (
          <button className="btn small" onClick={() => go("marketing")}>
            ✨ Buat konten promo untuk {data.top[0].name}
          </button>
        )}
      </div>
    </div>
  );
}
