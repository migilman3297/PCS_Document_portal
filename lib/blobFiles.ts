import { del, get, put } from "@vercel/blob";

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
    access: "private",
    token: process.env.BLOB_READ_WRITE_TOKEN,
    contentType: mimeType || "application/octet-stream",
    addRandomSuffix: false,
    allowOverwrite: true,
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
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  try {
    if (token) {
      const r = await get(url, {
        access: "private",
        token,
      });
      if (r?.statusCode === 200 && r.stream) {
        return Buffer.from(await new Response(r.stream).arrayBuffer());
      }
    }
    const res = await fetch(url);
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch {
    return null;
  }
}
