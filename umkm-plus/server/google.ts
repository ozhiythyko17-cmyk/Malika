// Integrasi Google: daftar bahan di folder Google Drive (dibagikan "siapa saja yang punya link")
// dan pembuatan gambar dengan Gemini. Keduanya memakai kunci API Google.
import type { DriveFile } from "../shared/types.js";
import { HttpError } from "./http.js";

const driveKey = () => process.env.GOOGLE_DRIVE_API_KEY || process.env.GOOGLE_API_KEY;
const geminiKey = () => process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
export const IMAGE_MODEL = () => process.env.GEMINI_IMAGE_MODEL || "gemini-2.5-flash-image";

const FILE_ID = /^[A-Za-z0-9_-]{10,100}$/;

export function assertFileId(id: string) {
  if (!FILE_ID.test(id)) throw new HttpError(400, "ID file Google Drive tidak valid.");
}

/** Ambil ID folder dari link Google Drive (atau ID polos). */
export function parseFolderId(input: string): string | null {
  const s = input.trim();
  if (!s) return null;
  const m = s.match(/\/folders\/([A-Za-z0-9_-]+)/) ?? s.match(/[?&]id=([A-Za-z0-9_-]+)/);
  const id = m ? m[1] : s;
  return FILE_ID.test(id) ? id : null;
}

export async function listDriveFiles(folderId: string): Promise<DriveFile[]> {
  const key = driveKey();
  if (!key) throw new HttpError(503, "Kunci API Google belum dipasang (GOOGLE_API_KEY).");
  const params = new URLSearchParams({
    q: `'${folderId}' in parents and trashed = false`,
    fields: "files(id,name,mimeType,videoMediaMetadata(durationMillis))",
    pageSize: "200",
    orderBy: "createdTime desc",
    key,
  });
  const res = await fetch(`https://www.googleapis.com/drive/v3/files?${params}`);
  if (res.status === 404) throw new HttpError(404, "Folder Google Drive tidak ditemukan. Cek link-nya.");
  if (res.status === 403 || res.status === 400) {
    throw new HttpError(502, "Google Drive menolak akses. Pastikan folder dibagikan \"Siapa saja yang memiliki link\" dan Drive API aktif untuk kunci API.");
  }
  if (!res.ok) throw new HttpError(502, `Google Drive error (${res.status}).`);
  const data = (await res.json()) as {
    files?: { id: string; name: string; mimeType: string; videoMediaMetadata?: { durationMillis?: string } }[];
  };
  return (data.files ?? [])
    .filter((f) => /^(image|video|audio)\//.test(f.mimeType))
    .map((f) => ({
      id: f.id,
      name: f.name,
      kind: f.mimeType.split("/")[0] as DriveFile["kind"],
      durationSec: f.videoMediaMetadata?.durationMillis ? Math.round(Number(f.videoMediaMetadata.durationMillis) / 1000) : null,
    }));
}

async function fetchImage(url: string): Promise<{ data: Buffer; mime: string } | null> {
  const res = await fetch(url, { redirect: "follow" });
  const mime = res.headers.get("content-type")?.split(";")[0] ?? "";
  if (!res.ok || !mime.startsWith("image/")) return null;
  return { data: Buffer.from(await res.arrayBuffer()), mime };
}

/**
 * Gambar pratinjau sebuah file Drive (foto, atau satu frame untuk video) dengan lebar `width` px.
 * Ukurannya kecil sehingga aman dikirim ke AI dan lewat batas ukuran Vercel.
 */
export async function driveThumbnail(id: string, width: number): Promise<{ data: Buffer; mime: string }> {
  assertFileId(id);
  const direct = await fetchImage(`https://drive.google.com/thumbnail?id=${id}&sz=w${width}`);
  if (direct) return direct;

  // Cadangan: thumbnailLink dari Drive API.
  const key = driveKey();
  if (key) {
    const res = await fetch(`https://www.googleapis.com/drive/v3/files/${id}?fields=thumbnailLink&key=${key}`);
    if (res.ok) {
      const { thumbnailLink } = (await res.json()) as { thumbnailLink?: string };
      if (thumbnailLink) {
        const img = await fetchImage(thumbnailLink.replace(/=s\d+$/, `=s${width}`));
        if (img) return img;
      }
    }
  }
  throw new HttpError(502, "Gambar dari Google Drive tidak bisa diambil. Pastikan file dibagikan lewat link.");
}

/** Ukuran potongan unduhan: di bawah batas 4,5 MB per respons Vercel Function. */
export const CHUNK_BYTES = 4 * 1024 * 1024;

/**
 * Unduh satu potongan file asli dari Drive (untuk video & musik yang dirender di HP).
 * Mengembalikan isi potongan, total ukuran file, dan jenis file.
 */
export async function driveFileChunk(id: string, part: number): Promise<{ data: Buffer; total: number; mime: string }> {
  assertFileId(id);
  const key = driveKey();
  if (!key) throw new HttpError(503, "Kunci API Google belum dipasang (GOOGLE_API_KEY).");
  const start = part * CHUNK_BYTES;
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${id}?alt=media&key=${key}`, {
    headers: { Range: `bytes=${start}-${start + CHUNK_BYTES - 1}` },
  });
  if (res.status === 416) throw new HttpError(416, "Bagian file di luar ukuran file.");
  if (!res.ok) throw new HttpError(502, `File Google Drive tidak bisa diunduh (${res.status}).`);
  const data = Buffer.from(await res.arrayBuffer());
  const range = res.headers.get("content-range"); // "bytes 0-4194303/12345678"
  const total = range ? Number(range.split("/")[1]) : data.length;
  return { data, total, mime: res.headers.get("content-type")?.split(";")[0] ?? "application/octet-stream" };
}

/** Buat gambar dengan Gemini. `reference` = foto asli yang dijadikan dasar (opsional). */
export async function generateImage(
  prompt: string,
  aspectRatio: string,
  reference?: { data: Buffer; mime: string }
): Promise<{ data: Buffer; mime: string }> {
  const key = geminiKey();
  if (!key) throw new HttpError(503, "Kunci API Gemini belum dipasang (GOOGLE_API_KEY) — fitur gambar AI belum aktif.");

  const parts: Record<string, unknown>[] = [{ text: prompt }];
  if (reference) parts.push({ inlineData: { mimeType: reference.mime, data: reference.data.toString("base64") } });

  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${IMAGE_MODEL()}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({
      contents: [{ role: "user", parts }],
      generationConfig: { responseModalities: ["TEXT", "IMAGE"], imageConfig: { aspectRatio } },
    }),
  });
  if (res.status === 400 || res.status === 403) {
    const detail = await res.text().catch(() => "");
    console.error("Gemini", res.status, detail.slice(0, 500));
    throw new HttpError(502, "Gemini menolak permintaan (cek kunci API, billing, atau nama model).");
  }
  if (res.status === 429) throw new HttpError(429, "Kuota gambar AI habis atau terlalu sering. Coba lagi nanti.");
  if (!res.ok) throw new HttpError(502, `Layanan gambar AI error (${res.status}).`);

  type Part = { thought?: boolean; inlineData?: { mimeType: string; data: string }; inline_data?: { mime_type: string; data: string } };
  const body = (await res.json()) as { candidates?: { content?: { parts?: Part[] }; finishReason?: string }[] };
  const imagePart = body.candidates?.[0]?.content?.parts?.filter((p) => !p.thought).find((p) => p.inlineData || p.inline_data);
  const inline = imagePart?.inlineData ?? (imagePart?.inline_data && { mimeType: imagePart.inline_data.mime_type, data: imagePart.inline_data.data });
  if (!inline) {
    throw new HttpError(422, "AI tidak menghasilkan gambar untuk permintaan ini. Coba ubah kata-katanya.");
  }
  return { data: Buffer.from(inline.data, "base64"), mime: inline.mimeType };
}
