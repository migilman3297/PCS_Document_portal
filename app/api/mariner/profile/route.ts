import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  isAllowedViewerBillet,
  isAllowedViewerShip,
} from "@/lib/viewerAssignment";
import { MARINER_COOKIE, readMarinerUserId } from "@/lib/session";
import { readStore, writeStore } from "@/lib/store";

export async function PATCH(req: Request) {
  const jar = await cookies();
  const userId = readMarinerUserId(jar.get(MARINER_COOKIE)?.value);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const o = body as Record<string, unknown>;
  if (
    typeof o.assignedShip !== "string" ||
    typeof o.assignedBillet !== "string"
  ) {
    return NextResponse.json(
      {
        error:
          "Body must include assignedShip and assignedBillet (empty string clears).",
      },
      { status: 400 }
    );
  }
  const assignedShip = o.assignedShip.trim();
  const assignedBillet = o.assignedBillet.trim();
  const store = await readStore();
  if (!isAllowedViewerShip(assignedShip, store)) {
    return NextResponse.json({ error: "Invalid vessel." }, { status: 400 });
  }
  if (!isAllowedViewerBillet(assignedBillet, store)) {
    return NextResponse.json({ error: "Invalid billet." }, { status: 400 });
  }
  const user = store.users.find((u) => u.id === userId);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (assignedShip.length === 0) delete user.assignedShip;
  else user.assignedShip = assignedShip;
  if (assignedBillet.length === 0) delete user.assignedBillet;
  else user.assignedBillet = assignedBillet;
  await writeStore(store);
  return NextResponse.json({
    ok: true,
    assignedShip: user.assignedShip ?? null,
    assignedBillet: user.assignedBillet ?? null,
  });
}
