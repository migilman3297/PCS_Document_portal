const ALLOWED = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

/** Browsers often omit `file.type` or use `application/octet-stream` for PDFs/images. */
export function resolveAllowedUploadMime(file: File): {
  mimeType: string;
  ok: boolean;
} {
  let raw = (file.type ?? "").trim().toLowerCase();
  if (raw === "image/jpg") raw = "image/jpeg";

  if (!raw || raw === "application/octet-stream") {
    const n = file.name.toLowerCase();
    if (n.endsWith(".pdf")) raw = "application/pdf";
    else if (n.endsWith(".jpg") || n.endsWith(".jpeg")) raw = "image/jpeg";
    else if (n.endsWith(".png")) raw = "image/png";
    else if (n.endsWith(".webp")) raw = "image/webp";
  }

  if (!raw) {
    return { mimeType: "application/octet-stream", ok: false };
  }

  return {
    mimeType: raw === "image/jpg" ? "image/jpeg" : raw,
    ok: ALLOWED.has(raw === "image/jpg" ? "image/jpeg" : raw),
  };
}

export function allowedUploadMimeErrorMessage(): string {
  return "Only PDF and images (JPEG, PNG, WebP) are allowed.";
}
