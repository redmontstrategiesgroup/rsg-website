import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { isAdminContext, requireAdmin } from "@/lib/admin-auth";
import { SITE_URL } from "@/lib/site";

export const runtime = "nodejs";

/**
 * Admin-only QR download. Permanent scan URL is /r/connect so the public
 * destination can change without reprinting codes.
 */
export async function GET(request: Request) {
  const ctx = await requireAdmin("manage_clients");
  if (!isAdminContext(ctx)) return ctx;

  const url = new URL(request.url);
  const format = url.searchParams.get("format") === "png" ? "png" : "svg";
  const campaign = url.searchParams.get("campaign")?.slice(0, 80) ?? "";
  const target = new URL("/r/connect", SITE_URL);
  if (campaign) target.searchParams.set("campaign", campaign);

  if (format === "png") {
    const png = await QRCode.toBuffer(target.toString(), {
      type: "png",
      width: 1024,
      margin: 2,
      errorCorrectionLevel: "H",
      color: { dark: "#0a0a0a", light: "#ffffff" },
    });
    return new NextResponse(new Uint8Array(png), {
      headers: {
        "Content-Type": "image/png",
        "Content-Disposition": `attachment; filename="rsg-connect-qr.png"`,
        "Cache-Control": "no-store",
      },
    });
  }

  const svg = await QRCode.toString(target.toString(), {
    type: "svg",
    margin: 2,
    errorCorrectionLevel: "H",
    color: { dark: "#0a0a0a", light: "#ffffff" },
  });

  return new NextResponse(svg, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Content-Disposition": `attachment; filename="rsg-connect-qr.svg"`,
      "Cache-Control": "no-store",
    },
  });
}
