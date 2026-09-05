"use client";

import { useCallback, useEffect, useState } from "react";

import { AssistantChat } from "../components/AssistantChat";
import { ChapterDetail } from "../components/ChapterDetail";
import { NewThesisWizard } from "../components/NewThesisWizard";
import {
  Beranda,
  DraftScreen,
  JejakScreen,
  PeriksaScreen,
  SumberScreen,
  type ToolId,
} from "../components/screens";
import { ICONS, Icon, Sheet, TabBar, Toast, type ScreenName } from "../components/ui";
import {
  ApiError,
  createProject,
  exportProject,
  getProject,
  getStages,
  markStage,
  reviewChapter,
  reviseProject,
  type AssistantAction,
  type ExportBlocked,
  type Project,
  type Stage,
} from "../lib/api";

const STORAGE_KEY = "skripsiku.project";
const POLL_MS = 3000;

const TITLES: Record<ScreenName, string> = {
  beranda: "Beranda",
  draft: "Draft",
  sumber: "Sumber",
  periksa: "Periksa",
  jejak: "Jejak",
};

type SheetContent =
  | { kind: "stage"; stage: Stage }
  | { kind: "tool"; tool: ToolId }
  | { kind: "revise" }
  | { kind: "export"; content: string }
  | { kind: "blocked"; detail: ExportBlocked }
  | null;

export default function Home() {
  const [projectId, setProjectId] = useState<string | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [stages, setStages] = useState<Stage[]>([]);
  const [screen, setScreen] = useState<ScreenName>("beranda");
  const [openChapter, setOpenChapter] = useState<string | null>(null);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [chatSeed, setChatSeed] = useState<string | undefined>();
  const [chatOpen, setChatOpen] = useState(false);
  const [sheet, setSheet] = useState<SheetContent>(null);
  const [revisePrompt, setRevisePrompt] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const notify = useCallback((message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 2600);
  }, []);

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved) setProjectId(saved);
  }, []);

  const refresh = useCallback(async (id: string) => {
    try {
      const [nextProject, nextStages] = await Promise.all([getProject(id), getStages(id)]);
      setProject(nextProject);
      setStages(nextStages);
      setError(null);
    } catch (err) {
      if ((err as ApiError).status === 404) {
        window.localStorage.removeItem(STORAGE_KEY);
        setProjectId(null);
        setProject(null);
        setStages([]);
        return;
      }
      setError((err as Error).message);
    }
  }, []);

  useEffect(() => {
    if (!projectId) return;
    void refresh(projectId);
  }, [projectId, refresh]);

  // Polling hanya selama pipeline berjalan.
  useEffect(() => {
    if (!projectId || !project) return;
    if (project.status !== "queued" && project.status !== "running") return;
    const timer = setInterval(() => void refresh(projectId), POLL_MS);
    return () => clearInterval(timer);
  }, [projectId, project, refresh]);

  const chapter = project?.document?.chapters.find((c) => c.key === openChapter) ?? null;
  const blockers = project?.document?.qa?.issues.filter((i) => i.severity === "blocker") ?? [];
  const unreviewed = (project?.document?.chapters ?? []).filter((c) => !c.reviewed_by_student);

  async function handleReview(chapterKey: string, reviewed: boolean) {
    if (!projectId) return;
    await reviewChapter(projectId, chapterKey, reviewed);
    await refresh(projectId);
    notify(reviewed ? "Bab ditandai sudah direview" : "Tanda review dibatalkan");
  }

  async function handleExport() {
    if (!projectId) return;
    try {
      const result = await exportProject(projectId);
      setSheet({ kind: "export", content: result.content });
    } catch (err) {
      const failure = err as ApiError;
      if (failure.status === 409 && failure.detail) {
        setSheet({ kind: "blocked", detail: failure.detail as ExportBlocked });
      } else {
        notify(failure.message);
      }
    }
  }

  async function handleRevise() {
    if (!projectId || revisePrompt.trim().length < 3) return;
    await reviseProject(projectId, { prompt: revisePrompt });
    setRevisePrompt("");
    setSheet(null);
    notify("Revisi dikirim — agent menulis ulang bab itu");
    await refresh(projectId);
  }

  async function handleMarkStage(stage: Stage) {
    if (!projectId) return;
    const next = await markStage(projectId, stage.id, stage.state !== "done");
    setStages(next);
    setSheet(null);
    notify(stage.state === "done" ? "Tanda tahap dibatalkan" : `Tahap “${stage.name}” ditandai selesai`);
  }

  function handleTool(tool: ToolId) {
    setSheet(null);
    if (tool === "asisten") return openChat();
    if (tool === "topik") return setWizardOpen(true);
    if (tool === "referensi") return setScreen("sumber");
    if (tool === "judul") return openChat("Judul saya sekarang sudah layak belum? Terlalu luas atau terlalu sempit?");
    if (tool === "bimbingan") return openChat("Siapkan bahan bimbingan: progres, hambatan, dan pertanyaan untuk pembimbing.");
    if (tool === "sidang") return openChat("Pertanyaan apa yang mungkin ditanyakan penguji dari draft saya?");
  }

  function openChat(seed?: string) {
    if (!projectId) {
      notify("Buat skripsi dulu — asisten membaca draft Anda");
      return;
    }
    setChatSeed(seed);
    setChatOpen(true);
  }

  function handleAssistantAction(action: AssistantAction) {
    setChatOpen(false);
    if (action.kind === "chapter") return setOpenChapter(action.target);
    if (action.kind === "screen") return setScreen(action.target as ScreenName);
    if (action.kind === "tool") return handleTool(action.target as ToolId);
  }

  async function handleCreate(prompt: string) {
    const { project_id } = await createProject({ prompt });
    window.localStorage.setItem(STORAGE_KEY, project_id);
    setProjectId(project_id);
    setWizardOpen(false);
    setScreen("draft");
    notify("Agent mulai menyusun draft — ini butuh beberapa menit");
  }

  return (
    <main className="app">
      <div className="appbar">
        <h1>{TITLES[screen]}</h1>
        {project?.status === "running" || project?.status === "queued" ? (
          <span className="pill warn">menyusun…</span>
        ) : null}
      </div>

      <div className="viewport">
        {screen === "beranda" ? (
          <Beranda
            project={project}
            stages={stages}
            onNew={() => setWizardOpen(true)}
            onOpenStage={(stage) => setSheet({ kind: "stage", stage })}
            onTool={handleTool}
            onOpenDraft={() => setScreen("draft")}
          />
        ) : null}

        {screen === "draft" ? (
          <DraftScreen
            project={project}
            onOpenChapter={setOpenChapter}
            onRevise={() => setSheet({ kind: "revise" })}
          />
        ) : null}

        {screen === "sumber" ? <SumberScreen project={project} /> : null}
        {screen === "periksa" ? <PeriksaScreen project={project} onExport={() => void handleExport()} /> : null}
        {screen === "jejak" ? <JejakScreen project={project} /> : null}

        {error ? (
          <div className="toast" role="alert">
            {error}
          </div>
        ) : null}

        {projectId ? (
          <button type="button" className="fab" onClick={() => openChat()}>
            <Icon path={ICONS.sparkle} size={18} />
            Tanya AI
          </button>
        ) : null}

        {chapter ? (
          <ChapterDetail
            chapter={chapter}
            onBack={() => setOpenChapter(null)}
            onToggleReview={() => void handleReview(chapter.key, !chapter.reviewed_by_student)}
            onAsk={() => {
              setOpenChapter(null);
              openChat(`Bagaimana penilaian Anda soal ${chapter.key}?`);
            }}
          />
        ) : null}

        {wizardOpen ? (
          <NewThesisWizard onClose={() => setWizardOpen(false)} onSubmit={handleCreate} />
        ) : null}

        {chatOpen && projectId ? (
          <AssistantChat
            projectId={projectId}
            seed={chatSeed}
            onClose={() => {
              setChatOpen(false);
              setChatSeed(undefined);
              if (projectId) void refresh(projectId);
            }}
            onAction={handleAssistantAction}
          />
        ) : null}

        <Sheet open={sheet !== null} onClose={() => setSheet(null)}>
          {sheet?.kind === "stage" ? (
            <>
              <h3>{sheet.stage.name}</h3>
              <p className="lead">{sheet.stage.hint}</p>
              <button
                type="button"
                className="btn primary block"
                onClick={() => void handleMarkStage(sheet.stage)}
              >
                {sheet.stage.state === "done" ? "Batalkan tanda selesai" : "Tandai tahap ini selesai"}
              </button>
              <button type="button" className="btn block" onClick={() => handleTool(sheet.stage.tool as ToolId)}>
                Buka alat bantunya
              </button>
            </>
          ) : null}

          {sheet?.kind === "revise" ? (
            <>
              <h3>Revisi lewat prompt</h3>
              <p className="lead">
                Sebut babnya, dan hanya bab itu yang ditulis ulang. Statusnya otomatis kembali “belum
                direview”.
              </p>
              <textarea
                rows={3}
                value={revisePrompt}
                placeholder="mis. perbanyak studi kasus di bab 2"
                onChange={(event) => setRevisePrompt(event.target.value)}
              />
              <button type="button" className="btn primary block" onClick={() => void handleRevise()}>
                Kirim revisi
              </button>
            </>
          ) : null}

          {sheet?.kind === "export" ? (
            <>
              <h3>Draft final siap</h3>
              <p className="lead">Catatan penggunaan AI ikut tercetak di berkas.</p>
              <pre className="export-pre">{sheet.content}</pre>
            </>
          ) : null}

          {sheet?.kind === "blocked" ? (
            <>
              <h3>Ekspor ditahan</h3>
              <p className="lead">{sheet.detail.reason}</p>
              <div className="error-box">
                <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
                  {sheet.detail.unreviewed_chapters.length ? (
                    <li>Belum direview: {sheet.detail.unreviewed_chapters.join(", ")}</li>
                  ) : null}
                  {sheet.detail.qa_blockers.map((message, index) => (
                    <li key={index}>{message}</li>
                  ))}
                </ul>
              </div>
            </>
          ) : null}

          {sheet?.kind === "tool" ? (
            <>
              <h3>Alat bantu</h3>
              <p className="lead">Alat ini dijalankan lewat asisten AI.</p>
            </>
          ) : null}
        </Sheet>

        <Toast text={toast} />
      </div>

      <TabBar
        active={screen}
        onSelect={setScreen}
        alert={Boolean(project?.document) && (unreviewed.length > 0 || blockers.length > 0)}
      />
    </main>
  );
}
