"use client";

export default function DashboardError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-base p-6 text-white">
      <div className="card max-w-md p-8 text-center">
        <p className="font-mono text-xs uppercase tracking-label text-crimson-light">Dashboard unavailable</p>
        <h1 className="display mt-3 text-2xl">The intelligence workspace could not load.</h1>
        <p className="mt-3 text-sm text-white/50">Try again. If the problem continues, review the storage configuration.</p>
        <button className="btn-primary mt-6" onClick={reset}>Try again</button>
      </div>
    </main>
  );
}
