"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function ViewerLoginPage() {
  const router = useRouter();
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const res = await fetch("/api/viewer/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ login, password }),
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Login failed");
        return;
      }
      router.push("/viewer");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex min-h-full flex-1 flex-col items-center justify-center bg-[#1a1208] px-4 py-16 text-slate-100">
      <div className="w-full max-w-md space-y-8">
        <div className="space-y-3 text-center">
          <h1 className="text-3xl font-semibold leading-tight text-white sm:text-4xl">
            Office &amp; vessel portal
          </h1>
          <p className="text-sm leading-relaxed text-slate-400">
            Log in to your account to view your crewmember documents.{" "}
            <span className="text-slate-500">
              (admin account — User:{" "}
              <code className="rounded bg-white/10 px-1.5 py-0.5 text-amber-100">
                ADMIN
              </code>{" "}
              Pass:{" "}
              <code className="rounded bg-white/10 px-1.5 py-0.5 text-amber-100">
                DEMOCHANGE
              </code>
              )
            </span>
          </p>
        </div>

        <form
          onSubmit={(e) => void onSubmit(e)}
          className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.04] p-8"
        >
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">
              Username
            </label>
            <input
              required
              type="text"
              autoComplete="username"
              className="w-full rounded-xl border border-white/10 bg-[#2a2015] px-4 py-3 text-slate-100 outline-none ring-amber-400/30 focus:ring-2"
              value={login}
              onChange={(e) => setLogin(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">
              Password
            </label>
            <input
              required
              type="password"
              autoComplete="current-password"
              className="w-full rounded-xl border border-white/10 bg-[#2a2015] px-4 py-3 text-slate-100 outline-none ring-amber-400/30 focus:ring-2"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {error && (
            <p className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-xl bg-amber-400 py-3 text-sm font-semibold text-[#1a1208] hover:bg-amber-300 disabled:opacity-60"
          >
            {pending ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p className="text-center text-sm text-slate-500">
          <Link href="/" className="text-slate-400 hover:text-white">
            ← Back to home
          </Link>
        </p>
      </div>
    </div>
  );
}
