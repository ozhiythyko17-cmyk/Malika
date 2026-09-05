"use client";

import type { Chapter } from "../lib/api";
import { ICONS, Icon } from "./ui";

const ROMAN = ["", "I", "II", "III", "IV", "V", "VI", "VII"];
const NEED_DATA = /\[BUTUH DATA[^\]]*\]/g;

/** Render naskah bab: penanda [BUTUH DATA] ditonjolkan, sisanya paragraf biasa. */
function renderBody(markdown: string) {
  return markdown.split(/\n{2,}/).map((block, index) => {
    const trimmed = block.trim();
    if (!trimmed) return null;

    if (trimmed.startsWith("## ") || trimmed.startsWith("### ")) {
      return <h3 key={index}>{trimmed.replace(/^#+\s*/, "")}</h3>;
    }

    const marker = trimmed.match(NEED_DATA);
    if (marker && trimmed === marker[0]) {
      return (
        <span className="need" key={index}>
          {trimmed}
        </span>
      );
    }

    return <p key={index}>{trimmed}</p>;
  });
}

export function ChapterDetail({
  chapter,
  onBack,
  onToggleReview,
  onAsk,
}: {
  chapter: Chapter;
  onBack: () => void;
  onToggleReview: () => void;
  onAsk: () => void;
}) {
  const words = chapter.body_markdown.split(/\s+/).filter(Boolean).length;

  return (
    <div className="overlay">
      <div className="appbar">
        <button type="button" className="icon-btn" onClick={onBack} aria-label="Kembali">
          <Icon path={ICONS.back} size={19} />
        </button>
        <h1>BAB {ROMAN[chapter.number] ?? chapter.number}</h1>
        <button
          type="button"
          className="icon-btn"
          onClick={onAsk}
          aria-label="Tanya asisten tentang bab ini"
        >
          <Icon path={ICONS.chat} size={19} />
        </button>
      </div>

      <div className="manuscript">
        <p className="chap-head">BAB {ROMAN[chapter.number] ?? chapter.number}</p>
        <h2 className="chap-title">{chapter.title}</h2>
        <div className="read-meta">
          <span>{words.toLocaleString("id-ID")} kata</span>
          <span>{chapter.citation_keys.length} sitasi</span>
          <span>revisi ke-{chapter.revision}</span>
          {chapter.ai_generated ? <span>disusun dengan bantuan AI</span> : null}
        </div>
        {renderBody(chapter.body_markdown)}
      </div>

      <div className="overlay-foot">
        <button
          type="button"
          className={chapter.reviewed_by_student ? "btn block" : "btn primary block"}
          onClick={onToggleReview}
        >
          {chapter.reviewed_by_student ? "Batalkan tanda review" : "Tandai sudah saya review"}
        </button>
      </div>
    </div>
  );
}
