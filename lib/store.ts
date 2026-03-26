import { randomUUID } from "crypto";
import { mkdir, readFile, writeFile } from "fs/promises";
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

const DATA_DIR = path.join(process.cwd(), "data");
const STORE_PATH = path.join(DATA_DIR, "store.json");

export function uploadsRoot(): string {
  return path.join(DATA_DIR, "uploads");
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
  await ensureDataDir();
  try {
    const raw = await readFile(STORE_PATH, "utf-8");
    const parsed = JSON.parse(raw) as DataStore;
    if (!parsed.users) parsed.users = [];
    if (!parsed.documents) parsed.documents = [];
    if (!Array.isArray(parsed.officeAccounts)) parsed.officeAccounts = [];

    let mutated = false;
    if (parsed.officeAccounts.length === 0) {
      const login = (process.env.OFFICE_ADMIN_LOGIN ?? "admin")
        .trim()
        .toLowerCase();
      const password = process.env.OFFICE_ADMIN_PASSWORD ?? "changeme";
      parsed.officeAccounts.push({
        id: randomUUID(),
        login,
        passwordHash: hashPassword(password),
        role: "admin",
        allowedShips: [],
      });
      mutated = true;
    }
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
    ensureCertTemplates(parsed);
    ensureAssignmentLists(parsed);
    return parsed;
  }
}

export async function writeStore(store: DataStore): Promise<void> {
  await ensureDataDir();
  await writeFile(STORE_PATH, JSON.stringify(store, null, 2), "utf-8");
}
