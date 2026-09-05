"use client";

import { useState } from "react";

import type { Project, Stage } from "../lib/api";
import { ICONS, Icon, ProgressRing } from "./ui";

const ROMAN = ["", "I", "II", "III", "IV", "V", "VI", "VII"];

export const TOOLS = [
  { id: "asisten", label: "Tanya asisten AI", desc: "Ngobrol soal skripsi Anda", icon: ICONS.sparkle },
  { id: "topik", label: "Cari topik skripsi", desc: "Belum punya ide? Mulai di sini", icon: ICONS.search },
  { id: "judul", label: "Cek kelayakan judul", desc: "Terlalu luas? Sudah jenuh?", icon: ICONS.list },
  { id: "referensi", label: "Cari referensi", desc: "Sumber terverifikasi", icon: ICONS.book },
  { id: "bimbingan", label: "Siapkan bimbingan", desc: "Ringkasan + pertanyaan", icon: ICONS.chat },
  { id: "sidang", label: "Latihan sidang", desc: "Tebakan pertanyaan penguji", icon: ICONS.question },
] as const;

export type ToolId = (typeof TOOLS)[number]["id"];

/* ---------- beranda ---------- */

export function Beranda({
  project,
  stages,
  onNew,
  onOpenStage,
  onTool,
  onOpenDraft,
}: {
  project: Project | null;
  stages: Stage[];
  onNew: () => void;
  onOpenStage: (stage: Stage) => void;
  onTool: (tool: ToolId) => void;
  onOpenDraft: () => void;
}) {
  const chapters = project?.document?.chapters ?? [];
  const reviewed = chapters.filter((c) => c.reviewed_by_student).length;
  const current = stages.find((s) => s.state === "current");
  const doneCount = stages.filter((s) => s.state === "done").length;
  const hour = new Date().getHours();
  const greeting =
    hour < 11 ? "Selamat pagi" : hour < 15 ? "Selamat siang" : hour < 19 ? "Selamat sore" : "Selamat malam";

  return (
    <section className="screen">
      <div className="greet">
        <p>{greeting}</p>
        <h2>{project ? "Mau lanjut dari mana?" : "Mulai skripsi Anda"}</h2>
      </div>

      <button type="button" className="btn primary block" onClick={onNew}>
        <Icon path={ICONS.plus} size={18} />
        Buat skripsi baru
      </button>

      {project ? (
        <>
          <div className="section-label">Skripsi berjalan</div>
          <div className="card">
            <div className="hero">
              <div className="hero-text">
                <h3>{project.document?.outline.working_title ?? "Draft sedang disusun…"}</h3>
                <p>
                  {chapters.length} bab · {project.document?.references.length ?? 0} referensi
                  terverifikasi · status {project.status}
                </p>
              </div>
              <ProgressRing done={reviewed} total={chapters.length || 5} label="REVIEW" />
            </div>
            {current ? (
              <div className="next-step">
                <span>
                  Tahap sekarang: <b>{current.name}</b>
                </span>
                <button type="button" className="btn small soft" onClick={() => onOpenStage(current)}>
                  Lanjutkan
                </button>
              </div>
            ) : null}
          </div>
        </>
      ) : (
        <div className="card note">
          <strong>Belum ada skripsi berjalan.</strong> Mulai dari tombol di atas — kalau belum punya
          topik, aplikasi akan mengusulkan beberapa berdasarkan jurusan, minat, dan data yang
          realistis Anda dapat.
        </div>
      )}

      {stages.length > 0 ? (
        <>
          <div className="section-label">
            Tahapan skripsi{" "}
            <span className="aside">
              {doneCount}/{stages.length} selesai
            </span>
          </div>
          <div className="card">
            <div className="road">
              {stages.map((stage) => (
                <button
                  key={stage.id}
                  type="button"
                  className={`stage-row ${stage.state === "done" ? "done" : ""} ${
                    stage.state === "current" ? "current" : ""
                  }`}
                  onClick={() => onOpenStage(stage)}
                >
                  <span className="stage-mark">
                    <i>{stage.state === "done" ? "✓" : stage.number}</i>
                  </span>
                  <span>
                    <span className="stage-name">{stage.name}</span>
                    <span className="stage-note">{stage.note}</span>
                  </span>
                  <span className="stage-tag">
                    {stage.state === "done" ? "selesai" : stage.state === "current" ? "sekarang" : "nanti"}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </>
      ) : null}

      <div className="section-label">Alat bantu</div>
      <div className="quick-grid">
        {TOOLS.map((tool) => (
          <button key={tool.id} type="button" className="qa" onClick={() => onTool(tool.id)}>
            <span className="ico">
              <Icon path={tool.icon} size={17} />
            </span>
            <b>{tool.label}</b>
            <span>{tool.desc}</span>
          </button>
        ))}
      </div>

      {project?.document ? (
        <button type="button" className="btn soft block" onClick={onOpenDraft}>
          Buka draft
        </button>
      ) : null}
    </section>
  );
}

/* ---------- draft ---------- */

export function DraftScreen({
  project,
  onOpenChapter,
  onRevise,
}: {
  project: Project | null;
  onOpenChapter: (key: string) => void;
  onRevise: () => void;
}) {
  const document = project?.document;
  const chapters = document?.chapters ?? [];
  const reviewed = chapters.filter((c) => c.reviewed_by_student).length;
  const words = chapters.reduce((sum, c) => sum + c.body_markdown.split(/\s+/).filter(Boolean).length, 0);

  if (!document) {
    return (
      <section className="screen">
        <div className="card note">
          {project?.status === "running" || project?.status === "queued"
            ? "Agent sedang menyusun draft — halaman ini terisi begitu selesai."
            : "Belum ada draft. Buat skripsi baru dari Beranda."}
        </div>
      </section>
    );
  }

  return (
    <section className="screen">
      <div className="card hero">
        <div className="hero-text">
          <h3>{document.outline.working_title}</h3>
          <p>
            {words.toLocaleString("id-ID")} kata · {chapters.length} bab · {document.citation_style.toUpperCase()}
          </p>
        </div>
        <ProgressRing done={reviewed} total={chapters.length} label="REVIEW" />
      </div>

      <div className="section-label">
        Bab <span className="aside">Ketuk untuk baca &amp; tandai</span>
      </div>
      <div className="list">
        {chapters.map((chapter) => (
          <button
            key={chapter.key}
            type="button"
            className={`ch ${chapter.reviewed_by_student ? "done" : ""}`}
            onClick={() => onOpenChapter(chapter.key)}
          >
            <span className="tick">
              <Icon path={ICONS.check} size={14} />
            </span>
            <span>
              <span className="ch-title">
                <span className="rom">BAB {ROMAN[chapter.number] ?? chapter.number}</span> · {chapter.title}
              </span>
              <span className="ch-sub">
                {chapter.body_markdown.split(/\s+/).filter(Boolean).length.toLocaleString("id-ID")} kata ·{" "}
                {chapter.citation_keys.length} sitasi
                {chapter.revision > 1 ? <span className="mini-flag rev">revisi {chapter.revision}</span> : null}
                {chapter.body_markdown.includes("[BUTUH DATA") ? (
                  <span className="mini-flag stop">butuh data</span>
                ) : null}
              </span>
            </span>
            <Icon path={ICONS.chevron} size={18} />
          </button>
        ))}
      </div>

      <button type="button" className="btn soft block" onClick={onRevise}>
        <Icon path={ICONS.pencil} size={17} />
        Revisi lewat prompt
      </button>
    </section>
  );
}

/* ---------- sumber ---------- */

export function SumberScreen({ project }: { project: Project | null }) {
  const [tab, setTab] = useState<"ok" | "no">("ok");
  const document = project?.document;
  const verified = document?.references ?? [];
  const rejected = document?.rejected_references ?? [];

  return (
    <section className="screen">
      <div className="segmented" role="tablist">
        <button type="button" role="tab" aria-selected={tab === "ok"} onClick={() => setTab("ok")}>
          Terverifikasi · {verified.length}
        </button>
        <button type="button" role="tab" aria-selected={tab === "no"} onClick={() => setTab("no")}>
          Ditolak · {rejected.length}
        </button>
      </div>

      <p className="note">
        {tab === "ok"
          ? "Metadata diambil dari Crossref/OpenAlex — bukan dari model. Kunci sitasi di bawah dipakai di naskah."
          : "Dikeluarkan dari draft sebelum penulisan. Ditampilkan apa adanya supaya Anda tahu apa yang dibuang dan kenapa."}
      </p>

      <div className="list">
        {tab === "ok"
          ? verified.map((ref) => (
              <div key={ref.key} className="card">
                <div className="ref-top">
                  <span className="ref-badge ok">✓</span>
                  <span className="ref-entry">
                    {ref.authors.map((a) => a.family).join(", ") || "—"} ({ref.year ?? "n.d."}). {ref.title}.
                    {ref.container_title ? ` ${ref.container_title}.` : ""}
                  </span>
                </div>
                <div className="meta-line">
                  <span>[@{ref.key}]</span>
                  {ref.doi ? <span>doi:{ref.doi}</span> : null}
                  <span>{ref.source}</span>
                </div>
              </div>
            ))
          : rejected.map((item, index) => (
              <div key={index} className="card">
                <div className="ref-top">
                  <span className="ref-badge no">✕</span>
                  <span className="ref-entry struck">
                    {item.claimed.title} ({item.claimed.year ?? "n.d."})
                  </span>
                </div>
                <div className="why">
                  <b>{item.verdict}</b>
                  <br />
                  {item.reason}
                </div>
              </div>
            ))}

        {(tab === "ok" ? verified : rejected).length === 0 ? (
          <p className="note">Belum ada data — draft belum tersusun.</p>
        ) : null}
      </div>
    </section>
  );
}

/* ---------- periksa ---------- */

export function PeriksaScreen({
  project,
  onExport,
}: {
  project: Project | null;
  onExport: () => void;
}) {
  const chapters = project?.document?.chapters ?? [];
  const reviewed = chapters.filter((c) => c.reviewed_by_student).length;
  const issues = project?.document?.qa?.issues ?? [];
  const blockers = issues.filter((i) => i.severity === "blocker");
  const reviewPass = chapters.length > 0 && reviewed === chapters.length;

  return (
    <section className="screen">
      <div className="card">
        <div className="section-label" style={{ margin: "0 0 6px" }}>
          Gerbang ekspor
        </div>

        <div className={`gate-row ${reviewPass ? "pass" : ""}`}>
          <span className="gate-dot">{reviewPass ? "✓" : "!"}</span>
          <span style={{ flex: 1 }}>
            <span className="gate-label">Tiap bab sudah Anda review</span>
            <span className="gate-note">
              {reviewed} dari {chapters.length || 5} bab
            </span>
            <span className="meter">
              <span style={{ width: `${chapters.length ? (reviewed / chapters.length) * 100 : 0}%` }} />
            </span>
          </span>
        </div>

        <div className={`gate-row ${blockers.length === 0 ? "pass" : ""}`}>
          <span className="gate-dot">{blockers.length === 0 ? "✓" : "!"}</span>
          <span style={{ flex: 1 }}>
            <span className="gate-label">Tidak ada temuan blocker</span>
            <span className="gate-note">
              {blockers.length === 0 ? "bersih" : `${blockers.length} temuan menahan ekspor`}
            </span>
          </span>
        </div>

        <button
          type="button"
          className="btn primary block"
          style={{ marginTop: 14 }}
          onClick={onExport}
          disabled={!project?.document}
        >
          Ekspor draft final
        </button>
      </div>

      <div className="section-label">
        Temuan QA <span className="aside">{blockers.length} blocker</span>
      </div>
      <div className="card">
        {issues.length === 0 ? (
          <p className="note">Belum ada temuan — QA berjalan setelah draft selesai disusun.</p>
        ) : (
          issues.map((issue, index) => (
            <div key={index} className="finding">
              <span className={`sev ${issue.severity}`}>{issue.severity}</span>
              <p>{issue.message}</p>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

/* ---------- jejak ---------- */

export function JejakScreen({ project }: { project: Project | null }) {
  const events = project?.events ?? [];

  return (
    <section className="screen">
      <div className="section-label">
        Langkah agent <span className="aside">{events.length} langkah</span>
      </div>
      <div className="card">
        <div className="timeline">
          {events.length === 0 ? (
            <p className="note">Belum ada aktivitas.</p>
          ) : (
            events.map((event, index) => (
              <div key={index} className="tl-item">
                <span className="tl-agent">{event.agent}</span>
                <span className="tl-text">{event.message}</span>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="card note">
        <strong>Untuk ditunjukkan ke pembimbing.</strong> Jejak ini memperlihatkan langkah agent,
        pertanyaan yang Anda ajukan ke asisten, dan referensi yang ditolak sistem — bukti bahwa draft
        ini disusun dengan bantuan AI secara terbuka.
      </div>
    </section>
  );
}
