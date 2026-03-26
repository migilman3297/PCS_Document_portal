import path from "path";
import { readFile, stat } from "fs/promises";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { MARINER_COOKIE, readMarinerUserId } from "@/lib/session";
import { readStore, uploadsRoot } from "@/lib/store";

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
    `inline; filename="${encodeURIComponent(doc.originalName)}"`,
  );

  return new NextResponse(body, { headers });
}
