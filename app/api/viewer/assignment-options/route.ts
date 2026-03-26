import { NextResponse } from "next/server";
import {
  mergedBilletOptions,
  mergedShipOptions,
  normalizeAssignmentOptionList,
} from "@/lib/viewerAssignment";
import { requireViewerAdmin } from "@/lib/viewerAccess";
import { writeStore } from "@/lib/store";

export async function GET() {
  const r = await requireViewerAdmin();
  if (!r.ok) return r.response;
  const store = r.store;
  return NextResponse.json({
    shipOptions: mergedShipOptions(store),
    billetOptions: mergedBilletOptions(store),
  });
}

export async function PATCH(req: Request) {
  const r = await requireViewerAdmin();
  if (!r.ok) return r.response;
  let body: { shipOptions?: unknown; billetOptions?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (body.shipOptions !== undefined) {
    if (!Array.isArray(body.shipOptions)) {
      return NextResponse.json(
        { error: "shipOptions must be an array of strings." },
        { status: 400 },
      );
    }
    const ships = normalizeAssignmentOptionList(body.shipOptions as string[]);
    if (ships.length === 0) {
      return NextResponse.json(
        { error: "Keep at least one vessel in the list." },
        { status: 400 },
      );
    }
    r.store.assignmentShips = ships;
  }
  if (body.billetOptions !== undefined) {
    if (!Array.isArray(body.billetOptions)) {
      return NextResponse.json(
        { error: "billetOptions must be an array of strings." },
        { status: 400 },
      );
    }
    const billets = normalizeAssignmentOptionList(
      body.billetOptions as string[],
    );
    if (billets.length === 0) {
      return NextResponse.json(
        { error: "Keep at least one billet in the list." },
        { status: 400 },
      );
    }
    r.store.assignmentBillets = billets;
  }
  if (body.shipOptions === undefined && body.billetOptions === undefined) {
    return NextResponse.json(
      { error: "Send shipOptions and/or billetOptions arrays." },
      { status: 400 },
    );
  }
  await writeStore(r.store);
  return NextResponse.json({
    shipOptions: mergedShipOptions(r.store),
    billetOptions: mergedBilletOptions(r.store),
  });
}
