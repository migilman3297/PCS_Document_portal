import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { readDocumentFileBytes } from "@/lib/documentFiles";
import { MARINER_COOKIE, readMarinerUserId } from "@/lib/session";
import { readStore } from "@/lib/store";

type Params = { docId: string };

export async function GET(
  _req: Request,
  context: { params: Promise<Params> },
) {
  const jar = await cookies();
  const userId = readMarinerUserId(jar.get(MARINER_COOKIE)?.value);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const store = await readStore();
  const { docId } = await context.params;
  const doc = store.documents.find((d) => d.id === docId && d.userId === userId);
  if (!doc) {
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
    `inline; filename="${encodeURIComponent(doc.originalName)}"`,
  );

  return new NextResponse(new Uint8Array(body), { headers });
}
