// Perender video di browser: adegan (foto/video/gambar AI) + teks di layar + musik latar + penutup,
// digambar di kanvas lalu direkam dengan MediaRecorder menjadi file MP4 (atau WebM bila MP4 tak didukung).
import fixWebmDuration from "fix-webm-duration";

export type SceneSource = { kind: "image"; url: string } | { kind: "video"; url: string; fallbackUrl?: string };

export interface RenderScene {
  seconds: number;
  source: SceneSource;
  overlayText: string;
}

export interface RenderOptions {
  scenes: RenderScene[];
  aspectRatio: string; // "9:16" | "1:1"
  endCard: { title: string; subtitle: string; cta: string };
  musicUrl?: string | null;
  /** Buat di dalam klik tombol (sebelum menunggu apa pun) supaya HP mengizinkan suara, terutama iPhone. */
  audioContext?: AudioContext | null;
  onProgress?: (fraction: number) => void;
}

export interface RenderResult {
  blob: Blob;
  mime: string;
  extension: "mp4" | "webm";
  seconds: number;
}

const FPS = 30;
const END_SECONDS = 3;
const FONT = "'Plus Jakarta Sans Variable', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

export function supportedMime() {
  const candidates = [
    "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
    "video/mp4;codecs=avc1",
    "video/mp4",
    "video/webm;codecs=vp9,opus",
    "video/webm",
  ];
  if (typeof MediaRecorder === "undefined") return null;
  return candidates.find((t) => MediaRecorder.isTypeSupported(t)) ?? null;
}

function loadImage(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Gambar adegan tidak bisa dimuat."));
    img.src = url;
  });
}

function loadVideo(url: string) {
  return new Promise<HTMLVideoElement>((resolve, reject) => {
    const v = document.createElement("video");
    v.muted = true;
    v.playsInline = true;
    v.preload = "auto";
    v.onloadeddata = () => resolve(v);
    v.onerror = () => reject(new Error("Video adegan tidak bisa diputar."));
    v.src = url;
  });
}

type Visual = HTMLImageElement | HTMLVideoElement;

async function loadScene(source: SceneSource): Promise<Visual> {
  if (source.kind === "image") return loadImage(source.url);
  try {
    return await loadVideo(source.url);
  } catch (e) {
    // Video gagal diputar di HP ini: pakai gambar cuplikannya supaya video tetap jadi.
    if (source.fallbackUrl) return loadImage(source.fallbackUrl);
    throw e;
  }
}

function size(v: Visual) {
  return v instanceof HTMLVideoElement ? [v.videoWidth, v.videoHeight] : [v.naturalWidth, v.naturalHeight];
}

/** Gambar `v` memenuhi kanvas (crop tengah), dengan zoom pelan untuk foto (efek Ken Burns). */
function drawCover(ctx: CanvasRenderingContext2D, v: Visual, w: number, h: number, zoom: number, panX: number) {
  const [vw, vh] = size(v);
  if (!vw || !vh) return;
  const scale = Math.max(w / vw, h / vh) * zoom;
  const dw = vw * scale;
  const dh = vh * scale;
  ctx.drawImage(v, (w - dw) / 2 + panX * (dw - w) * 0.5, (h - dh) / 2, dw, dh);
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Teks besar di layar ala Reels/TikTok, muncul dengan efek "pop". */
function drawOverlay(ctx: CanvasRenderingContext2D, text: string, w: number, h: number, appear: number) {
  if (!text) return;
  const fontSize = Math.round(w * 0.075);
  ctx.font = `800 ${fontSize}px ${FONT}`;
  const lines = wrap(ctx, text, w * 0.8).slice(0, 3);
  const lineH = fontSize * 1.22;
  const boxW = Math.max(...lines.map((l) => ctx.measureText(l).width)) + fontSize * 1.1;
  const boxH = lines.length * lineH + fontSize * 0.7;
  const scale = 0.85 + 0.15 * Math.min(1, appear);
  ctx.save();
  ctx.globalAlpha = Math.min(1, appear * 1.5);
  ctx.translate(w / 2, h * 0.7);
  ctx.scale(scale, scale);
  ctx.fillStyle = "rgba(255,255,255,0.95)";
  roundRect(ctx, -boxW / 2, -boxH / 2, boxW, boxH, fontSize * 0.35);
  ctx.fill();
  ctx.fillStyle = "#13348f";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  lines.forEach((l, i) => ctx.fillText(l, 0, (i - (lines.length - 1) / 2) * lineH));
  ctx.restore();
}

function drawEndCard(ctx: CanvasRenderingContext2D, card: RenderOptions["endCard"], w: number, h: number, t: number) {
  const bg = ctx.createLinearGradient(0, 0, w, h);
  bg.addColorStop(0, "#2463eb");
  bg.addColorStop(1, "#13348f");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
  ctx.globalAlpha = Math.min(1, t * 2.5);
  ctx.fillStyle = "#fff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `800 ${Math.round(w * 0.1)}px ${FONT}`;
  wrap(ctx, card.title, w * 0.85).forEach((l, i) => ctx.fillText(l, w / 2, h * 0.4 + i * w * 0.12));
  // Ajakan dalam kapsul putih.
  ctx.font = `700 ${Math.round(w * 0.05)}px ${FONT}`;
  const pillW = ctx.measureText(card.cta).width + w * 0.1;
  const pillH = w * 0.1;
  ctx.fillStyle = "#fff";
  roundRect(ctx, (w - pillW) / 2, h * 0.58 - pillH / 2, pillW, pillH, pillH / 2);
  ctx.fill();
  ctx.fillStyle = "#1a4fd0";
  ctx.fillText(card.cta, w / 2, h * 0.58);
  ctx.font = `500 ${Math.round(w * 0.045)}px ${FONT}`;
  ctx.fillStyle = "rgba(255,255,255,0.88)";
  ctx.fillText(card.subtitle, w / 2, h * 0.58 + pillH * 1.05);
  ctx.globalAlpha = 1;
}

export async function renderVideo(opts: RenderOptions): Promise<RenderResult> {
  const mime = supportedMime();
  if (!mime) throw new Error("Browser ini belum bisa membuat video. Coba pakai Google Chrome terbaru.");
  if (!opts.scenes.length) throw new Error("Tidak ada adegan untuk dirender.");

  const [w, h] = opts.aspectRatio === "9:16" ? [720, 1280] : [720, 720];
  // Pastikan huruf aplikasi sudah dimuat sebelum digambar di kanvas.
  await document.fonts?.load(`800 40px ${FONT}`).catch(() => {});
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;

  // Sumber yang sama dipakai bersama, supaya video yang muncul di beberapa adegan berlanjut, bukan mengulang.
  const loaded = new Map<string, Promise<Visual>>();
  const visuals = await Promise.all(
    opts.scenes.map((s) => {
      if (!loaded.has(s.source.url)) loaded.set(s.source.url, loadScene(s.source));
      return loaded.get(s.source.url)!;
    })
  );
  const offsets = new Map<Visual, number>();
  const starts: number[] = [];
  let total = 0;
  for (const s of opts.scenes) {
    starts.push(total);
    total += s.seconds;
  }
  const videoEnd = total;
  total += END_SECONDS;

  // Musik latar (opsional): diulang bila lebih pendek dari video, dikecilkan di detik terakhir.
  const stream = canvas.captureStream(FPS);
  const audioCtx = opts.musicUrl ? opts.audioContext ?? new AudioContext() : null;
  let music: { src: AudioBufferSourceNode; gain: GainNode } | null = null;
  if (audioCtx && opts.musicUrl) {
    await audioCtx.resume().catch(() => {});
    const buffer = await audioCtx.decodeAudioData(await (await fetch(opts.musicUrl)).arrayBuffer());
    const src = audioCtx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    const gain = audioCtx.createGain();
    const dest = audioCtx.createMediaStreamDestination();
    src.connect(gain).connect(dest);
    dest.stream.getAudioTracks().forEach((t) => stream.addTrack(t));
    music = { src, gain };
  }

  const recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 4_000_000 });
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  const done = new Promise<void>((resolve) => (recorder.onstop = () => resolve()));

  let current = -1;
  recorder.start(500);
  const begin = performance.now();
  if (audioCtx && music) {
    const now = audioCtx.currentTime;
    music.gain.gain.setValueAtTime(0.8, now);
    music.gain.gain.setValueAtTime(0.8, now + Math.max(0, total - 1.5));
    music.gain.gain.linearRampToValueAtTime(0, now + total);
    music.src.start(now);
  }

  await new Promise<void>((resolve) => {
    const frame = () => {
      const t = (performance.now() - begin) / 1000;
      if (t >= total) return resolve();
      opts.onProgress?.(t / total);

      if (t >= videoEnd) {
        if (current < opts.scenes.length) {
          visuals.forEach((v) => v instanceof HTMLVideoElement && v.pause());
          current = opts.scenes.length;
        }
        drawEndCard(ctx, opts.endCard, w, h, t - videoEnd);
      } else {
        let i = starts.findIndex((s, k) => t >= s && t < s + opts.scenes[k].seconds);
        if (i < 0) i = opts.scenes.length - 1;
        const v = visuals[i];
        if (i !== current) {
          const prev = current >= 0 ? visuals[current] : null;
          if (prev instanceof HTMLVideoElement) {
            prev.pause();
            offsets.set(prev, (offsets.get(prev) ?? 0) + opts.scenes[current].seconds);
          }
          if (v instanceof HTMLVideoElement) {
            // Lanjutkan dari bagian yang belum dipakai; kembali ke awal bila sisa videonya kurang.
            const from = offsets.get(v) ?? 0;
            v.currentTime = from + opts.scenes[i].seconds <= (v.duration || 0) ? from : 0;
            if (v.currentTime === 0) offsets.set(v, 0);
            v.play().catch(() => {});
          }
          current = i;
        }
        const local = t - starts[i];
        const progress = local / opts.scenes[i].seconds;
        ctx.fillStyle = "#000";
        ctx.fillRect(0, 0, w, h);
        const isPhoto = !(v instanceof HTMLVideoElement);
        drawCover(ctx, v, w, h, isPhoto ? 1 + 0.12 * progress : 1, isPhoto ? (i % 2 ? 1 : -1) * 0.3 * progress : 0);
        // Gelap tipis di bawah supaya teks terbaca, dan transisi masuk singkat.
        const shade = ctx.createLinearGradient(0, h * 0.5, 0, h);
        shade.addColorStop(0, "rgba(0,0,0,0)");
        shade.addColorStop(1, "rgba(0,0,0,0.45)");
        ctx.fillStyle = shade;
        ctx.fillRect(0, h * 0.5, w, h * 0.5);
        if (local < 0.2) {
          ctx.fillStyle = `rgba(0,0,0,${1 - local / 0.2})`;
          ctx.fillRect(0, 0, w, h);
        }
        drawOverlay(ctx, opts.scenes[i].overlayText, w, h, (local - 0.15) / 0.3);
      }
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  });

  recorder.stop();
  await done;
  stream.getTracks().forEach((t) => t.stop());
  music?.src.stop();
  await audioCtx?.close().catch(() => {});
  opts.onProgress?.(1);

  const type = mime.split(";")[0];
  let blob = new Blob(chunks, { type });
  // WebM dari MediaRecorder tidak mencatat durasi; tanpa ini video tidak bisa digeser di pemutar.
  if (type === "video/webm") blob = await fixWebmDuration(blob, total * 1000, { logger: false });
  return { blob, mime: type, extension: type === "video/mp4" ? "mp4" : "webm", seconds: total };
}

/** Ambil file Drive utuh lewat server (per potongan 4 MB) dan kembalikan sebagai blob URL. */
export async function fetchDriveFile(id: string): Promise<string> {
  const parts: Blob[] = [];
  let part = 0;
  let total = Infinity;
  let received = 0;
  let type = "";
  while (received < total) {
    const res = await fetch(`/api/drive/file/${id}?part=${part}`, { credentials: "same-origin" });
    if (!res.ok) throw new Error("File dari Google Drive tidak bisa diunduh.");
    total = Number(res.headers.get("X-Total-Size") ?? "0");
    type = res.headers.get("Content-Type") ?? type;
    const blob = await res.blob();
    if (!blob.size) break;
    parts.push(blob);
    received += blob.size;
    part++;
    if (part > 40) throw new Error("File terlalu besar (maksimal ±160 MB).");
  }
  return URL.createObjectURL(new Blob(parts, { type }));
}
