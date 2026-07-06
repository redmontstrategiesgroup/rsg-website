type LogoProps = {
  showWordmark?: boolean;
};

/**
 * RSG brand assets (transparent PNGs in /public/brand).
 * Full wordmark for page headers and sign-in screens; the standalone
 * mark for compact placements (portal top bar, footer, widgets).
 */
export function Logo({ showWordmark = true }: LogoProps) {
  return showWordmark ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/brand/rsg-wordmark.png"
      alt="Redmont Strategies Group"
      className="h-9 w-auto sm:h-10"
    />
  ) : (
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/brand/rsg-mark.png" alt="RSG" className="h-10 w-auto" />
  );
}
