import { parseIsoDateOnly } from "./dateOnly";

/** Adds calendar years to a YYYY-MM-DD date, clamping the day within the target month. */
export function addCalendarYears(iso: string, years: number): string | null {
  const base = parseIsoDateOnly(iso);
  if (!base) return null;
  const [y, m, d] = base.split("-").map(Number);
  const targetY = y + years;
  const lastDay = new Date(targetY, m, 0).getDate();
  const day = Math.min(d, lastDay);
  return `${targetY}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Inverse of addCalendarYears for the same calendar clamping (e.g. editing derived issue dates). */
export function subtractCalendarYears(iso: string, years: number): string | null {
  const base = parseIsoDateOnly(iso);
  if (!base) return null;
  const [y, m, d] = base.split("-").map(Number);
  const targetY = y - years;
  const lastDay = new Date(targetY, m, 0).getDate();
  const day = Math.min(d, lastDay);
  return `${targetY}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export type ExpiryDisplayStatus = "valid" | "expired" | "none";

export function expiryDisplayStatus(
  expiresAtIso: string | null | undefined,
): ExpiryDisplayStatus {
  if (!expiresAtIso) return "none";
  const s = parseIsoDateOnly(expiresAtIso);
  if (!s) return "none";
  const [y, m, d] = s.split("-").map(Number);
  const end = new Date(y, m - 1, d);
  const now = new Date();
  const todayStart = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  );
  return end >= todayStart ? "valid" : "expired";
}
