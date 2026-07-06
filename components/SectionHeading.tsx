import { Reveal } from "./Reveal";
import { Label } from "./Label";

type SectionHeadingProps = {
  index?: string;
  eyebrow?: string;
  title: React.ReactNode;
  description?: string;
  /** Two-column layout: heading left, description right. */
  split?: boolean;
};

export function SectionHeading({
  index,
  eyebrow,
  title,
  description,
  split = false,
}: SectionHeadingProps) {
  const heading = (
    <div className={split ? "" : "max-w-3xl"}>
      {eyebrow && (
        <Reveal>
          <Label index={index}>{eyebrow}</Label>
        </Reveal>
      )}
      <Reveal delay={0.05}>
        <h2 className="display text-gradient mt-6 text-[2rem] leading-[1.05] sm:text-[2.6rem] lg:text-[3rem]">
          {title}
        </h2>
      </Reveal>
    </div>
  );

  if (split) {
    return (
      <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr] lg:items-end lg:gap-16">
        {heading}
        {description && (
          <Reveal delay={0.1}>
            <p className="text-base leading-relaxed text-white/55 lg:pb-2">
              {description}
            </p>
          </Reveal>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-3xl">
      {heading}
      {description && (
        <Reveal delay={0.1}>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-white/55">
            {description}
          </p>
        </Reveal>
      )}
    </div>
  );
}
