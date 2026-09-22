export function CodeBlock({ code, label }: { code: string; label?: string }) {
  return (
    <div className="mt-3 overflow-hidden rounded-lg border border-white/10 bg-black/40">
      {label && (
        <div className="border-b border-white/10 px-3 py-1.5 font-mono text-[0.62rem] uppercase tracking-label text-white/35">{label}</div>
      )}
      <pre className="whitespace-pre-wrap break-words px-3 py-3 font-mono text-[0.78rem] leading-relaxed text-white/75">
        <code>{code}</code>
      </pre>
    </div>
  );
}
