import { createHash } from "crypto";

function uuidV4LikeFromHash(namespace: string): string {
  const h = createHash("sha256").update(namespace).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
}

/** Deterministic per login — required when many serverless instances each seed their own store. */
export function stableOfficeAccountId(login: string): string {
  const l = login.trim().toLowerCase();
  return uuidV4LikeFromHash(`crewdoc:office-account:v1:${l}`);
}

/** Deterministic per email — session cookie stays valid across instances with a shared DB. */
export function stableMarinerUserId(email: string): string {
  const e = email.trim().toLowerCase();
  return uuidV4LikeFromHash(`crewdoc:mariner-user:v1:${e}`);
}
