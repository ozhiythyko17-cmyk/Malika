// Tes Studio Konten: Google Drive, Gemini, dan Claude ditiru (fetch palsu), database PGlite di memori.
import assert from "node:assert/strict";
import { after, describe, test } from "node:test";

process.env.PGLITE_DIR = "memory://";
if (process.env.TEST_DATABASE_URL) process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
else delete process.env.DATABASE_URL;
process.env.ANTHROPIC_API_KEY = "test-anthropic";
process.env.GOOGLE_API_KEY = "test-google";

const FOLDER = "1AbCdEfGhIjKlMnOpQrStUv";
const PHOTO = "photoFileId_0123456789";
const VIDEO = "videoFileId_0123456789";
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4]);
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 9, 9, 9]);

const calls: { url: string; body?: any; headers?: Headers }[] = [];
let claudeJson: object = {};

const realFetch = globalThis.fetch;
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const req = new Request(input, init);
  const url = req.url;
  const body = req.method === "POST" ? await req.clone().json().catch(() => undefined) : undefined;
  calls.push({ url, body, headers: req.headers });

  if (url.startsWith("https://www.googleapis.com/drive/v3/files?")) {
    return Response.json({
      files: [
        { id: PHOTO, name: "ayam-bakar.jpg", mimeType: "image/jpeg" },
        { id: VIDEO, name: "proses-bakar.mp4", mimeType: "video/mp4", videoMediaMetadata: { durationMillis: "21000" } },
        { id: "docFileId_0123456789", name: "catatan.pdf", mimeType: "application/pdf" },
      ],
    });
  }
  if (url.startsWith("https://drive.google.com/thumbnail")) {
    return new Response(JPEG, { headers: { "content-type": "image/jpeg" } });
  }
  if (url.includes("generativelanguage.googleapis.com")) {
    return Response.json({
      candidates: [{ content: { parts: [{ text: "Here you go" }, { inlineData: { mimeType: "image/png", data: PNG.toString("base64") } }] } }],
    });
  }
  if (url.startsWith("https://api.anthropic.com/v1/messages")) {
    return Response.json({
      id: "msg_test", type: "message", role: "assistant", model: "claude-opus-5-5",
      content: [{ type: "text", text: JSON.stringify(claudeJson) }],
      stop_reason: "end_turn", stop_sequence: null,
      usage: { input_tokens: 10, output_tokens: 10 },
    });
  }
  return realFetch(input, init);
}) as typeof fetch;

const { handle } = await import("../server/app.js");
const { closeDb } = await import("../server/db.js");
after(closeDb);

let cookie = "";
async function call(method: string, path: string, body?: unknown) {
  const res = await handle(
    new Request(`http://localhost/api${path}`, {
      method,
      headers: { "content-type": "application/json", cookie },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
    path.split("?")[0]
  );
  const set = res.headers.get("set-cookie");
  if (set) cookie = set.split(";")[0];
  const type = res.headers.get("content-type") ?? "";
  return { status: res.status, type, data: type.includes("json") ? await res.json() : Buffer.from(await res.arrayBuffer()) };
}

const lastCall = (host: string) => [...calls].reverse().find((c) => c.url.includes(host))!;

describe("Studio Konten", () => {
  let productId: number;

  test("persiapan: akun, produk, link folder Drive", async () => {
    await call("POST", "/auth/setup", { name: "Pemilik", username: "pemilik", password: "rahasia123" });
    const p = await call("POST", "/products", { name: "Ayam Bakar Madu", emoji: "🍗", price: 25000, cost: 11000, trackStock: false, stock: 0, minStock: 0, active: true, description: "bumbu madu, arang" });
    productId = p.data.id;
    const s = (await call("GET", "/settings")).data;
    assert.equal((await call("PUT", "/settings", { ...s, driveFolderUrl: "bukan link" })).status, 400);
    const ok = await call("PUT", "/settings", { ...s, driveFolderUrl: `https://drive.google.com/drive/folders/${FOLDER}?usp=sharing` });
    assert.equal(ok.status, 200);
  });

  test("daftar bahan Drive: hanya foto & video, folder yang benar", async () => {
    const r = await call("GET", "/drive/files");
    assert.equal(r.status, 200);
    assert.deepEqual(r.data.map((f: any) => [f.kind, f.durationSec]), [["image", null], ["video", 21]]);
    assert.equal(new URL(lastCall("drive/v3").url).searchParams.get("q"), `'${FOLDER}' in parents and trashed = false`);
    const thumb = await call("GET", `/drive/thumb/${PHOTO}?w=400`);
    assert.equal(thumb.type, "image/jpeg");
    assert.deepEqual(thumb.data, JPEG);
  });

  test("dari prompt saja: tanpa bahan, permintaan pengguna sampai ke AI", async () => {
    claudeJson = { materialNotes: [], captions: ["a", "b", "c"], headline: "Bakar Madu Juara", subheadline: "Cuma 25 ribu", imagePrompt: "grilled chicken" };
    const r = await call("POST", "/ai/generate", { source: "prompt", brief: "Promo paket keluarga akhir pekan", productId, platform: "Instagram Story", style: "Santai", wantImage: true, wantVideo: false });
    assert.equal(r.status, 200, JSON.stringify(r.data));
    assert.equal(r.data.captions.length, 3);
    assert.equal(r.data.video, null);
    assert.equal(r.data.aspectRatio, "9:16");
    const sent = lastCall("api.anthropic.com").body;
    assert.equal(sent.output_config.format.type, "json_schema");
    assert.ok(!("video" in sent.output_config.format.schema.properties));
    const blocks = sent.messages[0].content;
    assert.equal(blocks.length, 1);
    assert.match(blocks[0].text, /Promo paket keluarga akhir pekan/);
    assert.match(blocks[0].text, /Ayam Bakar Madu — Rp25\.000/);
  });

  test("prompt kosong tanpa produk ditolak", async () => {
    const r = await call("POST", "/ai/generate", { source: "prompt", brief: "", productId: null, platform: "TikTok", style: "Santai", wantImage: false, wantVideo: false });
    assert.equal(r.status, 400);
  });

  test("dari bahan Drive: foto & frame video dikirim ke AI, naskah video diminta", async () => {
    claudeJson = {
      materialNotes: ["Bahan 1: ayam bakar", "Bahan 2: proses membakar"],
      captions: ["a", "b", "c"], headline: "h", subheadline: "s", imagePrompt: "p",
      video: { title: "t", durationSec: 20, music: "m", scenes: [{ time: "0-3", shot: "Bahan 2", overlayText: "x", voiceover: "y" }] },
    };
    const r = await call("POST", "/ai/generate", { source: "drive", fileIds: [PHOTO, VIDEO], brief: "", productId: null, platform: "TikTok", style: "Gaul", wantImage: true, wantVideo: true });
    assert.equal(r.status, 200, JSON.stringify(r.data));
    assert.equal(r.data.video.scenes[0].shot, "Bahan 2");
    const blocks = lastCall("api.anthropic.com").body.messages[0].content;
    assert.deepEqual(blocks.map((b: any) => b.type), ["image", "image", "text"]);
    assert.equal(blocks[0].source.data, JPEG.toString("base64"));
    assert.match(blocks[2].text, /Bahan 2: video 21 detik/);
  });

  test("bahan di luar folder usaha ditolak", async () => {
    const r = await call("POST", "/ai/generate", { source: "drive", fileIds: ["someoneElseFile_123456"], platform: "TikTok", style: "Gaul", wantImage: false, wantVideo: false });
    assert.equal(r.status, 400);
  });

  test("gambar AI dari prompt dan dari foto asli, disimpan & bisa diunduh", async () => {
    const a = await call("POST", "/ai/image", { imagePrompt: "grilled chicken on banana leaf", aspectRatio: "1:1", referenceFileId: null });
    assert.equal(a.status, 201, JSON.stringify(a.data));
    let g = lastCall("generativelanguage");
    assert.equal(g.headers!.get("x-goog-api-key"), "test-google");
    assert.equal(g.body.generationConfig.imageConfig.aspectRatio, "1:1");
    assert.equal(g.body.contents[0].parts.length, 1);

    const b = await call("POST", "/ai/image", { imagePrompt: "warm light", aspectRatio: "9:16", referenceFileId: PHOTO });
    assert.equal(b.status, 201);
    g = lastCall("generativelanguage");
    assert.equal(g.body.contents[0].parts[1].inlineData.data, JPEG.toString("base64"));

    const img = await call("GET", b.data.url.replace("/api", ""));
    assert.equal(img.type, "image/png");
    assert.deepEqual(img.data, PNG);

    const saved = await call("POST", "/contents", { title: "Promo", platform: "TikTok", text: "caption", mediaId: b.data.mediaId });
    assert.equal(saved.status, 201);
    assert.equal((await call("GET", "/contents")).data[0].mediaId, b.data.mediaId);
  });
});
