import { ChevronLeft, ChevronRight, Download, Plus, ReceiptText, Wallet } from "lucide-react";
import { useState } from "react";
import { EXPENSE_CATEGORIES, type Expense, type ExpenseInput, type Report } from "../../shared/types";
import { api, mutate, useApi } from "../api";
import { Chips, Empty, Field, LoadError, MoneyInput, Sheet, useRun } from "../components/ui";
import { dateStr, downloadFile, fromInputDate, MONTHS, rp, startOfMonth, toCsv, toInputDate } from "../utils";

type Tab = "Laporan" | "Pengeluaran";

export default function Keuangan() {
  const now = new Date();
  const [ym, setYm] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const [tab, setTab] = useState<Tab>("Laporan");
  const [editing, setEditing] = useState<ExpenseInput & { id?: number } | null>(null);
  const [busy, run] = useRun();

  const from = startOfMonth(ym.y, ym.m);
  const to = startOfMonth(ym.y, ym.m + 1);
  const range = `from=${from}&to=${to}`;
  const { data: r, error } = useApi<Report>(`/report?${range}`);
  const { data: expenses } = useApi<Expense[]>(tab === "Pengeluaran" ? `/expenses?${range}` : null);

  const shift = (d: number) => {
    const t = new Date(ym.y, ym.m + d, 1);
    setYm({ y: t.getFullYear(), m: t.getMonth() });
  };
  const label = `${MONTHS[ym.m]} ${ym.y}`;

  const opex = r?.expenses.reduce((s, e) => s + e.amount, 0) ?? 0;
  const gross = r ? r.revenue - r.cost : 0;
  const net = r ? gross - r.platformFees - opex - r.adSpend : 0;

  const exportCsv = () =>
    run(async () => {
      const tx = await api<{ date: number; kind: string; note: string; amount: number }[]>("GET", `/transactions?${range}`);
      const rows: (string | number)[][] = [
        [`Laporan ${label}`],
        ["Omzet", r!.revenue], ["Modal produk (HPP)", -r!.cost], ["Untung kotor", gross],
        ["Potongan aplikasi", -r!.platformFees],
        ...r!.expenses.map((e) => [e.category, -e.amount]),
        ["Iklan", -r!.adSpend], ["Untung bersih", net],
        [],
        ["Tanggal", "Jenis", "Keterangan", "Jumlah"],
        ...tx.map((t) => [dateStr(t.date), t.kind, t.note, t.amount]),
      ];
      downloadFile(`laporan-${ym.y}-${String(ym.m + 1).padStart(2, "0")}.csv`, "﻿" + toCsv(rows), "text/csv");
    });

  return (
    <div className="stack">
      <div className="row between">
        <h2>Keuangan</h2>
        <button className="btn primary" onClick={() => setEditing({ date: Date.now(), category: EXPENSE_CATEGORIES[0], amount: 0, note: "" })}>
          <Plus size={18} /> Uang keluar
        </button>
      </div>
      <div className="month-nav">
        <button className="icon-btn" aria-label="Bulan sebelumnya" onClick={() => shift(-1)}><ChevronLeft size={20} /></button>
        <b>{label}</b>
        <button className="icon-btn" aria-label="Bulan berikutnya" onClick={() => shift(1)}><ChevronRight size={20} /></button>
      </div>
      <LoadError error={error} />

      {r && (
        <div className={net >= 0 ? "card hero-num pos-bg" : "card hero-num neg-bg"}>
          <small>Untung bersih {label}</small>
          <b>{rp(net)}</b>
        </div>
      )}

      <Chips segmented options={["Laporan", "Pengeluaran"] as Tab[]} value={tab} onChange={setTab} />

      {tab === "Laporan" && r && (
        <>
          <table className="tbl card">
            <tbody>
              <tr><td>Omzet ({r.orders} pesanan)</td><td className="r">{rp(r.revenue)}</td></tr>
              <tr className="muted"><td>− Modal produk (HPP)</td><td className="r">{rp(r.cost)}</td></tr>
              <tr className="strong"><td>Untung kotor</td><td className="r">{rp(gross)}</td></tr>
              <tr className="muted"><td>− Potongan aplikasi</td><td className="r">{rp(r.platformFees)}</td></tr>
              {r.expenses.map((e) => (
                <tr key={e.category} className="muted"><td>− {e.category}</td><td className="r">{rp(e.amount)}</td></tr>
              ))}
              <tr className="muted"><td>− Iklan</td><td className="r">{rp(r.adSpend)}</td></tr>
              <tr className="strong"><td>Untung bersih</td><td className={net >= 0 ? "r pos" : "r neg"}>{rp(net)}</td></tr>
            </tbody>
          </table>
          <p className="small muted">
            Modal produk dihitung dari HPP tiap menu. Kalau belanja bahan juga dicatat sebagai uang keluar "Bahan baku", biaya bahan terhitung dua kali — pilih salah satu cara.
          </p>

          {r.byChannel.length > 0 && (
            <div className="card">
              <b>Omzet per saluran</b>
              {r.byChannel.map((c) => (
                <div key={c.channel} className="bar-row">
                  <div className="row between small"><span>{c.channel}</span><span>{rp(c.revenue)}</span></div>
                  <div className="prog"><i style={{ width: `${r.revenue ? (c.revenue / r.revenue) * 100 : 0}%` }} /></div>
                </div>
              ))}
            </div>
          )}

          {r.unpaid.count > 0 && (
            <div className="alert warn">
              <ReceiptText size={18} />
              <span>
                <b>{r.unpaid.count} pesanan belum dibayar</b> senilai {rp(r.unpaid.amount)} (semua bulan). Cek di menu Pesanan.
              </span>
            </div>
          )}
          <button className="btn" disabled={busy} onClick={exportCsv}>
            <Download size={18} /> Unduh laporan (Excel/CSV)
          </button>
        </>
      )}

      {tab === "Pengeluaran" && (
        <>
          {expenses?.length === 0 && <Empty icon={<Wallet size={26} />}>Belum ada uang keluar bulan ini.</Empty>}
          <div className="list">
            {expenses?.map((e) => (
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

function ExpenseForm({ expense, onClose }: { expense: ExpenseInput & { id?: number }; onClose: () => void }) {
  const [e, setE] = useState(expense);
  const [busy, run] = useRun();

  const save = () =>
    run(async () => {
      const body = { date: e.date, category: e.category, amount: e.amount, note: e.note };
      if (e.id) await mutate("PUT", `/expenses/${e.id}`, body);
      else await mutate("POST", "/expenses", body);
      onClose();
    });

  const remove = () =>
    confirm("Hapus catatan ini?") &&
    run(async () => {
      await mutate("DELETE", `/expenses/${e.id}`);
      onClose();
    });

  return (
    <Sheet title={e.id ? "Ubah uang keluar" : "Catat uang keluar"} onClose={onClose}>
      <Field label="Jumlah">
        <MoneyInput value={e.amount} onChange={(amount) => setE({ ...e, amount })} />
      </Field>
      <Field label="Kategori" group>
        <Chips options={EXPENSE_CATEGORIES} value={e.category} onChange={(category) => setE({ ...e, category })} />
      </Field>
      <Field label="Tanggal">
        <input type="date" value={toInputDate(e.date)} onChange={(ev) => ev.target.value && setE({ ...e, date: fromInputDate(ev.target.value) })} />
      </Field>
      <Field label="Keterangan">
        <input value={e.note} onChange={(ev) => setE({ ...e, note: ev.target.value })} placeholder="Mis. beli arang 2 karung" />
      </Field>
      <p className="small muted">Biaya iklan dicatat di menu Marketing → Iklan, supaya hasilnya bisa diukur.</p>
      <div className="stack">
        <button className="btn primary" disabled={e.amount <= 0 || busy} onClick={save}>Simpan</button>
        {e.id && <button className="btn ghost danger" disabled={busy} onClick={remove}>Hapus</button>}
      </div>
    </Sheet>
  );
}
