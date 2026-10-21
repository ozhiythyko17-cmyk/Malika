import type { User } from "../shared/types.js";

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export const json = (data: unknown, status = 200, headers: HeadersInit = {}) =>
  Response.json(data, { status, headers });

export interface Ctx {
  req: Request;
  url: URL;
  params: Record<string, string>;
  user: User;
  body: () => Promise<Record<string, unknown>>;
}

export async function readBody(req: Request): Promise<Record<string, unknown>> {
  if (!req.headers.get("content-type")?.includes("application/json")) {
    throw new HttpError(415, "Format permintaan harus JSON.");
  }
  try {
    const body = await req.json();
    if (body && typeof body === "object" && !Array.isArray(body)) return body;
  } catch {
    // jatuh ke error di bawah
  }
  throw new HttpError(400, "Permintaan tidak valid.");
}

// ---- Validasi input sederhana ----

export function str(v: unknown, field: string, { max = 500, required = false } = {}): string {
  if (v == null) v = "";
  if (typeof v !== "string") throw new HttpError(400, `${field} harus berupa teks.`);
  const s = v.trim();
  if (required && !s) throw new HttpError(400, `${field} wajib diisi.`);
  if (s.length > max) throw new HttpError(400, `${field} terlalu panjang (maks. ${max} karakter).`);
  return s;
}

export function int(v: unknown, field: string, { min = 0, max = 1_000_000_000 } = {}): number {
  const n = typeof v === "string" && v.trim() !== "" ? Number(v) : v;
  if (typeof n !== "number" || !Number.isInteger(n)) throw new HttpError(400, `${field} harus angka bulat.`);
  if (n < min || n > max) throw new HttpError(400, `${field} di luar batas yang wajar.`);
  return n;
}

export function bool(v: unknown, field: string): boolean {
  if (typeof v !== "boolean") throw new HttpError(400, `${field} harus ya/tidak.`);
  return v;
}

export function oneOf<T extends string>(v: unknown, options: readonly T[], field: string): T {
  if (!options.includes(v as T)) throw new HttpError(400, `${field} tidak dikenal.`);
  return v as T;
}

/** Waktu dalam milidetik (dari query string atau body). */
export function time(v: unknown, field: string): number {
  return int(v, field, { min: 0, max: 8_640_000_000_000 });
}

export function idParam(ctx: Ctx, name = "id") {
  return int(ctx.params[name], "ID", { min: 1, max: 2_147_483_647 });
}
