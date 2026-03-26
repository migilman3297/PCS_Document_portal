import { NextResponse } from "next/server";
import { documentDisplayLabel } from "@/lib/certTypes";
import {
  marinerVisibleToOfficeAccount,
  requireViewerAccount,
} from "@/lib/viewerAccess";
import { ensureCertTemplates } from "@/lib/store";
import {
  mergedBilletOptions,
  mergedShipOptions,
} from "@/lib/viewerAssignment";

export async function GET() {
  const auth = await requireViewerAccount();
  if (!auth.ok) return auth.response;
  const { account, store } = auth;
  ensureCertTemplates(store);
  const certList = store.certTemplates!;

  const mariners = store.users
    .filter((u) => marinerVisibleToOfficeAccount(u, account))
    .slice()
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
    .map((u) => {
      const documents = store.documents
        .filter((d) => d.userId === u.id)
        .sort(
          (a, b) =>
            new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
        )
        .map((d) => ({
          ...d,
          certLabel: documentDisplayLabel(d.certKey, d.customTitle, certList),
        }));
      return {
        id: u.id,
        email: u.email,
        name: u.name,
        createdAt: u.createdAt,
        assignedShip: u.assignedShip?.trim() || null,
        assignedBillet: u.assignedBillet?.trim() || null,
        documents,
      };
    });

  return NextResponse.json({
    mariners,
    certTypes: certList,
    shipOptions: mergedShipOptions(store),
    billetOptions: mergedBilletOptions(store),
    officeRole: account.role,
    officeLogin: account.login,
  });
}
