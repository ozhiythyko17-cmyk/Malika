import { useEffect, useState, type ReactNode } from "react";

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
            ✕
          </button>
        </div>
        <div className="sheet-body">{children}</div>
      </div>
    </div>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
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
        −
      </button>
      <b>{value}</b>
      <button type="button" aria-label="Tambah" onClick={() => onChange(value + 1)}>
        +
      </button>
    </div>
  );
}

export function Empty({ icon, children }: { icon: string; children: ReactNode }) {
  return (
    <div className="empty">
      <div>{icon}</div>
      <p>{children}</p>
    </div>
  );
}

export function Chips<T extends string>({ options, value, onChange }: { options: T[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="chips">
      {options.map((o) => (
        <button type="button" key={o} className={o === value ? "chip on" : "chip"} onClick={() => onChange(o)}>
          {o}
        </button>
      ))}
    </div>
  );
}
