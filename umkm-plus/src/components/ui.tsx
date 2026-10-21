import { useEffect, useState, type ReactNode } from "react";
import { CircleAlert, Info, LoaderCircle, Minus, Plus, X } from "lucide-react";
import { useBlobUrl } from "../api";

export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <b>{title}</b>
          <button className="icon-btn" aria-label="Tutup" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        <div className="sheet-body">{children}</div>
      </div>
    </div>
  );
}

/**
 * Label + isian. Untuk kelompok pilihan berisi tombol (Chips, galeri), pakai `group`: elemen <label>
 * meneruskan klik ke tombol pertama di dalamnya bila tombol yang ditekan hilang setelah diklik.
 */
export function Field({ label, hint, group, children }: { label: string; hint?: string; group?: boolean; children: ReactNode }) {
  const content = (
    <>
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </>
  );
  return group ? (
    <div className="field" role="group" aria-label={label}>
      {content}
    </div>
  ) : (
    <label className="field">{content}</label>
  );
}

/** Input angka rupiah: tampil 15.000, disimpan 15000. */
export function MoneyInput({ value, onChange, placeholder }: { value: number; onChange: (n: number) => void; placeholder?: string }) {
  const [text, setText] = useState(value ? value.toLocaleString("id-ID") : "");
  useEffect(() => {
    const parsed = Number(text.replace(/\D/g, "")) || 0;
    if (parsed !== value) setText(value ? value.toLocaleString("id-ID") : "");
  }, [value]);
  return (
    <div className="money">
      <span>Rp</span>
      <input
        inputMode="numeric"
        placeholder={placeholder ?? "0"}
        value={text}
        onChange={(e) => {
          const n = Number(e.target.value.replace(/\D/g, "")) || 0;
          setText(n ? n.toLocaleString("id-ID") : "");
          onChange(n);
        }}
      />
    </div>
  );
}

export function NumberInput({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <input
      type="number"
      inputMode="numeric"
      value={Number.isFinite(value) ? value : 0}
      onChange={(e) => onChange(Number(e.target.value) || 0)}
    />
  );
}

export function Stepper({ value, onChange, min = 0 }: { value: number; onChange: (n: number) => void; min?: number }) {
  return (
    <div className="stepper">
      <button type="button" aria-label="Kurangi" onClick={() => onChange(Math.max(min, value - 1))}>
        <Minus size={18} strokeWidth={2.4} />
      </button>
      <b>{value}</b>
      <button type="button" aria-label="Tambah" onClick={() => onChange(value + 1)}>
        <Plus size={18} strokeWidth={2.4} />
      </button>
    </div>
  );
}

/** Kotak pesan: biru untuk info, kuning untuk peringatan/error. */
export function Alert({ tone = "info", className, children }: { tone?: "info" | "warn"; className?: string; children: ReactNode }) {
  const Icon = tone === "warn" ? CircleAlert : Info;
  return (
    <div className={`alert ${tone}${className ? ` ${className}` : ""}`}>
      <Icon size={18} />
      <div className="alert-body">{children}</div>
    </div>
  );
}

/** Ikon berputar untuk proses yang sedang berjalan. */
export function Spinner({ size = 18 }: { size?: number }) {
  return <LoaderCircle size={size} className="spin" aria-hidden="true" />;
}

export function Empty({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <div className="empty">
      <div className="empty-icon">{icon}</div>
      <p>{children}</p>
    </div>
  );
}

/** Pilihan satu-dari-beberapa. `segmented` = tab utama halaman (satu baris, lebar sama). */
export function Chips<T extends string>({ options, value, onChange, segmented }: { options: T[]; value: T; onChange: (v: T) => void; segmented?: boolean }) {
  return (
    <div className={segmented ? "chips segmented" : "chips"} role={segmented ? "tablist" : undefined}>
      {options.map((o) => (
        <button
          type="button"
          key={o}
          className={o === value ? "chip on" : "chip"}
          role={segmented ? "tab" : undefined}
          aria-selected={segmented ? o === value : undefined}
          aria-pressed={segmented ? undefined : o === value}
          onClick={() => onChange(o)}
        >
          {o}
        </button>
      ))}
    </div>
  );
}

/** Jalankan aksi (mis. simpan) dengan status sibuk; pesan error ditampilkan ke pengguna. */
export function useRun() {
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return [busy, run] as const;
}

export function LoadError({ error }: { error: string | null }) {
  return error ? <Alert tone="warn">{error}</Alert> : null;
}

/** <img> untuk gambar dari API (lihat useBlobUrl). */
export function ApiImage({ path, alt, className }: { path: string; alt: string; className?: string }) {
  const { url, failed } = useBlobUrl(path);
  if (failed) return <div className={`img-missing ${className ?? ""}`}>Gambar tidak bisa dimuat</div>;
  if (!url) return <div className={`img-loading ${className ?? ""}`} aria-label="Memuat gambar" />;
  return <img src={url} alt={alt} className={className} />;
}
