import path from "path";
import { readFile, stat, unlink } from "fs/promises";
import type { StoredDocument } from "./store";
import { uploadsRoot } from "./store";
import { deleteBlobUrl, fetchBlobBytes, isBlobFilesEnabled } from "./blobFiles";

export async function readDocumentFileBytes(
  doc: StoredDocument,
): Promise<Buffer | null> {
  if (doc.blobUrl) {
    return fetchBlobBytes(doc.blobUrl);
  }
  const fullPath = path.join(uploadsRoot(), doc.relativePath);
  try {
    const st = await stat(fullPath);
    if (!st.isFile()) return null;
    return readFile(fullPath);
  } catch {
    return null;
  }
}

export async function deleteDocumentFile(doc: StoredDocument): Promise<void> {
  if (doc.blobUrl && isBlobFilesEnabled()) {
    await deleteBlobUrl(doc.blobUrl);
    return;
  }
  const fullPath = path.join(uploadsRoot(), doc.relativePath);
  try {
    await unlink(fullPath);
  } catch {
    /* missing */
  }
}
