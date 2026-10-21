// Tiruan Google Drive & Gemini untuk demo: "foto" dan "gambar AI" digambar di kanvas.

export const DEMO_FOLDER = "https://drive.google.com/drive/folders/1DemoDapurBakarBahanKonten";

const FILES = [
  { id: "demoFile_ayamBakarMadu", name: "ayam-bakar-madu.jpg", mimeType: "image/jpeg", emoji: "🍗", hue: 28 },
  { id: "demoFile_ikanNilaBakar", name: "ikan-nila-bakar.jpg", mimeType: "image/jpeg", emoji: "🐟", hue: 18 },
  { id: "demoFile_prosesBakar01", name: "proses-bakar.mp4", mimeType: "video/mp4", emoji: "🔥", hue: 8, durationMillis: "21000" },
  { id: "demoFile_cumiBakarSaus", name: "cumi-bakar.jpg", mimeType: "image/jpeg", emoji: "🦑", hue: 35 },
  { id: "demoFile_sambalMatah01", name: "sambal-matah.jpg", mimeType: "image/jpeg", emoji: "🌶️", hue: 2 },
  { id: "demoFile_jagungBakar01", name: "jagung-bakar.jpg", mimeType: "image/jpeg", emoji: "🌽", hue: 45 },
];

async function canvasToBytes(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  const blob = await new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b!), "image/png"));
  return new Uint8Array(await blob.arrayBuffer());
}

function foodScene(w: number, h: number, emoji: string, hue: number, label: string, glow = false) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d")!;
  // Meja kayu
  const bg = ctx.createLinearGradient(0, 0, w, h);
  bg.addColorStop(0, `hsl(${hue + 10} 45% 28%)`);
  bg.addColorStop(1, `hsl(${hue} 50% 14%)`);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = "rgba(0,0,0,0.18)";
  ctx.lineWidth = Math.max(1, w / 300);
  for (let y = h / 14; y < h; y += h / 7) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.bezierCurveTo(w / 3, y + h / 60, (2 * w) / 3, y - h / 60, w, y);
    ctx.stroke();
  }
  // Daun pisang & piring
  const r = Math.min(w, h) * 0.36;
  ctx.save();
  ctx.translate(w / 2, h / 2);
  ctx.rotate(-0.35);
  ctx.fillStyle = "hsl(115 45% 32%)";
  ctx.beginPath();
  ctx.ellipse(0, 0, r * 1.25, r * 0.95, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = "hsl(40 30% 92%)";
  ctx.beginPath();
  ctx.arc(w / 2, h / 2, r * 0.82, 0, Math.PI * 2);
  ctx.fill();
  if (glow) {
    const g = ctx.createRadialGradient(w / 2, h / 2, r * 0.2, w / 2, h / 2, Math.max(w, h) * 0.7);
    g.addColorStop(0, "rgba(255,200,120,0.35)");
    g.addColorStop(1, "rgba(0,0,0,0.35)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }
  ctx.font = `${Math.round(r * 0.95)}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(emoji, w / 2, h / 2 + r * 0.05);
  // Label jujur bahwa ini contoh
  ctx.font = `600 ${Math.round(Math.min(w, h) * 0.045)}px system-ui, sans-serif`;
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText(label, w * 0.04, h * 0.035);
  return c;
}

const SIZES: Record<string, [number, number]> = { "1:1": [1024, 1024], "9:16": [768, 1365], "3:4": [864, 1152], "4:3": [1152, 864], "16:9": [1365, 768] };

function emojiFor(prompt: string) {
  const p = prompt.toLowerCase();
  if (p.includes("fish") || p.includes("ikan")) return "🐟";
  if (p.includes("squid") || p.includes("cumi")) return "🦑";
  if (p.includes("corn") || p.includes("jagung")) return "🌽";
  if (p.includes("shrimp") || p.includes("udang")) return "🦐";
  return "🍗";
}

/** Menangani fetch ke Google; null = bukan urusan tiruan ini. */
export async function fakeGoogleFetch(url: string, init?: RequestInit): Promise<Response | null> {
  if (url.startsWith("https://www.googleapis.com/drive/v3/files?")) {
    return Response.json({
      files: FILES.map((f) => ({ id: f.id, name: f.name, mimeType: f.mimeType, videoMediaMetadata: f.durationMillis ? { durationMillis: f.durationMillis } : undefined })),
    });
  }
  if (url.startsWith("https://drive.google.com/thumbnail")) {
    const u = new URL(url);
    const f = FILES.find((x) => x.id === u.searchParams.get("id"));
    if (!f) return new Response("not found", { status: 404 });
    const w = Number(u.searchParams.get("sz")?.slice(1)) || 400;
    const size = Math.min(w, 1000);
    const bytes = await canvasToBytes(foodScene(size, size, f.emoji, f.hue, f.mimeType.startsWith("video") ? "▶ Contoh video (demo)" : "Contoh foto (demo)"));
    return new Response(bytes, { headers: { "content-type": "image/png" } });
  }
  if (url.includes("generativelanguage.googleapis.com")) {
    await new Promise((r) => setTimeout(r, 1500));
    const body = JSON.parse(String(init?.body ?? "{}"));
    const prompt: string = body.contents?.[0]?.parts?.[0]?.text ?? "";
    const reference = body.contents?.[0]?.parts?.[1];
    const [w, h] = SIZES[body.generationConfig?.imageConfig?.aspectRatio] ?? SIZES["1:1"];
    const canvas = foodScene(w, h, emojiFor(prompt), 25, reference ? "Foto dipercantik AI (demo)" : "Gambar AI (demo)", true);
    const bytes = await canvasToBytes(canvas);
    let bin = "";
    bytes.forEach((b) => (bin += String.fromCharCode(b)));
    return Response.json({ candidates: [{ content: { parts: [{ inlineData: { mimeType: "image/png", data: btoa(bin) } }] } }] });
  }
  return null;
}
