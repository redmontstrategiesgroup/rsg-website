import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-[70vh] items-center justify-center bg-base p-6 text-white">
      <div className="max-w-md text-center">
        <p className="font-mono text-xs uppercase tracking-label text-crimson-light">
          404
        </p>
        <h1 className="display mt-3 text-2xl">Page not found</h1>
        <p className="mt-3 text-sm text-white/50">
          That URL doesn&apos;t match anything on this site.
        </p>
        <Link href="/" className="btn-primary mt-6 inline-flex">
          Back home
        </Link>
      </div>
    </main>
  );
}
