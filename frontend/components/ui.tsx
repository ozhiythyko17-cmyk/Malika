"use client";

import type { ReactNode } from "react";

/* ---------- ikon ---------- */

export function Icon({ path, size = 20 }: { path: ReactNode; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {path}
    </svg>
  );
}

export const ICONS = {
  home: (
    <>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5.5 9.5V20h13V9.5" />
      <path d="M9.5 20v-6h5v6" />
    </>
  ),
  doc: (
    <>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z" />
      <path d="M14 3v5h5M9 13h6M9 17h4" />
    </>
  ),
  book: (
    <>
      <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H19v15H6.5A2.5 2.5 0 0 0 4 20.5Z" />
      <path d="M19 18v3H6.5A2.5 2.5 0 0 1 4 18.5" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3l7 3v6c0 4.4-3 8-7 9-4-1-7-4.6-7-9V6Z" />
      <path d="M9.2 12.2l2 2 3.6-3.8" />
    </>
  ),
  clock: (
    <>
      <path d="M12 7v5l3 2" />
      <circle cx="12" cy="12" r="9" />
    </>
  ),
  sparkle: (
    <>
      <path d="M12 3v3M12 18v3M3 12h3M18 12h3" />
      <circle cx="12" cy="12" r="3.4" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-4.2-4.2" />
    </>
  ),
  pencil: (
    <>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </>
  ),
  back: <path d="M15 18l-6-6 6-6" />,
  close: <path d="M18 6 6 18M6 6l12 12" />,
  check: <path d="M20 6 9 17l-5-5" />,
  chevron: <path d="M9 18l6-6-6-6" />,
  plus: <path d="M12 5v14M5 12h14" />,
  send: <path d="m4 12 16-8-6 16-2.5-6.5L4 12Z" />,
  chat: (
    <>
      <path d="M8 10h8M8 14h5" />
      <path d="M21 12a8 8 0 0 1-8 8H7l-4 3V12a8 8 0 0 1 8-8h2a8 8 0 0 1 8 8Z" />
    </>
  ),
  list: <path d="M4 6h16M4 12h10M4 18h7" />,
  calendar: (
    <>
      <rect x="3.5" y="5" width="17" height="16" rx="2.5" />
      <path d="M8 3v4M16 3v4M3.5 10h17" />
    </>
  ),
  question: (
    <>
      <path d="M12 17h.01" />
      <path d="M9.1 9a3 3 0 1 1 4.2 2.7c-.8.4-1.3 1.1-1.3 2" />
      <circle cx="12" cy="12" r="9" />
    </>
  ),
};

/* ---------- cincin progres ---------- */

const RADIUS = 31;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function ProgressRing({ done, total, label }: { done: number; total: number; label: string }) {
  const ratio = total > 0 ? done / total : 0;
  return (
    <div className="ring">
      <svg width="74" height="74" viewBox="0 0 74 74">
        <circle className="track" cx="37" cy="37" r={RADIUS} fill="none" strokeWidth="7" />
        <circle
          className="fill"
          cx="37"
          cy="37"
          r={RADIUS}
          fill="none"
          strokeWidth="7"
          strokeDasharray={`${(ratio * CIRCUMFERENCE).toFixed(1)} ${CIRCUMFERENCE.toFixed(1)}`}
        />
      </svg>
      <b>
        {done}/{total}
        <small>{label}</small>
      </b>
    </div>
  );
}

/* ---------- bottom sheet ---------- */

export function Sheet({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  if (!open) return null;
  return (
    <>
      <div className="scrim" onClick={onClose} role="presentation" />
      <div className="sheet" role="dialog" aria-modal="true">
        <div className="grab" />
        {children}
        <button type="button" className="btn block" onClick={onClose}>
          Tutup
        </button>
      </div>
    </>
  );
}

export function Toast({ text }: { text: string | null }) {
  if (!text) return null;
  return (
    <div className="toast" role="status">
      {text}
    </div>
  );
}

/* ---------- tab bar ---------- */

export type ScreenName = "beranda" | "draft" | "sumber" | "periksa" | "jejak";

const TABS: { id: ScreenName; label: string; icon: ReactNode }[] = [
  { id: "beranda", label: "Beranda", icon: ICONS.home },
  { id: "draft", label: "Draft", icon: ICONS.doc },
  { id: "sumber", label: "Sumber", icon: ICONS.book },
  { id: "periksa", label: "Periksa", icon: ICONS.shield },
  { id: "jejak", label: "Jejak", icon: ICONS.clock },
];

export function TabBar({
  active,
  onSelect,
  alert,
}: {
  active: ScreenName;
  onSelect: (name: ScreenName) => void;
  alert: boolean;
}) {
  return (
    <nav className="tabbar">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          className="tab"
          role="tab"
          aria-selected={active === tab.id}
          onClick={() => onSelect(tab.id)}
        >
          <Icon path={tab.icon} />
          {tab.label}
          {tab.id === "periksa" && alert ? <span className="dot" /> : null}
        </button>
      ))}
    </nav>
  );
}
