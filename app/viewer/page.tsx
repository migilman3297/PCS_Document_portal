"use client";

import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { FileThumb, fileViewUrl } from "@/app/components/FileThumb";
import {
  autoRenewalPeriodicityLabel,
  CERT_SECTIONS,
  sortCertTypesByDefaultSectionOrder,
  type CertSectionKey,
  type CertType,
} from "@/lib/certTypes";
import {
  VIEWER_BILLET_OPTIONS,
  VIEWER_SHIP_OPTIONS,
} from "@/lib/viewerAssignment";

type Doc = {
  id: string;
  certKey: string;
  certLabel: string;
  originalName: string;
  mimeType?: string;
  uploadedAt: string;
  expiresAt?: string | null;
  certificateIssuedDate?: string | null;
  customTitle?: string | null;
};

type Mariner = {
  id: string;
  email: string;
  name: string;
  createdAt: string;
  assignedShip?: string | null;
  assignedBillet?: string | null;
  documents: Doc[];
};

type OfficeAccountRow = {
  id: string;
  login: string;
  role: string;
  allowedShips: string[];
};

type SortKey = "newest" | "name" | "vessel" | "billet";

const viewerSelectClass =
  "rounded-lg border border-amber-900/50 bg-[#2a2015] px-3 py-2 text-sm text-slate-100 [color-scheme:dark] outline-none ring-amber-400/25 focus:ring-2";
const viewerSelectOptionClass = "bg-[#2a2015] text-slate-100";

function compareAssignedText(a: string | null, b: string | null): number {
  const empty = (s: string | null) => !s?.trim();
  if (empty(a) && empty(b)) return 0;
  if (empty(a)) return 1;
  if (empty(b)) return -1;
  return a!.trim().localeCompare(b!.trim(), undefined, { sensitivity: "base" });
}

function marinerMatchesQuery(m: Mariner, q: string): boolean {
  const s = q.trim().toLowerCase();
  if (!s) return true;
  return (
    m.name.toLowerCase().includes(s) ||
    (m.assignedShip ?? "").toLowerCase().includes(s) ||
    (m.assignedBillet ?? "").toLowerCase().includes(s)
  );
}

function resolveToOptionList(
  value: string | null | undefined,
  list: string[],
): string {
  if (!value?.trim()) return "";
  const t = value.trim().toLowerCase();
  return list.find((x) => x.toLowerCase() === t) ?? "";
}

function hasValidAssignmentInLists(
  ship: string | null | undefined,
  billet: string | null | undefined,
  shipOptions: string[],
  billetOptions: string[],
): boolean {
  return (
    resolveToOptionList(ship, shipOptions) !== "" &&
    resolveToOptionList(billet, billetOptions) !== ""
  );
}

function formatExpiry(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function isMedicalNoExpiryCert(cert: CertType): boolean {
  return cert.section === "medical" && !cert.requiresExpiry;
}

/** Match checklist row or uploaded file metadata (office cert search). */
function certMatchesOfficeSearch(
  cert: CertType,
  docs: Doc[],
  qRaw: string,
): boolean {
  const q = qRaw.trim().toLowerCase();
  if (!q) return true;
  if (cert.label.toLowerCase().includes(q)) return true;
  if (cert.key.toLowerCase().includes(q)) return true;
  if (cert.renewalPeriodicity.toLowerCase().includes(q)) return true;
  for (const d of docs) {
    if (d.originalName.toLowerCase().includes(q)) return true;
    if ((d.certLabel ?? "").toLowerCase().includes(q)) return true;
    if ((d.customTitle ?? "").toLowerCase().includes(q)) return true;
  }
  return false;
}

function certsForSection(
  certTypes: CertType[],
  sectionKey: CertSectionKey
): CertType[] {
  return certTypes.filter((c) => c.section === sectionKey);
}

function CertificateChecklist({
  m,
  certTypes,
  certSearchQuery,
}: {
  m: Mariner;
  certTypes: CertType[];
  certSearchQuery: string;
}) {
  const [sectionOpen, setSectionOpen] = useState<
    Record<CertSectionKey, boolean>
  >({
    medical: true,
    training: true,
    credentials: true,
    additional: true,
  });

  function toggleSection(key: CertSectionKey) {
    setSectionOpen((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  const filterActive = certSearchQuery.trim().length > 0;

  const known = useMemo(() => new Set(certTypes.map((c) => c.key)), [certTypes]);
  const orphanDocs = useMemo(() => {
    return m.documents
      .filter((d) => !known.has(d.certKey))
      .sort(
        (a, b) =>
          new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
      );
  }, [m.documents, known]);

  const filteredOrphans = useMemo(() => {
    const q = certSearchQuery.trim().toLowerCase();
    if (!q) return orphanDocs;
    return orphanDocs.filter((d) => {
      if (d.originalName.toLowerCase().includes(q)) return true;
      if ((d.certLabel ?? "").toLowerCase().includes(q)) return true;
      if (d.certKey.toLowerCase().includes(q)) return true;
      if ((d.customTitle ?? "").toLowerCase().includes(q)) return true;
      return false;
    });
  }, [orphanDocs, certSearchQuery]);

  return (
    <div className="mt-6 space-y-4">
      <h3 className="text-sm font-semibold text-white">Certificate checklist</h3>
      <p className="text-xs text-slate-500">
        Full list by category — empty rows have no upload yet.
        {filterActive
          ? " Showing rows that match the search above."
          : null}
      </p>
      <div className="space-y-4">
        {CERT_SECTIONS.map((section) => {
          const types = certsForSection(certTypes, section.key);
          if (types.length === 0) return null;
          const typesFiltered = types.filter((cert) => {
            const docs = m.documents.filter((d) => d.certKey === cert.key);
            return certMatchesOfficeSearch(cert, docs, certSearchQuery);
          });
          if (filterActive && typesFiltered.length === 0) return null;
          const typesToRender = filterActive ? typesFiltered : types;
          const expanded = filterActive || sectionOpen[section.key];
          return (
            <section
              key={section.key}
              className="rounded-2xl border border-white/10 bg-white/[0.02]"
            >
              <button
                type="button"
                onClick={() => toggleSection(section.key)}
                className="flex w-full items-start gap-3 border-b border-white/10 px-4 py-4 text-left transition hover:bg-white/[0.04] sm:items-center sm:px-5"
              >
                <span
                  className="mt-0.5 text-amber-200/90 sm:mt-0"
                  aria-hidden
                >
                  {expanded ? "▾" : "▸"}
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="text-lg font-semibold text-white">
                    {section.label}
                  </h2>
                  <p className="mt-1 text-sm text-slate-400">
                    {section.description}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-white/10 px-2.5 py-0.5 text-xs text-slate-400">
                  {filterActive ? typesFiltered.length : types.length}
                </span>
              </button>
              {expanded && (
                <ul className="space-y-3 p-4 sm:p-5">
                  {typesToRender.map((cert) => {
                    const docs = m.documents
                      .filter((d) => d.certKey === cert.key)
                      .sort(
                        (a, b) =>
                          new Date(b.uploadedAt).getTime() -
                          new Date(a.uploadedAt).getTime()
                      );
                    return (
                      <li
                        key={cert.key}
                        className="rounded-xl border border-white/10 bg-black/20 px-4 py-3"
                      >
                        <p className="font-medium text-white">{cert.label}</p>
                        {!isMedicalNoExpiryCert(cert) &&
                        cert.renewalPeriodicity.trim() ? (
                          <p className="mt-0.5 text-xs text-slate-500">
                            Renewal periodicity: {cert.renewalPeriodicity}
                          </p>
                        ) : null}
                        {docs.length === 0 ? (
                          <p className="mt-2 text-sm italic text-slate-500">
                            Empty — no upload
                          </p>
                        ) : (
                          <ul className="mt-3 space-y-2">
                            {docs.map((d) => {
                              const exp = formatExpiry(d.expiresAt);
                              const issued = formatExpiry(
                                d.certificateIssuedDate,
                              );
                              const noExpiryTraining =
                                cert.section === "training" &&
                                !cert.requiresExpiry;
                              const metaParts: string[] = [];
                              if (noExpiryTraining && issued) {
                                metaParts.push(`certificate ${issued}`);
                              } else if (!noExpiryTraining && exp) {
                                metaParts.push(`expires ${exp}`);
                              }
                              metaParts.push(
                                `uploaded ${new Date(d.uploadedAt).toLocaleString()}`,
                              );
                              return (
                                <li
                                  key={d.id}
                                  className="flex flex-wrap items-center gap-3 rounded-lg bg-black/30 px-3 py-2 text-sm"
                                >
                                  <FileThumb
                                    docId={d.id}
                                    mimeType={
                                      d.mimeType ?? "application/octet-stream"
                                    }
                                  />
                                  <div className="min-w-0 flex-1">
                                    <p className="truncate text-slate-200">
                                      {d.originalName}
                                    </p>
                                    <p className="text-xs text-slate-500">
                                      {metaParts.join(" · ")}
                                    </p>
                                  </div>
                                  <a
                                    href={fileViewUrl(d.id)}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="shrink-0 rounded-lg bg-amber-400/90 px-3 py-1.5 text-xs font-semibold text-[#1a1208] hover:bg-amber-300"
                                  >
                                    Open
                                  </a>
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          );
        })}
      </div>
      {filterActive &&
      CERT_SECTIONS.every((section) => {
        const types = certsForSection(certTypes, section.key);
        return (
          types.filter((cert) => {
            const docs = m.documents.filter((d) => d.certKey === cert.key);
            return certMatchesOfficeSearch(cert, docs, certSearchQuery);
          }).length === 0
        );
      }) &&
      filteredOrphans.length === 0 ? (
        <p className="rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3 text-sm text-slate-500">
          No certificates or files match this search.
        </p>
      ) : null}
      {(() => {
        if (orphanDocs.length === 0) return null;
        if (filterActive && filteredOrphans.length === 0) return null;
        return (
          <section className="rounded-2xl border border-amber-500/20 bg-amber-950/10 px-4 py-4">
            <h2 className="text-sm font-semibold text-amber-200/90">
              Other files
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Uploads whose type is not on the current checklist (legacy or
              custom key).
            </p>
            <ul className="mt-3 space-y-2">
              {(filterActive ? filteredOrphans : orphanDocs).map((d) => {
                const exp = formatExpiry(d.expiresAt);
                const issued = formatExpiry(d.certificateIssuedDate);
                const extra =
                  issued && exp
                    ? ` · cert. ${issued} · expires ${exp}`
                    : issued
                      ? ` · cert. ${issued}`
                      : exp
                        ? ` · expires ${exp}`
                        : "";
                return (
                  <li
                    key={d.id}
                    className="flex flex-wrap items-center gap-3 rounded-lg bg-black/30 px-3 py-2 text-sm"
                  >
                    <FileThumb
                      docId={d.id}
                      mimeType={d.mimeType ?? "application/octet-stream"}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-slate-200">{d.originalName}</p>
                      <p className="text-xs text-slate-500">
                        {d.certLabel} · {d.certKey}
                        {extra}
                        {" · "}
                        {new Date(d.uploadedAt).toLocaleString()}
                      </p>
                    </div>
                    <a
                      href={fileViewUrl(d.id)}
                      target="_blank"
                      rel="noreferrer"
                      className="shrink-0 rounded-lg bg-amber-400/90 px-3 py-1.5 text-xs font-semibold text-[#1a1208] hover:bg-amber-300"
                    >
                      Open
                    </a>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })()}
    </div>
  );
}

function sectionTitleForCert(key: CertSectionKey): string {
  return CERT_SECTIONS.find((s) => s.key === key)?.label ?? key;
}

const ADMIN_VALIDITY_YEAR_OPTIONS = Array.from({ length: 99 }, (_, i) => i + 1);

function CertTemplateRowEditor({
  cert,
  onSave,
  onDelete,
  busySave,
  busyDelete,
}: {
  cert: CertType;
  onSave: (payload: {
    label: string;
    validityYears?: number | null;
  }) => Promise<void>;
  onDelete: () => Promise<void>;
  busySave: boolean;
  busyDelete: boolean;
}) {
  const [label, setLabel] = useState(cert.label);
  const [yearsSelect, setYearsSelect] = useState(
    () =>
      cert.validityYears == null ? "direct" : String(cert.validityYears),
  );

  const supportsValidityControls =
    cert.requiresExpiry && !cert.requiresCustomTitle;

  useEffect(() => {
    setLabel(cert.label);
    setYearsSelect(
      cert.validityYears == null ? "direct" : String(cert.validityYears),
    );
  }, [cert.key, cert.label, cert.validityYears]);

  const resolvedValidityYears: number | null =
    yearsSelect === "direct" ? null : Number(yearsSelect);

  const autoRenewalPreview = supportsValidityControls
    ? autoRenewalPeriodicityLabel({
        requiresExpiry: true,
        validityYears: resolvedValidityYears,
        section: cert.section,
        requiresCustomTitle: false,
      })
    : cert.renewalPeriodicity.trim();

  const dirty = supportsValidityControls
    ? label !== cert.label || resolvedValidityYears !== cert.validityYears
    : label !== cert.label;

  async function handleSave() {
    if (supportsValidityControls) {
      await onSave({
        label: label.trim(),
        validityYears: resolvedValidityYears,
      });
    } else {
      await onSave({ label: label.trim() });
    }
  }

  return (
    <li className="rounded-xl border border-white/10 bg-black/25 px-4 py-3">
      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
        <span className="rounded bg-white/10 px-2 py-0.5 font-mono text-[11px] text-amber-200/90">
          {cert.key}
        </span>
        <span>{sectionTitleForCert(cert.section)}</span>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs text-slate-500">Display name</label>
          <input
            type="text"
            className="w-full rounded-lg border border-white/10 bg-[#2a2015] px-3 py-2 text-sm text-slate-100 outline-none"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            disabled={busySave || busyDelete}
          />
        </div>
        {supportsValidityControls ? (
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs text-slate-500">
              Expiration (how mariner dates the document)
            </label>
            <select
              value={yearsSelect}
              onChange={(e) => setYearsSelect(e.target.value)}
              disabled={busySave || busyDelete}
              className={`w-full ${viewerSelectClass}`}
            >
              <option value="direct" className={viewerSelectOptionClass}>
                Expiration date on the document (mariner enters expiry)
              </option>
              {ADMIN_VALIDITY_YEAR_OPTIONS.map((y) => (
                <option
                  key={y}
                  value={String(y)}
                  className={viewerSelectOptionClass}
                >
                  {y} {y === 1 ? "year" : "years"} from certificate date (mariner
                  enters issue date)
                </option>
              ))}
            </select>
            <p className="mt-2 text-xs text-slate-500">
              Renewal periodicity (auto):{" "}
              <span className="font-medium text-slate-400">
                {autoRenewalPreview}
              </span>
            </p>
          </div>
        ) : cert.renewalPeriodicity.trim() ? (
          <div className="sm:col-span-2">
            <p className="text-xs text-slate-500">
              Renewal note:{" "}
              <span className="text-slate-400">{cert.renewalPeriodicity}</span>
            </p>
          </div>
        ) : null}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busySave || busyDelete || !dirty}
          onClick={() => void handleSave()}
          className="rounded-lg bg-amber-400/90 px-3 py-1.5 text-xs font-semibold text-[#1a1208] hover:bg-amber-300 disabled:opacity-50"
        >
          {busySave ? "Saving…" : "Save changes"}
        </button>
        <button
          type="button"
          disabled={busySave || busyDelete}
          onClick={() => void onDelete()}
          className="rounded-lg border border-red-400/40 px-3 py-1.5 text-xs font-medium text-red-300 hover:bg-red-500/10 disabled:opacity-50"
        >
          {busyDelete ? "Removing…" : "Remove template"}
        </button>
      </div>
    </li>
  );
}

function CertTemplatesAdminPanel({ onSaved }: { onSaved: () => Promise<void> }) {
  const router = useRouter();
  const [certTypes, setCertTypes] = useState<CertType[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [deletingKey, setDeletingKey] = useState<string | null>(null);

  const [newKey, setNewKey] = useState("");
  const [newSection, setNewSection] = useState<CertSectionKey>("training");
  const [newLabel, setNewLabel] = useState("");
  const [newYearsSelect, setNewYearsSelect] = useState("5");
  const [newCustomRenewalNote, setNewCustomRenewalNote] = useState("");
  const [newRequiresExpiry, setNewRequiresExpiry] = useState(true);
  const [newRequiresCustomTitle, setNewRequiresCustomTitle] = useState(false);
  const [newOptionalExpiry, setNewOptionalExpiry] = useState(true);
  const [adding, setAdding] = useState(false);
  const [adminSectionOpen, setAdminSectionOpen] = useState<
    Record<CertSectionKey, boolean>
  >({
    medical: true,
    training: true,
    credentials: true,
    additional: true,
  });

  const load = useCallback(async () => {
    setLoading(true);
    setMsg(null);
    const res = await fetch("/api/viewer/cert-templates", {
      credentials: "include",
    });
    if (res.status === 401) {
      router.replace("/viewer/login");
      return;
    }
    if (res.status === 403) {
      setMsg("Only administrators can manage certificate templates.");
      setLoading(false);
      return;
    }
    if (!res.ok) {
      setLoading(false);
      return;
    }
    const data = await res.json();
    setCertTypes(data.certTypes ?? []);
    setLoading(false);
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveRow(
    key: string,
    payload: { label: string; validityYears?: number | null },
  ) {
    setSavingKey(key);
    setMsg(null);
    try {
      const body: Record<string, unknown> = {
        key,
        label: payload.label,
      };
      if (payload.validityYears !== undefined) {
        body.validityYears = payload.validityYears;
      }
      const res = await fetch("/api/viewer/cert-templates", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.status === 401) {
        router.replace("/viewer/login");
        return;
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg(typeof data.error === "string" ? data.error : "Save failed.");
        return;
      }
      setCertTypes(data.certTypes ?? []);
      await onSaved();
    } finally {
      setSavingKey(null);
    }
  }

  async function removeRow(key: string) {
    if (
      !window.confirm(
        "Remove this upload template? Mariners will no longer see it unless you add it again. You cannot remove a template that still has files uploaded.",
      )
    ) {
      return;
    }
    setDeletingKey(key);
    setMsg(null);
    try {
      const res = await fetch("/api/viewer/cert-templates", {
        method: "DELETE",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key }),
      });
      if (res.status === 401) {
        router.replace("/viewer/login");
        return;
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg(typeof data.error === "string" ? data.error : "Remove failed.");
        return;
      }
      setCertTypes(data.certTypes ?? []);
      await onSaved();
    } finally {
      setDeletingKey(null);
    }
  }

  async function addRow(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    const key = newKey.trim().toLowerCase();
    if (!key) {
      setMsg("Enter a stable key (e.g. training_new_course).");
      return;
    }
    const label = newLabel.trim();
    if (!label) {
      setMsg("Enter a display name for mariners.");
      return;
    }
    let validityYears: number | null = null;
    if (!newRequiresCustomTitle && newRequiresExpiry) {
      if (newYearsSelect === "direct") {
        validityYears = null;
      } else {
        const n = parseInt(newYearsSelect, 10);
        if (!Number.isFinite(n) || n < 1 || n > 99) {
          setMsg("Choose a valid validity option.");
          return;
        }
        validityYears = n;
      }
    } else if (!newRequiresCustomTitle && !newRequiresExpiry) {
      validityYears = null;
    }
    setAdding(true);
    try {
      const res = await fetch("/api/viewer/cert-templates", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key,
          section: newSection,
          label,
          renewalPeriodicity: newRequiresCustomTitle
            ? newCustomRenewalNote.trim()
            : "",
          requiresExpiry: newRequiresCustomTitle ? false : newRequiresExpiry,
          validityYears:
            newRequiresCustomTitle || !newRequiresExpiry ? null : validityYears,
          requiresCustomTitle: newRequiresCustomTitle,
          optionalExpiry: newRequiresCustomTitle ? newOptionalExpiry : false,
        }),
      });
      if (res.status === 401) {
        router.replace("/viewer/login");
        return;
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg(typeof data.error === "string" ? data.error : "Could not add template.");
        return;
      }
      setCertTypes(data.certTypes ?? []);
      setNewKey("");
      setNewLabel("");
      setNewYearsSelect("5");
      setNewCustomRenewalNote("");
      setNewRequiresExpiry(true);
      setNewRequiresCustomTitle(false);
      setNewOptionalExpiry(true);
      await onSaved();
    } finally {
      setAdding(false);
    }
  }

  const sorted = sortCertTypesByDefaultSectionOrder(certTypes);

  return (
    <section className="mt-14 rounded-2xl border border-amber-500/25 bg-amber-950/25 px-5 py-6">
      <button
        type="button"
        aria-expanded={expanded}
        onClick={() => setExpanded((e) => !e)}
        className="flex w-full items-start gap-3 text-left transition hover:opacity-90"
      >
        <span
          className="mt-1 shrink-0 select-none text-amber-200/90"
          aria-hidden
        >
          {expanded ? "▾" : "▸"}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold text-white">
            Mariner upload checklist
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            {loading
              ? "Loading templates…"
              : "Edit templates by category (same order as mariners and the office). Expiration uses a years-from-issue or document-expiry rule; renewal text is generated automatically."}
          </p>
          {!loading ? (
            <p className="mt-1 text-xs text-slate-500">
              {certTypes.length} template{certTypes.length === 1 ? "" : "s"}
            </p>
          ) : null}
        </div>
      </button>
      {expanded && loading ? (
        <p className="mt-4 text-sm text-slate-500">Loading certificate templates…</p>
      ) : null}
      {expanded && !loading ? (
        <>
          <p className="mt-3 text-xs text-slate-500">
            Internal keys (monospace) are stored on uploads—change display fields freely;
            do not remove a key that still has files.
          </p>
          {msg ? (
            <p className="mt-4 rounded-lg border border-red-400/35 bg-red-950/40 px-3 py-2 text-sm text-red-200">
              {msg}
            </p>
          ) : null}
          <div className="mt-6 max-h-[min(36rem,65vh)] space-y-4 overflow-y-auto pr-1">
            {CERT_SECTIONS.map((section) => {
              const typesInSection = certsForSection(sorted, section.key);
              if (typesInSection.length === 0) return null;
              const open = adminSectionOpen[section.key] ?? true;
              return (
                <section
                  key={section.key}
                  className="rounded-2xl border border-white/10 bg-black/15"
                >
                  <button
                    type="button"
                    onClick={() =>
                      setAdminSectionOpen((prev) => ({
                        ...prev,
                        [section.key]: !open,
                      }))
                    }
                    className="flex w-full items-start gap-3 px-4 py-4 text-left transition hover:bg-white/[0.04] sm:items-center"
                  >
                    <span
                      className="mt-0.5 shrink-0 text-amber-200/90 sm:mt-0"
                      aria-hidden
                    >
                      {open ? "▾" : "▸"}
                    </span>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-base font-semibold text-white">
                        {section.label}
                      </h3>
                      <p className="mt-1 text-xs text-slate-500">
                        {section.description}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full bg-white/10 px-2 py-0.5 text-xs text-slate-400">
                      {typesInSection.length}
                    </span>
                  </button>
                  {open ? (
                    <ul className="space-y-3 border-t border-white/10 p-4 pt-4">
                      {typesInSection.map((c) => (
                        <CertTemplateRowEditor
                          key={c.key}
                          cert={c}
                          onSave={(payload) => saveRow(c.key, payload)}
                          onDelete={() => removeRow(c.key)}
                          busySave={savingKey === c.key}
                          busyDelete={deletingKey === c.key}
                        />
                      ))}
                    </ul>
                  ) : null}
                </section>
              );
            })}
          </div>
        </>
      ) : null}
      {expanded && !loading ? (
      <form
        onSubmit={(e) => void addRow(e)}
        className="mt-8 space-y-4 rounded-xl border border-white/10 bg-black/20 p-4"
      >
        <h3 className="font-semibold text-white">Add template</h3>
        <p className="text-xs text-slate-500">
          Use a short stable key (lowercase, underscores). Mariners never see the key;
          it ties uploads to this row.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs text-slate-400">Key</label>
            <input
              type="text"
              className="w-full rounded-lg border border-white/10 bg-[#2a2015] px-3 py-2 text-sm text-slate-100 outline-none"
              value={newKey}
              onChange={(e) => setNewKey(e.target.value)}
              placeholder="e.g. training_new_orientation"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-400">Section</label>
            <select
              value={newSection}
              onChange={(e) =>
                setNewSection(e.target.value as CertSectionKey)
              }
              className={`w-full ${viewerSelectClass}`}
            >
              {CERT_SECTIONS.map((s) => (
                <option key={s.key} value={s.key} className={viewerSelectOptionClass}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs text-slate-400">Display name</label>
            <input
              type="text"
              className="w-full rounded-lg border border-white/10 bg-[#2a2015] px-3 py-2 text-sm text-slate-100 outline-none"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="Title on mariner checklist"
            />
          </div>
        </div>
        {!newRequiresCustomTitle ? (
          <div className="flex flex-wrap gap-4">
            <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-300">
              <input
                type="checkbox"
                className="rounded border-white/20 bg-[#2a2015]"
                checked={newRequiresExpiry}
                onChange={(e) => setNewRequiresExpiry(e.target.checked)}
              />
              Require expiration or certificate date before upload
            </label>
          </div>
        ) : null}
        {!newRequiresCustomTitle && newRequiresExpiry ? (
          <div>
            <label className="mb-1 block text-xs text-slate-400">
              Expiration (how mariner dates the document)
            </label>
            <select
              value={newYearsSelect}
              onChange={(e) => setNewYearsSelect(e.target.value)}
              className={`w-full max-w-xl ${viewerSelectClass}`}
            >
              <option value="direct" className={viewerSelectOptionClass}>
                Expiration date on the document
              </option>
              {ADMIN_VALIDITY_YEAR_OPTIONS.map((y) => (
                <option
                  key={y}
                  value={String(y)}
                  className={viewerSelectOptionClass}
                >
                  {y} {y === 1 ? "year" : "years"} from certificate date
                </option>
              ))}
            </select>
            <p className="mt-2 text-xs text-slate-500">
              Renewal periodicity (auto):{" "}
              <span className="font-medium text-slate-400">
                {autoRenewalPeriodicityLabel({
                  requiresExpiry: true,
                  validityYears:
                    newYearsSelect === "direct" ? null : Number(newYearsSelect),
                  section: newSection,
                  requiresCustomTitle: false,
                })}
              </span>
            </p>
          </div>
        ) : null}
        {newRequiresCustomTitle ? (
          <div>
            <label className="mb-1 block text-xs text-slate-400">
              Renewal note (optional, shown to mariners)
            </label>
            <input
              type="text"
              className="w-full rounded-lg border border-white/10 bg-[#2a2015] px-3 py-2 text-sm text-slate-100 outline-none"
              value={newCustomRenewalNote}
              onChange={(e) => setNewCustomRenewalNote(e.target.value)}
              placeholder="e.g. Per assignment"
            />
          </div>
        ) : null}
        <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-300">
          <input
            type="checkbox"
            className="rounded border-white/20 bg-[#2a2015]"
            checked={newRequiresCustomTitle}
            onChange={(e) => {
              const v = e.target.checked;
              setNewRequiresCustomTitle(v);
              if (v) setNewRequiresExpiry(false);
            }}
          />
          Mariner names each file (additional-document style)
        </label>
        {newRequiresCustomTitle ? (
          <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-300">
            <input
              type="checkbox"
              className="rounded border-white/20 bg-[#2a2015]"
              checked={newOptionalExpiry}
              onChange={(e) => setNewOptionalExpiry(e.target.checked)}
            />
            Allow optional expiration date per file
          </label>
        ) : null}
        <button
          type="submit"
          disabled={adding}
          className="rounded-lg bg-amber-400/90 px-4 py-2 text-sm font-semibold text-[#1a1208] hover:bg-amber-300 disabled:opacity-50"
        >
          {adding ? "Adding…" : "Add template"}
        </button>
      </form>
      ) : null}
    </section>
  );
}

function AssignmentPanel({
  marinerId,
  assignedShip,
  assignedBillet,
  shipOptions,
  billetOptions,
  onUpdated,
}: {
  marinerId: string;
  assignedShip: string | null;
  assignedBillet: string | null;
  shipOptions: string[];
  billetOptions: string[];
  onUpdated: () => Promise<void>;
}) {
  const router = useRouter();
  const shipList = shipOptions;
  const billetList = billetOptions;

  const shipCanon = resolveToOptionList(assignedShip, shipList);
  const billetCanon = resolveToOptionList(assignedBillet, billetList);
  const bothSavedOnServer = hasValidAssignmentInLists(
    assignedShip,
    assignedBillet,
    shipList,
    billetList,
  );

  const [ship, setShip] = useState(() => shipCanon);
  const [billet, setBillet] = useState(() => billetCanon);
  const [saving, setSaving] = useState(false);
  const [editOpen, setEditOpen] = useState(() => !bothSavedOnServer);

  useEffect(() => {
    setShip(resolveToOptionList(assignedShip, shipList));
  }, [assignedShip, marinerId, shipList.join("|")]);

  useEffect(() => {
    setBillet(resolveToOptionList(assignedBillet, billetList));
  }, [assignedBillet, marinerId, billetList.join("|")]);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(`/api/viewer/mariner/${marinerId}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignedShip: ship, assignedBillet: billet }),
      });
      if (res.status === 401) {
        router.replace("/viewer/login");
        return;
      }
      if (!res.ok) return;
      await onUpdated();
      if (ship.trim() && billet.trim()) setEditOpen(false);
    } finally {
      setSaving(false);
    }
  }

  function minimize() {
    setShip(shipCanon);
    setBillet(billetCanon);
    setEditOpen(false);
  }

  const summaryParts: string[] = [];
  if (assignedShip?.trim()) summaryParts.push(assignedShip.trim());
  if (assignedBillet?.trim()) summaryParts.push(assignedBillet.trim());
  const summaryText =
    summaryParts.length > 0 ? summaryParts.join(" · ") : "No assignment yet";

  if (bothSavedOnServer && !editOpen) {
    return (
      <div className="mb-6 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-400/25 bg-amber-950/35 px-4 py-3">
        <p className="text-sm text-amber-100/95">
          <span className="font-medium text-amber-200/90">Vessel & billet: </span>
          {summaryText}
        </p>
        <button
          type="button"
          onClick={() => setEditOpen(true)}
          className="shrink-0 rounded-lg border border-amber-300/40 px-3 py-1.5 text-xs font-semibold text-amber-200 hover:bg-amber-400/15"
        >
          Change
        </button>
      </div>
    );
  }

  return (
    <div className="mb-6 rounded-xl border border-amber-400/20 bg-amber-950/30 px-4 py-3">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-amber-200/90">
          Vessel & billet
        </p>
        {bothSavedOnServer ? (
          <button
            type="button"
            onClick={minimize}
            className="text-xs font-medium text-slate-400 hover:text-slate-200"
          >
            Minimize
          </button>
        ) : null}
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1">
          <label className="mb-1 block text-xs font-medium text-amber-200/90">
            Ship
          </label>
          <select
            value={ship}
            onChange={(e) => setShip(e.target.value)}
            className={`w-full ${viewerSelectClass}`}
          >
            <option value="" className={viewerSelectOptionClass}>
              Select ship…
            </option>
            {shipList.map((name) => (
              <option key={name} value={name} className={viewerSelectOptionClass}>
                {name}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-0 flex-1">
          <label className="mb-1 block text-xs font-medium text-amber-200/90">
            Billet
          </label>
          <select
            value={billet}
            onChange={(e) => setBillet(e.target.value)}
            className={`w-full ${viewerSelectClass}`}
          >
            <option value="" className={viewerSelectOptionClass}>
              Select billet…
            </option>
            {billetList.map((name) => (
              <option key={name} value={name} className={viewerSelectOptionClass}>
                {name}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving}
          className="shrink-0 rounded-lg bg-amber-400/90 px-4 py-2 text-sm font-semibold text-[#1a1208] hover:bg-amber-300 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save assignment"}
        </button>
      </div>
    </div>
  );
}

function CoordinatorShipAccess({
  account,
  shipOptions,
  onSaved,
}: {
  account: OfficeAccountRow;
  shipOptions: string[];
  onSaved: () => Promise<void>;
}) {
  const router = useRouter();
  const allowedHas = (ship: string) =>
    account.allowedShips.some(
      (a) => a.toLowerCase() === ship.toLowerCase(),
    );
  const [ships, setShips] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(shipOptions.map((s) => [s, allowedHas(s)])),
  );
  useEffect(() => {
    setShips(
      Object.fromEntries(
        shipOptions.map((s) => [s, allowedHas(s)]),
      ),
    );
  }, [account.id, account.allowedShips.join("|"), shipOptions.join("|")]);
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function saveShips() {
    const allowedShips = shipOptions.filter((s) => ships[s]);
    if (allowedShips.length === 0) {
      setMsg("Select at least one vessel.");
      return;
    }
    setMsg(null);
    setSaving(true);
    try {
      const res = await fetch(`/api/viewer/office-accounts/${account.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ allowedShips }),
      });
      if (res.status === 401) {
        router.replace("/viewer/login");
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setMsg(typeof data.error === "string" ? data.error : "Save failed.");
        return;
      }
      await onSaved();
    } finally {
      setSaving(false);
    }
  }

  async function savePassword() {
    if (password.length < 8) {
      setMsg("Password must be at least 8 characters.");
      return;
    }
    setMsg(null);
    setSaving(true);
    try {
      const res = await fetch(`/api/viewer/office-accounts/${account.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (res.status === 401) {
        router.replace("/viewer/login");
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setMsg(typeof data.error === "string" ? data.error : "Save failed.");
        return;
      }
      setPassword("");
      await onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-3 space-y-4 border-t border-white/10 pt-3">
      <div className="flex flex-wrap gap-4">
        {shipOptions.map((ship) => (
          <label
            key={ship}
            className="flex cursor-pointer items-center gap-2 text-sm text-slate-300"
          >
            <input
              type="checkbox"
              className="rounded border-white/20 bg-[#2a2015]"
              checked={ships[ship] ?? false}
              onChange={(e) =>
                setShips((prev) => ({ ...prev, [ship]: e.target.checked }))
              }
            />
            {ship}
          </label>
        ))}
      </div>
      <button
        type="button"
        disabled={saving}
        onClick={() => void saveShips()}
        className="rounded-lg border border-amber-300/40 px-3 py-1.5 text-xs font-semibold text-amber-200 hover:bg-amber-400/10 disabled:opacity-50"
      >
        Save vessel access
      </button>
      <div className="flex flex-wrap items-end gap-2">
        <div>
          <label className="mb-1 block text-xs text-slate-500">New password</label>
          <input
            type="password"
            autoComplete="new-password"
            className="w-48 rounded-lg border border-white/10 bg-[#2a2015] px-3 py-1.5 text-sm text-slate-100 outline-none"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <button
          type="button"
          disabled={saving || password.length < 8}
          onClick={() => void savePassword()}
          className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/15 disabled:opacity-50"
        >
          Update password
        </button>
      </div>
      {msg && <p className="text-sm text-red-300">{msg}</p>}
    </div>
  );
}

const MAX_ASSIGNMENT_OPTION_LEN = 120;

function CustomDropdownListEditor({
  sectionTitle,
  items,
  setItems,
  addPlaceholder,
  persist,
  persistDisabled,
}: {
  sectionTitle: string;
  items: string[];
  setItems: Dispatch<SetStateAction<string[]>>;
  addPlaceholder: string;
  persist: (next: string[]) => Promise<void>;
  persistDisabled?: boolean;
}) {
  const [selectedKey, setSelectedKey] = useState("");
  const [editText, setEditText] = useState("");
  const [newText, setNewText] = useState("");
  const [hint, setHint] = useState<string | null>(null);

  const selectedIndex =
    selectedKey === "" ? null : Number(selectedKey);
  const editingSelected =
    selectedIndex !== null &&
    !Number.isNaN(selectedIndex) &&
    selectedIndex >= 0 &&
    selectedIndex < items.length;

  useEffect(() => {
    if (selectedKey === "") {
      setEditText("");
      return;
    }
    const i = Number(selectedKey);
    if (Number.isNaN(i) || i < 0 || i >= items.length) {
      setSelectedKey("");
      setEditText("");
      return;
    }
    setEditText(items[i]!);
  }, [selectedKey, items]);

  function conflictMessage(
    excludeIndex: number | null,
    candidate: string,
  ): string | null {
    const k = candidate.toLowerCase();
    const dup = items.findIndex(
      (x, i) => i !== excludeIndex && x.toLowerCase() === k,
    );
    if (dup !== -1) {
      return "Another entry already uses that name.";
    }
    return null;
  }

  async function applyEdit() {
    setHint(null);
    if (persistDisabled || !editingSelected || selectedIndex === null) return;
    const t = editText.trim();
    if (!t) {
      setHint("Enter a name, or use Remove to delete this entry.");
      return;
    }
    if (t.length > MAX_ASSIGNMENT_OPTION_LEN) {
      setHint(`Keep names to ${MAX_ASSIGNMENT_OPTION_LEN} characters or fewer.`);
      return;
    }
    const err = conflictMessage(selectedIndex, t);
    if (err) {
      setHint(err);
      return;
    }
    const next = [...items];
    next[selectedIndex] = t;
    setItems(next);
    await persist(next);
  }

  async function removeSelected() {
    setHint(null);
    if (persistDisabled || !editingSelected || selectedIndex === null) return;
    if (items.length <= 1) {
      setHint("Keep at least one entry. Add another before removing this one.");
      return;
    }
    const next = items.filter((_, i) => i !== selectedIndex);
    setItems(next);
    setSelectedKey("");
    await persist(next);
  }

  async function addNew() {
    setHint(null);
    if (persistDisabled) return;
    const t = newText.trim();
    if (!t) return;
    if (t.length > MAX_ASSIGNMENT_OPTION_LEN) {
      setHint(`Keep names to ${MAX_ASSIGNMENT_OPTION_LEN} characters or fewer.`);
      return;
    }
    const err = conflictMessage(null, t);
    if (err) {
      setHint(err);
      return;
    }
    const next = [...items, t];
    setItems(next);
    setNewText("");
    await persist(next);
  }

  const selectId = `assignment-list-select-${sectionTitle.replace(/\s+/g, "-").toLowerCase()}`;
  const busy = !!persistDisabled;

  return (
    <div className="space-y-3 rounded-xl border border-white/10 bg-black/20 p-4">
      <h3 className="text-sm font-semibold text-white">{sectionTitle}</h3>
      <div>
        <label
          htmlFor={selectId}
          className="mb-1 block text-xs font-medium text-amber-200/85"
        >
          Entries
        </label>
        <select
          id={selectId}
          value={selectedKey}
          disabled={busy}
          onChange={(e) => {
            setHint(null);
            setSelectedKey(e.target.value);
          }}
          className={`w-full ${viewerSelectClass}`}
        >
          <option value="" className={viewerSelectOptionClass}>
            Select an entry to edit or remove…
          </option>
          {items.map((item, i) => (
            <option
              key={`${i}-${item}`}
              value={String(i)}
              className={viewerSelectOptionClass}
            >
              {item}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1">
          <label className="mb-1 block text-xs text-slate-400">
            Edit selected
          </label>
          <input
            type="text"
            disabled={busy || !editingSelected}
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-[#2a2015] px-3 py-2 text-sm text-slate-100 outline-none disabled:opacity-45"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy || !editingSelected}
            onClick={() => void applyEdit()}
            className="rounded-lg border border-amber-400/50 bg-amber-400/15 px-3 py-2 text-xs font-semibold text-amber-100 hover:bg-amber-400/25 disabled:opacity-40"
          >
            Save edit
          </button>
          <button
            type="button"
            disabled={busy || !editingSelected || items.length <= 1}
            onClick={() => void removeSelected()}
            className="rounded-lg border border-red-400/40 bg-red-950/40 px-3 py-2 text-xs font-semibold text-red-200 hover:bg-red-950/55 disabled:opacity-40"
          >
            Remove
          </button>
        </div>
      </div>
      <div className="flex flex-col gap-2 border-t border-white/10 pt-4 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1">
          <label className="mb-1 block text-xs text-slate-400">Add new</label>
          <input
            type="text"
            disabled={busy}
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            placeholder={addPlaceholder}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void addNew();
              }
            }}
            className="w-full rounded-lg border border-white/10 bg-[#2a2015] px-3 py-2 text-sm text-slate-100 outline-none"
          />
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={() => void addNew()}
          title="Add entry"
          aria-label={`Add ${sectionTitle} entry`}
          className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-lg border border-amber-400/45 bg-amber-400/15 text-lg font-semibold leading-none text-amber-100 hover:bg-amber-400/25 disabled:opacity-40"
        >
          +
        </button>
      </div>
      {hint ? (
        <p className="text-xs text-amber-200/90">{hint}</p>
      ) : null}
    </div>
  );
}

function AssignmentOptionsAdminPanel({
  onSaved,
}: {
  onSaved: () => Promise<void>;
}) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [listSaving, setListSaving] = useState(false);
  const [editShipOptions, setEditShipOptions] = useState<string[]>([]);
  const [editBilletOptions, setEditBilletOptions] = useState<string[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setMsg(null);
    const res = await fetch("/api/viewer/assignment-options", {
      credentials: "include",
    });
    if (res.status === 401) {
      router.replace("/viewer/login");
      return;
    }
    if (res.status === 403) {
      setMsg("Only administrators can edit vessel and billet lists.");
      setLoading(false);
      return;
    }
    if (!res.ok) {
      setLoading(false);
      return;
    }
    const data = await res.json();
    setEditShipOptions(Array.isArray(data.shipOptions) ? data.shipOptions : []);
    setEditBilletOptions(
      Array.isArray(data.billetOptions) ? data.billetOptions : [],
    );
    setLoading(false);
  }, [router]);

  const reloadListsQuiet = useCallback(async () => {
    const res = await fetch("/api/viewer/assignment-options", {
      credentials: "include",
    });
    if (res.status === 401) {
      router.replace("/viewer/login");
      return;
    }
    if (!res.ok) return;
    const data = await res.json();
    if (Array.isArray(data.shipOptions)) setEditShipOptions(data.shipOptions);
    if (Array.isArray(data.billetOptions)) {
      setEditBilletOptions(data.billetOptions);
    }
  }, [router]);

  useEffect(() => {
    if (expanded) void load();
  }, [expanded, load]);

  const patchAssignment = useCallback(
    async (patch: { shipOptions?: string[]; billetOptions?: string[] }) => {
      setListSaving(true);
      setMsg(null);
      try {
        const res = await fetch("/api/viewer/assignment-options", {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        });
        const data = await res.json().catch(() => ({}));
        if (res.status === 401) {
          router.replace("/viewer/login");
          return;
        }
        if (!res.ok) {
          setMsg(
            typeof data.error === "string" ? data.error : "Could not save.",
          );
          await reloadListsQuiet();
          return;
        }
        if (Array.isArray(data.shipOptions)) setEditShipOptions(data.shipOptions);
        if (Array.isArray(data.billetOptions)) {
          setEditBilletOptions(data.billetOptions);
        }
        await onSaved();
      } finally {
        setListSaving(false);
      }
    },
    [router, reloadListsQuiet, onSaved],
  );

  const persistShips = useCallback(
    (next: string[]) => patchAssignment({ shipOptions: next }),
    [patchAssignment],
  );
  const persistBillets = useCallback(
    (next: string[]) => patchAssignment({ billetOptions: next }),
    [patchAssignment],
  );

  return (
    <section className="mt-14 rounded-2xl border border-amber-500/25 bg-amber-950/25 px-5 py-6">
      <button
        type="button"
        aria-expanded={expanded}
        onClick={() => setExpanded((e) => !e)}
        className="flex w-full items-start gap-3 text-left transition hover:opacity-90"
      >
        <span
          className="mt-1 shrink-0 select-none text-amber-200/90"
          aria-hidden
        >
          {expanded ? "▾" : "▸"}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold text-white">
            Vessel &amp; billet dropdowns
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            Changes apply immediately for mariners, coordinator vessel access, and
            office assignment. Keep at least one entry in each list.
          </p>
        </div>
      </button>
      {expanded && loading ? (
        <p className="mt-4 text-sm text-slate-500">Loading…</p>
      ) : null}
      {expanded && !loading ? (
        <div className="mt-6 space-y-6">
          {msg && (
            <p className="rounded-lg border border-red-400/35 bg-red-950/40 px-3 py-2 text-sm text-red-200">
              {msg}
            </p>
          )}
          <CustomDropdownListEditor
            sectionTitle="Vessels"
            items={editShipOptions}
            setItems={setEditShipOptions}
            addPlaceholder="e.g. MV Example"
            persist={persistShips}
            persistDisabled={listSaving}
          />
          <CustomDropdownListEditor
            sectionTitle="Billets"
            items={editBilletOptions}
            setItems={setEditBilletOptions}
            addPlaceholder="e.g. Chief Cook"
            persist={persistBillets}
            persistDisabled={listSaving}
          />
          <p className="text-xs text-slate-500">
            If you rename an entry, update any mariners still using the old
            spelling on their assignment.
          </p>
        </div>
      ) : null}
    </section>
  );
}

function OfficeTeamPanel({ shipOptions }: { shipOptions: string[] }) {
  const router = useRouter();
  const [accounts, setAccounts] = useState<OfficeAccountRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [newLogin, setNewLogin] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [pickShips, setPickShips] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(shipOptions.map((s) => [s, false])),
  );
  const [banner, setBanner] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    setPickShips((prev) => {
      const next = { ...prev };
      for (const s of shipOptions) {
        if (!(s in next)) next[s] = false;
      }
      for (const k of Object.keys(next)) {
        if (!shipOptions.includes(k)) delete next[k];
      }
      return next;
    });
  }, [shipOptions.join("|")]);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/viewer/office-accounts", {
      credentials: "include",
    });
    if (res.status === 401) {
      router.replace("/viewer/login");
      return;
    }
    if (!res.ok) {
      setLoading(false);
      return;
    }
    const data = await res.json();
    setAccounts(data.accounts ?? []);
    setLoading(false);
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  async function addCoordinator(e: React.FormEvent) {
    e.preventDefault();
    setBanner(null);
    const allowedShips = shipOptions.filter((s) => pickShips[s]);
    if (!newLogin.trim() || !newPassword) {
      setBanner("Enter username and password.");
      return;
    }
    if (allowedShips.length === 0) {
      setBanner("Select at least one vessel.");
      return;
    }
    setAdding(true);
    try {
      const res = await fetch("/api/viewer/office-accounts", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          login: newLogin.trim().toLowerCase(),
          password: newPassword,
          allowedShips,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) {
        router.replace("/viewer/login");
        return;
      }
      if (!res.ok) {
        setBanner(typeof data.error === "string" ? data.error : "Could not add.");
        return;
      }
      setNewLogin("");
      setNewPassword("");
      setPickShips(
        Object.fromEntries(shipOptions.map((s) => [s, false])),
      );
      await load();
    } finally {
      setAdding(false);
    }
  }

  return (
    <section className="mt-14 rounded-2xl border border-amber-500/25 bg-amber-950/25 px-5 py-6">
      <button
        type="button"
        aria-expanded={expanded}
        onClick={() => setExpanded((e) => !e)}
        className="flex w-full items-start gap-3 text-left transition hover:opacity-90"
      >
        <span
          className="mt-1 shrink-0 select-none text-amber-200/90"
          aria-hidden
        >
          {expanded ? "▾" : "▸"}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold text-white">Office team access</h2>
          <p className="mt-1 text-sm text-slate-400">
            {loading
              ? "Loading accounts…"
              : "Admins see everyone. Coordinators only see mariners whose vessel matches a vessel you allow."}
          </p>
          {!loading ? (
            <p className="mt-1 text-xs text-slate-500">
              {accounts.length} office account{accounts.length === 1 ? "" : "s"}
            </p>
          ) : null}
        </div>
      </button>
      {expanded && loading ? (
        <p className="mt-4 text-sm text-slate-500">Loading office accounts…</p>
      ) : null}
      {expanded && !loading ? (
        <>
          <ul className="mt-6 space-y-4">
            {accounts.map((a) => (
              <li
                key={a.id}
                className="rounded-xl border border-white/10 bg-black/25 px-4 py-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium text-white">{a.login}</p>
                  <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-xs text-amber-200/90">
                    {a.role === "admin" ? "Administrator" : "Coordinator"}
                  </span>
                </div>
                {a.role === "admin" ? (
                  <p className="mt-2 text-sm text-slate-500">Full access.</p>
                ) : (
                  <CoordinatorShipAccess
                    account={a}
                    shipOptions={shipOptions}
                    onSaved={load}
                  />
                )}
              </li>
            ))}
          </ul>
          <form
            onSubmit={(e) => void addCoordinator(e)}
            className="mt-8 space-y-4 rounded-xl border border-white/10 bg-black/20 p-4"
          >
            <h3 className="font-semibold text-white">Add coordinator</h3>
            {banner && (
              <p className="rounded-lg border border-red-400/35 bg-red-950/40 px-3 py-2 text-sm text-red-200">
                {banner}
              </p>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs text-slate-400">Username</label>
                <input
                  type="text"
                  autoComplete="username"
                  className="w-full rounded-lg border border-white/10 bg-[#2a2015] px-3 py-2 text-sm text-slate-100 outline-none"
                  value={newLogin}
                  onChange={(e) => setNewLogin(e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-400">
                  Password (8+ characters)
                </label>
                <input
                  type="password"
                  autoComplete="new-password"
                  className="w-full rounded-lg border border-white/10 bg-[#2a2015] px-3 py-2 text-sm text-slate-100 outline-none"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>
            </div>
            <fieldset>
              <legend className="mb-2 text-xs font-medium text-slate-400">
                Vessels
              </legend>
              <div className="flex flex-wrap gap-3">
                {shipOptions.map((ship) => (
                  <label
                    key={ship}
                    className="flex cursor-pointer items-center gap-2 text-sm text-slate-300"
                  >
                    <input
                      type="checkbox"
                      className="rounded border-white/20 bg-[#2a2015]"
                      checked={pickShips[ship] ?? false}
                      onChange={(e) =>
                        setPickShips((p) => ({ ...p, [ship]: e.target.checked }))
                      }
                    />
                    {ship}
                  </label>
                ))}
              </div>
            </fieldset>
            <button
              type="submit"
              disabled={adding}
              className="rounded-lg bg-amber-400/90 px-4 py-2 text-sm font-semibold text-[#1a1208] hover:bg-amber-300 disabled:opacity-50"
            >
              {adding ? "Adding…" : "Create coordinator"}
            </button>
          </form>
        </>
      ) : null}
    </section>
  );
}

export default function ViewerBrowsePage() {
  const router = useRouter();
  const [mariners, setMariners] = useState<Mariner[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("newest");
  const [officeRole, setOfficeRole] = useState<"admin" | "coordinator" | null>(
    null
  );
  const [officeLogin, setOfficeLogin] = useState<string | null>(null);
  const [certTypes, setCertTypes] = useState<CertType[]>([]);
  const [certSearchByMarinerId, setCertSearchByMarinerId] = useState<
    Record<string, string>
  >({});
  const [deletingMarinerId, setDeletingMarinerId] = useState<string | null>(
    null,
  );
  const [pendingDeleteMarinerId, setPendingDeleteMarinerId] = useState<
    string | null
  >(null);
  const [shipOptions, setShipOptions] = useState<string[]>(() => [
    ...VIEWER_SHIP_OPTIONS,
  ]);
  const [billetOptions, setBilletOptions] = useState<string[]>(() => [
    ...VIEWER_BILLET_OPTIONS,
  ]);

  const ingestMarinersResponse = useCallback(
    (data: {
      mariners?: Mariner[];
      certTypes?: CertType[];
      officeRole?: string;
      officeLogin?: string;
      shipOptions?: string[];
      billetOptions?: string[];
    }) => {
      setMariners(data.mariners ?? []);
      if (Array.isArray(data.certTypes)) {
        setCertTypes(sortCertTypesByDefaultSectionOrder(data.certTypes));
      }
      if (data.officeRole === "admin" || data.officeRole === "coordinator") {
        setOfficeRole(data.officeRole);
      }
      if (typeof data.officeLogin === "string") setOfficeLogin(data.officeLogin);
      if (Array.isArray(data.shipOptions)) setShipOptions(data.shipOptions);
      if (Array.isArray(data.billetOptions)) setBilletOptions(data.billetOptions);
    },
    [],
  );

  const refreshMariners = useCallback(async () => {
    const res = await fetch("/api/viewer/mariners", { credentials: "include" });
    if (res.status === 401) {
      router.replace("/viewer/login");
      return;
    }
    if (!res.ok) return;
    const data = await res.json();
    ingestMarinersResponse(data);
  }, [router, ingestMarinersResponse]);

  const displayMariners = useMemo(() => {
    const filtered = mariners.filter((m) => marinerMatchesQuery(m, searchQuery));
    const out = [...filtered];
    out.sort((a, b) => {
      if (sortBy === "newest") {
        return (
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      }
      if (sortBy === "name") {
        return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
      }
      if (sortBy === "vessel") {
        const v = compareAssignedText(
          a.assignedShip ?? null,
          b.assignedShip ?? null
        );
        if (v !== 0) return v;
        return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
      }
      if (sortBy === "billet") {
        const bl = compareAssignedText(
          a.assignedBillet ?? null,
          b.assignedBillet ?? null
        );
        if (bl !== 0) return bl;
        return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
      }
      return 0;
    });
    return out;
  }, [mariners, searchQuery, sortBy]);

  const effectiveOpenId = useMemo(() => {
    if (!openId) return null;
    return displayMariners.some((m) => m.id === openId) ? openId : null;
  }, [openId, displayMariners]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch("/api/viewer/mariners", { credentials: "include" });
      if (cancelled) return;
      if (res.status === 401) {
        router.replace("/viewer/login");
        return;
      }
      if (!res.ok) {
        setLoading(false);
        return;
      }
      const data = await res.json();
      if (cancelled) return;
      ingestMarinersResponse(data);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [router, ingestMarinersResponse]);

  async function logout() {
    await fetch("/api/viewer/logout", {
      method: "POST",
      credentials: "include",
    });
    router.replace("/viewer/login");
  }

  async function deleteMarinerAccount(m: Mariner) {
    setDeletingMarinerId(m.id);
    try {
      const res = await fetch(`/api/viewer/mariner/${m.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (res.status === 401) {
        router.replace("/viewer/login");
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        window.alert(
          typeof data.error === "string"
            ? data.error
            : "Could not delete this account.",
        );
        return;
      }
      setPendingDeleteMarinerId(null);
      setOpenId((id) => (id === m.id ? null : id));
      setCertSearchByMarinerId((prev) => {
        const next = { ...prev };
        delete next[m.id];
        return next;
      });
      await refreshMariners();
    } finally {
      setDeletingMarinerId(null);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-full flex-1 items-center justify-center bg-[#1a1208] text-slate-400">
        Loading crew documents…
      </div>
    );
  }

  return (
    <div className="flex min-h-full flex-1 flex-col bg-[#1a1208] text-slate-100">
      <header className="border-b border-white/10 px-6 py-5">
        <div className="mx-auto flex max-w-4xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-amber-200/90">
              Office portal
            </p>
            <h1 className="text-lg font-semibold text-white">
              Mariner documents
            </h1>
            {officeLogin && (
              <p className="mt-1 text-sm text-slate-500">
                Signed in as <span className="text-slate-300">{officeLogin}</span>
                {officeRole === "admin"
                  ? " · Administrator"
                  : officeRole === "coordinator"
                    ? " · Coordinator"
                    : null}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => void logout()}
            className="rounded-xl border border-white/15 px-4 py-2 text-sm text-slate-300 hover:bg-white/5"
          >
            Save and exit
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-10">
        {mariners.length === 0 ? (
          <p className="rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-slate-400">
            {officeRole === "coordinator"
              ? "No mariners match your vessel access, or none have a vessel on file yet. Mariners and office staff can set vessel and billet anytime."
              : "No mariners yet. Have crew register from the mariner portal, then set vessel and billet here or on their dashboard."}
          </p>
        ) : (
          <>
            <div className="mb-6">
              <input
                type="search"
                placeholder="Search by name, vessel, or billet…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none ring-amber-400/30 placeholder:text-slate-500 focus:ring-2"
              />
              {searchQuery.trim() && displayMariners.length === 0 && (
                <p className="mt-2 text-sm text-slate-500">No matches.</p>
              )}
              <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-slate-400">
                <span>Sort by</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortKey)}
                  className={viewerSelectClass}
                >
                  <option value="newest" className={viewerSelectOptionClass}>
                    Newest
                  </option>
                  <option value="name" className={viewerSelectOptionClass}>
                    Name (A–Z)
                  </option>
                  <option value="vessel" className={viewerSelectOptionClass}>
                    Vessel (A–Z)
                  </option>
                  <option value="billet" className={viewerSelectOptionClass}>
                    Billet (A–Z)
                  </option>
                </select>
              </div>
            </div>
            <ul className="space-y-4">
              {displayMariners.map((m) => {
                const collapsed = effectiveOpenId !== m.id;
                const canDeleteMariner =
                  officeRole === "admin" || officeRole === "coordinator";
                return (
                <li
                  key={m.id}
                  className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]"
                >
                  <div className="flex w-full min-w-0 items-stretch">
                    <button
                      type="button"
                      className="flex min-w-0 flex-1 flex-col gap-1 px-6 py-4 text-left transition hover:bg-white/[0.05] sm:flex-row sm:items-center sm:justify-between"
                      onClick={() =>
                        setOpenId((id) => {
                          if (id === m.id) return null;
                          setPendingDeleteMarinerId(null);
                          return m.id;
                        })
                      }
                    >
                      <div>
                        <p className="font-semibold text-white">{m.name}</p>
                        <p className="text-sm text-slate-400">{m.email}</p>
                      </div>
                      <div className="text-sm text-slate-500">
                        {m.documents.length} file
                        {m.documents.length === 1 ? "" : "s"} · joined{" "}
                        {new Date(m.createdAt).toLocaleDateString()}
                        {m.assignedShip?.trim() ? (
                          <span className="mt-0.5 block text-amber-200/85 sm:ml-2 sm:inline">
                            · {m.assignedShip.trim()}
                          </span>
                        ) : null}
                        {m.assignedBillet?.trim() ? (
                          <span className="mt-0.5 block text-slate-400 sm:ml-2 sm:inline">
                            · {m.assignedBillet.trim()}
                          </span>
                        ) : null}
                        <span className="ml-2 text-amber-200/80">
                          {effectiveOpenId === m.id ? "▾" : "▸"}
                        </span>
                      </div>
                    </button>
                    {canDeleteMariner && collapsed ? (
                      <div className="flex shrink-0 flex-col justify-center border-l border-white/10 bg-black/25">
                        {pendingDeleteMarinerId !== m.id ? (
                          <button
                            type="button"
                            className="flex h-full min-h-[3rem] items-center justify-center px-4 text-slate-400 transition hover:bg-red-950/40 hover:text-red-200"
                            title="Delete mariner account"
                            aria-label="Delete mariner account"
                            onClick={(e) => {
                              e.stopPropagation();
                              setPendingDeleteMarinerId(m.id);
                            }}
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              fill="none"
                              viewBox="0 0 24 24"
                              strokeWidth={1.5}
                              stroke="currentColor"
                              className="h-5 w-5"
                              aria-hidden
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"
                              />
                            </svg>
                          </button>
                        ) : (
                          <div className="flex max-w-[min(100vw-8rem,17rem)] flex-col gap-2 px-3 py-3 sm:max-w-[17rem]">
                            <p className="text-xs leading-snug text-slate-400">
                              Are you sure you want to permanently delete this
                              crewmember?
                            </p>
                            <div className="flex flex-wrap items-center gap-2">
                              <button
                                type="button"
                                disabled={deletingMarinerId === m.id}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void deleteMarinerAccount(m);
                                }}
                                className="rounded-lg border border-red-400/45 bg-red-950/50 px-3 py-1.5 text-xs font-semibold text-red-100 hover:bg-red-950/70 disabled:opacity-50"
                              >
                                {deletingMarinerId === m.id
                                  ? "Deleting…"
                                  : "Yes"}
                              </button>
                              <button
                                type="button"
                                disabled={deletingMarinerId === m.id}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setPendingDeleteMarinerId(null);
                                }}
                                className="rounded-lg border border-white/15 px-3 py-1.5 text-xs font-medium text-slate-400 hover:bg-white/5 hover:text-slate-200 disabled:opacity-50"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : null}
                  </div>
                  {effectiveOpenId === m.id && (
                    <div className="border-t border-white/10 px-6 py-4">
                      <AssignmentPanel
                        key={m.id}
                        marinerId={m.id}
                        assignedShip={m.assignedShip ?? null}
                        assignedBillet={m.assignedBillet ?? null}
                        shipOptions={shipOptions}
                        billetOptions={billetOptions}
                        onUpdated={refreshMariners}
                      />
                      <div className="mt-4">
                        <label
                          htmlFor={`cert-search-${m.id}`}
                          className="mb-1.5 block text-xs font-medium text-amber-200/85"
                        >
                          Search this mariner&apos;s certificates
                        </label>
                        <input
                          id={`cert-search-${m.id}`}
                          type="search"
                          value={certSearchByMarinerId[m.id] ?? ""}
                          onChange={(e) =>
                            setCertSearchByMarinerId((prev) => ({
                              ...prev,
                              [m.id]: e.target.value,
                            }))
                          }
                          placeholder="Certificate name, category detail, or file name…"
                          className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none ring-amber-400/30 placeholder:text-slate-500 focus:ring-2 [color-scheme:dark]"
                        />
                      </div>
                      <CertificateChecklist
                        key={`certs-${m.id}`}
                        m={m}
                        certTypes={certTypes}
                        certSearchQuery={certSearchByMarinerId[m.id] ?? ""}
                      />
                    </div>
                  )}
                </li>
                );
              })}
            </ul>
          </>
        )}
        {officeRole === "admin" ? (
          <>
            <AssignmentOptionsAdminPanel onSaved={refreshMariners} />
            <OfficeTeamPanel shipOptions={shipOptions} />
            <CertTemplatesAdminPanel onSaved={refreshMariners} />
          </>
        ) : null}
      </main>
    </div>
  );
}
