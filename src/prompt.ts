// Dipakai bersama oleh halaman Marketing dan api/konten.ts.

export interface ContentRequest {
  businessName: string;
  city: string;
  brandDescription: string;
  brandVoice: string;
  productName: string;
  productDescription: string;
  price: number;
  platform: string;
  style: string;
  goal: string;
  promo: string;
}

export const PLATFORMS = ["Instagram Feed", "Instagram Story", "TikTok", "WhatsApp Status", "Facebook"];
export const STYLES = ["Santai", "Gaul", "Lucu", "Hangat", "Formal"];
export const GOALS = ["Ajak order sekarang", "Promo / diskon", "Kenalkan menu", "Cerita di balik menu"];

export const SYSTEM_PROMPT = `Kamu adalah copywriter media sosial untuk usaha kuliner online kecil di Indonesia.
Tulis dalam Bahasa Indonesia sehari-hari yang terdengar seperti pemilik usaha sungguhan, bukan iklan korporat.
Jangan membuat klaim kesehatan, klaim "paling enak se-Indonesia", atau janji yang tidak bisa dibuktikan.
Jangan mengarang harga, promo, alamat, atau fakta yang tidak diberikan.

Format jawaban (teks biasa, tanpa markdown tebal/miring):
- Tiga variasi caption yang berbeda sudut pandangnya, dipisahkan oleh satu baris berisi hanya ---
- Setiap caption diakhiri ajakan bertindak yang jelas (mis. "order via WA", "klik link di bio") dan 5–8 hashtag relevan.
- Setelah variasi ketiga, tambahkan satu baris --- lalu bagian "Ide video pendek:" berisi naskah 15–30 detik: hook 3 detik pertama, isi, dan penutup.`;

const rupiah = (n: number) => "Rp" + n.toLocaleString("id-ID");

export function buildUserPrompt(r: ContentRequest) {
  return [
    `Usaha: ${r.businessName}${r.city ? ` (${r.city})` : ""}`,
    r.brandDescription && `Tentang usaha: ${r.brandDescription}`,
    `Produk: ${r.productName} — ${rupiah(r.price)}`,
    r.productDescription && `Keterangan produk: ${r.productDescription}`,
    `Platform: ${r.platform}`,
    `Gaya bahasa: ${r.style}`,
    `Tujuan konten: ${r.goal}`,
    r.promo && `Detail promo: ${r.promo}`,
  ]
    .filter(Boolean)
    .join("\n");
}

/** Prompt lengkap untuk ditempel manual di aplikasi Claude jika API belum disiapkan. */
export function buildManualPrompt(r: ContentRequest) {
  return `${SYSTEM_PROMPT}\n\n${buildUserPrompt(r)}`;
}
