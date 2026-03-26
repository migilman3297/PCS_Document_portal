import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { VIEWER_COOKIE, readViewerOfficeAccountId } from "@/lib/session";
import type { DataStore, OfficeAccount, User } from "@/lib/store";
import { readStore } from "@/lib/store";

export function marinerVisibleToOfficeAccount(
  mariner: User,
  account: OfficeAccount
): boolean {
  if (account.role === "admin") return true;
  const ship = mariner.assignedShip?.trim();
  if (!ship) return false;
  return account.allowedShips.includes(ship);
}

export function officeAccountCanAccessMarinerUserId(
  store: DataStore,
  account: OfficeAccount,
  marinerUserId: string
): boolean {
  const mariner = store.users.find((u) => u.id === marinerUserId);
  if (!mariner) return false;
  return marinerVisibleToOfficeAccount(mariner, account);
}

export async function requireViewerAccount(): Promise<
  | { ok: true; account: OfficeAccount; store: DataStore }
  | { ok: false; response: NextResponse }
> {
  const jar = await cookies();
  const id = readViewerOfficeAccountId(jar.get(VIEWER_COOKIE)?.value);
  if (!id) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  const store = await readStore();
  const account = store.officeAccounts?.find((a) => a.id === id);
  if (!account) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  return { ok: true, account, store };
}

export async function requireViewerAdmin(): Promise<
  | { ok: true; account: OfficeAccount; store: DataStore }
  | { ok: false; response: NextResponse }
> {
  const r = await requireViewerAccount();
  if (!r.ok) return r;
  if (r.account.role !== "admin") {
    return {
      ok: false,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }
  return r;
}
