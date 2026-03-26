import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { verifyPassword } from "@/lib/password";
import { VIEWER_COOKIE, createViewerSessionToken } from "@/lib/session";
import { readStore } from "@/lib/store";

export async function POST(req: Request) {
  let body: { login?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const login = String(body.login ?? "")
    .trim()
    .toLowerCase();
  const password = String(body.password ?? "");
  if (!login || !password) {
    return NextResponse.json(
      { error: "Username and password are required." },
      { status: 400 }
    );
  }
  const store = await readStore();
  const account = store.officeAccounts.find((a) => a.login === login);
  if (!account || !verifyPassword(password, account.passwordHash)) {
    return NextResponse.json(
      { error: "Incorrect username or password." },
      { status: 401 }
    );
  }
  const token = createViewerSessionToken(account.id);
  const jar = await cookies();
  jar.set(VIEWER_COOKIE, token, {
    httpOnly: true,
    path: "/",
    maxAge: 60 * 60 * 24 * 14,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
  return NextResponse.json({
    ok: true,
    role: account.role,
    login: account.login,
  });
}
