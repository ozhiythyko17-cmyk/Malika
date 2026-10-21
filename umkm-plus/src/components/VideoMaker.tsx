import { Clapperboard, Download, Image as ImageIcon, Mic, Play, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import type { DriveFile } from "../../shared/types";
import type { VideoScript } from "../../shared/prompt";
import { api } from "../api";
import { useSession } from "../App";
import { fetchDriveFile, renderVideo, supportedMime, type RenderResult, type RenderScene } from "../video/render";
import { Alert, Field, Spinner } from "./ui";

interface Props {
  script: VideoScript;
  materials: DriveFile[]; // bahan yang dipilih (urutan = Bahan 1, 2, …); kosong = mode prompt
  aspectRatio: string;
  musicFiles: DriveFile[]; // file audio di folder Drive
}

async function blobUrl(path: string) {
  const res = await fetch(path, { credentials: "same-origin" });
  if (!res.ok) throw new Error("Gambar adegan tidak bisa dimuat.");
  return URL.createObjectURL(await res.blob());
}

const clampSeconds = (n: number) => Math.min(8, Math.max(2, Math.round(n) || 3));

export default function VideoMaker({ script, materials, aspectRatio, musicFiles }: Props) {
  const { settings } = useSession();
  const [scenes, setScenes] = useState(script.scenes.map((s) => ({ ...s, seconds: clampSeconds(s.seconds) })));
  const [musicId, setMusicId] = useState<string>("");
  const [status, setStatus] = useState("");
  const [progress, setProgress] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [video, setVideo] = useState<(RenderResult & { url: string }) | null>(null);
  const canRecord = supportedMime() !== null;

  useEffect(() => {
    setScenes(script.scenes.map((s) => ({ ...s, seconds: clampSeconds(s.seconds) })));
    setVideo(null);
  }, [script]);

  useEffect(() => () => {
    if (video) URL.revokeObjectURL(video.url);
  }, [video]);

  const fromDrive = materials.length > 0;
  const totalSeconds = scenes.reduce((s, x) => s + x.seconds, 0) + 3;
  const setScene = (i: number, patch: Partial<(typeof scenes)[number]>) =>
    setScenes(scenes.map((s, k) => (k === i ? { ...s, ...patch } : s)));

  async function make() {
    // Dibuat langsung saat tombol ditekan: HP (terutama iPhone) hanya mengizinkan suara dari ketukan pengguna.
    const audioContext = musicId ? new AudioContext() : null;
    audioContext?.resume().catch(() => {});
    setBusy(true);
    setError("");
    setVideo(null);
    setProgress(0);
    const urls: string[] = [];
    let wakeLock: { release: () => Promise<void> } | null = null;
    try {
      wakeLock = await (navigator as Navigator & { wakeLock?: { request: (t: string) => Promise<{ release: () => Promise<void> }> } }).wakeLock
        ?.request("screen")
        .catch(() => null) ?? null;

      // 1. Siapkan gambar/video untuk tiap adegan.
      let sources: RenderScene["source"][];
      if (fromDrive) {
        const cache = new Map<string, RenderScene["source"]>();
        sources = [];
        for (const [i, s] of scenes.entries()) {
          setStatus(`Mengambil bahan adegan ${i + 1} dari ${scenes.length}…`);
          const file = materials[s.material - 1] ?? materials[0];
          let source = cache.get(file.id);
          if (!source) {
            const thumb = await blobUrl(`/api/drive/thumb/${file.id}?w=1280`);
            urls.push(thumb);
            if (file.kind === "video") {
              // Video gagal diunduh/diputar: adegan memakai gambar cuplikannya.
              const url = await fetchDriveFile(file.id).catch(() => null);
              if (url) urls.push(url);
              source = url ? { kind: "video", url, fallbackUrl: thumb } : { kind: "image", url: thumb };
            } else source = { kind: "image", url: thumb };
            cache.set(file.id, source);
          }
          sources.push(source);
        }
      } else {
        // Mode prompt: setiap adegan dibuatkan gambar oleh AI, sekaligus.
        let made = 0;
        setStatus(`Membuat gambar AI untuk ${scenes.length} adegan…`);
        sources = await Promise.all(
          scenes.map(async (s) => {
            const prompt = s.imagePrompt || `${s.shot}. Appetizing food photo, no text.`;
            const img = await api<{ url: string }>("POST", "/ai/image", { imagePrompt: prompt, aspectRatio, referenceFileId: null });
            const url = await blobUrl(img.url);
            urls.push(url);
            setStatus(`Membuat gambar AI: ${++made} dari ${scenes.length} selesai…`);
            return { kind: "image" as const, url };
          })
        );
      }

      let musicUrl: string | null = null;
      if (musicId) {
        setStatus("Mengunduh musik…");
        musicUrl = await fetchDriveFile(musicId);
        urls.push(musicUrl);
      }

      // 2. Rekam video.
      setStatus(`Merekam video (${totalSeconds} detik) — biarkan layar tetap menyala…`);
      const result = await renderVideo({
        scenes: scenes.map((s, i) => ({ seconds: s.seconds, source: sources[i], overlayText: s.overlayText })),
        aspectRatio,
        endCard: {
          title: settings.businessName,
          subtitle: settings.businessWa ? `WA ${settings.businessWa}` : settings.city,
          cta: "Pesan sekarang!",
        },
        musicUrl,
        audioContext,
        onProgress: setProgress,
      });
      setVideo({ ...result, url: URL.createObjectURL(result.blob) });
      setStatus("");
    } catch (e) {
      setError((e as Error).message);
      setStatus("");
      await audioContext?.close().catch(() => {});
    } finally {
      urls.forEach((u) => URL.revokeObjectURL(u));
      await wakeLock?.release().catch(() => {});
      setBusy(false);
    }
  }

  let at = 0;
  return (
    <div className="card stack">
      <b className="section-title">
        <Clapperboard size={18} /> Video otomatis: {script.title}
      </b>
      <p className="small muted">
        {fromDrive
          ? "Video disusun dari bahan yang kamu pilih. Teks dan lama tiap adegan bisa diubah sebelum dibuat."
          : "Setiap adegan dibuatkan gambar oleh AI, lalu disusun jadi video bergerak."}
      </p>
      <div className="scene-list">
        {scenes.map((s, i) => {
          const from = at;
          at += s.seconds;
          const m = fromDrive ? materials[s.material - 1] ?? materials[0] : null;
          return (
            <div key={i} className="scene">
              <div className="row between small">
                <b>
                  Adegan {i + 1} · {from}–{at} dtk
                </b>
                <span className="muted inline-icon">
                  {m?.kind === "video" ? <Play size={13} /> : <ImageIcon size={13} />}
                  {m ? `Bahan ${materials.indexOf(m) + 1}` : "Gambar AI"}
                </span>
              </div>
              <div className="small muted">{s.shot}</div>
              <div className="scene-edit">
                <input aria-label={`Teks adegan ${i + 1}`} value={s.overlayText} onChange={(e) => setScene(i, { overlayText: e.target.value })} />
                <select aria-label={`Lama adegan ${i + 1}`} value={s.seconds} onChange={(e) => setScene(i, { seconds: Number(e.target.value) })}>
                  {[2, 3, 4, 5, 6, 7, 8].map((n) => (
                    <option key={n} value={n}>{n} dtk</option>
                  ))}
                </select>
              </div>
              {s.voiceover && (
                <div className="small muted icon-line">
                  <Mic size={14} />
                  <span>{s.voiceover}</span>
                </div>
              )}
            </div>
          );
        })}
        <div className="scene small muted">Penutup · 3 dtk · nama usaha, “Pesan sekarang!”, nomor WA</div>
      </div>

      <Field label="Musik latar" hint={musicFiles.length ? `Saran AI: ${script.music}` : "Unggah file musik (MP3) ke folder Drive bahan konten untuk memakai musik."}>
        <select value={musicId} onChange={(e) => setMusicId(e.target.value)}>
          <option value="">Tanpa musik</option>
          {musicFiles.map((f) => (
            <option key={f.id} value={f.id}>{f.name}</option>
          ))}
        </select>
      </Field>

      {!canRecord && <Alert tone="warn">Browser ini belum bisa membuat video. Buka aplikasi di Google Chrome terbaru.</Alert>}
      <button className="btn primary" disabled={busy || !canRecord} onClick={make}>
        {busy ? (
          <><Spinner /> Sedang membuat video…</>
        ) : video ? (
          <><RefreshCw size={18} /> Buat ulang video</>
        ) : (
          <><Clapperboard size={18} /> Buat video ({totalSeconds} detik)</>
        )}
      </button>
      {!fromDrive && !busy && !video && (
        <p className="small muted">Membuat {scenes.length} gambar AI (biaya kecil per gambar), lalu merekam video.</p>
      )}
      {busy && (
        <div className="stack">
          <div className="small">{status}</div>
          <div className="prog"><i style={{ width: `${Math.round(progress * 100)}%` }} /></div>
        </div>
      )}
      {error && <Alert tone="warn">{error}</Alert>}

      {video && (
        <div className="stack">
          <video className="result-video" src={video.url} controls playsInline />
          <a className="btn" href={video.url} download={`video-${settings.businessName.toLowerCase().replace(/\W+/g, "-")}-${Date.now()}.${video.extension}`}>
            <Download size={18} /> Unduh video ({(video.blob.size / 1024 / 1024).toFixed(1)} MB, {video.extension.toUpperCase()})
          </a>
          {video.extension === "webm" && (
            <p className="small muted">HP ini menyimpan video sebagai WebM. TikTok & WhatsApp biasanya menerima; bila Instagram menolak, buka aplikasi di Chrome terbaru agar tersimpan sebagai MP4.</p>
          )}
        </div>
      )}
    </div>
  );
}
