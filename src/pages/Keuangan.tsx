import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, EXPENSE_CATEGORIES, orderCost, orderRevenue, type Expense } from "../db";
import { Chips, Empty, Field, MoneyInput, Sheet } from "../components/ui";
import { dateStr, downloadFile, fromInputDate, MONTHS, rp, startOfMonth, toCsv, toInputDate } from "../utils";

type Tab = "Laporan" | "Pengeluaran";

export default function Keuangan() {
  const now = new Date();
  const [ym, setYm] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const [tab, setTab] = useState<Tab>("Laporan");
  const [editing, setEditing] = useState<Expense | null>(null);

  const from = startOfMonth(ym.y, ym.m);
  const to = startOfMonth(ym.y, ym.m + 1);

  const data = useLiveQuery(async () => {
    const [orders, expenses, ads, unpaid] = await Promise.all([
      db.orders.where("createdAt").between(from, to, true, false).filter((o) => o.status !== "batal").toArray(),
      db.expenses.where("date").between(from, to, true, false).reverse().sortBy("date"),
      db.ads.where("startDate").between(from, to, true, false).toArray(),
      db.orders.filter((o) => !o.paid && o.status !== "batal").toArray(),
    ]);
    return { orders, expenses, ads, unpaid };
  }, [from, to]);

  const shift = (d: number) => {
    const t = new Date(ym.y, ym.m + d, 1);
    setYm({ y: t.getFullYear(), m: t.getMonth() });
  };

  if (!data) return null;
  const { orders, expenses, ads, unpaid } = data;

  const omzet = orders.reduce((s, o) => s + orderRevenue(o), 0);
  const hpp = orders.reduce((s, o) => s + orderCost(o), 0);
  const fees = orders.reduce((s, o) => s + o.platformFee, 0);
  const adSpend = ads.reduce((s, a) => s + a.spend, 0);
  const byCat = new Map<string, number>();
  for (const e of expenses) byCat.set(e.category, (byCat.get(e.category) ?? 0) + e.amount);
  const opex = expenses.reduce((s, e) => s + e.amount, 0);
  const gross = omzet - hpp;
  const net = gross - fees - opex - adSpend;

  const byChannel = new Map<string, number>();
  for (const o of orders) byChannel.set(o.channel, (byChannel.get(o.channel) ?? 0) + orderRevenue(o));

  const unpaidTotal = unpaid.reduce((s, o) => s + orderRevenue(o) + o.shippingFee, 0);
  const label = `${MONTHS[ym.m]} ${ym.y}`;

  function exportCsv() {
    const rows: (string | number)[][] = [
      [`Laporan ${label}`],
      ["Omzet", omzet], ["Modal produk (HPP)", -hpp], ["Untung kotor", gross],
      ["Potongan aplikasi", -fees],
      ...[...byCat.entries()].map(([c, v]) => [c, -v]),
      ["Iklan", -adSpend], ["Untung bersih", net],
      [],
      ["Tanggal", "Jenis", "Keterangan", "Jumlah"],
      ...orders.map((o) => [dateStr(o.createdAt), "Penjualan", `#${o.id} ${o.channel} ${o.customerName}`, orderRevenue(o)]),
      ...expenses.map((e) => [dateStr(e.date), e.category, e.note, -e.amount]),
      ...ads.map((a) => [dateStr(a.startDate), "Iklan", a.name, -a.spend]),
    ];
    downloadFile(`laporan-${ym.y}-${String(ym.m + 1).padStart(2, "0")}.csv`, toCsv(rows), "text/csv");
  }

  return (
    <div className="stack">
      <div className="row between">
        <h2>Keuangan</h2>
        <button className="btn primary" onClick={() => setEditing({ date: Date.now(), category: EXPENSE_CATEGORIES[0], amount: 0, note: "" })}>
          + Uang keluar
        </button>
      </div>
      <div className="month-nav">
        <button className="icon-btn" aria-label="Bulan sebelumnya" onClick={() => shift(-1)}>‹</button>
        <b>{label}</b>
        <button className="icon-btn" aria-label="Bulan berikutnya" onClick={() => shift(1)}>›</button>
      </div>

      <div className={net >= 0 ? "card hero-num pos-bg" : "card hero-num neg-bg"}>
        <small>Untung bersih {label}</small>
        <b>{rp(net)}</b>
      </div>

      <Chips options={["Laporan", "Pengeluaran"] as Tab[]} value={tab} onChange={setTab} />

      {tab === "Laporan" ? (
        <>
          <table className="tbl card">
            <tbody>
              <tr><td>Omzet ({orders.length} pesanan)</td><td className="r">{rp(omzet)}</td></tr>
              <tr className="muted"><td>− Modal produk (HPP)</td><td className="r">{rp(hpp)}</td></tr>
              <tr className="strong"><td>Untung kotor</td><td className="r">{rp(gross)}</td></tr>
              <tr className="muted"><td>− Potongan aplikasi</td><td className="r">{rp(fees)}</td></tr>
              {[...byCat.entries()].map(([c, v]) => (
                <tr key={c} className="muted"><td>− {c}</td><td className="r">{rp(v)}</td></tr>
              ))}
              <tr className="muted"><td>− Iklan</td><td className="r">{rp(adSpend)}</td></tr>
              <tr className="strong"><td>Untung bersih</td><td className={net >= 0 ? "r pos" : "r neg"}>{rp(net)}</td></tr>
            </tbody>
          </table>
          <p className="small muted">
            Modal produk dihitung dari HPP tiap produk. Kalau belanja bahan juga dicatat sebagai uang keluar "Bahan baku", biaya bahan akan terhitung dua kali — pilih salah satu cara.
          </p>

          {byChannel.size > 0 && (
            <div className="card">
              <b>Omzet per saluran</b>
              {[...byChannel.entries()].sort((a, b) => b[1] - a[1]).map(([c, v]) => (
                <div key={c} className="bar-row">
                  <div className="row between small"><span>{c}</span><span>{rp(v)}</span></div>
                  <div className="prog"><i style={{ width: `${(v / omzet) * 100}%` }} /></div>
                </div>
              ))}
            </div>
          )}

          {unpaid.length > 0 && (
            <div className="alert warn">
              🧾 <b>{unpaid.length} pesanan belum dibayar</b> senilai {rp(unpaidTotal)} (semua bulan). Cek di menu Pesanan.
            </div>
          )}
          <button className="btn" onClick={exportCsv}>⬇️ Unduh laporan (Excel/CSV)</button>
        </>
      ) : (
        <>
          {expenses.length === 0 && <Empty icon="💸">Belum ada uang keluar bulan ini.</Empty>}
          <div className="list">
            {expenses.map((e) => (
              <button key={e.id} className="card row between" onClick={() => setEditing(e)}>
                <div className="left">
                  <b>{e.category}</b>
                  <div className="small muted">{dateStr(e.date)}{e.note && ` · ${e.note}`}</div>
                </div>
                <b className="neg">−{rp(e.amount)}</b>
              </button>
            ))}
          </div>
        </>
      )}

      {editing && <ExpenseForm expense={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function ExpenseForm({ expense, onClose }: { expense: Expense; onClose: () => void }) {
  const [e, setE] = useState(expense);

  async function save() {
    if (e.amount <= 0) return;
    await db.expenses.put(e);
    onClose();
  }

  async function remove() {
    if (!confirm("Hapus catatan ini?")) return;
    await db.expenses.delete(e.id!);
    onClose();
  }

  return (
    <Sheet title={e.id ? "Ubah uang keluar" : "Catat uang keluar"} onClose={onClose}>
      <Field label="Jumlah">
        <MoneyInput value={e.amount} onChange={(amount) => setE({ ...e, amount })} />
      </Field>
      <Field label="Kategori">
        <Chips options={EXPENSE_CATEGORIES} value={e.category} onChange={(category) => setE({ ...e, category })} />
      </Field>
      <Field label="Tanggal">
        <input type="date" value={toInputDate(e.date)} onChange={(ev) => ev.target.value && setE({ ...e, date: fromInputDate(ev.target.value) })} />
      </Field>
      <Field label="Keterangan">
        <input value={e.note} onChange={(ev) => setE({ ...e, note: ev.target.value })} placeholder="Mis. beli gas 2 tabung" />
      </Field>
      <p className="small muted">Biaya iklan dicatat di menu Marketing → Iklan, supaya hasilnya bisa diukur.</p>
      <div className="stack">
        <button className="btn primary" disabled={e.amount <= 0} onClick={save}>Simpan</button>
        {e.id && <button className="btn ghost danger" onClick={remove}>Hapus</button>}
      </div>
    </Sheet>
  );
}
