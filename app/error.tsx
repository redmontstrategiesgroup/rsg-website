"use client";

import Link from "next/link";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex min-h-[70vh] items-center justify-center bg-base p-6 text-white">
      <div className="max-w-md text-center">
        <p className="font-mono text-xs uppercase tracking-label text-crimson-light">
          Error
        </p>
        <h1 className="display mt-3 text-2xl">Something went wrong</h1>
        <p className="mt-3 text-sm text-white/50">
          {error.digest
            ? `Reference ${error.digest}. Try again, or return home.`
            : "Try again, or return to the homepage."}
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <button type="button" className="btn-primary" onClick={reset}>
            Try again
          </button>
          <Link href="/" className="btn-ghost">
            Home
          </Link>
        </div>
      </div>
    </main>
  );
}
