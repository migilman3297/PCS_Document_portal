import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { addCalendarYears } from "@/lib/certExpiry";
import { certTypeByKeyFromList } from "@/lib/certTypes";
import { parseIsoDateOnly } from "@/lib/dateOnly";
import { deleteDocumentFile } from "@/lib/documentFiles";
import { MARINER_COOKIE, readMarinerUserId } from "@/lib/session";
import { ensureCertTemplates, readStore, writeStore } from "@/lib/store";

type Params = { docId: string };

async function getOwnedDoc(docId: string) {
  const jar = await cookies();
  const userId = readMarinerUserId(jar.get(MARINER_COOKIE)?.value);
  if (!userId) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  const store = await readStore();
  ensureCertTemplates(store);
  const doc = store.documents.find(
    (d) => d.id === docId && d.userId === userId,
  );
  if (!doc) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Not found" }, { status: 404 }),
    };
  }
  return { ok: true as const, store, doc, userId };
}

export async function DELETE(
  _req: Request,
  context: { params: Promise<Params> },
) {
  const { docId } = await context.params;
  const r = await getOwnedDoc(docId);
  if (!r.ok) return r.response;

  await deleteDocumentFile(r.doc);

  r.store.documents = r.store.documents.filter((d) => d.id !== docId);
  await writeStore(r.store);

  return NextResponse.json({ ok: true });
}

export async function PATCH(
  req: Request,
  context: { params: Promise<Params> },
) {
  const { docId } = await context.params;
  const r = await getOwnedDoc(docId);
  if (!r.ok) return r.response;

  const certMeta = certTypeByKeyFromList(r.doc.certKey, r.store.certTemplates!);
  if (!certMeta) {
    return NextResponse.json(
      { error: "Unknown certificate type." },
      { status: 400 },
    );
  }

  let body: {
    certificateDate?: string;
    customTitle?: string;
    certificateIssuedDate?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (certMeta.requiresCustomTitle) {
    if (body.customTitle !== undefined) {
      const nextTitle = String(body.customTitle ?? "").trim();
      if (!nextTitle) {
        return NextResponse.json(
          { error: "Document title cannot be empty." },
          { status: 400 },
        );
      }
      r.doc.customTitle = nextTitle;
    }
    const raw = String(body.certificateDate ?? "").trim();
    if (!raw) {
      r.doc.expiresAt = null;
    } else {
      const parsed = parseIsoDateOnly(raw);
      if (!parsed) {
        return NextResponse.json(
          { error: "Invalid date. Use YYYY-MM-DD." },
          { status: 400 },
        );
      }
      r.doc.expiresAt = parsed;
    }
    await writeStore(r.store);
      return NextResponse.json({ document: r.doc });
  }

  if (certMeta.section === "training" && !certMeta.requiresExpiry) {
    if (body.certificateIssuedDate !== undefined) {
      const raw = String(body.certificateIssuedDate ?? "").trim();
      if (!raw) {
        r.doc.certificateIssuedDate = null;
      } else {
        const parsed = parseIsoDateOnly(raw);
        if (!parsed) {
          return NextResponse.json(
            { error: "Invalid date. Use YYYY-MM-DD." },
            { status: 400 },
          );
        }
        r.doc.certificateIssuedDate = parsed;
      }
    }
    r.doc.expiresAt = null;
    await writeStore(r.store);
    return NextResponse.json({ document: r.doc });
  }

  if (!certMeta.requiresExpiry) {
    r.doc.expiresAt = null;
    await writeStore(r.store);
    return NextResponse.json({ document: r.doc });
  }

  const raw = String(body.certificateDate ?? "").trim();
  if (!raw) {
    return NextResponse.json(
      {
        error:
          certMeta.validityYears != null
            ? "Certificate date is required."
            : "Expiration date is required.",
      },
      { status: 400 },
    );
  }

  let expiresAt: string | null = null;
  if (certMeta.validityYears != null) {
    expiresAt = addCalendarYears(raw, certMeta.validityYears);
  } else {
    expiresAt = parseIsoDateOnly(raw);
  }

  if (!expiresAt) {
    return NextResponse.json(
      { error: "Invalid date. Use YYYY-MM-DD." },
      { status: 400 },
    );
  }

  r.doc.expiresAt = expiresAt;
  await writeStore(r.store);

  return NextResponse.json({ document: r.doc });
}
