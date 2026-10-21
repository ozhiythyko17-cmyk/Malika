import { useEffect, useState } from "react";
import { db, exportBackup, getSettings, importBackup, type Settings } from "../db";
import { Chips, Field, NumberInput } from "../components/ui";
import { STYLES } from "../prompt";
import { dateStr, downloadFile, toInputDate } from "../utils";

export default function Pengaturan() {
  const [s, setS] = useState<Settings | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    getSettings().then(setS);
  }, []);

  if (!s) return null;
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => {
    setS({ ...s, [k]: v });
    setSaved(false);
  };

  async function save() {
    await db.settings.put({ ...s!, channels: s!.channels.filter((c) => c.name.trim()) });
    setSaved(true);
  }

  async function backup() {
    const data = await exportBackup();
    downloadFile(`backup-umkm-plus-${toInputDate(Date.now())}.json`, JSON.stringify(data), "application/json");
    const now = Date.now();
    await db.settings.put({ ...s!, lastBackup: now });
    setS({ ...s!, lastBackup: now });
  }

  async function restore(file: File) {
    if (!confirm("Pulihkan dari backup? Semua data di HP ini akan diganti dengan isi file backup.")) return;
    try {
      await importBackup(JSON.parse(await file.text()));
      alert("Data berhasil dipulihkan.");
      setS(await getSettings());
    } catch (e) {
      alert((e as Error).message || "File backup tidak bisa dibaca.");
    }
  }

  return (
    <div className="stack">
      <h2>Pengaturan</h2>

      <div className="card stack">
        <b>Profil usaha</b>
        <Field label="Nama usaha">
          <input value={s.businessName} onChange={(e) => set("businessName", e.target.value)} />
        </Field>
        <div className="grid2">
          <Field label="Nama pemilik">
            <input value={s.ownerName} onChange={(e) => set("ownerName", e.target.value)} />
          </Field>
          <Field label="WhatsApp usaha">
            <input inputMode="tel" value={s.businessWa} onChange={(e) => set("businessWa", e.target.value)} placeholder="08xx" />
          </Field>
        </div>
        <Field label="Kota / area">
          <input value={s.city} onChange={(e) => set("city", e.target.value)} placeholder="Mis. Bekasi Timur" />
        </Field>
        <Field label="Tentang usaha" hint="Dipakai AI. Mis. 'Rumahan sejak 2021, ayam selalu fresh, sambal diulek tiap pagi'">
          <textarea rows={3} value={s.brandDescription} onChange={(e) => set("brandDescription", e.target.value)} />
        </Field>
        <Field label="Gaya bahasa favorit">
          <Chips options={STYLES} value={s.brandVoice} onChange={(v) => set("brandVoice", v)} />
        </Field>
      </div>

      <div className="card stack">
        <b>Saluran penjualan & potongan aplikasi</b>
        <p className="small muted">Potongan (%) dipotong otomatis dari omzet pesanan saluran itu, supaya untung yang tampil adalah untung sebenarnya.</p>
        {s.channels.map((c, i) => (
          <div key={i} className="channel-row">
            <input
              value={c.name}
              aria-label="Nama saluran"
              onChange={(e) => set("channels", s.channels.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
            />
            <div className="pct">
              <NumberInput value={c.feePct} onChange={(n) => set("channels", s.channels.map((x, j) => (j === i ? { ...x, feePct: n } : x)))} />
              <span>%</span>
            </div>
            <button className="icon-btn" aria-label="Hapus saluran" onClick={() => set("channels", s.channels.filter((_, j) => j !== i))}>
              ✕
            </button>
          </div>
        ))}
        <button className="btn small" onClick={() => set("channels", [...s.channels, { name: "", feePct: 0 }])}>
          + Tambah saluran
        </button>
      </div>

      <button className="btn primary big" onClick={save}>
        {saved ? "✓ Tersimpan" : "Simpan pengaturan"}
      </button>

      <div className="card stack">
        <b>💾 Backup data</b>
        <p className="small">
          Semua data tersimpan <b>di HP/browser ini saja</b>. Kalau HP hilang, rusak, atau data browser dihapus, data ikut hilang. Lakukan backup minimal seminggu sekali dan simpan filenya di Google Drive atau kirim ke WhatsApp sendiri.
        </p>
        <p className="small muted">Backup terakhir: {s.lastBackup ? dateStr(s.lastBackup) : "belum pernah"}</p>
        <button className="btn" onClick={backup}>⬇️ Unduh backup</button>
        <label className="btn ghost">
          ⬆️ Pulihkan dari file backup
          <input type="file" accept="application/json,.json" hidden onChange={(e) => e.target.files?.[0] && restore(e.target.files[0])} />
        </label>
      </div>

      <div className="card stack">
        <b>📱 Pasang di layar utama HP</b>
        <p className="small">
          <b>Android (Chrome):</b> ketuk menu ⋮ → <i>Tambahkan ke layar utama</i> / <i>Instal aplikasi</i>.<br />
          <b>iPhone (Safari):</b> ketuk tombol Bagikan → <i>Tambah ke Layar Utama</i>.
        </p>
      </div>

      <p className="small muted center">UMKM Plus · versi uji coba 0.1</p>
    </div>
  );
}
