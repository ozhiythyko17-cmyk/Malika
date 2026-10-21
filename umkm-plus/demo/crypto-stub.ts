// Pengganti node:crypto di demo browser. Hanya dipakai server/meta.ts untuk appsecret_proof,
// yang tidak aktif di demo (META_APP_SECRET kosong).
export function createHmac(): never {
  throw new Error("createHmac tidak tersedia di versi demo.");
}
