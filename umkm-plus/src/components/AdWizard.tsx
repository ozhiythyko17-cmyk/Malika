import { useState } from "react";
import type { Content, DriveFile, MetaLaunchInput, MetaObjective, MetaStatus } from "../../shared/types";
import { mutate, useApi } from "../api";
import { useSession } from "../App";
import { rp } from "../utils";
import { ApiImage, Chips, Field, MoneyInput, Sheet, useRun } from "./ui";

/** Bahan iklan yang dikirim dari Studio Konten (gambar + caption). */
export interface AdDraft {
  image: MetaLaunchInput["image"];
  previewPath: string; // alamat API gambar, atau data URL untuk poster
  captions: string[];
  headline: string;
}

const OBJECTIVES: Record<string, MetaObjective> = { "💬 Chat WhatsApp": "whatsapp", "🔗 Buka link": "link" };
const BUDGETS = [20_000, 30_000, 50_000, 100_000];
const BUDGET_LABELS = BUDGETS.map((b) => rp(b));
type Source = "Galeri AI" | "Google Drive" | "Dari HP";
const DAYS = [3, 5, 7, 14, 30];
const RADII = [2, 3, 5, 10, 15, 25];
const AGES = [18, 21, 25, 30, 35, 40, 45, 50, 55, 60, 65];

/** Perkecil foto dari HP jadi JPG maks. 1600 px supaya cepat diunggah ke Meta. */
async function shrink(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error("File ini bukan gambar yang bisa dibaca."));
      i.src = url;
    });
    const scale = Math.min(1, 1600 / Math.max(img.width, img.height));
    const c = document.createElement("canvas");
    c.width = Math.round(img.width * scale);
    c.height = Math.round(img.height * scale);
    c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", 0.9);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function Preview({ path }: { path: string }) {
  return path.startsWith("data:") ? <img className="result-img" src={path} alt="Gambar iklan" /> : <ApiImage className="result-img" path={path} alt="Gambar iklan" />;
}

export default function AdWizard({ draft, meta, onClose }: { draft: AdDraft | null; meta: MetaStatus | undefined; onClose: () => void }) {
  const { settings, go } = useSession();
  const [objectiveLabel, setObjectiveLabel] = useState("💬 Chat WhatsApp");
  const objective = OBJECTIVES[objectiveLabel];
  const [link, setLink] = useState("");
  const [image, setImage] = useState<{ value: MetaLaunchInput["image"]; preview: string } | null>(
    draft ? { value: draft.image, preview: draft.previewPath } : null
  );
  const [source, setSource] = useState<Source>("Galeri AI");
  const [primaryText, setPrimaryText] = useState(draft?.captions[0] ?? "");
  const [headline, setHeadline] = useState(draft?.headline ?? "");
  const [radiusKm, setRadiusKm] = useState(5);
  const [ageMin, setAgeMin] = useState(18);
  const [ageMax, setAgeMax] = useState(45);
  const [dailyBudget, setDailyBudget] = useState(30_000);
  const [customBudget, setCustomBudget] = useState(false);
  const [days, setDays] = useState(7);
  const [autopilot, setAutopilot] = useState(true);
  const [autopilotLimit, setAutopilotLimit] = useState(30_000);
  const [error, setError] = useState("");
  const [busy, run] = useRun();

  const { data: contents } = useApi<Content[]>(image ? null : "/contents");
  const gallery = (contents ?? []).filter((c) => c.mediaId);
  const { data: driveFiles } = useApi<DriveFile[]>(!image && settings.driveFolderUrl ? "/drive/files" : null);
  const photos = (driveFiles ?? []).filter((f) => f.kind === "image");

  const hasLocation = settings.latitude != null && settings.longitude != null;
  const total = dailyBudget * days;
  const problems = [
    !meta?.connected && "Akun Meta Ads belum terhubung.",
    !hasLocation && "Lokasi usaha belum diisi di Pengaturan.",
    !image && "Pilih gambar iklan.",
    !primaryText.trim() && "Tulis teks iklan.",
    objective === "link" && !/^https:\/\/\S+\.\S+/.test(link) && "Isi link tujuan (diawali https://).",
    dailyBudget < 10_000 && "Anggaran harian minimal Rp10.000.",
    ageMin > ageMax && "Umur minimal lebih besar dari maksimal.",
  ].filter(Boolean) as string[];

  async function pickFile(file: File | undefined) {
    if (!file) return;
    try {
      const dataUrl = await shrink(file);
      setImage({ value: { dataUrl }, preview: dataUrl });
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const launch = () =>
    run(async () => {
      setError("");
      await mutate("POST", "/meta/campaigns", {
        objective, link, image: image!.value, primaryText, headline, radiusKm, ageMin, ageMax, dailyBudget, days, autopilot, autopilotLimit,
      } satisfies MetaLaunchInput);
      alert("Iklan dipasang! Meta akan meninjaunya dulu (biasanya beberapa menit sampai 24 jam).");
      onClose();
    });

  return (
    <Sheet title="Pasang iklan di Facebook & Instagram" onClose={onClose}>
      <Field label="1. Tujuan iklan" group>
        <Chips options={Object.keys(OBJECTIVES)} value={objectiveLabel} onChange={setObjectiveLabel} />
      </Field>
      {objective === "whatsapp" ? (
        <p className="small muted">Orang yang tertarik menekan tombol lalu langsung chat ke WhatsApp usaha. Page Facebook harus sudah terhubung ke nomor WhatsApp Business.</p>
      ) : (
        <Field label="Link tujuan" hint="Mis. link toko GoFood, GrabFood, ShopeeFood, atau menu online">
          <input inputMode="url" value={link} onChange={(e) => setLink(e.target.value.trim())} placeholder="https://gofood.co.id/…" />
        </Field>
      )}

      <Field label="2. Gambar iklan" group>
        {image ? (
          <div className="stack">
            <Preview path={image.preview} />
            <button className="btn small" onClick={() => setImage(null)}>Ganti gambar</button>
          </div>
        ) : (
          <div className="stack">
            <Chips options={["Galeri AI", "Google Drive", "Dari HP"] as Source[]} value={source} onChange={setSource} />
            {source === "Galeri AI" &&
              (gallery.length ? (
                <div className="material-grid">
                  {gallery.map((c) => (
                    <button key={c.id} className="material" onClick={() => setImage({ value: { mediaId: c.mediaId! }, preview: `/api/media/${c.mediaId}` })}>
                      <ApiImage path={`/api/media/${c.mediaId}`} alt={c.title} />
                    </button>
                  ))}
                </div>
              ) : (
                <p className="small muted">Belum ada gambar AI tersimpan. Buat di tab AI Konten lalu tekan ⭐ Simpan.</p>
              ))}
            {source === "Google Drive" &&
              (photos.length ? (
                <div className="material-grid">
                  {photos.map((f) => (
                    <button key={f.id} className="material" onClick={() => setImage({ value: { driveFileId: f.id }, preview: `/api/drive/thumb/${f.id}?w=800` })}>
                      <ApiImage path={`/api/drive/thumb/${f.id}?w=300`} alt={f.name} />
                    </button>
                  ))}
                </div>
              ) : (
                <p className="small muted">{settings.driveFolderUrl ? "Memuat foto…" : "Folder Google Drive belum diisi di Pengaturan."}</p>
              ))}
            {source === "Dari HP" && <input type="file" accept="image/*" onChange={(e) => pickFile(e.target.files?.[0])} />}
          </div>
        )}
      </Field>

      <Field label="3. Teks iklan" group hint="Teks utama di atas gambar. Sebut menu, harga, dan ajakan memesan.">
        {draft && draft.captions.length > 1 && (
          <Chips
            options={draft.captions.map((_, i) => `Caption ${i + 1}`)}
            value={`Caption ${Math.max(1, draft.captions.indexOf(primaryText) + 1)}`}
            onChange={(v) => setPrimaryText(draft.captions[Number(v.split(" ")[1]) - 1])}
          />
        )}
        <textarea rows={5} value={primaryText} onChange={(e) => setPrimaryText(e.target.value)} />
      </Field>
      <Field label="Judul singkat" hint="Tampil tebal di bawah gambar, maks. ±40 huruf">
        <input value={headline} maxLength={80} onChange={(e) => setHeadline(e.target.value)} placeholder="Mis. Ayam Bakar Madu Rp25 ribu" />
      </Field>

      <Field label="4. Siapa yang melihat" group>
        {hasLocation ? (
          <div className="small muted">Orang di sekitar lokasi usaha ({settings.city || "titik di Pengaturan"}), dalam radius:</div>
        ) : (
          <div className="alert warn small">
            Lokasi usaha belum diisi.{" "}
            <button className="link-btn" onClick={() => go("pengaturan")}>Isi di Pengaturan</button>
          </div>
        )}
        <Chips options={RADII.map((r) => `${r} km`)} value={`${radiusKm} km`} onChange={(v) => setRadiusKm(parseInt(v))} />
      </Field>
      <div className="grid2">
        <Field label="Umur dari">
          <select value={ageMin} onChange={(e) => setAgeMin(Number(e.target.value))}>
            {AGES.map((a) => <option key={a} value={a}>{a} th</option>)}
          </select>
        </Field>
        <Field label="sampai">
          <select value={ageMax} onChange={(e) => setAgeMax(Number(e.target.value))}>
            {AGES.map((a) => <option key={a} value={a}>{a === 65 ? "65+ th" : `${a} th`}</option>)}
          </select>
        </Field>
      </div>

      <Field label="5. Anggaran per hari" group>
        <Chips
          options={[...BUDGET_LABELS, "Lainnya"]}
          value={customBudget ? "Lainnya" : rp(dailyBudget)}
          onChange={(v) => {
            const i = BUDGET_LABELS.indexOf(v);
            setCustomBudget(i < 0);
            if (i >= 0) {
              setDailyBudget(BUDGETS[i]);
              setAutopilotLimit(BUDGETS[i]);
            }
          }}
        />
        {customBudget && <MoneyInput value={dailyBudget} onChange={setDailyBudget} />}
      </Field>
      <Field label="Lama iklan" group>
        <Chips options={DAYS.map((d) => `${d} hari`)} value={`${days} hari`} onChange={(v) => setDays(parseInt(v))} />
      </Field>

      <div className="card flat stack">
        <label className="check">
          <input type="checkbox" checked={autopilot} onChange={(e) => setAutopilot(e.target.checked)} />
          <span>
            <b>🤖 Autopilot hemat</b> — jeda otomatis bila biaya sudah mencapai batas tapi belum ada satu pun {objective === "whatsapp" ? "chat" : "klik"}
          </span>
        </label>
        {autopilot && (
          <Field label="Batas biaya tanpa hasil">
            <MoneyInput value={autopilotLimit} onChange={setAutopilotLimit} />
          </Field>
        )}
      </div>

      <div className="card ad-preview">
        <div className="small muted">Pratinjau · {meta?.page?.name ?? settings.businessName} · Bersponsor</div>
        <div className="small pre">{primaryText || "Teks iklan…"}</div>
        {image && <Preview path={image.preview} />}
        <div className="row between">
          <b className="small">{headline || settings.businessName}</b>
          <span className="btn small">{objective === "whatsapp" ? "Kirim Pesan WhatsApp" : "Pesan Sekarang"}</span>
        </div>
      </div>

      <div className="card flat small">
        Maksimal biaya <b>{rp(total)}</b> ({rp(dailyBudget)} × {days} hari), ditagih Meta ke metode pembayaran akun iklanmu. Iklan berhenti otomatis setelah {days} hari.
      </div>

      {problems.length > 0 && (
        <ul className="small problems">
          {problems.map((p) => <li key={p}>{p}</li>)}
        </ul>
      )}
      {error && <div className="alert warn">{error}</div>}
      <button className="btn primary big" disabled={busy || problems.length > 0} onClick={launch}>
        {busy ? "⏳ Memasang iklan di Meta…" : `📣 Pasang iklan · maks. ${rp(total)}`}
      </button>
    </Sheet>
  );
}
