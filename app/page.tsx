import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col bg-[#0c1929] text-slate-100">
      <header className="border-b border-white/10 px-6 py-5">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
          <p className="text-sm font-semibold tracking-wide text-cyan-300/90">
            CrewDoc · prototype
          </p>
          <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-slate-400">
            Demo only — not for production PHI/PII
          </span>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-12 px-6 py-14">
        <div className="max-w-2xl space-y-4">
          <h1 className="text-3xl font-semibold leading-tight text-white sm:text-4xl">
            PCS Crewmember document portal
          </h1>
          <p className="text-lg leading-relaxed text-slate-400">
            Mariners, sign into your account to access your uploaded documents
            and to update existing uploads. For crewing and vessel staff, log in
            to Office &amp; vessel to view crew members&apos; documents.
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          <Link
            href="/mariner/login"
            className="group rounded-2xl border border-white/10 bg-white/[0.04] p-8 transition hover:border-cyan-400/40 hover:bg-white/[0.07]"
          >
            <p className="text-xs font-semibold uppercase tracking-wider text-cyan-300/80">
              Mariners
            </p>
            <h2 className="mt-3 text-xl font-semibold text-white">
              View and Upload documents
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-400">
              You can log in and update your documents here at any time.
            </p>
            <span className="mt-6 inline-flex text-sm font-medium text-cyan-300 group-hover:underline">
              Go to mariner portal →
            </span>
          </Link>

          <Link
            href="/viewer/login"
            className="group rounded-2xl border border-white/10 bg-white/[0.04] p-8 transition hover:border-amber-400/40 hover:bg-white/[0.07]"
          >
            <p className="text-xs font-semibold uppercase tracking-wider text-amber-200/80">
              Office & vessel
            </p>
            <h2 className="mt-3 text-xl font-semibold text-white">
              View and search crewmember documents
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-400">
              Admin account can edit permissions and entry templates. Other
              accounts assigned by Admin can view their vessels&apos; crewmember
              docs.
            </p>
            <span className="mt-6 inline-flex text-sm font-medium text-amber-200 group-hover:underline">
              Open viewer portal →
            </span>
          </Link>
        </div>
      </main>
    </div>
  );
}
