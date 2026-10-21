import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { House, Megaphone, ReceiptText, Settings as SettingsIcon, UtensilsCrossed, Wallet, type LucideIcon } from "lucide-react";
import { DEFAULT_SETTINGS, type Settings, type User } from "../shared/types";
import { api, setUnauthorizedHandler, useApi } from "./api";
import Login from "./pages/Login";
import Beranda from "./pages/Beranda";
import Pesanan from "./pages/Pesanan";
import Produk from "./pages/Produk";
import Keuangan from "./pages/Keuangan";
import Marketing from "./pages/Marketing";
import Pengaturan from "./pages/Pengaturan";

export type Page = "beranda" | "pesanan" | "produk" | "keuangan" | "marketing" | "pengaturan";

interface Session {
  user: User;
  isOwner: boolean;
  settings: Settings;
  logout: () => void;
  go: (p: Page) => void;
}

const SessionContext = createContext<Session | null>(null);
export const useSession = () => useContext(SessionContext)!;

const NAV: { page: Page; icon: LucideIcon; label: string; ownerOnly?: boolean }[] = [
  { page: "beranda", icon: House, label: "Beranda" },
  { page: "pesanan", icon: ReceiptText, label: "Pesanan" },
  { page: "produk", icon: UtensilsCrossed, label: "Produk" },
  { page: "keuangan", icon: Wallet, label: "Keuangan", ownerOnly: true },
  { page: "marketing", icon: Megaphone, label: "Marketing" },
];

function readHash(): Page {
  const h = location.hash.slice(1) as Page;
  return [...NAV.map((n) => n.page), "pengaturan"].includes(h) ? h : "beranda";
}

export default function App() {
  const [auth, setAuth] = useState<{ user: User | null; needsSetup?: boolean } | null>(null);
  const [authError, setAuthError] = useState("");

  const refreshAuth = useCallback(() => {
    setAuthError("");
    api<{ user: User | null; needsSetup?: boolean }>("GET", "/auth/status")
      .then(setAuth)
      .catch((e) => setAuthError(e.message));
  }, []);

  useEffect(() => {
    refreshAuth();
    setUnauthorizedHandler(() => setAuth({ user: null }));
  }, [refreshAuth]);

  if (authError) {
    return (
      <div className="center-screen">
        <p>{authError}</p>
        <button className="btn primary" onClick={refreshAuth}>Coba lagi</button>
      </div>
    );
  }
  if (!auth) return <div className="center-screen muted">Memuat…</div>;
  if (!auth.user) return <Login needsSetup={!!auth.needsSetup} onDone={refreshAuth} />;
  return <Main user={auth.user} onLogout={() => setAuth({ user: null })} />;
}

function Main({ user, onLogout }: { user: User; onLogout: () => void }) {
  const [page, setPage] = useState<Page>(readHash);
  const { data: settings } = useApi<Settings>("/settings");
  const isOwner = user.role === "pemilik";

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
  const logout = () => {
    api("POST", "/auth/logout").finally(onLogout);
  };

  const nav = NAV.filter((n) => isOwner || !n.ownerOnly);
  const current = nav.some((n) => n.page === page) || page === "pengaturan" ? page : "beranda";

  return (
    <SessionContext.Provider value={{ user, isOwner, settings: settings ?? DEFAULT_SETTINGS, logout, go }}>
      <div className="app">
        <header className="topbar">
          <div className="topbar-inner">
            <div className="brand">
              <span className="brand-mark" aria-hidden="true">U+</span>
              <div className="brand-text">
                <b>{settings?.businessName ?? ""}</b>
                <small>UMKM Plus · {user.name}</small>
              </div>
            </div>
            <button className="icon-btn" aria-label="Pengaturan" onClick={() => go("pengaturan")}>
              <SettingsIcon size={22} strokeWidth={1.8} />
            </button>
          </div>
        </header>

        <main className="content">
          {current === "beranda" && <Beranda />}
          {current === "pesanan" && <Pesanan />}
          {current === "produk" && <Produk />}
          {current === "keuangan" && <Keuangan />}
          {current === "marketing" && <Marketing />}
          {current === "pengaturan" && <Pengaturan />}
        </main>

        <nav className="tabbar">
          {nav.map(({ page: p, icon: Icon, label }) => (
            <button key={p} className={current === p ? "on" : ""} aria-current={current === p ? "page" : undefined} onClick={() => go(p)}>
              <span className="nav-icon">
                <Icon size={21} strokeWidth={current === p ? 2.2 : 1.8} />
              </span>
              {label}
            </button>
          ))}
        </nav>
      </div>
    </SessionContext.Provider>
  );
}
