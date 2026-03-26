import { createHash } from "crypto";
import { cp, mkdir, readFile, rm, stat, writeFile } from "fs/promises";
import path from "path";
import type { CertType } from "./certTypes";
import { DEFAULT_CERT_TYPES } from "./certTypes";
import { hashPassword } from "./password";
import { ensureAssignmentLists } from "./viewerAssignment";

export type OfficeAccountRole = "admin" | "coordinator";

export type OfficeAccount = {
  id: string;
  login: string;
  passwordHash: string;
  role: OfficeAccountRole;
  allowedShips: string[];
};

export type User = {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  createdAt: string;
  assignedShip?: string | null;
  assignedBillet?: string | null;
};

export type StoredDocument = {
  id: string;
  userId: string;
  certKey: string;
  relativePath: string;
  originalName: string;
  mimeType: string;
  uploadedAt: string;
  expiresAt?: string | null;
  /** Optional completion / issue date (e.g. one-time training). YYYY-MM-DD. */
  certificateIssuedDate?: string | null;
  /** Mariner-provided label (additional documents). */
  customTitle?: string | null;
};

export type DataStore = {
  users: User[];
  documents: StoredDocument[];
  officeAccounts: OfficeAccount[];
  /** Mariner upload checklist; seeded from defaults when missing or empty. */
  certTemplates?: CertType[];
  /** Full vessel dropdown list (order preserved); seeded on first read if missing. */
  assignmentShips?: string[];
  /** Full billet dropdown list (order preserved); seeded on first read if missing. */
  assignmentBillets?: string[];
};

/** Vercel serverless is read-only except `/tmp`; local file store must live there. */
function dataDir(): string {
  if (process.env.VERCEL) return path.join("/tmp", "crewdoc-data");
  return path.join(process.cwd(), "data");
}

const DATA_DIR = dataDir();
const STORE_PATH = path.join(DATA_DIR, "store.json");

/** Shipped with the repo for Vercel: copy into /tmp on first cold start (see `seed/` folder). */
const SEED_DIR = path.join(process.cwd(), "seed");
const SEED_STORE_PATH = path.join(SEED_DIR, "store.json");
const SEED_UPLOADS_DIR = path.join(SEED_DIR, "uploads");

/**
 * When hosted on Vercel, the live store is under `/tmp` and starts empty.
 * If you commit `seed/store.json` (and optionally `seed/uploads/`), we hydrate `/tmp` once per instance.
 */
async function bootstrapFromSeedIfNeeded(): Promise<void> {
  if (!process.env.VERCEL) return;
  try {
    await readFile(STORE_PATH, "utf-8");
    return;
  } catch {
    /* no runtime store yet */
  }
  let raw: string;
  try {
    raw = await readFile(SEED_STORE_PATH, "utf-8");
  } catch {
    return;
  }
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(STORE_PATH, raw, "utf-8");
  try {
    const st = await stat(SEED_UPLOADS_DIR);
    if (!st.isDirectory()) return;
    await rm(uploadsRoot(), { recursive: true, force: true });
    await cp(SEED_UPLOADS_DIR, uploadsRoot(), { recursive: true });
  } catch {
    await mkdir(uploadsRoot(), { recursive: true });
  }
}

/**
 * Env-seeded admin must use a stable id: each Vercel invocation has its own `/tmp`
 * store, and the session cookie stores this id — randomUUID() per instance would
 * make the next API request fail `requireViewerAccount` and bounce to login.
 */
function stableSeededOfficeAccountId(login: string): string {
  const h = createHash("sha256")
    .update(`crewdoc:office-account:v1:${login.toLowerCase()}`)
    .digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
}

function seedOfficeAdminIfEmpty(store: DataStore): boolean {
  if (store.officeAccounts.length > 0) return false;
  const login = (process.env.OFFICE_ADMIN_LOGIN ?? "admin").trim().toLowerCase();
  const password = process.env.OFFICE_ADMIN_PASSWORD ?? "changeme";
  store.officeAccounts.push({
    id: stableSeededOfficeAccountId(login),
    login,
    passwordHash: hashPassword(password),
    role: "admin",
    allowedShips: [],
  });
  return true;
}

export function uploadsRoot(): string {
  return path.join(dataDir(), "uploads");
}

async function ensureDataDir(): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  await mkdir(uploadsRoot(), { recursive: true });
}

const emptyStore = (): DataStore => ({
  users: [],
  documents: [],
  officeAccounts: [],
});

/** Ensures `certTemplates` exists; returns true if the store was mutated. */
export function ensureCertTemplates(store: DataStore): boolean {
  if (!Array.isArray(store.certTemplates) || store.certTemplates.length === 0) {
    store.certTemplates = structuredClone(DEFAULT_CERT_TYPES);
    return true;
  }
  return false;
}

/** One-time merge of legacy marinerShip/marinerBillet into assigned*; drops old keys. */
export function migrateLegacyMarinerVesselFields(store: DataStore): boolean {
  let mutated = false;
  for (const u of store.users) {
    const legacy = u as User & {
      marinerShip?: string | null;
      marinerBillet?: string | null;
    };
    const ms = legacy.marinerShip?.trim();
    const mb = legacy.marinerBillet?.trim();
    if (!u.assignedShip?.trim() && ms) {
      u.assignedShip = ms;
      mutated = true;
    }
    if (!u.assignedBillet?.trim() && mb) {
      u.assignedBillet = mb;
      mutated = true;
    }
    const rec = u as Record<string, unknown>;
    if ("marinerShip" in rec) {
      delete rec.marinerShip;
      mutated = true;
    }
    if ("marinerBillet" in rec) {
      delete rec.marinerBillet;
      mutated = true;
    }
  }
  return mutated;
}

export async function readStore(): Promise<DataStore> {
  await mkdir(DATA_DIR, { recursive: true });
  await bootstrapFromSeedIfNeeded();
  await ensureDataDir();
  try {
    const raw = await readFile(STORE_PATH, "utf-8");
    const parsed = JSON.parse(raw) as DataStore;
    if (!parsed.users) parsed.users = [];
    if (!parsed.documents) parsed.documents = [];
    if (!Array.isArray(parsed.officeAccounts)) parsed.officeAccounts = [];

    let mutated = seedOfficeAdminIfEmpty(parsed);
    const seededCerts = ensureCertTemplates(parsed);
    if (seededCerts) mutated = true;
    if (migrateLegacyMarinerVesselFields(parsed)) mutated = true;
    if (ensureAssignmentLists(parsed)) mutated = true;
    if (mutated) {
      await writeFile(STORE_PATH, JSON.stringify(parsed, null, 2), "utf-8");
    }
    return parsed;
  } catch {
    const parsed = emptyStore();
    let mutated = false;
    if (ensureCertTemplates(parsed)) mutated = true;
    if (ensureAssignmentLists(parsed)) mutated = true;
    if (seedOfficeAdminIfEmpty(parsed)) mutated = true;
    if (mutated) {
      try {
        await writeFile(STORE_PATH, JSON.stringify(parsed, null, 2), "utf-8");
      } catch {
        /* e.g. read-only FS without VERCEL /tmp — return in-memory store for this request */
      }
    }
    return parsed;
  }
}

export async function writeStore(store: DataStore): Promise<void> {
  await ensureDataDir();
  await writeFile(STORE_PATH, JSON.stringify(store, null, 2), "utf-8");
}
