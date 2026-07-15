import type { ReactNode } from "react";

function inline(text: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\(https?:\/\/[^)]+\))/g);
  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) return <strong key={index} className="font-semibold text-white">{part.slice(2, -2)}</strong>;
    if (part.startsWith("`") && part.endsWith("`")) return <code key={index} className="rounded bg-white/[0.06] px-1.5 py-0.5 font-mono text-[0.85em] text-white/80">{part.slice(1, -1)}</code>;
    const link = part.match(/^\[([^\]]+)\]\((https?:\/\/[^)]+)\)$/);
    if (link) return <a key={index} href={link[2]} target="_blank" rel="noopener noreferrer" className="text-crimson-light underline underline-offset-4">{link[1]}</a>;
    return part;
  });
}

/** Safe Markdown subset: text is rendered as React nodes; raw HTML never executes. */
export function MarkdownRenderer({ content }: { content: string }) {
  const lines = content.replace(/\r/g, "").split("\n");
  return (
    <div className="space-y-3 text-[0.95rem] leading-7 text-white/72">
      {lines.map((line, index) => {
        if (line.startsWith("### ")) return <h3 key={index} className="display pt-3 text-lg">{inline(line.slice(4))}</h3>;
        if (line.startsWith("## ")) return <h2 key={index} className="display pt-5 text-xl">{inline(line.slice(3))}</h2>;
        if (line.startsWith("# ")) return <h1 key={index} className="display pt-5 text-2xl">{inline(line.slice(2))}</h1>;
        if (/^[-*] /.test(line)) return <div key={index} className="flex gap-3 pl-2"><span aria-hidden="true" className="text-crimson-light">•</span><span>{inline(line.slice(2))}</span></div>;
        if (/^\d+\. /.test(line)) return <div key={index} className="pl-2">{inline(line)}</div>;
        if (line.startsWith("> ")) return <blockquote key={index} className="border-l-2 border-crimson/50 pl-4 text-white/60">{inline(line.slice(2))}</blockquote>;
        if (!line.trim()) return <div key={index} className="h-1" aria-hidden="true" />;
        return <p key={index}>{inline(line)}</p>;
      })}
    </div>
  );
}
