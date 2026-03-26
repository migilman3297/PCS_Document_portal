import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { MARINER_COOKIE, readMarinerUserId } from "@/lib/session";
import { DashboardClient } from "./DashboardClient";

export default async function MarinerDashboardPage() {
  const jar = await cookies();
  if (!readMarinerUserId(jar.get(MARINER_COOKIE)?.value)) {
    redirect("/mariner/login?next=/mariner/dashboard");
  }
  return <DashboardClient />;
}
