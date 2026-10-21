import { createHmac, randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import type { Role, User } from "../shared/types.js";
import { getDb } from "./db.js";
import { HttpError } from "./http.js";

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;
const COOKIE = "umkm_session";
const MAX_AGE = 30 * 24 * 3600; // 30 hari

export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const hash = await scrypt(password, salt, 32);
  return `scrypt$${salt.toString("base64")}$${hash.toString("base64")}`;
}

export async function verifyPassword(password: string, stored: string) {
  const [algo, salt, hash] = stored.split("$");
  if (algo !== "scrypt" || !salt || !hash) return false;
  const expected = Buffer.from(hash, "base64");
  const actual = await scrypt(password, Buffer.from(salt, "base64"), expected.length);
  return timingSafeEqual(actual, expected);
}

function secret() {
  const s = process.env.SESSION_SECRET;
  if (s && s.length >= 32) return s;
  if (process.env.VERCEL) throw new HttpError(500, "SESSION_SECRET belum diatur (minimal 32 karakter).");
  return "dev-only-secret-jangan-dipakai-di-produksi";
}

const sign = (payload: string) => createHmac("sha256", secret()).update(payload).digest("base64url");

export function sessionCookie(user: { id: number; session_version: number }, secure: boolean) {
  const payload = Buffer.from(
    JSON.stringify({ uid: user.id, v: user.session_version, exp: Date.now() + MAX_AGE * 1000 })
  ).toString("base64url");
  const value = `${payload}.${sign(payload)}`;
  return `${COOKIE}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${MAX_AGE}${secure ? "; Secure" : ""}`;
}

export const clearCookie = (secure: boolean) =>
  `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure ? "; Secure" : ""}`;

export async function userFromRequest(req: Request): Promise<User | null> {
  const raw = req.headers
    .get("cookie")
    ?.split(/;\s*/)
    .find((c) => c.startsWith(`${COOKIE}=`))
    ?.slice(COOKIE.length + 1);
  if (!raw) return null;
  const [payload, sig] = raw.split(".");
  if (!payload || !sig) return null;
  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;

  let data: { uid: number; v: number; exp: number };
  try {
    data = JSON.parse(Buffer.from(payload, "base64url").toString());
  } catch {
    return null;
  }
  if (!data.exp || data.exp < Date.now()) return null;

  const { query } = await getDb();
  const [row] = await query<User & { session_version: number }>(
    "select id, name, username, role, session_version from users where id = $1",
    [data.uid]
  );
  if (!row || row.session_version !== data.v) return null;
  return { id: row.id, name: row.name, username: row.username, role: row.role as Role };
}

// Batasi tebakan kata sandi: maks. 8 gagal per 15 menit per nama pengguna (per instance server).
const failures = new Map<string, { count: number; until: number }>();

export function checkLoginAllowed(username: string) {
  const f = failures.get(username);
  if (f && f.count >= 8 && f.until > Date.now()) {
    throw new HttpError(429, "Terlalu banyak percobaan. Coba lagi 15 menit lagi.");
  }
}

export function recordLoginFailure(username: string) {
  const f = failures.get(username);
  const fresh = !f || f.until < Date.now();
  failures.set(username, { count: fresh ? 1 : f.count + 1, until: Date.now() + 15 * 60_000 });
}

export const clearLoginFailures = (username: string) => failures.delete(username);
