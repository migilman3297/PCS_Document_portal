import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { hashPassword } from "@/lib/password";
import {
  MARINER_COOKIE,
  createMarinerSessionToken,
} from "@/lib/session";
import { readStore, writeStore } from "@/lib/store";

export async function POST(req: Request) {
  let body: { email?: string; password?: string; name?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const email = String(body.email ?? "")
    .trim()
    .toLowerCase();
  const password = String(body.password ?? "");
  const name = String(body.name ?? "").trim();
  if (!email || !password || !name) {
    return NextResponse.json(
      { error: "Email, password, and full name are required." },
      { status: 400 }
    );
  }
  if (password.length < 8) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters." },
      { status: 400 }
    );
  }
  const store = await readStore();
  if (store.users.some((u) => u.email === email)) {
    return NextResponse.json(
      { error: "An account with this email already exists. Sign in instead." },
      { status: 409 }
    );
  }
  const user = {
    id: randomUUID(),
    email,
    name,
    passwordHash: hashPassword(password),
    createdAt: new Date().toISOString(),
  };
  store.users.push(user);
  await writeStore(store);

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
