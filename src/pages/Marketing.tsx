import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, DEFAULT_SETTINGS, type AdCampaign } from "../db";
import { Chips, Empty, Field, MoneyInput, NumberInput, Sheet } from "../components/ui";
import { buildManualPrompt, GOALS, PLATFORMS, STYLES, type ContentRequest } from "../prompt";
import { dateStr, fromInputDate, num, rp, timeStr, toInputDate } from "../utils";

type Tab = "AI Konten" | "Tersimpan" | "Iklan";

export default function Marketing() {
  const [tab, setTab] = useState<Tab>("AI Konten");
  return (
    <div className="stack">
      <h2>Marketing</h2>
      <Chips options={["AI Konten", "Tersimpan", "Iklan"] as Tab[]} value={tab} onChange={setTab} />
      {tab === "AI Konten" && <AiKonten />}
      {tab === "Tersimpan" && <Tersimpan />}
      {tab === "Iklan" && <Iklan />}
    </div>
  );
}

function copy(text: string) {
  navigator.clipboard.writeText(text).then(() => alert("Tersalin! Tinggal tempel di Instagram/TikTok/WA."));
}

function AiKonten() {
  const products = useLiveQuery(() => db.products.filter((p) => p.active).toArray());
  const settings = useLiveQuery(() => db.settings.get("main")) ?? DEFAULT_SETTINGS;
  const [productId, setProductId] = useState<number | null>(null);
  const [platform, setPlatform] = useState(PLATFORMS[0]);
  const [style, setStyle] = useState(settings.brandVoice || STYLES[0]);
  const [goal, setGoal] = useState(GOALS[0]);
  const [promo, setPromo] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [parts, setParts] = useState<string[]>([]);

  const product = products?.find((p) => p.id === productId) ?? products?.[0];

  const request = (): ContentRequest | null =>
    product
      ? {
          businessName: settings.businessName,
          city: settings.city,
          brandDescription: settings.brandDescription,
          brandVoice: settings.brandVoice,
          productName: product.name,
          productDescription: product.description ?? "",
          price: product.price,
          platform, style, goal, promo,
        }
      : null;

  async function generate() {
    const body = request();
    if (!body) return;
    setLoading(true);
    setError("");
    setParts([]);
    try {
      const res = await fetch("/api/konten", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Gagal membuat konten.");
      setParts((json.text as string).split(/^\s*---\s*$/m).map((s) => s.trim()).filter(Boolean));
    } catch (e) {
      setError(navigator.onLine ? (e as Error).message : "Tidak ada internet. Fitur AI butuh koneksi.");
    } finally {
      setLoading(false);
    }
  }

  async function save(text: string) {
    await db.contents.add({ createdAt: Date.now(), productName: product!.name, platform, text });
    alert("Disimpan di tab Tersimpan.");
  }

  if (!products) return null;
  if (products.length === 0) return <Empty icon="✨">Tambahkan produk dulu, lalu AI bisa membuatkan caption.</Empty>;

  return (
    <div className="stack">
      <Field label="Produk">
        <select value={product?.id ?? ""} onChange={(e) => setProductId(Number(e.target.value))}>
          {products?.map((p) => (
            <option key={p.id} value={p.id}>{p.emoji} {p.name}</option>
          ))}
        </select>
      </Field>
      <Field label="Untuk">
        <Chips options={PLATFORMS} value={platform} onChange={setPlatform} />
      </Field>
      <Field label="Gaya bahasa">
        <Chips options={STYLES} value={style} onChange={setStyle} />
      </Field>
      <Field label="Tujuan">
        <Chips options={GOALS} value={goal} onChange={setGoal} />
      </Field>
      <Field label="Detail promo (opsional)" hint="Mis. beli 2 gratis es teh, khusus Jumat">
        <input value={promo} onChange={(e) => setPromo(e.target.value)} />
      </Field>
      <button className="btn primary big" disabled={loading} onClick={generate}>
        {loading ? "⏳ AI sedang menulis…" : "✨ Buatkan caption"}
      </button>

      {error && (
        <div className="alert warn">
          {error}
          <div className="small">
            Sementara bisa pakai cara manual: salin perintah di bawah lalu tempel di aplikasi Claude.
          </div>
          <button className="btn small" onClick={() => copy(buildManualPrompt(request()!))}>📋 Salin perintah AI</button>
        </div>
      )}

      {parts.map((text, i) => (
        <div key={i} className="card result">
          <pre>{text}</pre>
          <div className="row gap">
            <button className="btn small" onClick={() => copy(text)}>📋 Salin</button>
            <button className="btn small" onClick={() => save(text)}>⭐ Simpan</button>
          </div>
        </div>
      ))}
      {parts.length > 0 && (
        <p className="small muted">Baca dulu sebelum diposting — pastikan harga & promo sudah benar. Gambar promo bisa dibuat di Canva.</p>
      )}
    </div>
  );
}

function Tersimpan() {
  const contents = useLiveQuery(() => db.contents.orderBy("createdAt").reverse().toArray());
  if (contents?.length === 0) return <Empty icon="⭐">Belum ada konten tersimpan.</Empty>;
  return (
    <div className="list">
      {contents?.map((c) => (
        <div key={c.id} className="card result">
          <div className="small muted">{timeStr(c.createdAt)} · {c.productName} · {c.platform}</div>
          <pre>{c.text}</pre>
          <div className="row gap">
            <button className="btn small" onClick={() => copy(c.text)}>📋 Salin</button>
            <button className="btn small ghost danger" onClick={() => confirm("Hapus konten ini?") && db.contents.delete(c.id!)}>Hapus</button>
          </div>
        </div>
      ))}
    </div>
  );
}

const AD_PLATFORMS = ["Instagram/Facebook", "TikTok", "GoFood", "GrabFood", "ShopeeFood", "Lainnya"];

function verdict(a: AdCampaign) {
  if (!a.spend) return { label: "Belum ada biaya", cls: "" };
  const roas = a.revenue / a.spend;
  if (roas >= 3) return { label: "BAGUS 👍", cls: "pos" };
  if (roas >= 1.5) return { label: "CUKUP", cls: "warn-text" };
  return { label: "PERLU DIPERBAIKI", cls: "neg" };
}

function Iklan() {
  const ads = useLiveQuery(() => db.ads.orderBy("startDate").reverse().toArray());
  const products = useLiveQuery(() => db.products.filter((p) => p.active && p.price > 0).toArray());
  const [editing, setEditing] = useState<AdCampaign | null>(null);

  const margins = (products ?? []).map((p) => (p.price - p.cost) / p.price);
  const avgMargin = margins.length ? margins.reduce((s, m) => s + m, 0) / margins.length : 0;

  return (
    <div className="stack">
      <div className="alert info small">
        Jalankan iklan seperti biasa di Instagram/Meta Ads atau TikTok, lalu catat hasilnya di sini. Aplikasi menghitung apakah iklannya menguntungkan.
      </div>
      <button
        className="btn primary"
        onClick={() =>
          setEditing({ name: "", platform: AD_PLATFORMS[0], startDate: Date.now(), endDate: Date.now() + 6 * 86_400_000, spend: 0, reach: 0, chats: 0, orders: 0, revenue: 0, note: "" })
        }
      >
        + Catat iklan
      </button>
      {ads?.length === 0 && <Empty icon="📣">Belum ada iklan yang dicatat.</Empty>}
      {ads?.map((a) => {
        const v = verdict(a);
        const profit = a.revenue * avgMargin - a.spend;
        return (
          <button key={a.id} className="card left" onClick={() => setEditing(a)}>
            <div className="row between">
              <b>{a.name || "Iklan"}</b>
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
          Untung perkiraan = penjualan × rata-rata margin produk ({Math.round(avgMargin * 100)}%) − biaya iklan. BAGUS jika penjualan ≥ 3× biaya iklan.
        </p>
      )}
      {editing && <AdForm ad={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function AdForm({ ad, onClose }: { ad: AdCampaign; onClose: () => void }) {
  const [a, setA] = useState(ad);
  const set = <K extends keyof AdCampaign>(k: K, v: AdCampaign[K]) => setA({ ...a, [k]: v });

  async function save() {
    await db.ads.put({ ...a, name: a.name.trim() || "Iklan" });
    onClose();
  }

  return (
    <Sheet title={a.id ? "Ubah catatan iklan" : "Catat iklan"} onClose={onClose}>
      <Field label="Nama iklan">
        <input value={a.name} onChange={(e) => set("name", e.target.value)} placeholder="Mis. Promo Geprek Jumat" />
      </Field>
      <Field label="Platform">
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
      <Field label="Total biaya iklan" hint="Lihat di laporan Meta/TikTok Ads">
        <MoneyInput value={a.spend} onChange={(n) => set("spend", n)} />
      </Field>
      <div className="grid2">
        <Field label="Orang melihat (jangkauan)">
          <NumberInput value={a.reach} onChange={(n) => set("reach", n)} />
        </Field>
        <Field label="Chat / DM masuk">
          <NumberInput value={a.chats} onChange={(n) => set("chats", n)} />
        </Field>
        <Field label="Pesanan dari iklan">
          <NumberInput value={a.orders} onChange={(n) => set("orders", n)} />
        </Field>
        <Field label="Penjualan dari iklan">
          <MoneyInput value={a.revenue} onChange={(n) => set("revenue", n)} />
        </Field>
      </div>
      <Field label="Catatan" hint="Mis. target radius 5 km, umur 20–35, gambar B paling bagus">
        <textarea rows={2} value={a.note} onChange={(e) => set("note", e.target.value)} />
      </Field>
      <div className="stack">
        <button className="btn primary" onClick={save}>Simpan</button>
        {a.id && (
          <button className="btn ghost danger" onClick={async () => { if (confirm("Hapus catatan iklan ini?")) { await db.ads.delete(a.id!); onClose(); } }}>
            Hapus
          </button>
        )}
      </div>
    </Sheet>
  );
}
