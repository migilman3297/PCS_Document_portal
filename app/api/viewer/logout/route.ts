import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { VIEWER_COOKIE } from "@/lib/session";

export async function POST() {
  const jar = await cookies();
  jar.delete(VIEWER_COOKIE);
  return NextResponse.json({ ok: true });
}
