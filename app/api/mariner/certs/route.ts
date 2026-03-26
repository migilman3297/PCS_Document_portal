import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { CERT_SECTIONS } from "@/lib/certTypes";
import { MARINER_COOKIE, readMarinerUserId } from "@/lib/session";
import { ensureCertTemplates, readStore } from "@/lib/store";
import {
  mergedBilletOptions,
  mergedShipOptions,
} from "@/lib/viewerAssignment";

export async function GET() {
  const jar = await cookies();
  const userId = readMarinerUserId(jar.get(MARINER_COOKIE)?.value);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const store = await readStore();
  ensureCertTemplates(store);
  const user = store.users.find((u) => u.id === userId);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const docs = store.documents
    .filter((d) => d.userId === userId)
    .sort(
      (a, b) =>
        new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
    );
  return NextResponse.json({
    certSections: CERT_SECTIONS,
    certTypes: store.certTemplates!,
    shipOptions: mergedShipOptions(store),
    billetOptions: mergedBilletOptions(store),
    documents: docs,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      assignedShip: user.assignedShip?.trim() || null,
      assignedBillet: user.assignedBillet?.trim() || null,
    },
  });
}
