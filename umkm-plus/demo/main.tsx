// Versi demo: server UMKM Plus (server/app.ts) dijalankan di dalam browser dengan database
// PostgreSQL WASM (PGlite). Google & Claude ditiru. Data hanya tersimpan di browser ini.
import { Buffer } from "buffer";
import { createRoot } from "react-dom/client";
import { useState } from "react";
import "../src/styles.css";
import "./demo.css";

const DB_NAME = "dapur-bakar-demo";

const g = globalThis as Record<string, unknown>;
g.Buffer = Buffer;
g.process = {
  env: {
    ANTHROPIC_API_KEY: "demo",
    GOOGLE_API_KEY: "demo",
    META_ACCESS_TOKEN: "demo",
    META_AD_ACCOUNT_ID: "act_demo",
    META_PAGE_ID: "demo_page",
    PGLITE_DIR: "memory://",
  },
};
g.__UMKM_DEMO__ = true;

// Dialog bawaan browser tidak tampil di halaman artifact: ganti dengan notifikasi kecil & selalu "ya".
window.alert = (msg?: unknown) => toast(String(msg ?? ""));
window.confirm = () => true;

function toast(message: string) {
  const el = document.createElement("div");
  el.className = "demo-toast";
  el.textContent = message;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3200);
}

async function canUseIndexedDb() {
  try {
    if (!("indexedDB" in window)) return false;
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.open("umkm-plus-probe");
      req.onsuccess = () => {
        req.result.close();
        resolve();
      };
      req.onerror = () => reject(req.error);
    });
    return true;
  } catch {
    return false;
  }
}

async function boot() {
  const root = createRoot(document.getElementById("root")!);
  root.render(<div className="center-screen muted">Menyiapkan demo Dapur Bakar…<br /><small>Memuat database (±10 detik pertama kali)</small></div>);

  const persistent = await canUseIndexedDb();
  (g.process as { env: Record<string, string> }).env.PGLITE_DIR = persistent ? `idb://${DB_NAME}` : "memory://";

  // Berkas data PostgreSQL dikemas sebagai modul JS (lihat demo/make-pglite-data.mjs).
  const { default: dataB64 } = await import("./generated/pglite-data.js");
  const bytes = Uint8Array.from(atob(dataB64), (c) => c.charCodeAt(0));
  g.__PGLITE_OPTIONS__ = { fsBundle: new Blob([bytes]) };

  const [{ handle }, { fakeGoogleFetch }, { fakeMetaFetch }, { seedDemo }] = await Promise.all([
    import("../server/app"),
    import("./fake-google"),
    import("./fake-meta"),
    import("./seed"),
  ]);

  const realFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (url.startsWith("/api/")) {
      const full = new URL(url, "https://demo.local");
      return handle(new Request(full, init), full.pathname.slice(5), full);
    }
    return (await fakeGoogleFetch(url, init)) ?? (await fakeMetaFetch(url, init)) ?? realFetch(input, init);
  };

  try {
    const status = await (await fetch("/api/auth/status")).json();
    if (status.needsSetup) {
      const call = async (method: string, path: string, body?: unknown) => {
        const res = await fetch(`/api${path}`, {
          method,
          headers: body === undefined ? undefined : { "Content-Type": "application/json" },
          body: body === undefined ? undefined : JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(`${method} ${path}: ${data.error}`);
        return data;
      };
      await seedDemo(call);
    }
  } catch (e) {
    root.render(
      <div className="center-screen">
        <b>Demo tidak bisa dimulai di browser ini.</b>
        <small className="muted">{(e as Error).message}</small>
      </div>
    );
    return;
  }

  const { default: App } = await import("../src/App");
  root.render(
    <>
      <DemoBar persistent={persistent} />
      <App />
    </>
  );
}

function DemoBar({ persistent }: { persistent: boolean }) {
  const [confirming, setConfirming] = useState(false);
  const reset = () => {
    try {
      localStorage.removeItem("umkm_session");
      localStorage.removeItem("umkm-demo-meta");
    } catch {
      // abaikan
    }
    const req = indexedDB.deleteDatabase(`/pglite/${DB_NAME}`);
    req.onsuccess = req.onerror = req.onblocked = () => location.reload();
  };
  return (
    <div className="demo-bar">
      <span>
        <b>MODE DEMO</b> · data contoh{persistent ? ", tersimpan di browser ini" : ", hilang saat halaman ditutup"} · hasil AI berupa contoh
      </span>
      {persistent &&
        (confirming ? (
          <span className="demo-confirm">
            Hapus semua perubahan?{" "}
            <button onClick={reset}>Ya, ulang</button> <button onClick={() => setConfirming(false)}>Batal</button>
          </span>
        ) : (
          <button onClick={() => setConfirming(true)}>Ulang demo</button>
        ))}
    </div>
  );
}

boot();
