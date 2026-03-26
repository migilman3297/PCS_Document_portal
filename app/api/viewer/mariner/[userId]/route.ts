import { NextResponse } from "next/server";
import { deleteDocumentFile } from "@/lib/documentFiles";
import {
  isAllowedViewerBillet,
  isAllowedViewerShip,
} from "@/lib/viewerAssignment";
import {
  officeAccountCanAccessMarinerUserId,
  requireViewerAccount,
} from "@/lib/viewerAccess";
import { writeStore } from "@/lib/store";

type Params = { userId: string };

export async function PATCH(
  req: Request,
  context: { params: Promise<Params> }
) {
  const auth = await requireViewerAccount();
  if (!auth.ok) return auth.response;
  const { userId } = await context.params;
  if (!officeAccountCanAccessMarinerUserId(auth.store, auth.account, userId)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
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
  if (!isAllowedViewerShip(assignedShip, auth.store)) {
    return NextResponse.json({ error: "Invalid ship" }, { status: 400 });
  }
  if (!isAllowedViewerBillet(assignedBillet, auth.store)) {
    return NextResponse.json({ error: "Invalid billet" }, { status: 400 });
  }
  const user = auth.store.users.find((u) => u.id === userId);
  if (!user) {
    return NextResponse.json({ error: "Mariner not found" }, { status: 404 });
  }
  if (assignedShip.length === 0) delete user.assignedShip;
  else user.assignedShip = assignedShip;
  if (assignedBillet.length === 0) delete user.assignedBillet;
  else user.assignedBillet = assignedBillet;
  await writeStore(auth.store);
  return NextResponse.json({
    ok: true,
    assignedShip: user.assignedShip ?? null,
    assignedBillet: user.assignedBillet ?? null,
  });
}

export async function DELETE(
  _req: Request,
  context: { params: Promise<Params> },
) {
  const auth = await requireViewerAccount();
  if (!auth.ok) return auth.response;
  const { userId } = await context.params;
  if (!officeAccountCanAccessMarinerUserId(auth.store, auth.account, userId)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const userIdx = auth.store.users.findIndex((u) => u.id === userId);
  if (userIdx === -1) {
    return NextResponse.json({ error: "Mariner not found" }, { status: 404 });
  }
  const docsToRemove = auth.store.documents.filter((d) => d.userId === userId);
  for (const d of docsToRemove) {
    await deleteDocumentFile(d);
  }
  auth.store.documents = auth.store.documents.filter(
    (d) => d.userId !== userId,
  );
  auth.store.users.splice(userIdx, 1);
  await writeStore(auth.store);
  return NextResponse.json({ ok: true });
}
