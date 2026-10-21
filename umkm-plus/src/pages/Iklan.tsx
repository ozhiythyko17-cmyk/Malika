import { Bot, CircleCheck, Link, Megaphone, MessageCircle, Pause, Play, Plus, ReceiptText, RefreshCw, Wallet } from "lucide-react";
import { useEffect, useState } from "react";
import { AD_PLATFORMS, type AdCampaign, type AdInput, type MetaAdState, type MetaStatus, type Product } from "../../shared/types";
import { api, invalidate, mutate, useApi } from "../api";
import AdWizard, { type AdDraft } from "../components/AdWizard";
import { Alert, Chips, Empty, Field, LoadError, MoneyInput, NumberInput, Sheet, Spinner, useRun } from "../components/ui";
import { dateStr, fromInputDate, num, rp, toInputDate } from "../utils";

const STATE: Record<MetaAdState, { label: string; cls: string }> = {
  review: { label: "Ditinjau Meta", cls: "st-baru" },
  active: { label: "Berjalan", cls: "st-selesai" },
  paused: { label: "Dijeda", cls: "st-diproses" },
  rejected: { label: "Ditolak Meta", cls: "neg" },
  billing: { label: "Perlu pembayaran", cls: "neg" },
  issue: { label: "Ada masalah", cls: "st-diproses" },
  ended: { label: "Selesai", cls: "st-batal" },
};

function verdict(a: AdCampaign) {
  if (!a.spend) return { label: "Belum ada biaya", cls: "" };
  if (!a.revenue) return { label: "Catat penjualannya", cls: "muted" };
  const roas = a.revenue / a.spend;
  if (roas >= 3) return { label: "BAGUS", cls: "pos" };
  if (roas >= 1.5) return { label: "CUKUP", cls: "warn-text" };
  return { label: "PERLU DIPERBAIKI", cls: "neg" };
}

function ago(t: number | null) {
  if (!t) return "belum pernah";
  const m = Math.round((Date.now() - t) / 60_000);
  if (m < 1) return "baru saja";
  if (m < 60) return `${m} menit lalu`;
  const h = Math.round(m / 60);
  return h < 24 ? `${h} jam lalu` : `${Math.round(h / 24)} hari lalu`;
}

export default function Iklan({ draft, onDraftUsed }: { draft: AdDraft | null; onDraftUsed: () => void }) {
  const meta = useApi<MetaStatus>("/meta/status");
  const { data: ads, error } = useApi<AdCampaign[]>("/ads");
  const { data: products } = useApi<Product[]>("/products");
  const [wizard, setWizard] = useState<{ draft: AdDraft | null } | null>(null);
  const [editing, setEditing] = useState<(AdInput & { id?: number; meta?: AdCampaign["meta"] }) | null>(null);
  const [syncing, setSyncing] = useState(false);
  const connected = meta.data?.connected === true;

  useEffect(() => {
    if (draft) {
      setWizard({ draft });
      onDraftUsed();
    }
  }, [draft, onDraftUsed]);

  const sync = async (force: boolean) => {
    setSyncing(true);
    try {
      const r = await api<{ synced: number; errors: string[] }>("POST", `/meta/sync${force ? "?force=1" : ""}`);
      if (r.synced) invalidate();
      if (force && r.errors.length) alert(r.errors[0]);
    } catch (e) {
      if (force) alert((e as Error).message);
    } finally {
      setSyncing(false);
    }
  };

  // Ambil hasil terbaru dari Meta setiap kali tab ini dibuka (server membatasi tiap 3 menit).
  useEffect(() => {
    if (connected) sync(false);
  }, [connected]);

  const margins = (products ?? []).filter((p) => p.active && p.price > 0).map((p) => (p.price - p.cost) / p.price);
  const avgMargin = margins.length ? margins.reduce((s, m) => s + m, 0) / margins.length : 0;
  const metaAds = ads?.filter((a) => a.meta) ?? [];
  const manualAds = ads?.filter((a) => !a.meta) ?? [];

  return (
    <div className="stack">
      <MetaConnection status={meta.data} error={meta.error} onLaunch={() => setWizard({ draft: null })} />

      {metaAds.length > 0 && (
        <div className="row between">
          <b>Iklan dari aplikasi</b>
          <button className="btn small" disabled={syncing} onClick={() => sync(true)}>
            {syncing ? <><Spinner size={16} /> Memperbarui…</> : <><RefreshCw size={16} /> Perbarui dari Meta</>}
          </button>
        </div>
      )}
      {metaAds.map((a) => (
        <MetaAdCard key={a.id} ad={a} avgMargin={avgMargin} onRecord={() => setEditing(a)} />
      ))}

      <div className="row between">
        <b>Catatan iklan manual</b>
        <button
          className="btn small"
          onClick={() =>
            setEditing({ name: "", platform: AD_PLATFORMS[0], startDate: Date.now(), endDate: Date.now() + 6 * 86_400_000, spend: 0, reach: 0, chats: 0, orders: 0, revenue: 0, note: "" })
          }
        >
          <Plus size={16} /> Catat iklan lain
        </button>
      </div>
      <p className="small muted">Untuk iklan yang dijalankan di luar aplikasi (TikTok Ads, iklan GoFood/GrabFood, dll.).</p>
      <LoadError error={error} />
      {ads && ads.length === 0 && <Empty icon={<Megaphone size={26} />}>Belum ada iklan.</Empty>}
      {manualAds.map((a) => {
        const v = verdict(a);
        const profit = a.revenue * avgMargin - a.spend;
        return (
          <button key={a.id} className="card left" onClick={() => setEditing(a)}>
            <div className="row between">
              <b>{a.name}</b>
              <b className={v.cls}>{v.label}</b>
            </div>
            <div className="small muted">{a.platform} · {dateStr(a.startDate)} – {dateStr(a.endDate)}</div>
            <div className="ad-stats">
              <div><small>Biaya</small><b>{rp(a.spend)}</b></div>
              <div><small>Chat masuk</small><b>{num(a.chats)}</b></div>
              <div><small>Pesanan</small><b>{num(a.orders)}</b></div>
              <div><small>Biaya / pesanan</small><b>{a.orders ? rp(a.spend / a.orders) : "–"}</b></div>
              <div><small>Penjualan</small><b>{rp(a.revenue)}</b></div>
              <div><small>Untung (perkiraan)</small><b className={profit >= 0 ? "pos" : "neg"}>{rp(profit)}</b></div>
            </div>
          </button>
        );
      })}
      {ads && ads.length > 0 && (
        <p className="small muted">
          Untung perkiraan = penjualan × rata-rata margin menu ({Math.round(avgMargin * 100)}%) − biaya iklan. BAGUS jika penjualan ≥ 3× biaya iklan.
        </p>
      )}

      {wizard && <AdWizard draft={wizard.draft} meta={meta.data} onClose={() => setWizard(null)} />}
      {editing && <AdForm ad={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function MetaConnection({ status, error, onLaunch }: { status: MetaStatus | undefined; error: string | null; onLaunch: () => void }) {
  if (error) return <Alert tone="warn">{error}</Alert>;
  if (!status) return <div className="card muted small">Memeriksa akun Meta Ads…</div>;
  if (status.connected && status.account) {
    return (
      <div className="card stack">
        <b className="section-title"><Megaphone size={18} /> Iklan Facebook & Instagram</b>
        <div className="small icon-line ok">
          <CircleCheck size={17} />
          <span>
            Terhubung ke akun iklan <b>{status.account.name}</b> · Page <b>{status.page?.name}</b>
            {!status.account.active && <span className="neg"> · {status.account.statusText}</span>}
          </span>
        </div>
        <p className="small muted">Pilih gambar & teks, tentukan target sekitar usaha dan anggaran — aplikasi memasang, memantau, dan bisa menjeda otomatis iklan yang boros.</p>
        <button className="btn primary big" onClick={onLaunch}>
          <Plus size={20} /> Pasang iklan baru
        </button>
      </div>
    );
  }
  return (
    <div className="card stack">
      <b className="section-title"><Megaphone size={18} /> Hubungkan Meta Ads</b>
      <p className="small">
        Dengan akun iklan Meta yang terhubung, iklan Facebook & Instagram bisa dipasang, dipantau, dan dijeda langsung dari aplikasi ini — tanpa membuka Ads Manager.
      </p>
      {status.error ? (
        <Alert tone="warn" className="small">{status.error}</Alert>
      ) : (
        <p className="small muted">
          Yang belum diisi di pengaturan server (Vercel): {status.missing.join(", ")}. Langkahnya ada di panduan README bagian "Meta Ads".
        </p>
      )}
      <button className="btn" onClick={onLaunch}>Lihat contoh pemasangan iklan</button>
    </div>
  );
}

function MetaAdCard({ ad: a, avgMargin, onRecord }: { ad: AdCampaign; avgMargin: number; onRecord: () => void }) {
  const m = a.meta!;
  const [busy, run] = useRun();
  const [sheet, setSheet] = useState<"budget" | "autopilot" | null>(null);
  const st = STATE[m.state] ?? STATE.issue;
  const wa = m.objective === "whatsapp";
  const results = wa ? a.chats : m.clicks;
  const v = verdict(a);
  const profit = a.revenue * avgMargin - a.spend;
  const canResume = m.state === "paused" || m.state === "issue";
  const canPause = m.state === "active" || m.state === "review";

  const running = (action: "pause" | "resume") => run(() => mutate("POST", `/meta/campaigns/${a.id}/running`, { action }));

  return (
    <div className="card stack">
      <div className="row between">
        <b>{a.name}</b>
        <span className={`badge dot ${st.cls}`}>{st.label}</span>
      </div>
      <div className="small muted icon-line">
        {wa ? <MessageCircle size={15} /> : <Link size={15} />}
        <span>
          {wa ? "Chat WhatsApp" : "Kunjungan link"} · {rp(m.dailyBudget)}/hari · {dateStr(a.startDate)} – {dateStr(a.endDate)}
        </span>
      </div>
      {m.notice && (
        <Alert tone={m.state === "rejected" || m.state === "billing" ? "warn" : "info"} className="small">
          {m.notice}
        </Alert>
      )}
      <div className="ad-stats">
        <div><small>Biaya</small><b>{rp(a.spend)}</b></div>
        <div><small>Orang melihat</small><b>{num(a.reach)}</b></div>
        <div><small>{wa ? "Chat masuk" : "Klik"}</small><b>{num(results)}</b></div>
        <div><small>{wa ? "Biaya / chat" : "Biaya / klik"}</small><b>{results ? rp(a.spend / results) : "–"}</b></div>
        <div><small>Pesanan · Penjualan</small><b>{num(a.orders)} · {rp(a.revenue)}</b></div>
        <div><small>Untung (perkiraan)</small><b className={profit >= 0 ? "pos" : "neg"}>{a.revenue ? rp(profit) : "–"}</b></div>
      </div>
      <div className="row between small">
        <span className={v.cls}>{v.label}</span>
        <span className="muted">Data Meta: {ago(m.syncedAt)}</span>
      </div>
      <div className="small icon-line">
        <Bot size={16} />
        <span>Autopilot: {m.autopilot ? `jeda otomatis bila ${rp(m.autopilotLimit)} habis tanpa ${wa ? "chat" : "klik"}` : "mati"}</span>
      </div>
      <div className="row gap">
        {canPause && (
          <button className="btn small" disabled={busy} onClick={() => running("pause")}>
            <Pause size={16} /> Jeda
          </button>
        )}
        {canResume && (
          <button className="btn small" disabled={busy} onClick={() => running("resume")}>
            <Play size={16} /> Lanjutkan
          </button>
        )}
        {m.state !== "ended" && m.state !== "rejected" && (
          <>
            <button className="btn small" onClick={() => setSheet("budget")}>
              <Wallet size={16} /> Anggaran
            </button>
            <button className="btn small" onClick={() => setSheet("autopilot")}>
              <Bot size={16} /> Autopilot
            </button>
          </>
        )}
        <button className="btn small" onClick={onRecord}>
          <ReceiptText size={16} /> Catat penjualan
        </button>
      </div>
      {sheet === "budget" && <BudgetSheet ad={a} onClose={() => setSheet(null)} />}
      {sheet === "autopilot" && <AutopilotSheet ad={a} onClose={() => setSheet(null)} />}
    </div>
  );
}

function BudgetSheet({ ad, onClose }: { ad: AdCampaign; onClose: () => void }) {
  const [daily, setDaily] = useState(ad.meta!.dailyBudget);
  const [busy, run] = useRun();
  const days = Math.max(0, Math.ceil((ad.endDate - Date.now()) / 86_400_000));
  return (
    <Sheet title="Ubah anggaran harian" onClose={onClose}>
      <Field label="Anggaran per hari" hint="Minimal Rp10.000. Perubahan berlaku mulai hari ini.">
        <MoneyInput value={daily} onChange={setDaily} />
      </Field>
      <div className="row gap">
        {[0.8, 1.2, 1.5].map((f) => (
          <button key={f} className="btn small" onClick={() => setDaily(Math.round((ad.meta!.dailyBudget * f) / 1000) * 1000)}>
            {f < 1 ? "−20%" : `+${Math.round((f - 1) * 100)}%`}
          </button>
        ))}
      </div>
      <p className="small muted">Sisa {days} hari → maksimal biaya tambahan ±{rp(daily * days)}.</p>
      <button
        className="btn primary"
        disabled={busy || daily < 10_000}
        onClick={() => run(async () => { await mutate("POST", `/meta/campaigns/${ad.id}/budget`, { dailyBudget: daily }); onClose(); })}
      >
        Simpan anggaran
      </button>
    </Sheet>
  );
}

function AutopilotSheet({ ad, onClose }: { ad: AdCampaign; onClose: () => void }) {
  const m = ad.meta!;
  const [on, setOn] = useState(m.autopilot);
  const [limit, setLimit] = useState(m.autopilotLimit || m.dailyBudget);
  const [busy, run] = useRun();
  return (
    <Sheet title="Autopilot hemat" onClose={onClose}>
      <p className="small">
        Aplikasi memeriksa iklan setiap kali tab Iklan dibuka dan sekali sehari secara otomatis. Bila biaya sudah mencapai batas tapi belum ada satu pun {m.objective === "whatsapp" ? "chat" : "klik"}, iklan dijeda supaya uang tidak terbuang.
      </p>
      <label className="check">
        <input type="checkbox" checked={on} onChange={(e) => setOn(e.target.checked)} /> Nyalakan autopilot
      </label>
      {on && (
        <Field label="Batas biaya tanpa hasil">
          <MoneyInput value={limit} onChange={setLimit} />
        </Field>
      )}
      <button
        className="btn primary"
        disabled={busy}
        onClick={() => run(async () => { await mutate("POST", `/meta/campaigns/${ad.id}/autopilot`, { autopilot: on, autopilotLimit: limit }); onClose(); })}
      >
        Simpan
      </button>
    </Sheet>
  );
}

function AdForm({ ad, onClose }: { ad: AdInput & { id?: number; meta?: AdCampaign["meta"] }; onClose: () => void }) {
  const [a, setA] = useState(ad);
  const [busy, run] = useRun();
  const set = <K extends keyof AdInput>(k: K, v: AdInput[K]) => setA({ ...a, [k]: v });
  const fromMeta = Boolean(ad.meta);

  const save = () =>
    run(async () => {
      const { id, meta: _meta, ...body } = a;
      if (id) await mutate("PUT", `/ads/${id}`, body);
      else await mutate("POST", "/ads", body);
      onClose();
    });
  const remove = () =>
    confirm(fromMeta ? "Hapus catatan ini dari aplikasi? Iklan di Meta tidak ikut dihapus." : "Hapus catatan iklan ini?") &&
    run(async () => {
      await mutate("DELETE", `/ads/${a.id}`);
      onClose();
    });

  return (
    <Sheet title={fromMeta ? "Catat hasil penjualan iklan" : a.id ? "Ubah catatan iklan" : "Catat iklan"} onClose={onClose}>
      <Field label="Nama iklan">
        <input value={a.name} onChange={(e) => set("name", e.target.value)} placeholder="Mis. Promo Ayam Bakar Jumat" />
      </Field>
      {fromMeta ? (
        <p className="small muted">Biaya, jangkauan, dan chat diambil otomatis dari Meta. Catat di sini pesanan & penjualan yang datang dari iklan ini.</p>
      ) : (
        <>
          <Field label="Platform" group>
            <Chips options={AD_PLATFORMS} value={a.platform} onChange={(v) => set("platform", v)} />
          </Field>
          <div className="grid2">
            <Field label="Mulai">
              <input type="date" value={toInputDate(a.startDate)} onChange={(e) => e.target.value && set("startDate", fromInputDate(e.target.value))} />
            </Field>
            <Field label="Selesai">
              <input type="date" value={toInputDate(a.endDate)} onChange={(e) => e.target.value && set("endDate", fromInputDate(e.target.value))} />
            </Field>
          </div>
          <Field label="Total biaya iklan" hint="Lihat di laporan TikTok Ads / aplikasi iklan">
            <MoneyInput value={a.spend} onChange={(n) => set("spend", n)} />
          </Field>
          <div className="grid2">
            <Field label="Orang melihat (jangkauan)">
              <NumberInput value={a.reach} onChange={(n) => set("reach", n)} />
            </Field>
            <Field label="Chat / DM masuk">
              <NumberInput value={a.chats} onChange={(n) => set("chats", n)} />
            </Field>
          </div>
        </>
      )}
      <div className="grid2">
        <Field label="Pesanan dari iklan">
          <NumberInput value={a.orders} onChange={(n) => set("orders", n)} />
        </Field>
        <Field label="Penjualan dari iklan">
          <MoneyInput value={a.revenue} onChange={(n) => set("revenue", n)} />
        </Field>
      </div>
      <Field label="Catatan" hint="Mis. gambar B paling banyak chat">
        <textarea rows={2} value={a.note} onChange={(e) => set("note", e.target.value)} />
      </Field>
      <div className="stack">
        <button className="btn primary" disabled={busy} onClick={save}>Simpan</button>
        {a.id && <button className="btn ghost danger" disabled={busy} onClick={remove}>Hapus catatan</button>}
      </div>
    </Sheet>
  );
}
