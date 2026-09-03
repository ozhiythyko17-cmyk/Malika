/** Klien API SkripsiKu. */

export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";

export type JobStatus = "queued" | "running" | "done" | "failed";

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

export interface QAIssue {
  severity: "blocker" | "warning" | "info";
  chapter_key: string | null;
  message: string;
}

export interface RejectedReference {
  claimed: { title: string; year: number | null };
  verdict: "verified" | "mismatch" | "not_found";
  reason: string;
}

export interface ThesisDocument {
  outline: { working_title: string; problem_statement: string[] };
  chapters: Chapter[];
  references: { key: string; title: string; year: number | null }[];
  rejected_references: RejectedReference[];
  qa: { issues: QAIssue[]; similarity_score: number | null } | null;
}

export interface Project {
  id: string;
  status: JobStatus;
  document: ThesisDocument | null;
  events: { agent: string; message: string; at: string }[];
  error: string | null;
}

export interface ExportBlocked {
  reason: string;
  unreviewed_chapters: string[];
  qa_blockers: string[];
}

async function parseError(response: Response): Promise<never> {
  let detail: unknown;
  try {
    detail = (await response.json())?.detail;
  } catch {
    detail = response.statusText;
  }
  throw Object.assign(new Error(typeof detail === "string" ? detail : "Permintaan gagal"), {
    status: response.status,
    detail,
  });
}

export async function createProject(payload: {
  prompt: string;
  field_of_study?: string;
  research_type?: string;
  citation_style?: string;
  template_id?: string;
}): Promise<{ project_id: string; status: JobStatus }> {
  const response = await fetch(`${API_BASE}/api/projects`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) return parseError(response);
  return response.json();
}

export async function getProject(projectId: string): Promise<Project> {
  const response = await fetch(`${API_BASE}/api/projects/${projectId}`, {
    cache: "no-store",
  });
  if (!response.ok) return parseError(response);
  return response.json();
}

export async function reviseProject(
  projectId: string,
  payload: { prompt: string; chapter_key?: string },
): Promise<void> {
  const response = await fetch(`${API_BASE}/api/projects/${projectId}/revise`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) await parseError(response);
}

export async function reviewChapter(
  projectId: string,
  chapterKey: string,
  reviewed: boolean,
): Promise<void> {
  const response = await fetch(
    `${API_BASE}/api/projects/${projectId}/chapters/${chapterKey}/review`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reviewed }),
    },
  );
  if (!response.ok) await parseError(response);
}

/** Mengembalikan Markdown final, atau melempar error dengan `detail: ExportBlocked` (409). */
export async function exportProject(projectId: string): Promise<string> {
  const response = await fetch(`${API_BASE}/api/projects/${projectId}/export`, {
    cache: "no-store",
  });
  if (!response.ok) return parseError(response);
  return (await response.json()).content as string;
}
