import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { hashPassword } from "@/lib/password";
import { normalizeCoordinatorAllowedShips } from "@/lib/viewerAssignment";
import { requireViewerAccount } from "@/lib/viewerAccess";
import { writeStore } from "@/lib/store";

export async function GET() {
  const auth = await requireViewerAccount();
  if (!auth.ok) return auth.response;
  if (auth.account.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const list = auth.store.officeAccounts.map((a) => ({
    id: a.id,
    login: a.login,
    role: a.role,
    allowedShips: a.allowedShips,
  }));
  return NextResponse.json({ accounts: list });
}

export async function POST(req: Request) {
  const auth = await requireViewerAccount();
  if (!auth.ok) return auth.response;
  if (auth.account.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  let body: { login?: string; password?: string; allowedShips?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const login = String(body.login ?? "")
    .trim()
    .toLowerCase();
  const password = String(body.password ?? "");
  const allowedShips = normalizeCoordinatorAllowedShips(
    body.allowedShips,
    auth.store,
  );
  if (!login || !password) {
    return NextResponse.json(
      { error: "Username and password are required." },
      { status: 400 }
    );
  }
  if (password.length < 8) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters." },
      { status: 400 }
    );
  }
  if (allowedShips === null) {
    return NextResponse.json(
      { error: "allowedShips must be an array of valid vessel names." },
      { status: 400 }
    );
  }
  if (allowedShips.length === 0) {
    return NextResponse.json(
      {
        error:
          "Select at least one vessel, or use an admin account for full access.",
      },
      { status: 400 }
    );
  }
  if (auth.store.officeAccounts.some((a) => a.login === login)) {
    return NextResponse.json(
      { error: "That username is already in use." },
      { status: 409 }
    );
  }
  const created = {
    id: randomUUID(),
    login,
    passwordHash: hashPassword(password),
    role: "coordinator" as const,
    allowedShips,
  };
  auth.store.officeAccounts.push(created);
  await writeStore(auth.store);
  return NextResponse.json({
    account: {
      id: created.id,
      login: created.login,
      role: created.role,
      allowedShips: created.allowedShips,
    },
  });
}
