import type { DataStore } from "./store";

/** Default vessel names (used when the store has no list yet). */
export const DEFAULT_ASSIGNMENT_SHIPS = [
  "USNS Pililaau",
  "USNS Dahl",
  "USNS Soderman",
] as const;

/** Default billet titles (used when the store has no list yet). */
export const DEFAULT_ASSIGNMENT_BILLETS = [
  "Captain",
  "Chief Mate",
  "2nd Mate",
  "3rd Mate",
] as const;

/** @deprecated Use DEFAULT_ASSIGNMENT_SHIPS */
export const VIEWER_SHIP_OPTIONS = DEFAULT_ASSIGNMENT_SHIPS;
/** @deprecated Use DEFAULT_ASSIGNMENT_BILLETS */
export const VIEWER_BILLET_OPTIONS = DEFAULT_ASSIGNMENT_BILLETS;

const MAX_OPTION_LEN = 120;

type StoreWithLegacy = DataStore & {
  customShips?: string[];
  customBillets?: string[];
};

/** Trim, dedupe (case-insensitive), max length per entry. Preserves first-seen casing. */
export function normalizeAssignmentOptionList(
  raw: string[] | undefined,
): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const s of raw) {
    if (typeof s !== "string") continue;
    const t = s.trim();
    if (!t || t.length > MAX_OPTION_LEN) continue;
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
  }
  return out;
}

/** @deprecated Use normalizeAssignmentOptionList */
export const normalizeCustomOptionList = normalizeAssignmentOptionList;

function legacyMergedShips(store: StoreWithLegacy): string[] {
  const custom = normalizeAssignmentOptionList(store.customShips);
  const used = new Set(
    DEFAULT_ASSIGNMENT_SHIPS.map((s) => s.toLowerCase()),
  );
  const out: string[] = [...DEFAULT_ASSIGNMENT_SHIPS];
  for (const c of custom) {
    const k = c.toLowerCase();
    if (used.has(k)) continue;
    used.add(k);
    out.push(c);
  }
  return out;
}

function legacyMergedBillets(store: StoreWithLegacy): string[] {
  const custom = normalizeAssignmentOptionList(store.customBillets);
  const used = new Set(
    DEFAULT_ASSIGNMENT_BILLETS.map((s) => s.toLowerCase()),
  );
  const out: string[] = [...DEFAULT_ASSIGNMENT_BILLETS];
  for (const c of custom) {
    const k = c.toLowerCase();
    if (used.has(k)) continue;
    used.add(k);
    out.push(c);
  }
  return out;
}

/**
 * Migrates legacy customShips/customBillets into assignmentShips/assignmentBillets.
 * Returns true if the store was mutated (caller should persist).
 */
export function ensureAssignmentLists(store: DataStore): boolean {
  const s = store as StoreWithLegacy;
  let mutated = false;

  const shipsOk =
    Array.isArray(store.assignmentShips) && store.assignmentShips.length > 0;
  if (shipsOk) {
    const before = store.assignmentShips!;
    const normalized = normalizeAssignmentOptionList(before);
    const next =
      normalized.length === 0 ? [...DEFAULT_ASSIGNMENT_SHIPS] : normalized;
    store.assignmentShips = next;
    if (
      next.length !== before.length ||
      next.some((v, i) => v !== before[i])
    ) {
      mutated = true;
    }
  } else {
    store.assignmentShips = legacyMergedShips(s);
    mutated = true;
  }
  if (s.customShips !== undefined) {
    delete s.customShips;
    mutated = true;
  }

  const billetsOk =
    Array.isArray(store.assignmentBillets) &&
    store.assignmentBillets.length > 0;
  if (billetsOk) {
    const before = store.assignmentBillets!;
    const normalized = normalizeAssignmentOptionList(before);
    const next =
      normalized.length === 0 ? [...DEFAULT_ASSIGNMENT_BILLETS] : normalized;
    store.assignmentBillets = next;
    if (
      next.length !== before.length ||
      next.some((v, i) => v !== before[i])
    ) {
      mutated = true;
    }
  } else {
    store.assignmentBillets = legacyMergedBillets(s);
    mutated = true;
  }
  if (s.customBillets !== undefined) {
    delete s.customBillets;
    mutated = true;
  }

  return mutated;
}

/** Ordered vessel names for dropdowns and validation. */
export function mergedShipOptions(store: DataStore): string[] {
  return normalizeAssignmentOptionList(store.assignmentShips);
}

/** Ordered billet names for dropdowns and validation. */
export function mergedBilletOptions(store: DataStore): string[] {
  return normalizeAssignmentOptionList(store.assignmentBillets);
}

export function isAllowedViewerShip(value: string, store: DataStore): boolean {
  if (value === "") return true;
  return mergedShipOptions(store).some(
    (s) => s.toLowerCase() === value.toLowerCase(),
  );
}

export function isAllowedViewerBillet(value: string, store: DataStore): boolean {
  if (value === "") return true;
  return mergedBilletOptions(store).some(
    (s) => s.toLowerCase() === value.toLowerCase(),
  );
}

export function normalizeCoordinatorAllowedShips(
  ships: unknown,
  store: DataStore,
): string[] | null {
  if (!Array.isArray(ships)) return null;
  const merged = mergedShipOptions(store);
  const byLower = new Map(merged.map((s) => [s.toLowerCase(), s] as const));
  const out: string[] = [];
  for (const s of ships) {
    if (typeof s !== "string") return null;
    const canon = byLower.get(s.trim().toLowerCase());
    if (!canon) return null;
    if (!out.includes(canon)) out.push(canon);
  }
  return out;
}
