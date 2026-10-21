// Satu Vercel Function untuk seluruh API. vercel.json meneruskan /api/<rute> ke sini sebagai ?route=<rute>.
import { handle } from "../server/app.js";

async function entry(request: Request) {
  const url = new URL(request.url);
  const route = url.searchParams.get("route") ?? "";
  url.searchParams.delete("route");
  return handle(request, route, url);
}

export const GET = entry;
export const POST = entry;
export const PUT = entry;
export const PATCH = entry;
export const DELETE = entry;
