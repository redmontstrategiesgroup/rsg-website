import type { ReactNode } from "react";

function inline(text: string): ReactNode[] {
  const parts = text.split(
    /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\(https?:\/\/[^)]+\))/g,
  );
  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**"))
      return (
        <strong key={index} className="font-semibold text-white">
          {part.slice(2, -2)}
        </strong>
      );
    if (part.startsWith("`") && part.endsWith("`"))
      return (
        <code
          key={index}
          className="break-all rounded bg-white/[0.06] px-1.5 py-0.5 font-mono text-[0.85em] text-white/80"
        >
          {part.slice(1, -1)}
        </code>
      );
    const link = part.match(/^\[([^\]]+)\]\((https?:\/\/[^)]+)\)$/);
    if (link)
      return (
        <a
          key={index}
          href={link[2]}
          target="_blank"
          rel="noopener noreferrer"
          className="break-words text-crimson-light underline underline-offset-4"
        >
          {link[1]}
        </a>
      );
    return part;
  });
}

/**
 * Safe Markdown subset: text is rendered as React nodes; raw HTML never
 * executes.
 *
 * Briefs are AI-ingested and full of URLs, identifiers and the occasional
 * fenced block. The container wraps anywhere so an unbroken token can never
 * push the column past a phone's viewport, and ``` fences become a
 * horizontally scrollable <pre> instead of N paragraphs of code.
 */
export function MarkdownRenderer({ content }: { content: string }) {
  const lines = content.replace(/\r/g, "").split("\n");
  const blocks: ReactNode[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];

    if (line.startsWith("```")) {
      const code: string[] = [];
      let j = index + 1;
      while (j < lines.length && !lines[j].startsWith("```")) {
        code.push(lines[j]);
        j += 1;
      }
      blocks.push(
        <pre
          key={index}
          className="overflow-x-auto overscroll-x-contain rounded-lg border border-white/10 bg-black/40 p-4 font-mono text-[0.8rem] leading-6 text-white/75"
        >
          <code>{code.join("\n")}</code>
        </pre>,
      );
      index = j; // skip the closing fence
      continue;
    }

    if (line.startsWith("### ")) {
      blocks.push(
        <h3 key={index} className="display pt-3 text-lg">
          {inline(line.slice(4))}
        </h3>,
      );
    } else if (line.startsWith("## ")) {
      blocks.push(
        <h2 key={index} className="display pt-5 text-xl">
          {inline(line.slice(3))}
        </h2>,
      );
    } else if (line.startsWith("# ")) {
      blocks.push(
        <h1 key={index} className="display pt-5 text-2xl">
          {inline(line.slice(2))}
        </h1>,
      );
    } else if (/^[-*] /.test(line)) {
      blocks.push(
        <div key={index} className="flex gap-3 pl-2">
          <span aria-hidden="true" className="text-crimson-light">
            •
          </span>
          <span className="min-w-0">{inline(line.slice(2))}</span>
        </div>,
      );
    } else if (/^\d+\. /.test(line)) {
      blocks.push(
        <div key={index} className="pl-2">
          {inline(line)}
        </div>,
      );
    } else if (line.startsWith("> ")) {
      blocks.push(
        <blockquote
          key={index}
          className="border-l-2 border-crimson/50 pl-4 text-white/60"
        >
          {inline(line.slice(2))}
        </blockquote>,
      );
    } else if (!line.trim()) {
      blocks.push(<div key={index} className="h-1" aria-hidden="true" />);
    } else {
      blocks.push(<p key={index}>{inline(line)}</p>);
    }
  }

  return (
    <div className="space-y-3 text-[0.95rem] leading-7 text-white/72 [overflow-wrap:anywhere]">
      {blocks}
    </div>
  );
}
