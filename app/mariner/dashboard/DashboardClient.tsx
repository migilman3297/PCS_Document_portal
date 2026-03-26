"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { sortCertTypesByDefaultSectionOrder } from "@/lib/certTypes";
import {
  VIEWER_BILLET_OPTIONS,
  VIEWER_SHIP_OPTIONS,
} from "@/lib/viewerAssignment";
import { FileThumb, marinerFileViewUrl } from "@/app/components/FileThumb";
import {
  addCalendarYears,
  expiryDisplayStatus,
  subtractCalendarYears,
} from "@/lib/certExpiry";

type CertSectionKey = "medical" | "training" | "credentials" | "additional";

type CertSection = {
  key: CertSectionKey;
  label: string;
  description: string;
};

type CertType = {
  key: string;
  label: string;
  renewalPeriodicity: string;
  section: CertSectionKey;
  requiresExpiry: boolean;
  validityYears: number | null;
  optionalExpiry?: boolean;
  requiresCustomTitle?: boolean;
};

function isTrainingNoExpiry(cert: CertType): boolean {
  return cert.section === "training" && !cert.requiresExpiry;
}

function isMedicalNoExpiry(cert: CertType): boolean {
  return cert.section === "medical" && !cert.requiresExpiry;
}

type DocRow = {
  id: string;
  certKey: string;
  originalName: string;
  mimeType?: string;
  uploadedAt: string;
  expiresAt?: string | null;
  certificateIssuedDate?: string | null;
  customTitle?: string | null;
};

function certificateDateForEdit(d: DocRow, c: CertType): string {
  if (!d.expiresAt) return "";
  if (c.validityYears != null) {
    return subtractCalendarYears(d.expiresAt, c.validityYears) ?? "";
  }
  return d.expiresAt;
}

function usesIssueDateForCert(cert: CertType): boolean {
  return cert.validityYears != null;
}

function primaryDateLabel(cert: CertType): string {
  if (usesIssueDateForCert(cert)) return "Certificate date";
  if (cert.requiresExpiry) return "Expiration date";
  return "Certificate date (optional)";
}

function resolveToOptionList(
  value: string | null | undefined,
  list: string[],
): string {
  if (!value?.trim()) return "";
  const t = value.trim().toLowerCase();
  return list.find((x) => x.toLowerCase() === t) ?? "";
}

type Me = {
  id: string;
  email: string;
  name: string;
  assignedShip?: string | null;
  assignedBillet?: string | null;
};

export function DashboardClient() {
  const [me, setMe] = useState<Me | null>(null);
  const [certSections, setCertSections] = useState<CertSection[]>([]);
  const [certTypes, setCertTypes] = useState<CertType[]>([]);
  const [documents, setDocuments] = useState<DocRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploadKey, setUploadKey] = useState<string | null>(null);
  /** YYYY-MM-DD: certificate (issue) date when `validityYears` set; otherwise expiry on document. */
  const [expiryDraft, setExpiryDraft] = useState<Record<string, string>>({});
  const [customTitleDraft, setCustomTitleDraft] = useState<
    Record<string, string>
  >({});
  /** Collapsible checklist sections; omitted keys default to expanded. */
  const [expandedSections, setExpandedSections] = useState<
    Record<string, boolean>
  >({});
  const [shipOptions, setShipOptions] = useState<string[]>(() => [
    ...VIEWER_SHIP_OPTIONS,
  ]);
  const [billetOptions, setBilletOptions] = useState<string[]>(() => [
    ...VIEWER_BILLET_OPTIONS,
  ]);
  const [shipDraft, setShipDraft] = useState("");
  const [billetDraft, setBilletDraft] = useState("");
  const [savingVesselBillet, setSavingVesselBillet] = useState(false);
  const [editingDocId, setEditingDocId] = useState<string | null>(null);
  const [editDateDraft, setEditDateDraft] = useState<Record<string, string>>(
    {},
  );
  const [editTitleDraft, setEditTitleDraft] = useState<Record<string, string>>(
    {},
  );
  const [savingDocId, setSavingDocId] = useState<string | null>(null);
  const [deletingDocId, setDeletingDocId] = useState<string | null>(null);
  const [additionalDateMode, setAdditionalDateMode] = useState<
    Record<string, "expiration" | "issue">
  >({});
  const [additionalIssueDateDraft, setAdditionalIssueDateDraft] = useState<
    Record<string, string>
  >({});
  const [additionalIssueYearsDraft, setAdditionalIssueYearsDraft] = useState<
    Record<string, string>
  >({});
  const [editAdditionalMode, setEditAdditionalMode] = useState<
    Record<string, "expiration" | "issue">
  >({});
  const [editIssueDateDraft, setEditIssueDateDraft] = useState<
    Record<string, string>
  >({});
  const [editIssueYearsDraft, setEditIssueYearsDraft] = useState<
    Record<string, string>
  >({});
  const [certificateIssueDraft, setCertificateIssueDraft] = useState<
    Record<string, string>
  >({});
  const [editCertificateIssueDraft, setEditCertificateIssueDraft] = useState<
    Record<string, string>
  >({});

  const marinerSelectClass =
    "w-full rounded-xl border border-white/10 bg-[#0f172a] px-3 py-2 text-sm text-slate-100 [color-scheme:dark] outline-none ring-cyan-400/30 focus:ring-2";
  const marinerSelectOptionClass = "bg-[#0f172a] text-slate-100";

  const load = useCallback(async () => {
    setError(null);
    const res = await fetch("/api/mariner/certs", { credentials: "include" });
    if (!res.ok) {
      if (res.status === 401) {
        window.location.href = "/mariner/login?next=/mariner/dashboard";
        return;
      }
      setError("Could not load your documents.");
      setLoading(false);
      return;
    }
    const data = await res.json();
    setMe(data.user);
    setCertSections(data.certSections ?? []);
    setCertTypes(
      sortCertTypesByDefaultSectionOrder(data.certTypes ?? []),
    );
    setDocuments(data.documents ?? []);
    if (Array.isArray(data.shipOptions)) setShipOptions(data.shipOptions);
    else setShipOptions([...VIEWER_SHIP_OPTIONS]);
    if (Array.isArray(data.billetOptions)) setBilletOptions(data.billetOptions);
    else setBilletOptions([...VIEWER_BILLET_OPTIONS]);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!me) return;
    setShipDraft(resolveToOptionList(me.assignedShip, shipOptions));
    setBilletDraft(resolveToOptionList(me.assignedBillet, billetOptions));
  }, [me, shipOptions, billetOptions]);

  async function saveVesselBillet() {
    setSavingVesselBillet(true);
    setError(null);
    try {
      const res = await fetch("/api/mariner/profile", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assignedShip: shipDraft,
          assignedBillet: billetDraft,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Could not save.");
        return;
      }
      await load();
    } finally {
      setSavingVesselBillet(false);
    }
  }

  const typesBySection = useMemo(() => {
    const map = new Map<CertSectionKey, CertType[]>();
    for (const t of certTypes) {
      const list = map.get(t.section) ?? [];
      list.push(t);
      map.set(t.section, list);
    }
    return map;
  }, [certTypes]);

  async function logout() {
    await fetch("/api/mariner/logout", {
      method: "POST",
      credentials: "include",
    });
    window.location.href = "/";
  }

  async function removeDocument(docId: string) {
    if (!window.confirm("Remove this upload? This cannot be undone.")) return;
    setDeletingDocId(docId);
    setError(null);
    try {
      const res = await fetch(`/api/mariner/document/${docId}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Remove failed.");
        return;
      }
      if (editingDocId === docId) setEditingDocId(null);
      await load();
    } finally {
      setDeletingDocId(null);
    }
  }

  async function saveDocumentDate(doc: DocRow, cert: CertType) {
    if (cert.requiresCustomTitle) {
      const title = (editTitleDraft[doc.id] ?? "").trim();
      if (!title) {
        setError("Enter a document title.");
        return;
      }
      setSavingDocId(doc.id);
      setError(null);
      const mode = editAdditionalMode[doc.id] ?? "expiration";
      let dateSend = "";
      if (mode === "issue") {
        const issue = (editIssueDateDraft[doc.id] ?? "").trim();
        const yearsStr = (editIssueYearsDraft[doc.id] ?? "").trim();
        const years = parseInt(yearsStr, 10);
        if (
          !issue ||
          !yearsStr ||
          !Number.isFinite(years) ||
          years < 1 ||
          years > 50
        ) {
          setError(
            "Enter certificate issue date and validity years (1–50).",
          );
          setSavingDocId(null);
          return;
        }
        const computed = addCalendarYears(issue, years);
        if (!computed) {
          setError("Enter a valid certificate issue date.");
          setSavingDocId(null);
          return;
        }
        dateSend = computed;
      } else {
        dateSend = (editDateDraft[doc.id] ?? "").trim();
      }
      try {
        const res = await fetch(`/api/mariner/document/${doc.id}`, {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            customTitle: title,
            certificateDate: dateSend,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(
            typeof data.error === "string" ? data.error : "Could not save.",
          );
          return;
        }
        setEditingDocId(null);
        await load();
      } finally {
        setSavingDocId(null);
      }
      return;
    }

    if (
      isTrainingNoExpiry(cert) &&
      !cert.requiresCustomTitle
    ) {
      setSavingDocId(doc.id);
      setError(null);
      const raw = (editCertificateIssueDraft[doc.id] ?? "").trim();
      try {
        const res = await fetch(`/api/mariner/document/${doc.id}`, {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ certificateIssuedDate: raw }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(
            typeof data.error === "string" ? data.error : "Could not save.",
          );
          return;
        }
        setEditingDocId(null);
        await load();
      } finally {
        setSavingDocId(null);
      }
      return;
    }

    if (!cert.requiresExpiry) return;
    const raw = (editDateDraft[doc.id] ?? "").trim();
    if (!raw) {
      setError(
        usesIssueDateForCert(cert)
          ? "Enter a certificate date."
          : "Enter an expiration date.",
      );
      return;
    }
    setSavingDocId(doc.id);
    setError(null);
    try {
      const res = await fetch(`/api/mariner/document/${doc.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ certificateDate: raw }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Could not save date.");
        return;
      }
      setEditingDocId(null);
      await load();
    } finally {
      setSavingDocId(null);
    }
  }

  async function upload(cert: CertType, file: File | null) {
    if (!file) return;
    setUploadKey(cert.key);
    setError(null);
    if (cert.requiresCustomTitle) {
      const title = (customTitleDraft[cert.key] ?? "").trim();
      if (!title) {
        setError("Enter a document title before uploading.");
        setUploadKey(null);
        return;
      }
      const mode = additionalDateMode[cert.key] ?? "expiration";
      if (mode === "issue") {
        const issue = (additionalIssueDateDraft[cert.key] ?? "").trim();
        const yearsStr = (additionalIssueYearsDraft[cert.key] ?? "").trim();
        const years = parseInt(yearsStr, 10);
        if (
          !issue ||
          !yearsStr ||
          !Number.isFinite(years) ||
          years < 1 ||
          years > 50
        ) {
          setError(
            "Enter certificate issue date and validity years (1–50).",
          );
          setUploadKey(null);
          return;
        }
        const computed = addCalendarYears(issue, years);
        if (!computed) {
          setError("Enter a valid certificate issue date.");
          setUploadKey(null);
          return;
        }
      }
    }

    const raw = (expiryDraft[cert.key] ?? "").trim();
    if (cert.requiresExpiry && !raw) {
      setError(
        `Enter the ${usesIssueDateForCert(cert) ? "certificate date" : "expiration date"} for “${cert.label}” before uploading.`,
      );
      setUploadKey(null);
      return;
    }

    let expiresAtOut: string | null = null;

    if (cert.requiresCustomTitle) {
      const mode = additionalDateMode[cert.key] ?? "expiration";
      if (mode === "issue") {
        const issue = (additionalIssueDateDraft[cert.key] ?? "").trim();
        const years = parseInt(
          (additionalIssueYearsDraft[cert.key] ?? "").trim(),
          10,
        );
        expiresAtOut = addCalendarYears(issue, years);
      } else if (raw) {
        expiresAtOut = raw;
      }
    } else if (cert.requiresExpiry) {
      if (cert.validityYears != null) {
        const computed = addCalendarYears(raw, cert.validityYears);
        if (!computed) {
          setError(`Enter a valid certificate date for “${cert.label}”.`);
          setUploadKey(null);
          return;
        }
        expiresAtOut = computed;
      } else {
        expiresAtOut = raw;
      }
    }

    const fd = new FormData();
    fd.set("certKey", cert.key);
    fd.set("file", file);
    if (cert.requiresCustomTitle) {
      fd.set("customTitle", (customTitleDraft[cert.key] ?? "").trim());
    }
    if (expiresAtOut) {
      fd.set("expiresAt", expiresAtOut);
    }
    if (isTrainingNoExpiry(cert)) {
      const cid = (certificateIssueDraft[cert.key] ?? "").trim();
      if (cid) fd.set("certificateIssuedDate", cid);
    }
    try {
      const res = await fetch("/api/mariner/upload", {
        method: "POST",
        body: fd,
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Upload failed");
        return;
      }
      if (cert.requiresCustomTitle) {
        setCustomTitleDraft((prev) => ({ ...prev, [cert.key]: "" }));
        setExpiryDraft((prev) => ({ ...prev, [cert.key]: "" }));
        setAdditionalIssueDateDraft((prev) => ({ ...prev, [cert.key]: "" }));
        setAdditionalIssueYearsDraft((prev) => ({ ...prev, [cert.key]: "" }));
      }
      if (isTrainingNoExpiry(cert)) {
        setCertificateIssueDraft((prev) => ({ ...prev, [cert.key]: "" }));
      }
      await load();
    } finally {
      setUploadKey(null);
    }
  }

  const byCert = (key: string) =>
    documents.filter((d) => d.certKey === key).sort(
      (a, b) =>
        new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
    );

  function formatExpiryLabel(iso: string | null | undefined): string | null {
    if (!iso) return null;
    const [y, m, d] = iso.split("-").map(Number);
    if (!y || !m || !d) return iso;
    return new Date(y, m - 1, d).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  if (loading) {
    return (
      <div className="flex min-h-full flex-1 items-center justify-center bg-[#0c1929] text-slate-400">
        Loading your checklist…
      </div>
    );
  }

  return (
    <div className="flex min-h-full flex-1 flex-col bg-[#0c1929] text-slate-100">
      <header className="border-b border-white/10 px-6 py-5">
        <div className="mx-auto flex max-w-3xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-cyan-300/90">
              Your documents
            </p>
            <p className="text-lg font-semibold text-white">
              {me?.name}
              <span className="font-normal text-slate-400">
                {" "}
                · {me?.email}
              </span>
            </p>
            <p className="mt-1 text-sm text-slate-500">
              Earlier uploads stay here when you return—add new files anytime.
            </p>
            {(me?.assignedShip || me?.assignedBillet) && (
              <p className="mt-2 text-xs text-slate-500">
                Vessel & billet:{" "}
                <span className="text-slate-400">
                  {[me?.assignedShip, me?.assignedBillet].filter(Boolean).join(" · ")}
                </span>
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => void logout()}
            className="shrink-0 rounded-xl border border-white/15 px-4 py-2 text-sm text-slate-300 hover:bg-white/5"
          >
            Save and exit
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">
        {error && (
          <p className="mb-6 rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </p>
        )}

        <div className="mb-10 rounded-2xl border border-white/10 bg-white/[0.02] p-6">
          <h2 className="font-semibold text-white">Your vessel & billet</h2>
          <p className="mt-1 text-sm text-slate-400">
            Optional. You or the office can update this anytime—it is the same for everyone.
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">
                Vessel
              </label>
              <select
                value={shipDraft}
                onChange={(e) => setShipDraft(e.target.value)}
                className={marinerSelectClass}
              >
                <option value="" className={marinerSelectOptionClass}>
                  Select…
                </option>
                {shipOptions.map((n) => (
                  <option key={n} value={n} className={marinerSelectOptionClass}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">
                Billet
              </label>
              <select
                value={billetDraft}
                onChange={(e) => setBilletDraft(e.target.value)}
                className={marinerSelectClass}
              >
                <option value="" className={marinerSelectOptionClass}>
                  Select…
                </option>
                {billetOptions.map((n) => (
                  <option key={n} value={n} className={marinerSelectOptionClass}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void saveVesselBillet()}
            disabled={savingVesselBillet}
            className="mt-4 rounded-xl bg-cyan-500 px-4 py-2 text-sm font-semibold text-[#0c1929] hover:bg-cyan-400 disabled:opacity-50"
          >
            {savingVesselBillet ? "Saving…" : "Save"}
          </button>
        </div>

        <div className="space-y-12">
          {certSections.map((section) => {
            const types = typesBySection.get(section.key) ?? [];
            if (types.length === 0) return null;
            const sectionOpen = expandedSections[section.key] ?? true;
            return (
              <section key={section.key}>
                <button
                  type="button"
                  aria-expanded={sectionOpen}
                  onClick={() =>
                    setExpandedSections((prev) => ({
                      ...prev,
                      [section.key]: !(prev[section.key] ?? true),
                    }))
                  }
                  className="flex w-full items-start gap-3 border-b border-white/10 pb-4 text-left transition hover:opacity-90"
                >
                  <span
                    className="mt-1 shrink-0 select-none text-slate-500"
                    aria-hidden
                  >
                    {sectionOpen ? "▼" : "▶"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <h2 className="text-xl font-semibold text-white">
                      {section.label}
                    </h2>
                    <p className="mt-1 text-sm text-slate-400">
                      {section.description}
                    </p>
                  </div>
                </button>
                {sectionOpen ? (
                <ul className="mt-6 space-y-6">
                  {types.map((c) => {
                    const rows = byCert(c.key);
                    const certDateDraft = (expiryDraft[c.key] ?? "").trim();
                    const computedExpiry =
                      c.validityYears != null && certDateDraft
                        ? addCalendarYears(certDateDraft, c.validityYears)
                        : null;
                    const computedExpiryLabel = computedExpiry
                      ? formatExpiryLabel(computedExpiry)
                      : null;
                    return (
                      <li
                        key={c.key}
                        className="rounded-2xl border border-white/10 bg-white/[0.03] p-6"
                      >
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <h3 className="font-semibold text-white">
                              {c.label}
                            </h3>
                            {!isMedicalNoExpiry(c) &&
                            c.renewalPeriodicity.trim() ? (
                              <p className="mt-1 text-sm text-slate-400">
                                Renewal periodicity: {c.renewalPeriodicity}
                              </p>
                            ) : null}
                          </div>
                          <div className="flex w-full flex-col gap-3 sm:w-auto sm:min-w-[200px]">
                            {c.requiresExpiry ? (
                              <div>
                                <label className="mb-1 block text-xs font-medium text-slate-400">
                                  {primaryDateLabel(c)}{" "}
                                  <span className="text-red-300">*</span>
                                </label>
                                <input
                                  type="date"
                                  className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none ring-cyan-400/40 focus:ring-2"
                                  value={expiryDraft[c.key] ?? ""}
                                  onChange={(e) =>
                                    setExpiryDraft((prev) => ({
                                      ...prev,
                                      [c.key]: e.target.value,
                                    }))
                                  }
                                />
                                {c.validityYears != null &&
                                  computedExpiryLabel && (
                                    <p className="mt-1.5 text-xs text-slate-500">
                                      Calculated expiry:{" "}
                                      <span className="font-medium text-slate-400">
                                        {computedExpiryLabel}
                                      </span>
                                    </p>
                                  )}
                              </div>
                            ) : isTrainingNoExpiry(c) ? (
                              <div>
                                <label className="mb-1 block text-xs font-medium text-slate-400">
                                  Certificate date (optional)
                                </label>
                                <input
                                  type="date"
                                  className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none ring-cyan-400/40 focus:ring-2"
                                  value={certificateIssueDraft[c.key] ?? ""}
                                  onChange={(e) =>
                                    setCertificateIssueDraft((prev) => ({
                                      ...prev,
                                      [c.key]: e.target.value,
                                    }))
                                  }
                                />
                                <p className="mt-1.5 text-xs text-slate-500">
                                  One-time qualification — no expiration stored.
                                </p>
                              </div>
                            ) : c.requiresCustomTitle ? (
                              <div>
                                <label className="mb-1 block text-xs font-medium text-slate-400">
                                  Document title{" "}
                                  <span className="text-red-300">*</span>
                                </label>
                                <input
                                  type="text"
                                  className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none ring-cyan-400/40 focus:ring-2"
                                  value={customTitleDraft[c.key] ?? ""}
                                  onChange={(e) =>
                                    setCustomTitleDraft((prev) => ({
                                      ...prev,
                                      [c.key]: e.target.value,
                                    }))
                                  }
                                  placeholder="Document title"
                                />
                                <p className="mt-3 text-xs font-medium text-slate-400">
                                  Date on document
                                </p>
                                <div className="mt-2 flex flex-col gap-2">
                                  <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-300">
                                    <input
                                      type="radio"
                                      className="border-white/20 bg-white/5 text-cyan-500"
                                      checked={
                                        (additionalDateMode[c.key] ??
                                          "expiration") === "expiration"
                                      }
                                      onChange={() =>
                                        setAdditionalDateMode((prev) => ({
                                          ...prev,
                                          [c.key]: "expiration",
                                        }))
                                      }
                                    />
                                    Expiration date
                                  </label>
                                  <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-300">
                                    <input
                                      type="radio"
                                      className="border-white/20 bg-white/5 text-cyan-500"
                                      checked={
                                        (additionalDateMode[c.key] ??
                                          "expiration") === "issue"
                                      }
                                      onChange={() =>
                                        setAdditionalDateMode((prev) => ({
                                          ...prev,
                                          [c.key]: "issue",
                                        }))
                                      }
                                    />
                                    Certificate (issue) date
                                  </label>
                                </div>
                                {(additionalDateMode[c.key] ?? "expiration") ===
                                "expiration" ? (
                                  <>
                                    <label className="mb-1 mt-3 block text-xs font-medium text-slate-400">
                                      Expiration date (optional)
                                    </label>
                                    <input
                                      type="date"
                                      className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none ring-cyan-400/40 focus:ring-2"
                                      value={expiryDraft[c.key] ?? ""}
                                      onChange={(e) =>
                                        setExpiryDraft((prev) => ({
                                          ...prev,
                                          [c.key]: e.target.value,
                                        }))
                                      }
                                    />
                                    <p className="mt-1.5 text-xs text-slate-500">
                                      Leave blank if the document does not
                                      expire.
                                    </p>
                                  </>
                                ) : (
                                  <>
                                    <label className="mb-1 mt-3 block text-xs font-medium text-slate-400">
                                      Certificate issue date{" "}
                                      <span className="text-red-300">*</span>
                                    </label>
                                    <input
                                      type="date"
                                      className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none ring-cyan-400/40 focus:ring-2"
                                      value={
                                        additionalIssueDateDraft[c.key] ?? ""
                                      }
                                      onChange={(e) =>
                                        setAdditionalIssueDateDraft((prev) => ({
                                          ...prev,
                                          [c.key]: e.target.value,
                                        }))
                                      }
                                    />
                                    <label className="mb-1 mt-3 block text-xs font-medium text-slate-400">
                                      Valid for (years){" "}
                                      <span className="text-red-300">*</span>
                                    </label>
                                    <input
                                      type="number"
                                      min={1}
                                      max={50}
                                      className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none ring-cyan-400/40 focus:ring-2"
                                      value={
                                        additionalIssueYearsDraft[c.key] ?? ""
                                      }
                                      onChange={(e) =>
                                        setAdditionalIssueYearsDraft(
                                          (prev) => ({
                                            ...prev,
                                            [c.key]: e.target.value,
                                          }),
                                        )
                                      }
                                    />
                                  </>
                                )}
                              </div>
                            ) : isMedicalNoExpiry(c) ? null : (
                              <div>
                                <p className="mb-1 text-xs font-medium text-slate-400">
                                  Date
                                </p>
                                <p className="text-sm text-slate-500">
                                  No expiration
                                </p>
                              </div>
                            )}
                            <label
                              className={`inline-flex cursor-pointer items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
                                uploadKey !== null ||
                                (c.requiresExpiry &&
                                  !(expiryDraft[c.key] ?? "").trim()) ||
                                (c.requiresCustomTitle &&
                                  !(customTitleDraft[c.key] ?? "").trim()) ||
                                (c.requiresCustomTitle &&
                                  (additionalDateMode[c.key] ?? "expiration") ===
                                    "issue" &&
                                  (!(additionalIssueDateDraft[c.key] ?? "")
                                    .trim() ||
                                    !(additionalIssueYearsDraft[c.key] ?? "")
                                      .trim()))
                                  ? "cursor-not-allowed bg-white/10 text-slate-500"
                                  : "bg-cyan-500 text-[#0c1929] hover:bg-cyan-400"
                              }`}
                            >
                              {uploadKey === c.key ? "Uploading…" : "Upload file"}
                              <input
                                type="file"
                                className="hidden"
                                accept=".pdf,image/jpeg,image/png,image/webp"
                                disabled={
                                  uploadKey !== null ||
                                  (c.requiresExpiry &&
                                    !(expiryDraft[c.key] ?? "").trim()) ||
                                  (c.requiresCustomTitle &&
                                    !(customTitleDraft[c.key] ?? "").trim()) ||
                                  (c.requiresCustomTitle &&
                                    (additionalDateMode[c.key] ?? "expiration") ===
                                      "issue" &&
                                    (!(additionalIssueDateDraft[c.key] ?? "")
                                      .trim() ||
                                      !(additionalIssueYearsDraft[c.key] ?? "")
                                        .trim()))
                                }
                                onChange={(e) => {
                                  const f = e.target.files?.[0] ?? null;
                                  e.target.value = "";
                                  void upload(c, f);
                                }}
                              />
                            </label>
                          </div>
                        </div>
                        {rows.length === 0 ? (
                          <p className="mt-4 text-sm text-slate-500">
                            No files yet for this category.
                          </p>
                        ) : (
                          <ul className="mt-4 space-y-3 border-t border-white/10 pt-4">
                            {rows.map((d) => {
                              const exp = formatExpiryLabel(d.expiresAt);
                              const status = expiryDisplayStatus(d.expiresAt);
                              const expColor =
                                status === "valid"
                                  ? "text-emerald-400"
                                  : status === "expired"
                                    ? "text-red-400"
                                    : "text-slate-500";
                              const busy =
                                savingDocId === d.id || deletingDocId === d.id;
                              const isEditing = editingDocId === d.id;
                              const displayTitle =
                                d.customTitle?.trim() || d.originalName;
                              const showExpiryRow =
                                c.requiresExpiry ||
                                c.requiresCustomTitle ||
                                isTrainingNoExpiry(c);
                              const certIssuedLabel = formatExpiryLabel(
                                d.certificateIssuedDate,
                              );
                              return (
                                <li
                                  key={d.id}
                                  className="flex flex-wrap items-start gap-3 rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-sm"
                                >
                                  <FileThumb
                                    docId={d.id}
                                    mimeType={
                                      d.mimeType ?? "application/octet-stream"
                                    }
                                    viewUrl={marinerFileViewUrl(d.id)}
                                  />
                                  <div className="min-w-0 flex-1">
                                    <p className="truncate font-medium text-slate-200">
                                      {displayTitle}
                                    </p>
                                    {d.customTitle?.trim() ? (
                                      <p className="truncate text-xs text-slate-500">
                                        {d.originalName}
                                      </p>
                                    ) : null}
                                    {showExpiryRow ? (
                                      <p className="mt-0.5 text-xs text-slate-500">
                                        {isTrainingNoExpiry(c) ? (
                                          certIssuedLabel ? (
                                            <span className="font-medium text-slate-400">
                                              Certificate date {certIssuedLabel}
                                            </span>
                                          ) : (
                                            <span className="text-slate-500">
                                              Certificate date not set — use
                                              Edit
                                            </span>
                                          )
                                        ) : exp ? (
                                          <span
                                            className={`font-medium ${expColor}`}
                                          >
                                            Expires {exp}
                                          </span>
                                        ) : c.requiresExpiry ? (
                                          <span className="text-amber-200/80">
                                            Date not set — use Edit
                                          </span>
                                        ) : (
                                          <span className="text-slate-500">
                                            No expiration
                                          </span>
                                        )}
                                      </p>
                                    ) : null}
                                    {isEditing &&
                                    (c.requiresExpiry ||
                                      c.requiresCustomTitle ||
                                      isTrainingNoExpiry(c)) ? (
                                      <div className="mt-2 flex flex-col gap-2">
                                        {c.requiresCustomTitle ? (
                                          <>
                                            <input
                                              type="text"
                                              className="w-full max-w-xs rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs text-white outline-none ring-cyan-400/40 focus:ring-2"
                                              value={
                                                editTitleDraft[d.id] ?? ""
                                              }
                                              onChange={(e) =>
                                                setEditTitleDraft((prev) => ({
                                                  ...prev,
                                                  [d.id]: e.target.value,
                                                }))
                                              }
                                              disabled={busy}
                                              placeholder="Document title"
                                            />
                                            <p className="text-[10px] font-medium text-slate-400">
                                              Date on document
                                            </p>
                                            <div className="flex flex-col gap-1.5">
                                              <label className="flex cursor-pointer items-center gap-2 text-[11px] text-slate-300">
                                                <input
                                                  type="radio"
                                                  className="border-white/20 bg-white/5 text-cyan-500"
                                                  checked={
                                                    (editAdditionalMode[
                                                      d.id
                                                    ] ?? "expiration") ===
                                                    "expiration"
                                                  }
                                                  onChange={() =>
                                                    setEditAdditionalMode(
                                                      (prev) => ({
                                                        ...prev,
                                                        [d.id]: "expiration",
                                                      }),
                                                    )
                                                  }
                                                  disabled={busy}
                                                />
                                                Expiration date
                                              </label>
                                              <label className="flex cursor-pointer items-center gap-2 text-[11px] text-slate-300">
                                                <input
                                                  type="radio"
                                                  className="border-white/20 bg-white/5 text-cyan-500"
                                                  checked={
                                                    (editAdditionalMode[
                                                      d.id
                                                    ] ?? "expiration") ===
                                                    "issue"
                                                  }
                                                  onChange={() =>
                                                    setEditAdditionalMode(
                                                      (prev) => ({
                                                        ...prev,
                                                        [d.id]: "issue",
                                                      }),
                                                    )
                                                  }
                                                  disabled={busy}
                                                />
                                                Certificate (issue) date
                                              </label>
                                            </div>
                                            {(editAdditionalMode[d.id] ??
                                              "expiration") ===
                                            "expiration" ? (
                                              <input
                                                type="date"
                                                className="max-w-[11rem] rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs text-white outline-none ring-cyan-400/40 focus:ring-2"
                                                value={
                                                  editDateDraft[d.id] ?? ""
                                                }
                                                onChange={(e) =>
                                                  setEditDateDraft((prev) => ({
                                                    ...prev,
                                                    [d.id]: e.target.value,
                                                  }))
                                                }
                                                disabled={busy}
                                              />
                                            ) : (
                                              <div className="flex flex-wrap items-end gap-2">
                                                <div>
                                                  <label className="mb-0.5 block text-[10px] text-slate-500">
                                                    Issue date *
                                                  </label>
                                                  <input
                                                    type="date"
                                                    className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs text-white outline-none ring-cyan-400/40 focus:ring-2"
                                                    value={
                                                      editIssueDateDraft[
                                                        d.id
                                                      ] ?? ""
                                                    }
                                                    onChange={(e) =>
                                                      setEditIssueDateDraft(
                                                        (prev) => ({
                                                          ...prev,
                                                          [d.id]:
                                                            e.target.value,
                                                        }),
                                                      )
                                                    }
                                                    disabled={busy}
                                                  />
                                                </div>
                                                <div>
                                                  <label className="mb-0.5 block text-[10px] text-slate-500">
                                                    Years *
                                                  </label>
                                                  <input
                                                    type="number"
                                                    min={1}
                                                    max={50}
                                                    className="w-20 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs text-white outline-none ring-cyan-400/40 focus:ring-2"
                                                    value={
                                                      editIssueYearsDraft[
                                                        d.id
                                                      ] ?? ""
                                                    }
                                                    onChange={(e) =>
                                                      setEditIssueYearsDraft(
                                                        (prev) => ({
                                                          ...prev,
                                                          [d.id]:
                                                            e.target.value,
                                                        }),
                                                      )
                                                    }
                                                    disabled={busy}
                                                  />
                                                </div>
                                              </div>
                                            )}
                                          </>
                                        ) : isTrainingNoExpiry(c) ? (
                                          <div>
                                            <label className="mb-0.5 block text-[10px] text-slate-500">
                                              Certificate date (optional)
                                            </label>
                                            <input
                                              type="date"
                                              className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs text-white outline-none ring-cyan-400/40 focus:ring-2"
                                              value={
                                                editCertificateIssueDraft[
                                                  d.id
                                                ] ?? ""
                                              }
                                              onChange={(e) =>
                                                setEditCertificateIssueDraft(
                                                  (prev) => ({
                                                    ...prev,
                                                    [d.id]: e.target.value,
                                                  }),
                                                )
                                              }
                                              disabled={busy}
                                            />
                                          </div>
                                        ) : (
                                          <div>
                                            <label className="mb-0.5 block text-[10px] text-slate-500">
                                              {primaryDateLabel(c)}
                                            </label>
                                            <input
                                              type="date"
                                              className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs text-white outline-none ring-cyan-400/40 focus:ring-2"
                                              value={
                                                editDateDraft[d.id] ?? ""
                                              }
                                              onChange={(e) =>
                                                setEditDateDraft((prev) => ({
                                                  ...prev,
                                                  [d.id]: e.target.value,
                                                }))
                                              }
                                              disabled={busy}
                                            />
                                          </div>
                                        )}
                                        <div className="flex flex-wrap items-center gap-2">
                                          {c.requiresCustomTitle ? (
                                            <span className="text-[10px] text-slate-500">
                                              Expiration mode: clear date for no
                                              expiry
                                            </span>
                                          ) : null}
                                          <button
                                            type="button"
                                            disabled={busy}
                                            onClick={() =>
                                              void saveDocumentDate(d, c)
                                            }
                                            className="rounded-lg bg-cyan-500/90 px-2 py-1 text-xs font-semibold text-[#0c1929] hover:bg-cyan-400 disabled:opacity-50"
                                          >
                                            {savingDocId === d.id
                                              ? "Saving…"
                                              : "Save"}
                                          </button>
                                          <button
                                            type="button"
                                            disabled={busy}
                                            onClick={() =>
                                              setEditingDocId(null)
                                            }
                                            className="rounded-lg border border-white/15 px-2 py-1 text-xs text-slate-300 hover:bg-white/5 disabled:opacity-50"
                                          >
                                            Cancel
                                          </button>
                                        </div>
                                      </div>
                                    ) : null}
                                    <p className="mt-1 text-xs text-slate-600">
                                      Uploaded{" "}
                                      {new Date(d.uploadedAt).toLocaleString()}
                                    </p>
                                  </div>
                                  <div className="flex shrink-0 flex-col gap-2 sm:items-end">
                                    <a
                                      href={marinerFileViewUrl(d.id)}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="rounded-lg border border-white/15 px-3 py-1.5 text-center text-xs font-medium text-slate-200 hover:bg-white/5"
                                    >
                                      Open
                                    </a>
                                    {(c.requiresExpiry ||
                                      c.requiresCustomTitle ||
                                      isTrainingNoExpiry(c)) &&
                                    !isEditing ? (
                                      <button
                                        type="button"
                                        disabled={busy}
                                        onClick={() => {
                                          setEditingDocId(d.id);
                                          setEditDateDraft((prev) => ({
                                            ...prev,
                                            [d.id]: certificateDateForEdit(
                                              d,
                                              c,
                                            ),
                                          }));
                                          if (isTrainingNoExpiry(c)) {
                                            setEditCertificateIssueDraft(
                                              (prev) => ({
                                                ...prev,
                                                [d.id]:
                                                  d.certificateIssuedDate?.trim() ??
                                                  "",
                                              }),
                                            );
                                          }
                                          if (c.requiresCustomTitle) {
                                            setEditTitleDraft((prev) => ({
                                              ...prev,
                                              [d.id]:
                                                d.customTitle?.trim() ?? "",
                                            }));
                                            setEditAdditionalMode((prev) => ({
                                              ...prev,
                                              [d.id]: "expiration",
                                            }));
                                            setEditIssueDateDraft((prev) => ({
                                              ...prev,
                                              [d.id]: "",
                                            }));
                                            setEditIssueYearsDraft((prev) => ({
                                              ...prev,
                                              [d.id]: "",
                                            }));
                                          }
                                        }}
                                        className="rounded-lg border border-white/15 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-white/5 disabled:opacity-50"
                                      >
                                        {c.requiresCustomTitle
                                          ? "Edit details"
                                          : "Edit date"}
                                      </button>
                                    ) : null}
                                    <button
                                      type="button"
                                      disabled={busy}
                                      onClick={() => void removeDocument(d.id)}
                                      className="rounded-lg border border-red-400/40 px-3 py-1.5 text-xs font-medium text-red-300 hover:bg-red-500/10 disabled:opacity-50"
                                    >
                                      {deletingDocId === d.id
                                        ? "Removing…"
                                        : "Remove"}
                                    </button>
                                  </div>
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </li>
                    );
                  })}
                </ul>
                ) : null}
              </section>
            );
          })}
        </div>
      </main>
    </div>
  );
}
