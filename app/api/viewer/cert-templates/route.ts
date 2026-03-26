import { NextResponse } from "next/server";
import {
  autoRenewalPeriodicityLabel,
  CERT_SECTIONS,
  type CertSectionKey,
  type CertType,
} from "@/lib/certTypes";
import { addCalendarYears, subtractCalendarYears } from "@/lib/certExpiry";
import { ensureCertTemplates, writeStore } from "@/lib/store";
import { requireViewerAdmin } from "@/lib/viewerAccess";

function isValidCertKey(key: string): boolean {
  return /^[a-z][a-z0-9_]*$/.test(key) && key.length <= 80;
}

export async function GET() {
  const r = await requireViewerAdmin();
  if (!r.ok) return r.response;
  ensureCertTemplates(r.store);
  return NextResponse.json({ certTypes: r.store.certTemplates });
}

export async function PATCH(req: Request) {
  const r = await requireViewerAdmin();
  if (!r.ok) return r.response;
  let body: { key: string; label?: string; validityYears?: number | null };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const key = String(body.key ?? "").trim();
  if (!key) {
    return NextResponse.json({ error: "Missing key." }, { status: 400 });
  }
  ensureCertTemplates(r.store);
  const list = r.store.certTemplates!;
  const row = list.find((c) => c.key === key);
  if (!row) {
    return NextResponse.json(
      { error: "Unknown certificate key." },
      { status: 404 },
    );
  }
  if (body.label !== undefined) {
    const label = String(body.label ?? "").trim();
    if (!label) {
      return NextResponse.json(
        { error: "Display name cannot be empty." },
        { status: 400 },
      );
    }
    row.label = label;
  }
  if (body.validityYears !== undefined) {
    if (!row.requiresExpiry || row.requiresCustomTitle) {
      return NextResponse.json(
        {
          error:
            "Years from certificate date only applies to standard expiring templates.",
        },
        { status: 400 },
      );
    }
    let newYears: number | null;
    if (body.validityYears === null) {
      newYears = null;
    } else {
      const n = Number(body.validityYears);
      if (!Number.isFinite(n) || n < 1 || n > 99) {
        return NextResponse.json(
          {
            error:
              "Years must be between 1 and 99, or use document expiration mode (null).",
          },
          { status: 400 },
        );
      }
      newYears = n;
    }
    const oldYears = row.validityYears;
    row.validityYears = newYears;
    row.renewalPeriodicity = autoRenewalPeriodicityLabel(row);
    if (
      oldYears != null &&
      newYears != null &&
      oldYears !== newYears
    ) {
      for (const d of r.store.documents) {
        if (d.certKey !== key || !d.expiresAt) continue;
        const issue = subtractCalendarYears(d.expiresAt, oldYears);
        if (!issue) continue;
        const nextExp = addCalendarYears(issue, newYears);
        if (nextExp) d.expiresAt = nextExp;
      }
    }
  }
  if (body.label === undefined && body.validityYears === undefined) {
    return NextResponse.json(
      { error: "Send label and/or validityYears." },
      { status: 400 },
    );
  }
  await writeStore(r.store);
  return NextResponse.json({ certTypes: r.store.certTemplates });
}

export async function POST(req: Request) {
  const r = await requireViewerAdmin();
  if (!r.ok) return r.response;
  let body: {
    key: string;
    section: CertSectionKey;
    label: string;
    renewalPeriodicity?: string;
    requiresExpiry?: boolean;
    validityYears?: number | null;
    requiresCustomTitle?: boolean;
    optionalExpiry?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const key = String(body.key ?? "").trim().toLowerCase();
  if (!isValidCertKey(key)) {
    return NextResponse.json(
      {
        error:
          "Key must be lowercase, start with a letter, and use only letters, numbers, and underscores.",
      },
      { status: 400 },
    );
  }
  const sectionStr = String(body.section ?? "").trim();
  if (
    !CERT_SECTIONS.some((s) => s.key === sectionStr)
  ) {
    return NextResponse.json({ error: "Invalid section." }, { status: 400 });
  }
  const section = sectionStr as CertSectionKey;
  const label = String(body.label ?? "").trim();
  if (!label) {
    return NextResponse.json({ error: "Display name is required." }, { status: 400 });
  }
  ensureCertTemplates(r.store);
  const list = r.store.certTemplates!;
  if (list.some((c) => c.key === key)) {
    return NextResponse.json(
      { error: "A template with this key already exists." },
      { status: 400 },
    );
  }
  const requiresCustomTitle = Boolean(body.requiresCustomTitle);
  const requiresExpiry =
    typeof body.requiresExpiry === "boolean"
      ? body.requiresExpiry
      : !requiresCustomTitle;

  let validityYears: number | null =
    body.validityYears === undefined || body.validityYears === null
      ? null
      : Number(body.validityYears);
  if (
    validityYears !== null &&
    (!Number.isFinite(validityYears) ||
      validityYears < 1 ||
      validityYears > 99)
  ) {
    return NextResponse.json(
      { error: "Years valid from issue date must be 1–99, or leave blank for document expiry directly." },
      { status: 400 },
    );
  }
  if (!requiresExpiry) {
    validityYears = null;
  }

  const row: CertType = {
    key,
    section,
    label,
    renewalPeriodicity: "",
    requiresExpiry,
    validityYears: requiresExpiry ? validityYears : null,
    optionalExpiry: requiresCustomTitle
      ? body.optionalExpiry === false
        ? undefined
        : true
      : body.optionalExpiry === true
        ? true
        : undefined,
    requiresCustomTitle: requiresCustomTitle ? true : undefined,
  };
  row.renewalPeriodicity = requiresCustomTitle
    ? String(body.renewalPeriodicity ?? "").trim()
    : autoRenewalPeriodicityLabel(row);
  list.push(row);
  await writeStore(r.store);
  return NextResponse.json({ certTypes: r.store.certTemplates }, { status: 201 });
}

export async function DELETE(req: Request) {
  const r = await requireViewerAdmin();
  if (!r.ok) return r.response;
  let body: { key?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const key = String(body.key ?? "").trim();
  if (!key) {
    return NextResponse.json({ error: "Missing key." }, { status: 400 });
  }
  ensureCertTemplates(r.store);
  if (r.store.documents.some((d) => d.certKey === key)) {
    return NextResponse.json(
      {
        error:
          "Cannot delete this template while mariners have files under it. Remove those uploads first.",
      },
      { status: 400 },
    );
  }
  const list = r.store.certTemplates!;
  const next = list.filter((c) => c.key !== key);
  if (next.length === list.length) {
    return NextResponse.json(
      { error: "Unknown certificate key." },
      { status: 404 },
    );
  }
  r.store.certTemplates = next;
  await writeStore(r.store);
  return NextResponse.json({ certTypes: r.store.certTemplates });
}
