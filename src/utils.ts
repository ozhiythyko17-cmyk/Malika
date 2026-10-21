import { normalizeWa } from "../shared/format";

const rupiahFmt = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });

export const rp = (n: number) => rupiahFmt.format(Math.round(n || 0));

export const num = (n: number) => new Intl.NumberFormat("id-ID").format(n || 0);

export const dateStr = (t: number) =>
  new Date(t).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });

export const timeStr = (t: number) =>
  new Date(t).toLocaleString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export const startOfDay = (t = Date.now()) => {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

export const startOfMonth = (year: number, month: number) => new Date(year, month, 1).getTime();

export const toInputDate = (t: number) => {
  const d = new Date(t);
  const pad = (x: number) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

export const fromInputDate = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d, 12).getTime();
};

export function waLink(phone: string, text: string) {
  return `https://wa.me/${normalizeWa(phone)}?text=${encodeURIComponent(text)}`;
}

export function downloadFile(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export function toCsv(rows: (string | number)[][]) {
  return rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
}

export const MONTHS = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];
