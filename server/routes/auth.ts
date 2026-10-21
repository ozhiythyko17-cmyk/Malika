import type { Role, User } from "../../shared/types.js";
import {
  checkLoginAllowed, clearCookie, clearLoginFailures, hashPassword, recordLoginFailure,
  sessionCookie, verifyPassword,
} from "../auth.js";
import { getDb } from "../db.js";
import { HttpError, idParam, json, oneOf, readBody, str, type Ctx } from "../http.js";

const isSecure = (req: Request) => new URL(req.url).protocol === "https:" || req.headers.get("x-forwarded-proto") === "https";

function validPassword(v: unknown) {
  const pw = str(v, "Kata sandi", { max: 200, required: true });
  if (pw.length < 8) throw new HttpError(400, "Kata sandi minimal 8 karakter.");
  return pw;
}

const validUsername = (v: unknown) => {
  const u = str(v, "Nama pengguna", { max: 40, required: true }).toLowerCase();
  if (!/^[a-z0-9._-]{3,}$/.test(u)) throw new HttpError(400, "Nama pengguna minimal 3 huruf/angka, tanpa spasi.");
  return u;
};

/** Status awal aplikasi: sudah login? perlu buat akun pemilik? */
export async function status(user: User | null) {
  if (user) return json({ user });
  const { query } = await getDb();
  const [{ count }] = await query<{ count: number }>("select count(*)::int as count from users");
  return json({ user: null, needsSetup: count === 0 });
}

/** Membuat akun pemilik pertama. Hanya bisa saat belum ada akun sama sekali. */
export async function setup(req: Request) {
  const body = await readBody(req);
  const name = str(body.name, "Nama", { max: 80, required: true });
  const username = validUsername(body.username);
  const passwordHash = await hashPassword(validPassword(body.password));
  const businessName = str(body.businessName, "Nama usaha", { max: 80 }) || "Dapur Bakar";

  const { transaction } = await getDb();
  const user = await transaction(async (q) => {
    await q("lock table users in exclusive mode");
    const [{ count }] = await q<{ count: number }>("select count(*)::int as count from users");
    if (count > 0) throw new HttpError(409, "Akun pemilik sudah dibuat. Silakan masuk.");
    const [u] = await q<{ id: number; session_version: number }>(
      "insert into users (name, username, password_hash, role) values ($1, $2, $3, 'pemilik') returning id, session_version",
      [name, username, passwordHash]
    );
    await q(
      `insert into settings (id, data) values (1, jsonb_build_object('businessName', $1::text, 'ownerName', $2::text))
       on conflict (id) do update set data = settings.data || excluded.data`,
      [businessName, name]
    );
    return u;
  });
  return json({ ok: true }, 201, { "Set-Cookie": sessionCookie(user, isSecure(req)) });
}

export async function login(req: Request) {
  const body = await readBody(req);
  const username = str(body.username, "Nama pengguna", { max: 40, required: true }).toLowerCase();
  const password = str(body.password, "Kata sandi", { max: 200, required: true });
  checkLoginAllowed(username);

  const { query } = await getDb();
  const [row] = await query<{ id: number; password_hash: string; session_version: number }>(
    "select id, password_hash, session_version from users where username = $1",
    [username]
  );
  if (!row || !(await verifyPassword(password, row.password_hash))) {
    recordLoginFailure(username);
    throw new HttpError(401, "Nama pengguna atau kata sandi salah.");
  }
  clearLoginFailures(username);
  return json({ ok: true }, 200, { "Set-Cookie": sessionCookie(row, isSecure(req)) });
}

export const logout = (req: Request) => json({ ok: true }, 200, { "Set-Cookie": clearCookie(isSecure(req)) });

export async function changePassword(ctx: Ctx) {
  const body = await ctx.body();
  const current = str(body.currentPassword, "Kata sandi lama", { max: 200, required: true });
  const next = validPassword(body.newPassword);
  const { query } = await getDb();
  const [row] = await query<{ password_hash: string }>("select password_hash from users where id = $1", [ctx.user.id]);
  if (!(await verifyPassword(current, row.password_hash))) throw new HttpError(400, "Kata sandi lama salah.");
  // Naikkan session_version supaya sesi di perangkat lain ikut keluar.
  const [u] = await query<{ id: number; session_version: number }>(
    "update users set password_hash = $1, session_version = session_version + 1 where id = $2 returning id, session_version",
    [await hashPassword(next), ctx.user.id]
  );
  return json({ ok: true }, 200, { "Set-Cookie": sessionCookie(u, isSecure(ctx.req)) });
}

export async function listUsers() {
  const { query } = await getDb();
  return json(await query("select id, name, username, role from users order by id"));
}

export async function createUser(ctx: Ctx) {
  const body = await ctx.body();
  const name = str(body.name, "Nama", { max: 80, required: true });
  const username = validUsername(body.username);
  const role = oneOf<Role>(body.role, ["pemilik", "staf"], "Peran");
  const hash = await hashPassword(validPassword(body.password));
  const { query } = await getDb();
  const [exists] = await query("select 1 from users where username = $1", [username]);
  if (exists) throw new HttpError(409, "Nama pengguna sudah dipakai.");
  const [u] = await query(
    "insert into users (name, username, password_hash, role) values ($1, $2, $3, $4) returning id, name, username, role",
    [name, username, hash, role]
  );
  return json(u, 201);
}

export async function deleteUser(ctx: Ctx) {
  const id = idParam(ctx);
  if (id === ctx.user.id) throw new HttpError(400, "Tidak bisa menghapus akun sendiri.");
  const { query } = await getDb();
  await query("delete from users where id = $1", [id]);
  return json({ ok: true });
}
