import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, DEFAULT_SETTINGS } from "./db";
import Beranda from "./pages/Beranda";
import Pesanan from "./pages/Pesanan";
import Produk from "./pages/Produk";
import Keuangan from "./pages/Keuangan";
import Marketing from "./pages/Marketing";
import Pengaturan from "./pages/Pengaturan";

export type Page = "beranda" | "pesanan" | "produk" | "keuangan" | "marketing" | "pengaturan";

const NAV: { page: Page; icon: string; label: string }[] = [
  { page: "beranda", icon: "🏠", label: "Beranda" },
  { page: "pesanan", icon: "🧾", label: "Pesanan" },
  { page: "produk", icon: "🍱", label: "Produk" },
  { page: "keuangan", icon: "💰", label: "Keuangan" },
  { page: "marketing", icon: "✨", label: "Marketing" },
];

function readHash(): Page {
  const h = location.hash.slice(1) as Page;
  return [...NAV.map((n) => n.page), "pengaturan"].includes(h) ? h : "beranda";
}

export default function App() {
  const [page, setPage] = useState<Page>(readHash);
  const settings = useLiveQuery(() => db.settings.get("main").then((s) => s ?? DEFAULT_SETTINGS));

  useEffect(() => {
    const onHash = () => setPage(readHash());
    addEventListener("hashchange", onHash);
    return () => removeEventListener("hashchange", onHash);
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [page]);

  const go = (p: Page) => {
    location.hash = p;
  };

  return (
    <div className="app">
      <header className="topbar">
        <div>
          <small>UMKM Plus</small>
          <b>{settings?.businessName}</b>
        </div>
        <button className="icon-btn" aria-label="Pengaturan" onClick={() => go("pengaturan")}>
          ⚙️
        </button>
      </header>

      <main className="content">
        {page === "beranda" && <Beranda go={go} />}
        {page === "pesanan" && <Pesanan />}
        {page === "produk" && <Produk />}
        {page === "keuangan" && <Keuangan />}
        {page === "marketing" && <Marketing />}
        {page === "pengaturan" && <Pengaturan />}
      </main>

      <nav className="tabbar">
        {NAV.map((n) => (
          <button key={n.page} className={page === n.page ? "on" : ""} onClick={() => go(n.page)}>
            <span>{n.icon}</span>
            {n.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
