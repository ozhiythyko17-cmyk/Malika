// Pengganti server/auth.ts untuk demo di browser: sama perilakunya, tanpa node:crypto.
// Hanya untuk demo lokal — kata sandi tidak di-hash dengan aman dan sesi tidak ditandatangani.
// Browser tidak mengizinkan header Cookie/Set-Cookie buatan, jadi sesi disimpan langsung di localStorage.
import type { Role, User } from "../shared/types";
import { getDb } from "../server/db";

const COOKIE = "umkm_session";
const encode = (s: string) => btoa(unescape(encodeURIComponent(s)));
const decode = (s: string) => decodeURIComponent(escape(atob(s)));

export async function hashPassword(password: string) {
  return `demo$${encode(password)}`;
}

export async function verifyPassword(password: string, stored: string) {
  return stored === `demo$${encode(password)}`;
}

let memorySession: string | null = null;

function storeSession(value: string | null) {
  memorySession = value;
  try {
    if (value) localStorage.setItem(COOKIE, value);
    else localStorage.removeItem(COOKIE);
  } catch {
    // penyimpanan diblokir: sesi hanya bertahan sampai halaman ditutup
  }
}

function readSession() {
  try {
    return localStorage.getItem(COOKIE) ?? memorySession;
  } catch {
    return memorySession;
  }
}

export function sessionCookie(user: { id: number; session_version: number }, _secure: boolean) {
  const value = encode(JSON.stringify({ uid: user.id, v: user.session_version }));
  storeSession(value);
  return `${COOKIE}=${value}; Path=/`;
}

export function clearCookie(_secure: boolean) {
  storeSession(null);
  return `${COOKIE}=; Path=/; Max-Age=0`;
}

export async function userFromRequest(_req: Request): Promise<User | null> {
  const raw = readSession();
  if (!raw) return null;
  let data: { uid: number; v: number };
  try {
    data = JSON.parse(decode(raw));
  } catch {
    return null;
  }
  const { query } = await getDb();
  const [row] = await query<User & { session_version: number }>(
    "select id, name, username, role, session_version from users where id = $1",
    [data.uid]
  );
  if (!row || row.session_version !== data.v) return null;
  return { id: row.id, name: row.name, username: row.username, role: row.role as Role };
}

export function checkLoginAllowed(_username: string) {}
export function recordLoginFailure(_username: string) {}
export const clearLoginFailures = (_username: string) => true;
