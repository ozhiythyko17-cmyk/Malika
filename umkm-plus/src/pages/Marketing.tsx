import { Bookmark, Copy, Megaphone, MessageCircle, Users } from "lucide-react";
import { useCallback, useState } from "react";
import type { Content, Customer } from "../../shared/types";
import Studio from "./Studio";
import Iklan from "./Iklan";
import { mutate, useApi } from "../api";
import { useSession } from "../App";
import type { AdDraft } from "../components/AdWizard";
import { ApiImage, Chips, Empty, LoadError, useRun } from "../components/ui";
import { dateStr, rp, timeStr, waLink } from "../utils";

type Tab = "AI Konten" | "Tersimpan" | "Pelanggan" | "Iklan";

export default function Marketing() {
  const { isOwner } = useSession();
  const [tab, setTab] = useState<Tab>("AI Konten");
  // Bahan dari Studio/Tersimpan yang ingin langsung diiklankan; dibuka di tab Iklan.
  const [adDraft, setAdDraft] = useState<AdDraft | null>(null);
  const tabs: Tab[] = isOwner ? ["AI Konten", "Tersimpan", "Pelanggan", "Iklan"] : ["AI Konten", "Tersimpan", "Pelanggan"];
  const advertise = isOwner
    ? (draft: AdDraft) => {
        setAdDraft(draft);
        setTab("Iklan");
      }
    : undefined;
  const draftUsed = useCallback(() => setAdDraft(null), []);
  return (
    <div className="stack">
      <h2>Marketing</h2>
      <Chips segmented options={tabs} value={tab} onChange={setTab} />
      {tab === "AI Konten" && <Studio onAdvertise={advertise} />}
      {tab === "Tersimpan" && <Tersimpan onAdvertise={advertise} />}
      {tab === "Pelanggan" && <Pelanggan />}
      {tab === "Iklan" && <Iklan draft={adDraft} onDraftUsed={draftUsed} />}
    </div>
  );
}

function copy(text: string) {
  navigator.clipboard.writeText(text).then(() => alert("Tersalin! Tinggal tempel di Instagram/TikTok/WA."));
}

function Tersimpan({ onAdvertise }: { onAdvertise?: (draft: AdDraft) => void }) {
  const { data: contents, error } = useApi<Content[]>("/contents");
  const [, run] = useRun();
  if (contents?.length === 0) return <Empty icon={<Bookmark size={26} />}>Belum ada konten tersimpan.</Empty>;
  return (
    <div className="list">
      <LoadError error={error} />
      {contents?.map((c) => (
        <div key={c.id} className="card result">
          <div className="small muted">{timeStr(c.createdAt)} · {c.title} · {c.platform}</div>
          {c.mediaId && (
            <a href={`/api/media/${c.mediaId}`} download={`gambar-promo-${c.mediaId}.png`}>
              <ApiImage className="result-img" path={`/api/media/${c.mediaId}`} alt="Gambar promo" />
            </a>
          )}
          <pre>{c.text}</pre>
          <div className="row gap">
            <button className="btn small" onClick={() => copy(c.text)}>
              <Copy size={16} /> Salin
            </button>
            {onAdvertise && c.mediaId && (
              <button
                className="btn small"
                onClick={() => onAdvertise({ image: { mediaId: c.mediaId! }, previewPath: `/api/media/${c.mediaId}`, captions: [c.text], headline: c.title })}
              >
                <Megaphone size={16} /> Iklankan
              </button>
            )}
            <button className="btn small ghost danger" onClick={() => confirm("Hapus konten ini?") && run(() => mutate("DELETE", `/contents/${c.id}`))}>
              Hapus
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function Pelanggan() {
  const { settings } = useSession();
  const { data: customers, error } = useApi<Customer[]>("/customers");
  const [q, setQ] = useState("");
  const DAY = 86_400_000;

  if (customers?.length === 0) {
    return <Empty icon={<Users size={26} />}>Pelanggan muncul otomatis dari pesanan yang ada nomor WhatsApp-nya.</Empty>;
  }
  const shown = customers?.filter((c) => !q || c.name.toLowerCase().includes(q.toLowerCase()) || c.wa.includes(q));
  const greeting = (c: Customer) =>
    `Halo ${c.name || "Kak"}! 👋 Terima kasih sudah langganan di ${settings.businessName}. `;

  return (
    <div className="stack">
      <LoadError error={error} />
      <input placeholder="Cari nama atau nomor…" value={q} onChange={(e) => setQ(e.target.value)} />
      <p className="small muted">{customers?.length ?? 0} pelanggan. "Lama tidak order" = lebih dari 30 hari — cocok dikirimi promo.</p>
      <div className="list">
        {shown?.map((c) => {
          const idle = Date.now() - c.lastOrder > 30 * DAY;
          return (
            <div key={c.wa} className="card">
              <div className="row between">
                <b>{c.name || c.wa}</b>
                {idle ? <span className="badge neg">Lama tidak order</span> : c.orders >= 3 && <span className="badge st-selesai">Setia</span>}
              </div>
              <div className="small muted">
                {c.orders}× order · total {rp(c.spent)} · terakhir {dateStr(c.lastOrder)}
              </div>
              <a className="btn small" href={waLink(c.wa, greeting(c))} target="_blank" rel="noreferrer">
                <MessageCircle size={16} /> Chat WhatsApp
              </a>
            </div>
          );
        })}
      </div>
    </div>
  );
}
