import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  MARINER_COOKIE,
  createMarinerSessionToken,
} from "@/lib/session";
import { readStore } from "@/lib/store";
import { verifyPassword } from "@/lib/password";

export async function POST(req: Request) {
  let body: { email?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const email = String(body.email ?? "")
    .trim()
    .toLowerCase();
  const password = String(body.password ?? "");
  if (!email || !password) {
    return NextResponse.json({ error: "Email and password required." }, { status: 400 });
  }
  const store = await readStore();
  const user = store.users.find((u) => u.email === email);
  if (!user || !verifyPassword(password, user.passwordHash)) {
    return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
  }
  const token = createMarinerSessionToken(user.id);
  const jar = await cookies();
  jar.set(MARINER_COOKIE, token, {
    httpOnly: true,
    path: "/",
    maxAge: 60 * 60 * 24 * 14,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
  return NextResponse.json({
    user: { id: user.id, email: user.email, name: user.name },
  });
}
