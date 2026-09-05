"use client";

import { useEffect, useRef, useState } from "react";

import { askAssistant, getChatHistory, type AssistantAction, type ChatMessage } from "../lib/api";
import { ICONS, Icon } from "./ui";

const SUGGESTIONS = [
  "Bab 2 saya sudah cukup belum?",
  "Apa yang bakal ditanya penguji?",
  "Kenapa ada referensi yang dibuang?",
  "Metodologi saya lemah di mana?",
  "Saya belum punya data, gimana?",
];

export function AssistantChat({
  projectId,
  seed,
  onClose,
  onAction,
}: {
  projectId: string;
  seed?: string;
  onClose: () => void;
  onAction: (action: AssistantAction) => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const seedSent = useRef(false);

  useEffect(() => {
    getChatHistory(projectId)
      .then(setMessages)
      .catch(() => setError("Riwayat percakapan tidak bisa dimuat."));
  }, [projectId]);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [messages, busy]);

  async function send(text: string) {
    const message = text.trim();
    if (!message || busy) return;

    setBusy(true);
    setError(null);
    setMessages((current) => [
      ...current,
      { role: "user", text: message, action: null, at: new Date().toISOString() },
    ]);

    try {
      const reply = await askAssistant(projectId, message);
      setMessages((current) => [
        ...current,
        { role: "assistant", text: reply.answer, action: reply.action, at: new Date().toISOString() },
      ]);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (seed && !seedSent.current) {
      seedSent.current = true;
      void send(seed);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed]);

  return (
    <div className="overlay">
      <div className="appbar">
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Tutup">
          <Icon path={ICONS.back} size={19} />
        </button>
        <h1>Asisten Skripsi</h1>
        <span className="pill">AI</span>
      </div>

      <div className="chat-log" ref={logRef}>
        {messages.length === 0 && !busy ? (
          <div className="msg ai">
            <span className="who-line">Asisten</span>
            <div className="bubble">
              Saya membaca draft Anda — bab apa saja yang sudah ada, mana yang belum direview, dan
              temuan apa yang menahan ekspor. Tanya apa saja soal isi bab, metodologi, referensi,
              atau langkah berikutnya.
            </div>
          </div>
        ) : null}

        {messages.map((message, index) => (
          <div key={index} className={message.role === "user" ? "msg me" : "msg ai"}>
            {message.role === "assistant" ? <span className="who-line">Asisten</span> : null}
            <div className="bubble">{message.text}</div>
            {message.action ? (
              <button
                type="button"
                className="msg-action"
                onClick={() => onAction(message.action as AssistantAction)}
              >
                {message.action.label}
              </button>
            ) : null}
          </div>
        ))}

        {busy ? (
          <div className="msg ai">
            <span className="who-line">Asisten</span>
            <div className="bubble typing">
              <i />
              <i />
              <i />
            </div>
          </div>
        ) : null}

        {error ? <div className="error-box">{error}</div> : null}
      </div>

      <div>
        <div className="chat-suggest">
          {SUGGESTIONS.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              className="chip"
              onClick={() => void send(suggestion)}
              disabled={busy}
            >
              {suggestion}
            </button>
          ))}
        </div>
        <div className="overlay-foot chat-input">
          <textarea
            rows={1}
            value={draft}
            placeholder="Tanya apa saja soal skripsi Anda…"
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void send(draft);
                setDraft("");
              }
            }}
          />
          <button
            type="button"
            className="send-btn"
            aria-label="Kirim"
            disabled={busy}
            onClick={() => {
              void send(draft);
              setDraft("");
            }}
          >
            <Icon path={ICONS.send} size={19} />
          </button>
        </div>
      </div>
    </div>
  );
}
