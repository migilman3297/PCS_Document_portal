import path from "path";
import { readFile, stat } from "fs/promises";
import { NextResponse } from "next/server";
import {
  officeAccountCanAccessMarinerUserId,
  requireViewerAccount,
} from "@/lib/viewerAccess";
import { uploadsRoot } from "@/lib/store";

type Params = { docId: string };

export async function GET(
  _req: Request,
  context: { params: Promise<Params> }
) {
  const auth = await requireViewerAccount();
  if (!auth.ok) return auth.response;
  const { docId } = await context.params;
  const doc = auth.store.documents.find((d) => d.id === docId);
  if (!doc) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (
    !officeAccountCanAccessMarinerUserId(
      auth.store,
      auth.account,
      doc.userId
    )
  ) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const fullPath = path.join(uploadsRoot(), doc.relativePath);
  try {
    const st = await stat(fullPath);
    if (!st.isFile()) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await readFile(fullPath);
  const headers = new Headers();
  headers.set("Content-Type", doc.mimeType);
  headers.set(
    "Content-Disposition",
    `inline; filename="${encodeURIComponent(doc.originalName)}"`
  );

  return new NextResponse(body, { headers });
}
