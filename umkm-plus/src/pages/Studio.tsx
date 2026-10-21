import { useState } from "react";
import type { DriveFile, Product } from "../../shared/types";
import { ASPECT, PLATFORMS, STYLES, type StudioResult } from "../../shared/prompt";
import { api, ApiError, mutate, useApi } from "../api";
import { useSession } from "../App";
import Poster from "../components/Poster";
import VideoMaker from "../components/VideoMaker";
import { ApiImage, Chips, Empty, Field, useRun } from "../components/ui";

type Source = "Dari prompt" | "Dari Google Drive";
type ImageMode = "Poster dari foto asli" | "Foto dipercantik AI";

const MAX_MATERIALS = 4;

function copy(text: string) {
  navigator.clipboard.writeText(text).then(() => alert("Tersalin! Tinggal tempel di Instagram/TikTok/WA."));
}

export default function Studio() {
  const { settings, isOwner, go } = useSession();
  const { data: allProducts } = useApi<Product[]>("/products");
  const products = allProducts?.filter((p) => p.active) ?? [];

  const [source, setSource] = useState<Source>("Dari prompt");
  const [brief, setBrief] = useState("");
  const [productId, setProductId] = useState<number | null>(null);
  const [platform, setPlatform] = useState(PLATFORMS[0]);
  const [style, setStyle] = useState(STYLES.includes(settings.brandVoice) ? settings.brandVoice : STYLES[0]);
  const [wantImage, setWantImage] = useState(true);
  const [imageMode, setImageMode] = useState<ImageMode>("Poster dari foto asli");
  const [wantVideo, setWantVideo] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);

  const fromDrive = source === "Dari Google Drive";
  // Daftar file Drive juga dipakai di mode prompt untuk pilihan musik video.
  const drive = useApi<DriveFile[]>(settings.driveFolderUrl ? "/drive/files" : null);
  const materialFiles = drive.data?.filter((f) => f.kind !== "audio");
  const musicFiles = drive.data?.filter((f) => f.kind === "audio") ?? [];

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [result, setResult] = useState<(StudioResult & { aspectRatio: string }) | null>(null);
  const [usedFiles, setUsedFiles] = useState<DriveFile[]>([]);
  const [image, setImage] = useState<{ url: string; mediaId: number } | null>(null);
  const [imageLoading, setImageLoading] = useState(false);
  const [imageError, setImageError] = useState("");
  const [, run] = useRun();

  const request = () => ({
    source: fromDrive ? "drive" : "prompt",
    brief,
    productId,
    platform,
    style,
    wantImage,
    wantVideo,
    fileIds: fromDrive ? selected : [],
  });

  async function makeImage(r: StudioResult & { aspectRatio: string }, files: DriveFile[]) {
    setImageLoading(true);
    setImageError("");
    try {
      const reference = fromDrive ? (files.find((f) => f.kind === "image") ?? files[0]) : null;
      setImage(await api("POST", "/ai/image", { imagePrompt: r.imagePrompt, aspectRatio: r.aspectRatio, referenceFileId: reference?.id ?? null }));
    } catch (e) {
      setImageError((e as Error).message);
    } finally {
      setImageLoading(false);
    }
  }

  async function generate() {
    setLoading(true);
    setError(null);
    setResult(null);
    setImage(null);
    setImageError("");
    const files = (drive.data ?? []).filter((f) => selected.includes(f.id));
    try {
      const r = await api<StudioResult & { aspectRatio: string }>("POST", "/ai/generate", request());
      setResult(r);
      setUsedFiles(files);
      setLoading(false);
      if (wantImage && (!fromDrive || imageMode === "Foto dipercantik AI")) await makeImage(r, files);
    } catch (e) {
      setError(e as ApiError);
    } finally {
      setLoading(false);
    }
  }

  const toggleFile = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : s.length >= MAX_MATERIALS ? s : [...s, id]));

  const copyPrompt = () => run(async () => copy((await api<{ text: string }>("POST", "/ai/prompt", request())).text));
  const save = (text: string) =>
    run(async () => {
      const title = brief.slice(0, 60) || products.find((p) => p.id === productId)?.name || "Konten";
      await mutate("POST", "/contents", { title, platform, text, mediaId: image?.mediaId ?? null });
      alert(image ? "Caption + gambar disimpan di tab Tersimpan." : "Disimpan di tab Tersimpan.");
    });

  const canGenerate = fromDrive ? selected.length > 0 : brief.trim() !== "" || productId !== null;
  const footer = [settings.businessName, settings.businessWa && `WA ${settings.businessWa}`].filter(Boolean).join(" · ");
  const aspect = ASPECT[platform] ?? "1:1";
  const posterPhoto = usedFiles.find((f) => f.kind === "image") ?? usedFiles[0];

  return (
    <div className="stack">
      <Field label="Bahan konten">
        <Chips
          options={["Dari prompt", "Dari Google Drive"] as Source[]}
          value={source}
          onChange={(v) => {
            setSource(v);
            setResult(null);
            setImage(null);
            setError(null);
          }}
        />
      </Field>

      {fromDrive && !settings.driveFolderUrl && (
        <div className="alert info">
          Belum ada folder Google Drive. {isOwner ? "Tempel link folder bahan foto/video di " : "Minta pemilik mengisi link folder di "}
          {isOwner ? <button className="link-btn" onClick={() => go("pengaturan")}>Pengaturan</button> : "Pengaturan"}.
        </div>
      )}
      {fromDrive && settings.driveFolderUrl && (
        <div className="stack">
          <div className="row between">
            <span className="small muted">Pilih maksimal {MAX_MATERIALS} foto/video ({selected.length} dipilih)</span>
            <button className="btn small" onClick={drive.reload}>🔄 Muat ulang</button>
          </div>
          {drive.error && <div className="alert warn">{drive.error}</div>}
          {!drive.data && !drive.error && <p className="muted small">Memuat bahan dari Google Drive…</p>}
          {materialFiles?.length === 0 && <Empty icon="📁">Folder kosong. Unggah foto/video menu ke folder Drive, lalu muat ulang.</Empty>}
          <div className="material-grid">
            {materialFiles?.map((f) => {
              const n = selected.indexOf(f.id);
              return (
                <button key={f.id} className={n >= 0 ? "material on" : "material"} onClick={() => toggleFile(f.id)} title={f.name}>
                  <ApiImage path={`/api/drive/thumb/${f.id}?w=300`} alt={f.name} />
                  {f.kind === "video" && <span className="tag-video">▶ {f.durationSec ? `${f.durationSec}s` : "video"}</span>}
                  {n >= 0 && <span className="tag-num">{n + 1}</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <Field label={fromDrive ? "Arahan untuk AI (opsional)" : "Mau bikin konten apa?"} hint="Mis. promo paket keluarga akhir pekan, beli 2 gratis es teh, khusus Jumat">
        <textarea rows={3} value={brief} onChange={(e) => setBrief(e.target.value)} placeholder="Ceritakan konten yang kamu mau…" />
      </Field>
      <Field label="Produk terkait (opsional)" hint="Supaya AI tahu nama, harga, dan keterangan menunya">
        <select value={productId ?? ""} onChange={(e) => setProductId(e.target.value ? Number(e.target.value) : null)}>
          <option value="">— Tidak spesifik —</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>{p.emoji} {p.name}</option>
          ))}
        </select>
      </Field>
      <Field label="Untuk">
        <Chips options={PLATFORMS} value={platform} onChange={setPlatform} />
      </Field>
      <Field label="Gaya bahasa">
        <Chips options={STYLES} value={style} onChange={setStyle} />
      </Field>

      <div className="card flat stack">
        <b className="small">Hasil yang dibuat</b>
        <label className="check"><input type="checkbox" checked disabled /> 3 variasi caption + hashtag</label>
        <label className="check">
          <input type="checkbox" checked={wantImage} onChange={(e) => setWantImage(e.target.checked)} />
          {fromDrive ? "Gambar promo dari bahan" : "Gambar promo dibuat AI"}
        </label>
        {fromDrive && wantImage && (
          <Chips options={["Poster dari foto asli", "Foto dipercantik AI"] as ImageMode[]} value={imageMode} onChange={setImageMode} />
        )}
        <label className="check">
          <input type="checkbox" checked={wantVideo} onChange={(e) => setWantVideo(e.target.checked)} /> Video pendek otomatis (Reels/TikTok)
        </label>
      </div>

      <button className="btn primary big" disabled={loading || !canGenerate} onClick={generate}>
        {loading ? "⏳ AI sedang bekerja…" : "✨ Buat konten"}
      </button>

      {error && (
        <div className="alert warn">
          {error.message}
          {error.status === 503 && (
            <>
              <div className="small">Sementara bisa pakai cara manual: salin perintah di bawah lalu tempel di aplikasi Claude.</div>
              <button className="btn small" onClick={copyPrompt}>📋 Salin perintah AI</button>
            </>
          )}
        </div>
      )}

      {result && (
        <div className="stack">
          {result.materialNotes.length > 0 && (
            <div className="card flat small">
              <b>👀 Yang dilihat AI dari bahanmu</b>
              <ul>{result.materialNotes.map((n, i) => <li key={i}>{n}</li>)}</ul>
            </div>
          )}

          {wantImage && (
            <div className="card stack">
              <b>🖼️ Gambar promo</b>
              {imageLoading && <p className="muted">⏳ Sedang membuat gambar… (bisa 10–30 detik)</p>}
              {imageError && (
                <div className="alert warn">
                  {imageError}
                  <button className="btn small" onClick={() => makeImage(result, usedFiles)}>Coba lagi</button>
                </div>
              )}
              {image && (
                <>
                  <ApiImage className="result-img" path={image.url} alt="Gambar promo buatan AI" />
                  <div className="row gap">
                    <a className="btn small" href={image.url} download={`gambar-promo-${image.mediaId}.png`}>⬇️ Unduh gambar</a>
                    <button className="btn small" onClick={() => makeImage(result, usedFiles)}>🔄 Buat ulang</button>
                  </div>
                  {!fromDrive && <p className="small muted">Ini ilustrasi buatan AI. Untuk foto menu, sebaiknya pakai foto asli agar pembeli tidak kecewa.</p>}
                  <details>
                    <summary className="small">Tambahkan judul & nama usaha (poster)</summary>
                    <Poster imageUrl={image.url} aspectRatio={result.aspectRatio} headline={result.headline} subheadline={result.subheadline} footer={footer} />
                  </details>
                </>
              )}
              {fromDrive && imageMode === "Poster dari foto asli" && posterPhoto && (
                <Poster
                  imageUrl={`/api/drive/thumb/${posterPhoto.id}?w=1600`}
                  aspectRatio={aspect}
                  headline={result.headline}
                  subheadline={result.subheadline}
                  footer={footer}
                />
              )}
            </div>
          )}

          {result.captions.map((text, i) => (
            <div key={i} className="card result">
              <small className="muted">Caption {i + 1}</small>
              <pre>{text}</pre>
              <div className="row gap">
                <button className="btn small" onClick={() => copy(text)}>📋 Salin</button>
                <button className="btn small" onClick={() => save(text)}>⭐ Simpan</button>
              </div>
            </div>
          ))}

          {result.video && (
            <>
              <VideoMaker script={result.video} materials={usedFiles} aspectRatio={result.aspectRatio} musicFiles={musicFiles} />
              <div className="row gap">
                <button className="btn small" onClick={() => copy(videoText(result.video!))}>📋 Salin naskah video</button>
                <button className="btn small" onClick={() => save(videoText(result.video!))}>⭐ Simpan naskah</button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function videoText(v: NonNullable<StudioResult["video"]>) {
  let at = 0;
  return [
    `🎬 ${v.title}`,
    ...v.scenes.map((s) => {
      const line = `\n[${at}–${at + s.seconds} dtk]\nGambar: ${s.shot}\nTeks layar: ${s.overlayText}\nNarasi: ${s.voiceover}`;
      at += s.seconds;
      return line;
    }),
    `\nMusik: ${v.music}`,
  ].join("\n");
}
