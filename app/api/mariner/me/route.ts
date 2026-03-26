import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { MARINER_COOKIE, readMarinerUserId } from "@/lib/session";
import { readStore } from "@/lib/store";

export async function GET() {
  const jar = await cookies();
  const userId = readMarinerUserId(jar.get(MARINER_COOKIE)?.value);
  if (!userId) {
    return NextResponse.json({ user: null }, { status: 401 });
  }
  const store = await readStore();
  const user = store.users.find((u) => u.id === userId);
  if (!user) {
    return NextResponse.json({ user: null }, { status: 401 });
  }
  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      assignedShip: user.assignedShip?.trim() || null,
      assignedBillet: user.assignedBillet?.trim() || null,
    },
  });
}
