"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, Suspense } from "react";

function MarinerAuthForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/mariner/dashboard";

  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const url =
        mode === "register" ? "/api/mariner/register" : "/api/mariner/login";
      const body =
        mode === "register"
          ? { email, password, name }
          : { email, password };
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Request failed");
        return;
      }
      router.push(next);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-md space-y-8">
      <div className="space-y-2 text-center">
        <p className="text-xs font-semibold uppercase tracking-wider text-cyan-300/90">
          Mariner portal
        </p>
        <h1 className="text-2xl font-semibold text-white">
          {mode === "login" ? "Sign in" : "Create account"}
        </h1>
        <p className="text-sm text-slate-400">
          Use the same email when you come back—your uploaded certs stay
          attached to your profile.
        </p>
      </div>

      <div className="flex rounded-full border border-white/10 bg-white/5 p-1">
        <button
          type="button"
          className={`flex-1 rounded-full py-2 text-sm font-medium transition ${
            mode === "login"
              ? "bg-white/15 text-white"
              : "text-slate-400 hover:text-white"
          }`}
          onClick={() => {
            setMode("login");
            setError(null);
          }}
        >
          Sign in
        </button>
        <button
          type="button"
          className={`flex-1 rounded-full py-2 text-sm font-medium transition ${
            mode === "register"
              ? "bg-white/15 text-white"
              : "text-slate-400 hover:text-white"
          }`}
          onClick={() => {
            setMode("register");
            setError(null);
          }}
        >
          New joiner
        </button>
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        {mode === "register" && (
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">
              Full name
            </label>
            <input
              required
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none ring-cyan-400/40 placeholder:text-slate-500 focus:ring-2"
              placeholder="e.g. Alex Rivera"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
            />
          </div>
        )}
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-400">
            Work email
          </label>
          <input
            required
            type="email"
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none ring-cyan-400/40 placeholder:text-slate-500 focus:ring-2"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-400">
            Password
          </label>
          <input
            required
            type="password"
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none ring-cyan-400/40 placeholder:text-slate-500 focus:ring-2"
            placeholder={mode === "register" ? "At least 8 characters" : "••••••••"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={
              mode === "register" ? "new-password" : "current-password"
            }
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
          className="w-full rounded-xl bg-cyan-500 py-3 text-sm font-semibold text-[#0c1929] transition hover:bg-cyan-400 disabled:opacity-60"
        >
          {pending ? "Working…" : mode === "login" ? "Sign in" : "Create account"}
        </button>
      </form>

      <p className="text-center text-sm text-slate-500">
        <Link href="/" className="text-slate-400 hover:text-white">
          ← Back to home
        </Link>
      </p>
    </div>
  );
}

export default function MarinerLoginPage() {
  return (
    <div className="flex min-h-full flex-1 flex-col bg-[#0c1929] px-4 py-16 text-slate-100">
      <Suspense
        fallback={
          <p className="text-center text-slate-400">Loading…</p>
        }
      >
        <MarinerAuthForm />
      </Suspense>
    </div>
  );
}
