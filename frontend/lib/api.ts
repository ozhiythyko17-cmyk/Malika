/** Klien API SkripsiKu. */

export const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";

export type JobStatus = "queued" | "running" | "done" | "failed";
export type StageState = "done" | "current" | "pending";

export interface Chapter {
  key: string;
  number: number;
  title: string;
  body_markdown: string;
  citation_keys: string[];
  reviewed_by_student: boolean;
  ai_generated: boolean;
  revision: number;
}

export interface Author {
  family: string;
  given: string;
}

export interface Reference {
  key: string;
  title: string;
  authors: Author[];
  year: number | null;
  container_title: string | null;
  doi: string | null;
  url: string | null;
  source: string;
}

export interface RejectedReference {
  claimed: { title: string; year: number | null };
  verdict: "verified" | "mismatch" | "not_found";
  reason: string;
}

export interface QAIssue {
  severity: "blocker" | "warning" | "info";
  chapter_key: string | null;
  message: string;
}

export interface ThesisDocument {
  outline: { working_title: string; problem_statement: string[]; objectives: string[] };
  chapters: Chapter[];
  references: Reference[];
  rejected_references: RejectedReference[];
  citation_style: string;
  template_id: string;
  qa: { issues: QAIssue[]; similarity_score: number | null } | null;
}

export interface Project {
  id: string;
  status: JobStatus;
  document: ThesisDocument | null;
  events: { agent: string; message: string; at: string }[];
  error: string | null;
  stage_overrides: string[];
}

export interface Stage {
  id: string;
  number: number;
  name: string;
  note: string;
  state: StageState;
  tool: string;
  hint: string;
}

export interface Major {
  id: string;
  name: string;
  faculty: string;
  traditions: string;
}

export interface TopicSuggestion {
  judul: string;
  rumusan_masalah: string;
  metode: string;
  difficulty: "ringan" | "sedang" | "berat";
  data_needed: string;
  why_relevant: string;
  reference_count: number;
  sample_references: Reference[];
}

export interface AssistantAction {
  label: string;
  kind: "chapter" | "screen" | "tool";
  target: string;
}

export interface AssistantReply {
  answer: string;
  action: AssistantAction | null;
}

export interface ChatMessage {
  role: "user" | "assistant";
  text: string;
  action: AssistantAction | null;
  at: string;
}

export interface ExportBlocked {
  reason: string;
  unreviewed_chapters: string[];
  qa_blockers: string[];
}

export class ApiError extends Error {
  status: number;
  detail: unknown;

  constructor(message: string, status: number, detail: unknown) {
    super(message);
    this.status = status;
    this.detail = detail;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    cache: "no-store",
    headers: init?.body ? { "Content-Type": "application/json" } : undefined,
  });

  if (!response.ok) {
    let detail: unknown = response.statusText;
    try {
      detail = (await response.json())?.detail ?? detail;
    } catch {
      /* body bukan JSON — pakai statusText */
    }
    const message =
      typeof detail === "string"
        ? detail
        : (detail as { reason?: string })?.reason ?? "Permintaan gagal";
    throw new ApiError(message, response.status, detail);
  }

  return response.status === 204 ? (undefined as T) : ((await response.json()) as T);
}

const post = <T,>(path: string, body?: unknown) =>
  request<T>(path, { method: "POST", body: body ? JSON.stringify(body) : undefined });

/* ---------- proyek & draft ---------- */

export const createProject = (payload: {
  prompt: string;
  field_of_study?: string;
  research_type?: string;
  citation_style?: string;
  template_id?: string;
}) => post<{ project_id: string; status: JobStatus }>("/api/projects", payload);

export const getProject = (id: string) => request<Project>(`/api/projects/${id}`);

export const reviseProject = (id: string, payload: { prompt: string; chapter_key?: string }) =>
  post<{ status: string }>(`/api/projects/${id}/revise`, payload);

export const reviewChapter = (id: string, chapterKey: string, reviewed: boolean) =>
  post<{ reviewed_by_student: boolean }>(`/api/projects/${id}/chapters/${chapterKey}/review`, {
    reviewed,
  });

export const exportProject = (id: string) =>
  request<{ format: string; content: string }>(`/api/projects/${id}/export`);

export const getDisclosure = (id: string) =>
  request<{
    prompts: { kind: string; prompt: string; chapter_key: string | null; at: string }[];
    chapters: { key: string; ai_generated: boolean; revision: number; reviewed_by_student: boolean }[];
  }>(`/api/projects/${id}/ai-disclosure`);

/* ---------- tahapan ---------- */

export const getStages = (id: string) => request<Stage[]>(`/api/projects/${id}/stages`);

export const markStage = (id: string, stageId: string, done: boolean) =>
  post<Stage[]>(`/api/projects/${id}/stages/${stageId}`, { done });

/* ---------- pencari topik ---------- */

export const getMajors = () => request<{ majors: Major[] }>("/api/majors");

export const suggestTopics = (payload: {
  major: string;
  interests: string[];
  data_access: string;
  count?: number;
}) => post<{ major: string; suggestions: TopicSuggestion[] }>("/api/topics/suggest", payload);

/* ---------- asisten AI ---------- */

export const askAssistant = (id: string, message: string) =>
  post<AssistantReply>(`/api/projects/${id}/assistant`, { message });

export const getChatHistory = (id: string) =>
  request<ChatMessage[]>(`/api/projects/${id}/assistant`);
