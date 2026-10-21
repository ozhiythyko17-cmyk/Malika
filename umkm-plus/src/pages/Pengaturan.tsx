import { Check, DatabaseBackup, Download, FolderOpen, KeyRound, LocateFixed, LogOut, MapPin, Percent, Plus, Smartphone, Store, Users, X } from "lucide-react";
import { useEffect, useState } from "react";
import type { Role, Settings, User } from "../../shared/types";
import { STYLES } from "../../shared/prompt";
import { api, mutate, useApi } from "../api";
import { useSession } from "../App";
import { Chips, Field, NumberInput, Sheet, useRun } from "../components/ui";
import { downloadFile, toInputDate } from "../utils";

export default function Pengaturan() {
  const { isOwner, logout, user } = useSession();
  return (
    <div className="stack">
      <h2>Pengaturan</h2>
      {isOwner && <ProfilUsaha />}
      {isOwner && <Akun />}
      <GantiSandi />
      {isOwner && <Backup />}
      <div className="card stack">
        <b className="section-title"><Smartphone size={18} /> Pasang di layar utama HP</b>
        <p className="small">
          <b>Android (Chrome):</b> ketuk menu ⋮ → <i>Tambahkan ke layar utama</i> / <i>Instal aplikasi</i>.<br />
          <b>iPhone (Safari):</b> ketuk tombol Bagikan → <i>Tambah ke Layar Utama</i>.
        </p>
      </div>
      <button className="btn ghost danger" onClick={logout}>
        <LogOut size={18} /> Keluar dari akun {user.username}
      </button>
      <p className="small muted center">UMKM Plus · versi uji coba 0.2</p>
    </div>
  );
}

const COORD = /^\s*(-?\d{1,2}(?:\.\d+)?)\s*[,;\s]\s*(-?\d{1,3}(?:\.\d+)?)\s*$/;
const coordText = (x: Settings) => (x.latitude != null && x.longitude != null ? `${x.latitude}, ${x.longitude}` : "");

function ProfilUsaha() {
  const { settings } = useSession();
  const [s, setS] = useState<Settings>(settings);
  const [coords, setCoords] = useState(coordText(settings));
  const [saved, setSaved] = useState(false);
  const [busy, run] = useRun();

  useEffect(() => {
    setS(settings);
    setCoords(coordText(settings));
  }, [settings]);

  const coordsValid = !coords.trim() || COORD.test(coords);
  const changeCoords = (text: string) => {
    setCoords(text);
    setSaved(false);
    const m = text.match(COORD);
    if (!text.trim()) setS((x) => ({ ...x, latitude: null, longitude: null }));
    else if (m) setS((x) => ({ ...x, latitude: Number(m[1]), longitude: Number(m[2]) }));
  };
  const useHere = () => {
    if (!navigator.geolocation) return alert("HP ini tidak bisa membaca lokasi. Tempel koordinat dari Google Maps.");
    navigator.geolocation.getCurrentPosition(
      (pos) => changeCoords(`${pos.coords.latitude.toFixed(6)}, ${pos.coords.longitude.toFixed(6)}`),
      () => alert("Lokasi tidak bisa dibaca. Izinkan akses lokasi, atau tempel koordinat dari Google Maps."),
      { enableHighAccuracy: true, timeout: 15_000 }
    );
  };

  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => {
    setS({ ...s, [k]: v });
    setSaved(false);
  };
  const save = () =>
    run(async () => {
      await mutate("PUT", "/settings", s);
      setSaved(true);
    });

  return (
    <>
      <div className="card stack">
        <b className="section-title"><Store size={18} /> Profil usaha</b>
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
        <Field label="Tentang usaha" hint="Dipakai AI. Mis. 'Ayam & ikan bakar arang, bumbu rempah resep keluarga, sambal diulek tiap pagi'">
          <textarea rows={3} value={s.brandDescription} onChange={(e) => set("brandDescription", e.target.value)} />
        </Field>
        <Field label="Gaya bahasa favorit" group>
          <Chips options={STYLES} value={s.brandVoice} onChange={(v) => set("brandVoice", v)} />
        </Field>
      </div>

      <div className="card stack">
        <b className="section-title"><FolderOpen size={18} /> Bahan konten di Google Drive</b>
        <p className="small muted">
          Buat satu folder berisi foto & video menu. Di Google Drive: klik kanan folder → <i>Bagikan</i> → Akses umum: <i>Siapa saja yang memiliki link</i> (Pelihat) → <i>Salin link</i>, lalu tempel di sini. Siapa pun yang punya link bisa melihat isi folder, jadi isi hanya dengan bahan promosi.
        </p>
        <Field label="Link folder">
          <input value={s.driveFolderUrl} onChange={(e) => set("driveFolderUrl", e.target.value)} placeholder="https://drive.google.com/drive/folders/…" />
        </Field>
      </div>

      <div className="card stack">
        <b className="section-title"><MapPin size={18} /> Lokasi usaha</b>
        <p className="small muted">
          Pusat target iklan Facebook & Instagram (orang di sekitar usaha). Di Google Maps, tekan lama titik dapurmu lalu salin angka koordinatnya, atau pakai lokasi HP saat berada di dapur.
        </p>
        <Field label="Koordinat (lintang, bujur)">
          <input value={coords} inputMode="decimal" onChange={(e) => changeCoords(e.target.value)} placeholder="-6.2383, 106.9756" />
        </Field>
        {!coordsValid && <div className="small neg">Format belum benar. Contoh: -6.2383, 106.9756</div>}
        <button className="btn small" onClick={useHere}>
          <LocateFixed size={16} /> Pakai lokasi HP sekarang
        </button>
      </div>

      <div className="card stack">
        <b className="section-title"><Percent size={18} /> Saluran penjualan & potongan aplikasi</b>
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
              <X size={18} />
            </button>
          </div>
        ))}
        <button className="btn small" onClick={() => set("channels", [...s.channels, { name: "", feePct: 0 }])}>
          <Plus size={16} /> Tambah saluran
        </button>
      </div>

      <button className="btn primary big" disabled={busy || !coordsValid} onClick={save}>
        {saved ? <><Check size={20} /> Tersimpan</> : "Simpan pengaturan"}
      </button>
    </>
  );
}

function Akun() {
  const { user } = useSession();
  const { data: users } = useApi<User[]>("/users");
  const [adding, setAdding] = useState(false);
  const [, run] = useRun();

  return (
    <div className="card stack">
      <b className="section-title"><Users size={18} /> Akun</b>
      <p className="small muted">Akun <b>staf</b> bisa mencatat pesanan, stok, dan membuat konten, tapi tidak bisa melihat keuangan, modal, dan iklan.</p>
      {users?.map((u) => (
        <div key={u.id} className="row between">
          <div>
            <b>{u.name}</b> <span className="small muted">@{u.username} · {u.role}</span>
          </div>
          {u.id !== user.id && (
            <button className="btn small ghost danger" onClick={() => confirm(`Hapus akun ${u.name}?`) && run(() => mutate("DELETE", `/users/${u.id}`))}>
              Hapus
            </button>
          )}
        </div>
      ))}
      <button className="btn small" onClick={() => setAdding(true)}>
        <Plus size={16} /> Tambah akun
      </button>
      {adding && <TambahAkun onClose={() => setAdding(false)} />}
    </div>
  );
}

function TambahAkun({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("staf");
  const [busy, run] = useRun();

  const save = () =>
    run(async () => {
      await mutate("POST", "/users", { name, username, password, role });
      onClose();
    });

  return (
    <Sheet title="Tambah akun" onClose={onClose}>
      <Field label="Nama">
        <input value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      <Field label="Nama pengguna" hint="Huruf kecil/angka tanpa spasi">
        <input value={username} autoCapitalize="none" onChange={(e) => setUsername(e.target.value.toLowerCase())} />
      </Field>
      <Field label="Kata sandi" hint="Minimal 8 karakter. Berikan langsung ke orangnya.">
        <input type="text" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="off" />
      </Field>
      <Field label="Peran" group>
        <Chips options={["staf", "pemilik"] as Role[]} value={role} onChange={setRole} />
      </Field>
      <button className="btn primary" disabled={busy} onClick={save}>Simpan</button>
    </Sheet>
  );
}

function GantiSandi() {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [busy, run] = useRun();

  const save = () =>
    run(async () => {
      await api("PUT", "/auth/password", { currentPassword: current, newPassword: next });
      alert("Kata sandi diganti. Perangkat lain yang memakai akun ini otomatis keluar.");
      setOpen(false);
    });

  return (
    <div className="card stack">
      <b className="section-title"><KeyRound size={18} /> Kata sandi</b>
      <button className="btn small" onClick={() => setOpen(true)}>Ganti kata sandi</button>
      {open && (
        <Sheet title="Ganti kata sandi" onClose={() => setOpen(false)}>
          <Field label="Kata sandi lama">
            <input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" />
          </Field>
          <Field label="Kata sandi baru" hint="Minimal 8 karakter">
            <input type="password" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" />
          </Field>
          <button className="btn primary" disabled={busy} onClick={save}>Simpan</button>
        </Sheet>
      )}
    </div>
  );
}

function Backup() {
  const [busy, run] = useRun();
  const backup = () =>
    run(async () => {
      const data = await api("GET", "/backup");
      downloadFile(`backup-umkm-plus-${toInputDate(Date.now())}.json`, JSON.stringify(data), "application/json");
    });
  return (
    <div className="card stack">
      <b className="section-title"><DatabaseBackup size={18} /> Cadangan data</b>
      <p className="small">
        Data tersimpan aman di database online dan bisa dibuka dari HP mana pun setelah masuk. Sebagai jaga-jaga, unduh cadangan sebulan sekali.
      </p>
      <button className="btn" disabled={busy} onClick={backup}>
        <Download size={18} /> Unduh cadangan (JSON)
      </button>
    </div>
  );
}
