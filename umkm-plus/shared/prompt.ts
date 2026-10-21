// Prompt & pilihan untuk Studio Konten AI. Pilihan dipakai frontend; prompt dipakai server.

export const PLATFORMS = ["Instagram Feed", "Instagram Story", "TikTok", "WhatsApp Status", "Facebook"];
export const STYLES = ["Santai", "Gaul", "Lucu", "Hangat", "Formal"];

/** Rasio gambar yang cocok untuk tiap platform. */
export const ASPECT: Record<string, string> = {
  "Instagram Feed": "1:1",
  "Instagram Story": "9:16",
  TikTok: "9:16",
  "WhatsApp Status": "9:16",
  Facebook: "1:1",
};

export interface StudioRequest {
  businessName: string;
  city: string;
  brandDescription: string;
  businessWa: string;
  brief: string; // apa yang ingin dibuat, kata-kata pengguna sendiri
  product: { name: string; description: string; price: number } | null;
  platform: string;
  style: string;
  materials: { label: string; kind: "image" | "video"; name: string; durationSec: number | null }[];
  wantImage: boolean;
  wantVideo: boolean;
}

export interface StudioResult {
  materialNotes: string[];
  captions: string[];
  headline: string;
  subheadline: string;
  imagePrompt: string;
  video: VideoScript | null;
}

export interface VideoScript {
  title: string;
  durationSec: number;
  scenes: { time: string; shot: string; overlayText: string; voiceover: string }[];
  music: string;
}

export const STUDIO_SYSTEM = `Kamu adalah tim kreatif media sosial untuk usaha kuliner online kecil di Indonesia.
Tulis dalam Bahasa Indonesia sehari-hari yang terdengar seperti pemilik usaha sungguhan, bukan iklan korporat.
Jangan membuat klaim kesehatan, klaim "paling enak se-Indonesia", atau janji yang tidak bisa dibuktikan.
Jangan mengarang harga, promo, alamat, atau fakta yang tidak diberikan pengguna.
Jika ada bahan foto/video, lihat baik-baik dan tulis konten yang sesuai dengan apa yang benar-benar terlihat; sebut bahan dengan labelnya (mis. "Bahan 2").

Isi setiap kolom:
- materialNotes: satu kalimat per bahan tentang apa yang terlihat dan cocok dipakai untuk apa. Kosongkan jika tidak ada bahan.
- captions: tepat 3 caption dengan sudut pandang berbeda. Setiap caption diakhiri ajakan bertindak yang jelas dan 5–8 hashtag relevan.
- headline: teks poster maksimal 6 kata, menggoda dan mudah dibaca.
- subheadline: teks pendukung poster maksimal 10 kata (boleh berisi harga/promo jika diberikan).
- imagePrompt: deskripsi gambar dalam bahasa Inggris untuk model pembuat gambar. Foto makanan yang realistis dan menggugah selera, pencahayaan dan komposisi jelas, gaya foto media sosial profesional. Jika ada foto asli sebagai acuan, jelaskan cara mempercantiknya (latar, cahaya, properti) tanpa mengubah bentuk makanannya. Jangan minta teks di dalam gambar.
- video (jika diminta): naskah video pendek vertikal 15–30 detik: adegan berurutan dengan waktu, pengambilan gambar (jika ada bahan video/foto, sebut bahan yang dipakai), teks di layar, dan suara/narasi; adegan pertama harus hook kuat 3 detik.`;

const rupiah = (n: number) => "Rp" + n.toLocaleString("id-ID");

export function buildStudioPrompt(r: StudioRequest) {
  const lines = [
    `Usaha: ${r.businessName}${r.city ? ` (${r.city})` : ""}`,
    r.brandDescription && `Tentang usaha: ${r.brandDescription}`,
    r.businessWa && `WhatsApp pemesanan: ${r.businessWa}`,
    r.product && `Produk: ${r.product.name} — ${rupiah(r.product.price)}${r.product.description ? ` (${r.product.description})` : ""}`,
    `Platform: ${r.platform}`,
    `Gaya bahasa: ${r.style}`,
    `Permintaan: ${r.brief || "Buat konten promosi yang menarik untuk produk ini."}`,
  ];
  if (r.materials.length) {
    lines.push(
      "Bahan dari pengguna (gambar terlampir sesuai urutan):",
      ...r.materials.map((m) =>
        `- ${m.label}: ${m.kind === "video" ? `video${m.durationSec ? ` ${m.durationSec} detik` : ""} (yang terlampir adalah satu cuplikan frame)` : "foto"} "${m.name}"`
      )
    );
  } else {
    lines.push("Tidak ada bahan foto/video; buat konten hanya dari permintaan di atas.");
  }
  return lines.filter(Boolean).join("\n");
}

/** Skema JSON untuk structured output Claude. */
export function studioSchema(wantVideo: boolean) {
  const str = { type: "string" };
  const video = {
    type: "object",
    additionalProperties: false,
    required: ["title", "durationSec", "scenes", "music"],
    properties: {
      title: str,
      durationSec: { type: "integer" },
      music: str,
      scenes: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["time", "shot", "overlayText", "voiceover"],
          properties: { time: str, shot: str, overlayText: str, voiceover: str },
        },
      },
    },
  };
  const required = ["materialNotes", "captions", "headline", "subheadline", "imagePrompt"];
  const properties: Record<string, unknown> = {
    materialNotes: { type: "array", items: str },
    captions: { type: "array", items: str },
    headline: str,
    subheadline: str,
    imagePrompt: str,
  };
  if (wantVideo) {
    required.push("video");
    properties.video = video;
  }
  return { type: "object", additionalProperties: false, required, properties };
}

/** Versi teks biasa untuk ditempel manual di aplikasi Claude bila API belum dipasang. */
export function buildManualPrompt(r: StudioRequest) {
  return `${STUDIO_SYSTEM.split("\n\nIsi setiap kolom:")[0]}

Buatkan 3 caption berbeda (masing-masing diakhiri ajakan bertindak dan 5–8 hashtag)${r.wantVideo ? ", lalu naskah video pendek 15–30 detik per adegan" : ""}.

${buildStudioPrompt({ ...r, wantVideo: true })}`;
}
