import { randomBytes, scryptSync, timingSafeEqual } from "crypto";

const SALT_LEN = 16;
const KEY_LEN = 32;

export function hashPassword(plain: string): string {
  const salt = randomBytes(SALT_LEN);
  const key = scryptSync(plain, salt, KEY_LEN);
  return `${salt.toString("base64")}:${key.toString("base64")}`;
}

export function verifyPassword(plain: string, stored: string): boolean {
  const parts = stored.split(":");
  if (parts.length !== 2) return false;
  const [saltB64, keyB64] = parts;
  const salt = Buffer.from(saltB64, "base64");
  const expected = Buffer.from(keyB64, "base64");
  const key = scryptSync(plain, salt, KEY_LEN);
  if (key.length !== expected.length) return false;
  return timingSafeEqual(key, expected);
}
