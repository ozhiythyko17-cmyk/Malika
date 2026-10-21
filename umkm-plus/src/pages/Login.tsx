import { useState, type FormEvent } from "react";
import { api } from "../api";
import { Field } from "../components/ui";

// Diset oleh versi demo (demo/main.tsx).
const isDemo = Boolean((globalThis as { __UMKM_DEMO__?: boolean }).__UMKM_DEMO__);

export default function Login({ needsSetup, onDone }: { needsSetup: boolean; onDone: () => void }) {
  const [businessName, setBusinessName] = useState("Dapur Bakar");
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (needsSetup && password !== password2) return setError("Kedua kata sandi tidak sama.");
    setBusy(true);
    try {
      if (needsSetup) await api("POST", "/auth/setup", { businessName, name, username, password });
      else await api("POST", "/auth/login", { username, password });
      onDone();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login">
      <div className="login-brand">
        <img src="icon-192.png" alt="" width={72} height={72} />
        <h1>UMKM Plus</h1>
        <p>{needsSetup ? "Buat akun pemilik untuk mulai" : "Masuk untuk melanjutkan"}</p>
      </div>
      {isDemo && !needsSetup && (
        <div className="alert info demo-hint">
          Akun demo — pemilik: <code>dapurbakar</code> / <code>demo1234</code> · staf: <code>sari</code> / <code>demo1234</code>
        </div>
      )}
      <form className="card stack" onSubmit={submit}>
        {needsSetup && (
          <>
            <Field label="Nama usaha">
              <input value={businessName} onChange={(e) => setBusinessName(e.target.value)} required />
            </Field>
            <Field label="Nama kamu">
              <input value={name} onChange={(e) => setName(e.target.value)} required autoComplete="name" />
            </Field>
          </>
        )}
        <Field label="Nama pengguna" hint={needsSetup ? "Huruf kecil/angka tanpa spasi, mis. dapurbakar" : undefined}>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value.toLowerCase())}
            autoCapitalize="none"
            autoComplete="username"
            required
          />
        </Field>
        <Field label="Kata sandi" hint={needsSetup ? "Minimal 8 karakter" : undefined}>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={needsSetup ? "new-password" : "current-password"}
            required
          />
        </Field>
        {needsSetup && (
          <Field label="Ulangi kata sandi">
            <input type="password" value={password2} onChange={(e) => setPassword2(e.target.value)} autoComplete="new-password" required />
          </Field>
        )}
        {error && <div className="alert warn">{error}</div>}
        <button className="btn primary big" disabled={busy}>
          {busy ? "Memproses…" : needsSetup ? "Buat akun & mulai" : "Masuk"}
        </button>
      </form>
    </div>
  );
}
