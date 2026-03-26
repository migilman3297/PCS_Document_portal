import { NextResponse } from "next/server";
import { readDocumentFileBytes } from "@/lib/documentFiles";
import {
  officeAccountCanAccessMarinerUserId,
  requireViewerAccount,
} from "@/lib/viewerAccess";

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
  const body = await readDocumentFileBytes(doc);
  if (!body) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const headers = new Headers();
  headers.set("Content-Type", doc.mimeType);
  headers.set(
    "Content-Disposition",
    `inline; filename="${encodeURIComponent(doc.originalName)}"`
  );

  return new NextResponse(new Uint8Array(body), { headers });
}
