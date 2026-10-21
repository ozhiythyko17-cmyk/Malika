/** 0812xxxx / +62 812-xxxx / 62812xxxx -> 62812xxxx (format wa.me). */
export function normalizeWa(raw: string) {
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("0")) return "62" + digits.slice(1);
  if (digits.startsWith("8")) return "62" + digits;
  return digits;
}
