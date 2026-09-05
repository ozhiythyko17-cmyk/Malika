"use client";

import { useEffect, useMemo, useState } from "react";

import { getMajors, suggestTopics, type Major, type TopicSuggestion } from "../lib/api";
import { ICONS, Icon } from "./ui";

const INTERESTS = [
  "Teknologi & data",
  "Perilaku manusia",
  "Bisnis & keuangan",
  "Pendidikan",
  "Kesehatan",
  "Kebijakan publik",
  "Lingkungan",
  "Budaya & media",
];

const DATA_SOURCES = [
  "Kuesioner ke responden",
  "Wawancara narasumber",
  "Data sekunder / laporan",
  "Data publik dari internet",
  "Observasi lapangan",
  "Belum tahu",
];

type Mode = "bantu" | "punya" | null;
type Step = "prodi" | "mulai" | "minat" | "hasil" | "topik" | "ringkas";

export function NewThesisWizard({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (prompt: string, major: string) => Promise<void>;
}) {
  const [step, setStep] = useState(0);
  const [majors, setMajors] = useState<Major[]>([]);
  const [query, setQuery] = useState("");
  const [major, setMajor] = useState<Major | null>(null);
  const [mode, setMode] = useState<Mode>(null);
  const [interests, setInterests] = useState<string[]>([]);
  const [dataAccess, setDataAccess] = useState<string | null>(null);
  const [topics, setTopics] = useState<TopicSuggestion[]>([]);
  const [chosen, setChosen] = useState<number | null>(null);
  const [ownTopic, setOwnTopic] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getMajors()
      .then((data) => setMajors(data.majors))
      .catch(() => setError("Daftar jurusan tidak bisa dimuat — pastikan API berjalan."));
  }, []);

  const steps: Step[] = useMemo(() => {
    if (!mode) return ["prodi", "mulai"];
    return mode === "bantu"
      ? ["prodi", "mulai", "minat", "hasil", "ringkas"]
      : ["prodi", "mulai", "topik", "ringkas"];
  }, [mode]);

  const current = steps[Math.min(step, steps.length - 1)];
  const judul = mode === "bantu" && chosen !== null ? topics[chosen]?.judul ?? "" : ownTopic;

  const filtered = majors.filter((m) =>
    `${m.name} ${m.faculty}`.toLowerCase().includes(query.toLowerCase()),
  );

  const canContinue = (() => {
    if (busy) return false;
    switch (current) {
      case "prodi":
        return Boolean(major);
      case "mulai":
        return Boolean(mode);
      case "minat":
        return interests.length > 0 && Boolean(dataAccess);
      case "hasil":
        return chosen !== null;
      case "topik":
        return ownTopic.trim().length >= 10;
      default:
        return true;
    }
  })();

  async function next() {
    setError(null);

    if (current === "minat") {
      setBusy(true);
      try {
        const result = await suggestTopics({
          major: major?.id ?? "lain",
          interests,
          data_access: dataAccess ?? "Belum tahu",
        });
        setTopics(result.suggestions);
        setChosen(null);
        setStep((s) => s + 1);
      } catch (err) {
        setError(`Pencarian topik gagal: ${(err as Error).message}`);
      } finally {
        setBusy(false);
      }
      return;
    }

    if (current === "ringkas") {
      setBusy(true);
      try {
        await onSubmit(judul, major?.name ?? "");
      } catch (err) {
        setError((err as Error).message);
        setBusy(false);
      }
      return;
    }

    setStep((s) => Math.min(s + 1, steps.length - 1));
  }

  return (
    <div className="overlay">
      <div>
        <div className="appbar">
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Tutup">
            <Icon path={ICONS.close} size={18} />
          </button>
          <h1>Skripsi baru</h1>
        </div>
        <div className="stepper">
          {steps.map((s, i) => (
            <i key={s} className={i <= step ? "on" : ""} />
          ))}
        </div>
      </div>

      <div className="wiz-body">
        {error ? <div className="error-box">{error}</div> : null}

        {current === "prodi" ? (
          <>
            <h2 className="wiz-q">Anda dari jurusan apa?</h2>
            <p className="wiz-help">
              Menentukan struktur bab, tradisi metode, dan jenis topik yang diusulkan.
            </p>
            <input
              type="text"
              placeholder="Cari jurusan…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <div className="major-list">
              {filtered.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="major"
                  aria-pressed={major?.id === item.id}
                  onClick={() => setMajor(item)}
                >
                  <span>
                    {item.name}
                    <br />
                    <small>{item.faculty}</small>
                  </span>
                  {major?.id === item.id ? "✓" : ""}
                </button>
              ))}
              {filtered.length === 0 ? (
                <p className="note">
                  Jurusan tidak ada di daftar? Pilih yang paling dekat — prodi di luar daftar tetap
                  dilayani, hanya tanpa konteks tambahan.
                </p>
              ) : null}
            </div>
          </>
        ) : null}

        {current === "mulai" ? (
          <>
            <h2 className="wiz-q">Sudah punya topik?</h2>
            <p className="wiz-help">Tidak apa-apa kalau belum — kebanyakan mahasiswa mulai dari sini.</p>
            <button
              type="button"
              className="choice"
              aria-pressed={mode === "bantu"}
              onClick={() => setMode("bantu")}
            >
              <Icon path={ICONS.search} size={20} />
              <span>
                <b>Belum, bantu carikan</b>
                <span>
                  Jawab dua pertanyaan; aplikasi mengusulkan topik lengkap dengan rumusan masalah dan
                  jumlah pustaka yang benar-benar ada.
                </span>
              </span>
            </button>
            <button
              type="button"
              className="choice"
              aria-pressed={mode === "punya"}
              onClick={() => setMode("punya")}
            >
              <Icon path={ICONS.pencil} size={20} />
              <span>
                <b>Sudah punya</b>
                <span>Tulis topik Anda; agent langsung menyusun kerangka dan draftnya.</span>
              </span>
            </button>
          </>
        ) : null}

        {current === "minat" ? (
          <>
            <h2 className="wiz-q">Apa yang paling Anda minati?</h2>
            <p className="wiz-help">Menentukan sudut pandang topik yang diusulkan.</p>
            <div className="chip-wrap">
              {INTERESTS.map((item) => (
                <button
                  key={item}
                  type="button"
                  className="chip"
                  aria-pressed={interests.includes(item)}
                  onClick={() =>
                    setInterests((current_) =>
                      current_.includes(item)
                        ? current_.filter((i) => i !== item)
                        : [...current_, item],
                    )
                  }
                >
                  {item}
                </button>
              ))}
            </div>

            <h2 className="wiz-q" style={{ fontSize: 17, marginTop: 8 }}>
              Data apa yang realistis Anda dapat?
            </h2>
            <p className="wiz-help">
              Jujur saja — topik yang datanya tidak terjangkau adalah penyebab skripsi mandek nomor
              satu.
            </p>
            <div className="chip-wrap">
              {DATA_SOURCES.map((item) => (
                <button
                  key={item}
                  type="button"
                  className="chip"
                  aria-pressed={dataAccess === item}
                  onClick={() => setDataAccess(item)}
                >
                  {item}
                </button>
              ))}
            </div>
          </>
        ) : null}

        {current === "hasil" ? (
          <>
            <h2 className="wiz-q">{topics.length} topik yang cocok untuk Anda</h2>
            <p className="wiz-help">
              Jumlah pustaka dihitung dari pencarian nyata ke Crossref/OpenAlex, bukan klaim model.
            </p>
            {topics.map((topic, index) => (
              <button
                key={topic.judul}
                type="button"
                className="topic"
                aria-pressed={chosen === index}
                onClick={() => setChosen(index)}
              >
                <h4>{topic.judul}</h4>
                <p>
                  <b>Rumusan masalah:</b> {topic.rumusan_masalah}
                </p>
                <div className="topic-meta">
                  <span className="tag">{topic.metode}</span>
                  <span
                    className={`tag ${
                      topic.difficulty === "ringan" ? "ok" : topic.difficulty === "berat" ? "warn" : ""
                    }`}
                  >
                    Kesulitan: {topic.difficulty}
                  </span>
                  <span className="tag">{topic.data_needed}</span>
                  <span className={`tag ${topic.reference_count >= 5 ? "ok" : "warn"}`}>
                    {topic.reference_count} pustaka ditemukan
                  </span>
                </div>
                {topic.why_relevant ? <p>{topic.why_relevant}</p> : null}
              </button>
            ))}
          </>
        ) : null}

        {current === "topik" ? (
          <>
            <h2 className="wiz-q">Tulis topik atau judul Anda</h2>
            <p className="wiz-help">
              Bahasa bebas — tidak perlu rapi. Agent yang merapikannya jadi judul dan rumusan masalah.
            </p>
            <textarea
              rows={4}
              value={ownTopic}
              placeholder="mis. pengaruh media sosial terhadap keputusan belanja mahasiswa"
              onChange={(event) => setOwnTopic(event.target.value)}
            />
          </>
        ) : null}

        {current === "ringkas" ? (
          <>
            <h2 className="wiz-q">Siap disusun</h2>
            <p className="wiz-help">Semua ini masih bisa diubah nanti lewat prompt revisi.</p>
            <div className="card">
              <div className="summary-row">
                <span>Jurusan</span>
                <b>{major?.name ?? "—"}</b>
              </div>
              <div className="summary-row">
                <span>Topik</span>
                <b style={{ fontFamily: "var(--doc)", fontWeight: 600 }}>{judul}</b>
              </div>
              <div className="summary-row">
                <span>Template</span>
                <b>Pedoman generik S1</b>
              </div>
              <div className="summary-row">
                <span>Gaya sitasi</span>
                <b>APA 7</b>
              </div>
            </div>
            <p className="note">
              <strong>Yang akan terjadi:</strong> agent mencari literatur nyata, memverifikasi tiap
              referensi ke Crossref/OpenAlex, menyusun kerangka, lalu menulis BAB I–V. Bagian yang
              butuh data penelitian Anda ditandai, bukan dikarang.
            </p>
          </>
        ) : null}
      </div>

      <div className="overlay-foot">
        {step > 0 ? (
          <button
            type="button"
            className="btn"
            style={{ flex: "0 0 92px" }}
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={busy}
          >
            Kembali
          </button>
        ) : null}
        <button
          type="button"
          className="btn primary"
          style={{ flex: 1 }}
          disabled={!canContinue}
          onClick={() => void next()}
        >
          {busy
            ? "Memproses…"
            : current === "ringkas"
              ? "Susun draft sekarang"
              : current === "minat"
                ? "Carikan topik"
                : "Lanjut"}
        </button>
      </div>
    </div>
  );
}
