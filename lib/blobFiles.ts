import { del, put } from "@vercel/blob";

export function isBlobFilesEnabled(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

export async function putMarinerUpload(
  userId: string,
  storedFileName: string,
  buf: Buffer,
  mimeType: string,
): Promise<{ blobUrl: string; relativePath: string }> {
  const pathname = `mariner/${userId}/${storedFileName}`;
  const blob = await put(pathname, buf, {
    access: "public",
    token: process.env.BLOB_READ_WRITE_TOKEN,
    contentType: mimeType || "application/octet-stream",
    addRandomSuffix: false,
  });
  return { blobUrl: blob.url, relativePath: pathname };
}

export async function deleteBlobUrl(url: string): Promise<void> {
  if (!isBlobFilesEnabled()) return;
  try {
    await del(url, { token: process.env.BLOB_READ_WRITE_TOKEN });
  } catch {
    /* missing or already deleted */
  }
}

export async function fetchBlobBytes(url: string): Promise<Buffer | null> {
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    return Buffer.from(await r.arrayBuffer());
  } catch {
    return null;
  }
}
