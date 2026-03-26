import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { deleteBlobUrl, isBlobFilesEnabled, putMarinerUpload } from "@/lib/blobFiles";
import { certTypeByKeyFromList } from "@/lib/certTypes";
import { parseIsoDateOnly } from "@/lib/dateOnly";
import { MARINER_COOKIE, readMarinerUserId } from "@/lib/session";
import { ensureCertTemplates, readStore, uploadsRoot, writeStore } from "@/lib/store";
import {
  allowedUploadMimeErrorMessage,
  resolveAllowedUploadMime,
} from "@/lib/uploadMime";

/** Vercel serverless request bodies are capped (~4.5 MB hobby); stay under that. */
const MAX_BYTES = 4 * 1024 * 1024;

export async function POST(req: Request) {
  const jar = await cookies();
  const userId = readMarinerUserId(jar.get(MARINER_COOKIE)?.value);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const store = await readStore();
  ensureCertTemplates(store);
  if (!store.users.some((u) => u.id === userId)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json(
      {
        error:
          "The upload could not be read. On Vercel, request bodies are limited to about 4.5 MB—try a smaller PDF or image.",
      },
      { status: 400 },
    );
  }
  const certKey = String(formData.get("certKey") ?? "");
  const file = formData.get("file");
  const certMeta = certTypeByKeyFromList(certKey, store.certTemplates!);
  if (!certMeta) {
    return NextResponse.json({ error: "Unknown certificate type." }, { status: 400 });
  }
  const customTitleRaw = String(formData.get("customTitle") ?? "").trim();
  let customTitle: string | null = null;
  if (certMeta.requiresCustomTitle) {
    if (!customTitleRaw) {
      return NextResponse.json(
        { error: "Enter a document title." },
        { status: 400 },
      );
    }
    customTitle = customTitleRaw;
  } else if (customTitleRaw) {
    return NextResponse.json(
      { error: "Custom document name is only for additional documents." },
      { status: 400 },
    );
  }
  const expiresRaw = String(formData.get("expiresAt") ?? "").trim();
  let expiresAt: string | null = null;
  if (certMeta.requiresExpiry) {
    const parsed = parseIsoDateOnly(expiresRaw);
    if (!parsed) {
      return NextResponse.json(
        { error: "Enter a valid date (YYYY-MM-DD) for this certificate." },
        { status: 400 }
      );
    }
    expiresAt = parsed;
  } else if (certMeta.requiresCustomTitle && expiresRaw) {
    const parsed = parseIsoDateOnly(expiresRaw);
    if (!parsed) {
      return NextResponse.json(
        { error: "Invalid expiration date format. Use YYYY-MM-DD or leave blank." },
        { status: 400 }
      );
    }
    expiresAt = parsed;
  }

  const issueRaw = String(formData.get("certificateIssuedDate") ?? "").trim();
  let certificateIssuedDate: string | null = null;
  if (certMeta.section === "training" && !certMeta.requiresExpiry) {
    if (issueRaw) {
      const parsed = parseIsoDateOnly(issueRaw);
      if (!parsed) {
        return NextResponse.json(
          {
            error:
              "Invalid certificate date. Use YYYY-MM-DD or leave certificate fields blank.",
          },
          { status: 400 },
        );
      }
      certificateIssuedDate = parsed;
    }
  } else if (issueRaw) {
    return NextResponse.json(
      { error: "Certificate date is not used for this upload type." },
      { status: 400 },
    );
  }
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Choose a file to upload." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: `File too large (max ${MAX_BYTES / 1024 / 1024} MB).` },
      { status: 400 }
    );
  }
  const { mimeType, ok: mimeOk } = resolveAllowedUploadMime(file);
  if (!mimeOk) {
    return NextResponse.json({ error: allowedUploadMimeErrorMessage() }, { status: 400 });
  }

  const docId = randomUUID();
  const safeBase = file.name.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 80);
  const storedFileName = `${docId}_${safeBase || "upload"}`;
  let buf: Buffer;
  try {
    buf = Buffer.from(await file.arrayBuffer());
  } catch {
    return NextResponse.json(
      { error: "Could not read the uploaded file. Try a smaller file or a different browser." },
      { status: 400 },
    );
  }
  let relativePath: string;
  let blobUrl: string | undefined;
  try {
    if (isBlobFilesEnabled()) {
      const put = await putMarinerUpload(userId, storedFileName, buf, mimeType);
      relativePath = put.relativePath;
      blobUrl = put.blobUrl;
    } else {
      const userDir = path.join(uploadsRoot(), userId);
      await mkdir(userDir, { recursive: true });
      const fullPath = path.join(userDir, storedFileName);
      await writeFile(fullPath, buf);
      relativePath = path.join(userId, storedFileName).replace(/\\/g, "/");
    }

    store.documents.push({
      id: docId,
      userId,
      certKey,
      relativePath,
      ...(blobUrl ? { blobUrl } : {}),
      originalName: file.name,
      mimeType,
      uploadedAt: new Date().toISOString(),
      expiresAt,
      certificateIssuedDate,
      customTitle,
    });
    await writeStore(store);
  } catch (err) {
    if (blobUrl) await deleteBlobUrl(blobUrl);
    const message =
      err instanceof Error ? err.message : "Upload could not be completed.";
    console.error("[mariner/upload]", err);
    return NextResponse.json(
      {
        error:
          message.length > 0 && message.length < 200
            ? message
            : "Upload failed (storage). Check Vercel Blob token and logs.",
      },
      { status: 502 },
    );
  }

  return NextResponse.json({
    document: store.documents[store.documents.length - 1],
  });
}
