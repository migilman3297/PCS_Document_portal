import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { MARINER_COOKIE } from "@/lib/session";

export async function POST() {
  const jar = await cookies();
  jar.delete(MARINER_COOKIE);
  return NextResponse.json({ ok: true });
}
