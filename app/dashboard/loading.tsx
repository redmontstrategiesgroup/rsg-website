export default function DashboardLoading() {
  return (
    <main className="min-h-screen bg-base p-6 text-white" aria-busy="true">
      <div className="mx-auto max-w-[1500px] animate-pulse space-y-6">
        <div className="h-14 rounded-xl bg-white/[0.04]" />
        <div className="grid gap-4 md:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-28 rounded-xl bg-white/[0.04]" />)}</div>
        <div className="h-96 rounded-xl bg-white/[0.04]" />
      </div>
    </main>
  );
}
