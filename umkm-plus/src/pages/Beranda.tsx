import { ChevronRight, Plus, Settings, Sparkles, TrendingUp, TriangleAlert } from "lucide-react";
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
      <div className="card welcome">
        <h2>Selamat datang di UMKM Plus</h2>
        <p className="muted">Tiga langkah supaya aplikasi siap dipakai jualan:</p>
        <ol>
          <li>Cek nama usaha, nomor WhatsApp, dan potongan GoFood/GrabFood/ShopeeFood di <b>Pengaturan</b>.</li>
          <li>Masukkan menu beserta harga jual & modal per porsi.</li>
          <li>Catat pesanan pertama di menu <b>Pesanan</b>.</li>
        </ol>
        <div className="row gap">
          <button className="btn ghost" onClick={() => go("pengaturan")}>
            <Settings size={18} /> Pengaturan
          </button>
          <button className="btn primary" onClick={() => go("produk")}>
            <Plus size={18} /> Tambah produk
          </button>
        </div>
      </div>
    );
  }

  const maxDay = Math.max(1, ...data.week.map((d) => d.revenue));
  const weekTotal = data.week.reduce((s, d) => s + d.revenue, 0);
  const today = new Date().toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long" });

  return (
    <div className="stack">
      <div className="hero-card">
        <div>
          <div className="hero-label">Omzet hari ini · {today}</div>
          <div className="hero-value">{rp(data.todayRevenue)}</div>
        </div>
        <div className="hero-split">
          {data.todayProfit !== null ? (
            <div>
              <small>Untung kotor</small>
              <b>{rp(data.todayProfit)}</b>
            </div>
          ) : (
            <div>
              <small>Belum dibayar</small>
              <b>{num(data.unpaidOrders)} pesanan</b>
            </div>
          )}
          <div>
            <small>Pesanan hari ini</small>
            <b>{num(data.todayOrders)}</b>
          </div>
        </div>
      </div>

      <button className="card kpi link row between" onClick={() => go("pesanan")}>
        <div>
          <span>Pesanan aktif</span>
          <b>{num(data.activeOrders)}</b>
          {isOwner && data.unpaidOrders > 0 && <small className="neg">{data.unpaidOrders} belum dibayar</small>}
        </div>
        <ChevronRight size={20} className="muted" />
      </button>

      <div className="card">
        <div className="row between">
          <b>Penjualan 7 hari</b>
          <span className="small muted">{rp(weekTotal)}</span>
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
          <TriangleAlert size={18} />
          <span>
            <b>Stok menipis:</b> {data.lowStock.map((p) => `${p.name} (${p.stock})`).join(", ")}
          </span>
        </button>
      )}

      <div className="card">
        <div className="section-title">
          <TrendingUp size={18} /> Terlaris 7 hari
        </div>
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
            <Sparkles size={16} /> Buat promo {data.top[0].name}
          </button>
        )}
      </div>
    </div>
  );
}
