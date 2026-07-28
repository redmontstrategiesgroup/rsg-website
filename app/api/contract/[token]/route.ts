import { NextResponse } from "next/server";
import { z } from "zod";
import { rateLimit, rateLimitResponse, clientIp } from "@/lib/security";
import { isSupabaseConfigured } from "@/lib/supabase";
import {
  getContractByToken,
  isFullyExecuted,
  markContractViewed,
  signContract,
} from "@/lib/lifecycle/contracts";
import { CONTRACT_TEMPLATES } from "@/lib/lifecycle/contract-templates";
import { onContractExecuted } from "@/lib/lifecycle/orchestrate";

export const runtime = "nodejs";

type Params = { params: Promise<{ token: string }> };

const signSchema = z.object({
  action: z.literal("sign"),
  signatureId: z.string().uuid(),
  signedName: z.string().min(2).max(200),
  initials: z.string().max(10).optional(),
  acknowledgmentKeys: z.array(z.string().max(100)).max(20),
});

export async function POST(request: Request, { params }: Params) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Not available right now." }, { status: 503 });
  }
  if (!(await rateLimit(`contract-post:${clientIp(request)}`, 15, 10 * 60_000))) {
    return rateLimitResponse();
  }
  const { token } = await params;
  const loaded = await getContractByToken(token);
  if (!loaded || loaded.contract.status === "draft") {
    return NextResponse.json({ error: "Agreement not found." }, { status: 404 });
  }
  const { contract, signatures } = loaded;

  let body: z.infer<typeof signSchema>;
  try {
    body = signSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  if (["voided", "declined", "expired"].includes(contract.status)) {
    return NextResponse.json(
      { error: `This agreement is ${contract.status} and can no longer be signed.` },
      { status: 409 },
    );
  }

  // Every acknowledgment defined by the template must be accepted.
  const template = CONTRACT_TEMPLATES[contract.kind];
  const required = template?.acknowledgments ?? [];
  const acceptedKeys = new Set(body.acknowledgmentKeys);
  const missing = required.filter((a) => !acceptedKeys.has(a.key));
  if (missing.length > 0) {
    return NextResponse.json(
      { error: "Please confirm every acknowledgment before signing." },
      { status: 400 },
    );
  }

  const slot = signatures.find((s) => s.id === body.signatureId);
  if (!slot || slot.signer_type !== "client") {
    return NextResponse.json({ error: "Invalid signature slot." }, { status: 400 });
  }
  if (slot.signed_at) {
    return NextResponse.json({ error: "Already signed." }, { status: 409 });
  }

  try {
    const result = await signContract(contract.id, {
      signatureId: body.signatureId,
      signedName: body.signedName.trim(),
      initials: body.initials?.trim(),
      acknowledgments: required.map((a) => ({ key: a.key, label: a.label })),
      ip: clientIp(request),
      userAgent: request.headers.get("user-agent") ?? "",
    });

    if (isFullyExecuted(result.contract)) {
      try {
        await onContractExecuted(result.contract, {
          email: slot.signer_email,
          name: body.signedName.trim(),
        });
      } catch (error) {
        console.error("[contract] execution orchestration failed", error);
      }
    }
    return NextResponse.json({
      ok: true,
      status: result.contract.status,
      signatures: result.signatures.map(publicSignature),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Signing failed." },
      { status: 400 },
    );
  }
}

export async function GET(request: Request, { params }: Params) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Not available right now." }, { status: 503 });
  }
  if (!(await rateLimit(`contract-get:${clientIp(request)}`, 60, 60_000))) {
    return rateLimitResponse();
  }
  const { token } = await params;
  const loaded = await getContractByToken(token);
  if (!loaded || loaded.contract.status === "draft") {
    return NextResponse.json({ error: "Agreement not found." }, { status: 404 });
  }
  if (loaded.contract.status === "sent") {
    await markContractViewed(loaded.contract.id).catch(() => {});
  }
  return NextResponse.json({
    contract: loaded.contract,
    signatures: loaded.signatures.map(publicSignature),
    acknowledgments: CONTRACT_TEMPLATES[loaded.contract.kind]?.acknowledgments ?? [],
  });
}

function publicSignature(s: {
  id: string;
  signer_type: string;
  role: string;
  signer_name: string;
  signer_title: string | null;
  signed_name: string | null;
  sort_order: number;
  required: boolean;
  signed_at: string | null;
}) {
  return {
    id: s.id,
    signer_type: s.signer_type,
    role: s.role,
    signer_name: s.signer_name,
    signer_title: s.signer_title,
    signed_name: s.signed_name,
    sort_order: s.sort_order,
    required: s.required,
    signed_at: s.signed_at,
  };
}
