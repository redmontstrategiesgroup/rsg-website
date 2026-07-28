import { NextResponse } from "next/server";
import { ZodError } from "zod";
import {
  isAdminContext,
  rateLimitAdminMutator,
  requireAdmin,
} from "@/lib/admin-auth";
import { checkCompleteness } from "@/lib/industries/completeness";
import { secondaryIndustriesSchema, verticalSchema } from "@/lib/industries/schema";
import {
  getSecondaryIndustries,
  getVerticals,
  resetVertical,
  saveSecondaryIndustries,
  saveVertical,
} from "@/lib/industries/store";
import { VERTICAL_SLUGS, type IndustryVertical, type VerticalSlug } from "@/lib/industries/types";

export const runtime = "nodejs";

export async function GET() {
  const ctx = await requireAdmin("manage_clients");
  if (!isAdminContext(ctx)) return ctx;

  const [verticals, secondary] = await Promise.all([
    getVerticals(),
    getSecondaryIndustries(),
  ]);

  return NextResponse.json({
    verticals: verticals.map((v) => ({
      vertical: v,
      completeness: checkCompleteness(v),
    })),
    secondary,
  });
}

/** Save one vertical's full content. Publishing is blocked while incomplete. */
export async function PUT(request: Request) {
  const ctx = await requireAdmin("manage_clients");
  if (!isAdminContext(ctx)) return ctx;

  const limited = await rateLimitAdminMutator(request, ctx.admin.id);
  if (limited) return limited;

  let body: { slug?: string; content?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid body." }, { status: 400 });
  }

  if (!body.slug || !VERTICAL_SLUGS.includes(body.slug as VerticalSlug)) {
    return NextResponse.json({ error: "Unknown vertical." }, { status: 400 });
  }

  let content: IndustryVertical;
  try {
    content = verticalSchema.parse(body.content) as IndustryVertical;
  } catch (err) {
    const message =
      err instanceof ZodError
        ? `${err.issues[0]?.path.join(".")}: ${err.issues[0]?.message}`
        : "Content failed validation.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  if (content.slug !== body.slug) {
    return NextResponse.json({ error: "Slug mismatch." }, { status: 400 });
  }

  const completeness = checkCompleteness(content);
  if (content.status === "published" && !completeness.complete) {
    return NextResponse.json(
      {
        error: "This vertical can't be published until every critical section is complete.",
        completeness,
      },
      { status: 400 }
    );
  }

  const saved = await saveVertical(content, ctx.admin.email);
  return NextResponse.json({
    vertical: saved,
    completeness: checkCompleteness(saved),
  });
}

/** Actions: reset a vertical to authored defaults; save the secondary list. */
export async function POST(request: Request) {
  const ctx = await requireAdmin("manage_clients");
  if (!isAdminContext(ctx)) return ctx;

  const limited = await rateLimitAdminMutator(request, ctx.admin.id);
  if (limited) return limited;

  let body: { action?: string; slug?: string; industries?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid body." }, { status: 400 });
  }

  if (body.action === "reset") {
    if (!body.slug || !VERTICAL_SLUGS.includes(body.slug as VerticalSlug)) {
      return NextResponse.json({ error: "Unknown vertical." }, { status: 400 });
    }
    const vertical = await resetVertical(body.slug as VerticalSlug);
    return NextResponse.json({ vertical, completeness: checkCompleteness(vertical) });
  }

  if (body.action === "save_secondary") {
    try {
      const industries = secondaryIndustriesSchema.parse(body.industries);
      const saved = await saveSecondaryIndustries(industries, ctx.admin.email);
      return NextResponse.json({ secondary: saved });
    } catch (err) {
      const message =
        err instanceof ZodError
          ? err.issues[0]?.message ?? "Invalid industries."
          : "Invalid industries.";
      return NextResponse.json({ error: message }, { status: 400 });
    }
  }

  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}
