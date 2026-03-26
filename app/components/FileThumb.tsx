/** URL to stream a document through the office session (inline / thumbs). */
export function fileViewUrl(docId: string): string {
  return `/api/viewer/file/${docId}`;
}

export function marinerFileViewUrl(docId: string): string {
  return `/api/mariner/file/${docId}`;
}

export function FileThumb({
  docId,
  mimeType,
  viewUrl,
}: {
  docId: string;
  mimeType: string;
  /** Defaults to office viewer URL. */
  viewUrl?: string;
}) {
  const mt = mimeType || "application/octet-stream";
  const isImage = mt.startsWith("image/");
  const url = viewUrl ?? fileViewUrl(docId);

  if (isImage) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt=""
        className="h-14 w-14 shrink-0 rounded-lg border border-white/10 object-cover"
      />
    );
  }

  const short = mt.includes("pdf") ? "PDF" : "FILE";
  return (
    <div
      className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-black/50 text-[10px] font-semibold tracking-wide text-slate-400"
      aria-hidden
    >
      {short}
    </div>
  );
}
