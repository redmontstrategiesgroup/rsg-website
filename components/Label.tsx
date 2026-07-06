type LabelProps = {
  index?: string;
  children: React.ReactNode;
  className?: string;
};

/**
 * Mono micro-label with a glowing crimson marker:
 *   ●  [01] · THE HIDDEN LEAK
 */
export function Label({ index, children, className = "" }: LabelProps) {
  return (
    <span className={`label ${className}`}>
      <span className="relative flex h-1.5 w-1.5">
        <span className="absolute inline-flex h-full w-full animate-glow-pulse rounded-full bg-crimson" />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-crimson" />
      </span>
      {index && <span className="text-crimson-light">[{index}]</span>}
      <span className="text-white/45">{children}</span>
    </span>
  );
}
