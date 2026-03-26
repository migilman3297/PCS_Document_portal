import { createHmac, timingSafeEqual } from "crypto";

function getSessionSecret(): string {
  const s = process.env.SESSION_SECRET;
  if (s && s.length >= 16) return s;
  return "dev-only-change-me-for-pitch";
}

function sign(payload: string): string {
  const mac = createHmac("sha256", getSessionSecret()).update(payload).digest("hex");
  return Buffer.from(`${payload}::${mac}`, "utf-8").toString("base64url");
}

function verify(token: string): string | null {
  let decoded: string;
  try {
    decoded = Buffer.from(token, "base64url").toString("utf-8");
  } catch {
    return null;
  }
  const idx = decoded.lastIndexOf("::");
  if (idx === -1) return null;
  const payload = decoded.slice(0, idx);
  const mac = decoded.slice(idx + 2);
  const expected = createHmac("sha256", getSessionSecret()).update(payload).digest("hex");
  try {
    const a = Buffer.from(mac, "hex");
    const b = Buffer.from(expected, "hex");
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }
  return payload;
}

const MAX_AGE_MS = 1000 * 60 * 60 * 24 * 14; // 14 days

export function createMarinerSessionToken(userId: string): string {
  const exp = Date.now() + MAX_AGE_MS;
  return sign(`mariner:${userId}:${exp}`);
}

export function readMarinerUserId(token: string | undefined): string | null {
  if (!token) return null;
  const payload = verify(token);
  if (!payload?.startsWith("mariner:")) return null;
  const parts = payload.split(":");
  if (parts.length !== 3) return null;
  const exp = Number(parts[2]);
  if (!Number.isFinite(exp) || Date.now() > exp) return null;
  return parts[1] ?? null;
}

export function createViewerSessionToken(officeAccountId: string): string {
  const exp = Date.now() + MAX_AGE_MS;
  return sign(`viewer:${officeAccountId}:${exp}`);
}

export function readViewerOfficeAccountId(
  token: string | undefined
): string | null {
  if (!token) return null;
  const payload = verify(token);
  if (!payload?.startsWith("viewer:")) return null;
  const parts = payload.split(":");
  if (parts.length !== 3) return null;
  const exp = Number(parts[2]);
  if (!Number.isFinite(exp) || Date.now() > exp) return null;
  return parts[1] || null;
}

export function isViewerSessionValid(token: string | undefined): boolean {
  return readViewerOfficeAccountId(token) !== null;
}

export const MARINER_COOKIE = "crewdoc_mariner";
export const VIEWER_COOKIE = "crewdoc_viewer";
