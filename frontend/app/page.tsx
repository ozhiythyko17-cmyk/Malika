"use client";

import { useCallback, useEffect, useState } from "react";

import {
  createProject,
  exportProject,
  getProject,
  reviewChapter,
  reviseProject,
  type ExportBlocked,
  type Project,
} from "../lib/api";

const POLL_INTERVAL_MS = 2500;

export default function Home() {
  const [prompt, setPrompt] = useState("");
  const [projectId, setProjectId] = useState<string | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [revisionPrompt, setRevisionPrompt] = useState("");
  const [exported, setExported] = useState<string | null>(null);
  const [blocked, setBlocked] = useState<ExportBlocked | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (id: string) => {
    try {
      setProject(await getProject(id));
    } catch (err) {
      setError((err as Error).message);
    }
  }, []);

  // Polling: cukup untuk MVP. Streaming SSE dipakai saat worker terpisah aktif.
  useEffect(() => {
    if (!projectId) return;
    void refresh(projectId);
    const timer = setInterval(() => void refresh(projectId), POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [projectId, refresh]);

  const running = project?.status === "queued" || project?.status === "running";

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setExported(null);
    setBlocked(null);
    try {
      const { project_id } = await createProject({ prompt });
      setProjectId(project_id);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function handleReview(chapterKey: string, reviewed: boolean) {
    if (!projectId) return;
    setBlocked(null);
    await reviewChapter(projectId, chapterKey, reviewed);
    await refresh(projectId);
  }

  async function handleRevise(event: React.FormEvent) {
    event.preventDefault();
    if (!projectId || !revisionPrompt.trim()) return;
    await reviseProject(projectId, { prompt: revisionPrompt });
    setRevisionPrompt("");
    setExported(null);
    await refresh(projectId);
  }

  async function handleExport() {
    if (!projectId) return;
    setError(null);
    try {
      setExported(await exportProject(projectId));
      setBlocked(null);
    } catch (err) {
      const failure = err as Error & { status?: number; detail?: ExportBlocked };
      if (failure.status === 409 && failure.detail) {
        setBlocked(failure.detail);
      } else {
        setError(failure.message);
      }
    }
  }

  const document = project?.document;
  const blockers = document?.qa?.issues.filter((i) => i.severity === "blocker") ?? [];

  return (
    <main>
      <h1>SkripsiKu</h1>
      <p className="lede">
        Satu prompt, satu draft skripsi lengkap. Draft berbantuan AI — wajib Anda
        review per bab sebelum bisa diekspor.
      </p>

      <form onSubmit={handleSubmit}>
        <label htmlFor="prompt">Topik / ide skripsi Anda</label>
        <textarea
          id="prompt"
          rows={4}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Contoh: analisis sentimen ulasan marketplace berbahasa Indonesia dengan Naive Bayes"
          required
          minLength={10}
        />
        <button type="submit" disabled={running}>
          {running ? "Sedang menyusun draft..." : "Susun draft skripsi"}
        </button>
      </form>

      {error && <p className="error">{error}</p>}

      {project && (
        <section>
          <h2>Progres agent</h2>
          <p>
            Status: <strong>{project.status}</strong>
            {project.error ? ` — ${project.error}` : ""}
          </p>
          <ol className="events">
            {project.events.map((event, index) => (
              <li key={`${event.at}-${index}`}>
                <code>{event.agent}</code> {event.message}
              </li>
            ))}
          </ol>
        </section>
      )}

      {document && (
        <>
          <section>
            <h2>{document.outline.working_title}</h2>
            <ul>
              {document.chapters.map((chapter) => (
                <li key={chapter.key} className="chapter">
                  <label>
                    <input
                      type="checkbox"
                      checked={chapter.reviewed_by_student}
                      onChange={(e) => void handleReview(chapter.key, e.target.checked)}
                    />{" "}
                    BAB {chapter.number} — {chapter.title}
                    {chapter.revision > 1 ? ` (revisi ke-${chapter.revision})` : ""}
                  </label>
                  <details>
                    <summary>
                      {chapter.body_markdown.split(/\s+/).length} kata,{" "}
                      {chapter.citation_keys.length} sitasi
                    </summary>
                    <pre>{chapter.body_markdown}</pre>
                  </details>
                </li>
              ))}
            </ul>
          </section>

          {document.rejected_references.length > 0 && (
            <section className="warning">
              <h3>Referensi yang ditolak sistem</h3>
              <p>
                Tidak lolos verifikasi ke Crossref/OpenAlex, jadi dikeluarkan dari
                draft:
              </p>
              <ul>
                {document.rejected_references.map((rejected, index) => (
                  <li key={index}>
                    {rejected.claimed.title} — {rejected.reason}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {blockers.length > 0 && (
            <section className="warning">
              <h3>Temuan yang harus diselesaikan</h3>
              <ul>
                {blockers.map((issue, index) => (
                  <li key={index}>{issue.message}</li>
                ))}
              </ul>
            </section>
          )}

          <section>
            <h3>Revisi lewat prompt</h3>
            <form onSubmit={handleRevise}>
              <input
                value={revisionPrompt}
                onChange={(e) => setRevisionPrompt(e.target.value)}
                placeholder='Contoh: "perbanyak studi kasus di bab 2"'
              />
              <button type="submit" disabled={running}>
                Kirim revisi
              </button>
            </form>
          </section>

          <section>
            <button type="button" onClick={() => void handleExport()}>
              Ekspor draft final
            </button>
            {blocked && (
              <div className="warning">
                <p>{blocked.reason}</p>
                {blocked.unreviewed_chapters.length > 0 && (
                  <p>Belum direview: {blocked.unreviewed_chapters.join(", ")}</p>
                )}
                {blocked.qa_blockers.map((message, index) => (
                  <p key={index}>{message}</p>
                ))}
              </div>
            )}
            {exported && <pre className="export">{exported}</pre>}
          </section>
        </>
      )}
    </main>
  );
}
