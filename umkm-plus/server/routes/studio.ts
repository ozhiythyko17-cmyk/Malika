// Studio Konten AI: konten dari prompt saja, atau dari bahan foto/video di Google Drive.
import Anthropic from "@anthropic-ai/sdk";
import {
  ASPECT, buildManualPrompt, buildStudioPrompt, PLATFORMS, STUDIO_SYSTEM, STYLES, studioSchema,
  type StudioRequest, type StudioResult,
} from "../../shared/prompt.js";
import { getDb } from "../db.js";
import type { DriveFile } from "../../shared/types.js";
import { assertFileId, driveFileChunk, driveThumbnail, generateImage, listDriveFiles, parseFolderId } from "../google.js";
import { bool, HttpError, idParam, int, json, oneOf, str, type Ctx } from "../http.js";
import { loadSettings } from "./settings.js";

const MAX_MATERIALS = 4;

// Daftar file disimpan sebentar supaya unduhan potongan video tidak selalu memanggil Drive API.
let cache: { folderId: string; at: number; files: DriveFile[] } | null = null;

async function folderFiles(fresh = true): Promise<DriveFile[]> {
  const s = await loadSettings();
  const folderId = parseFolderId(s.driveFolderUrl);
  if (!folderId) throw new HttpError(400, "Link folder Google Drive belum diisi di Pengaturan.");
  if (!fresh && cache?.folderId === folderId && Date.now() - cache.at < 5 * 60_000) return cache.files;
  const files = await listDriveFiles(folderId);
  cache = { folderId, at: Date.now(), files };
  return files;
}

/**
 * Isi asli file Drive (video/musik), dipotong per 4 MB: ?part=0, 1, 2, …
 * Header X-Total-Size memberi tahu ukuran total supaya HP tahu berapa potongan yang perlu diambil.
 */
export async function driveFile(ctx: Ctx) {
  const id = ctx.params.id;
  assertFileId(id);
  if (!(await folderFiles(false)).some((f) => f.id === id)) throw new HttpError(404, "File tidak ada di folder Drive usaha.");
  const part = int(ctx.url.searchParams.get("part") ?? "0", "Bagian", { max: 100 });
  const chunk = await driveFileChunk(id, part);
  return new Response(new Uint8Array(chunk.data), {
    headers: { "Content-Type": chunk.mime, "X-Total-Size": String(chunk.total), "Cache-Control": "private, max-age=3600" },
  });
}

export async function driveFiles() {
  return json(await folderFiles());
}

/** Pratinjau bahan Drive lewat server (supaya bisa dipakai di kanvas poster tanpa masalah CORS). */
export async function driveThumb(ctx: Ctx) {
  const id = ctx.params.id;
  assertFileId(id);
  const width = int(ctx.url.searchParams.get("w") ?? "400", "Lebar", { min: 100, max: 1600 });
  const img = await driveThumbnail(id, width);
  return new Response(new Uint8Array(img.data), {
    headers: { "Content-Type": img.mime, "Cache-Control": "private, max-age=86400" },
  });
}

async function buildRequest(b: Record<string, unknown>) {
  const s = await loadSettings();
  const source = oneOf(b.source, ["prompt", "drive"] as const, "Sumber");
  const brief = str(b.brief, "Permintaan", { max: 1500 });
  const productId = b.productId == null ? null : int(b.productId, "Produk", { min: 1, max: 2_147_483_647 });

  let product: StudioRequest["product"] = null;
  if (productId) {
    const { query } = await getDb();
    [product] = await query<{ name: string; description: string; price: number }>(
      "select name, description, price from products where id = $1",
      [productId]
    );
    if (!product) throw new HttpError(404, "Produk tidak ditemukan.");
  }

  let materials: DriveFile[] = [];
  if (source === "drive") {
    if (!Array.isArray(b.fileIds) || b.fileIds.length === 0) throw new HttpError(400, "Pilih minimal satu bahan dari Google Drive.");
    if (b.fileIds.length > MAX_MATERIALS) throw new HttpError(400, `Maksimal ${MAX_MATERIALS} bahan sekali buat.`);
    // Hanya foto/video yang memang ada di folder usaha yang boleh dipakai.
    const files = (await folderFiles()).filter((f) => f.kind !== "audio");
    materials = (b.fileIds as unknown[]).map((id) => {
      const f = files.find((x) => x.id === id);
      if (!f) throw new HttpError(400, "Ada bahan yang tidak ditemukan di folder Drive. Muat ulang daftar bahan.");
      return f;
    });
  } else if (!brief && !product) {
    throw new HttpError(400, "Tulis dulu konten apa yang ingin dibuat.");
  }

  const request: StudioRequest = {
    businessName: s.businessName,
    city: s.city,
    brandDescription: s.brandDescription,
    businessWa: s.businessWa,
    brief,
    product,
    platform: oneOf(b.platform, PLATFORMS, "Platform"),
    style: oneOf(b.style, STYLES, "Gaya bahasa"),
    materials: materials.map((m, i) => ({ label: `Bahan ${i + 1}`, kind: m.kind as "image" | "video", name: m.name, durationSec: m.durationSec })),
    wantImage: bool(b.wantImage ?? true, "Gambar"),
    wantVideo: bool(b.wantVideo ?? false, "Video"),
  };
  return { request, materials };
}

export async function generate(ctx: Ctx) {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new HttpError(503, "Kunci API AI belum dipasang. Tambahkan ANTHROPIC_API_KEY di pengaturan Vercel.");
  }
  const { request, materials } = await buildRequest(await ctx.body());

  // Foto (atau satu frame video) dikirim ke AI supaya konten sesuai bahan aslinya.
  const images = await Promise.all(materials.map((m) => driveThumbnail(m.id, 1000)));
  const content: Anthropic.Beta.BetaContentBlockParam[] = images.map((img) => ({
    type: "image",
    source: { type: "base64", media_type: img.mime as "image/jpeg", data: img.data.toString("base64") },
  }));
  content.push({ type: "text", text: buildStudioPrompt(request) });

  const client = new Anthropic();
  let response: Anthropic.Beta.BetaMessage;
  try {
    response = await client.beta.messages.create({
      model: "claude-opus-5-5",
      max_tokens: 16000,
      output_config: { effort: "low", format: { type: "json_schema", schema: studioSchema(request.wantVideo) } },
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: STUDIO_SYSTEM,
      messages: [{ role: "user", content }],
    });
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) throw new HttpError(502, "Kunci API AI salah atau sudah tidak aktif.");
    if (error instanceof Anthropic.RateLimitError) throw new HttpError(429, "AI sedang sibuk atau kredit habis. Coba lagi sebentar.");
    if (error instanceof Anthropic.APIError) throw new HttpError(502, `Layanan AI error (${error.status}).`);
    throw new HttpError(502, "Tidak bisa terhubung ke layanan AI.");
  }

  if (response.stop_reason === "refusal") {
    throw new HttpError(422, "AI menolak permintaan ini. Coba ubah kata-katanya.");
  }
  if (response.stop_reason === "max_tokens") throw new HttpError(502, "Jawaban AI terpotong. Coba lagi.");
  const text = response.content.map((block) => (block.type === "text" ? block.text : "")).join("");
  let result: StudioResult;
  try {
    result = JSON.parse(text);
  } catch {
    throw new HttpError(502, "Jawaban AI tidak terbaca. Coba lagi.");
  }
  return json({ ...result, video: result.video ?? null, aspectRatio: ASPECT[request.platform] ?? "1:1" });
}

/** Buat gambar promo. Dengan `referenceFileId`, foto asli dari Drive dipercantik. */
export async function image(ctx: Ctx) {
  const b = await ctx.body();
  const prompt = str(b.imagePrompt, "Deskripsi gambar", { max: 3000, required: true });
  const aspectRatio = oneOf(b.aspectRatio, ["1:1", "9:16", "3:4", "4:3", "16:9"], "Rasio gambar");
  let reference: Awaited<ReturnType<typeof driveThumbnail>> | undefined;
  if (b.referenceFileId != null) {
    const id = str(b.referenceFileId, "Bahan", { max: 100 });
    if (!(await folderFiles(false)).some((f) => f.id === id && f.kind !== "audio")) throw new HttpError(400, "Bahan tidak ditemukan di folder Drive.");
    reference = await driveThumbnail(id, 1600);
  }
  const fullPrompt = reference
    ? `Edit this real photo of our food into a professional social media promo photo. Keep the food itself exactly as it is (same dish, shape, portion). ${prompt}`
    : prompt;
  const img = await generateImage(fullPrompt, aspectRatio, reference);

  const { query } = await getDb();
  const [row] = await query<{ id: number }>(
    "insert into media (mime, data, prompt) values ($1, $2::bytea, $3) returning id",
    [img.mime, img.data, prompt]
  );
  return json({ mediaId: row.id, url: `/api/media/${row.id}` }, 201);
}

export async function media(ctx: Ctx) {
  const { query } = await getDb();
  const [row] = await query<{ mime: string; data: Uint8Array }>("select mime, data from media where id = $1", [idParam(ctx)]);
  if (!row) throw new HttpError(404, "Gambar tidak ditemukan.");
  return new Response(new Uint8Array(row.data), {
    headers: { "Content-Type": row.mime, "Cache-Control": "private, max-age=31536000, immutable" },
  });
}

/** Perintah lengkap untuk ditempel manual di aplikasi Claude bila API belum dipasang. */
export async function manualPrompt(ctx: Ctx) {
  const { request } = await buildRequest(await ctx.body());
  return json({ text: buildManualPrompt(request) });
}
