import { NextResponse } from "next/server";
import { hashPassword } from "@/lib/password";
import { normalizeCoordinatorAllowedShips } from "@/lib/viewerAssignment";
import { requireViewerAccount } from "@/lib/viewerAccess";
import { writeStore } from "@/lib/store";

type Params = { accountId: string };

export async function PATCH(
  req: Request,
  context: { params: Promise<Params> }
) {
  const auth = await requireViewerAccount();
  if (!auth.ok) return auth.response;
  if (auth.account.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { accountId } = await context.params;
  const target = auth.store.officeAccounts.find((a) => a.id === accountId);
  if (!target) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  let body: { allowedShips?: unknown; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (body.allowedShips !== undefined) {
    if (target.role === "admin") {
      return NextResponse.json(
        { error: "Admin access is global; allowedShips is not used." },
        { status: 400 }
      );
    }
    const ships = normalizeCoordinatorAllowedShips(
      body.allowedShips,
      auth.store,
    );
    if (ships === null) {
      return NextResponse.json(
        { error: "allowedShips must be an array of valid vessel names." },
        { status: 400 }
      );
    }
    if (ships.length === 0) {
      return NextResponse.json(
        { error: "Coordinators need at least one assigned vessel." },
        { status: 400 }
      );
    }
    target.allowedShips = ships;
  }

  let passwordUpdated = false;
  if (body.password !== undefined) {
    const password = String(body.password ?? "");
    if (password.length > 0) {
      if (password.length < 8) {
        return NextResponse.json(
          { error: "Password must be at least 8 characters." },
          { status: 400 }
        );
      }
      target.passwordHash = hashPassword(password);
      passwordUpdated = true;
    }
  }

  const shipsUpdated = body.allowedShips !== undefined;
  if (!shipsUpdated && !passwordUpdated) {
    return NextResponse.json(
      { error: "Nothing to update (allowedShips or password)." },
      { status: 400 }
    );
  }

  await writeStore(auth.store);
  return NextResponse.json({
    account: {
      id: target.id,
      login: target.login,
      role: target.role,
      allowedShips: target.allowedShips,
    },
  });
}
