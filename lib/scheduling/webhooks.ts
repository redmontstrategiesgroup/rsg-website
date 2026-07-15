import { createSecureToken } from "./tokens";
import { requireSupabase } from "./db";
import { signWebhookPayload } from "./notifications";

export async function enqueueWebhook(eventType: string, payload: Record<string, unknown>) {
  try {
    const sb = requireSupabase();
    const { data: endpoints } = await sb
      .from("webhook_endpoints")
      .select("*")
      .eq("enabled", true);

    if (!endpoints?.length) return;

    for (const ep of endpoints) {
      const events = (ep.events as string[]) ?? [];
      if (events.length && !events.includes(eventType) && !events.includes("*")) {
        continue;
      }
      const idempotencyKey = `${eventType}:${createSecureToken(12)}`;
      const body = {
        id: idempotencyKey,
        type: eventType,
        created_at: new Date().toISOString(),
        data: payload,
      };
      await sb.from("webhook_deliveries").insert({
        endpoint_id: ep.id,
        event_type: eventType,
        payload: body,
        status: "pending",
        attempts: 0,
        idempotency_key: idempotencyKey,
      });
    }
  } catch (err) {
    console.error("[scheduling] enqueueWebhook failed", err);
  }
}

export async function deliverPendingWebhooks(limit = 20) {
  const sb = requireSupabase();
  const { data: pending } = await sb
    .from("webhook_deliveries")
    .select("*, webhook_endpoints(*)")
    .eq("status", "pending")
    .lt("attempts", 5)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (!pending?.length) return { delivered: 0, failed: 0 };

  let delivered = 0;
  let failed = 0;

  for (const row of pending) {
    const ep = row.webhook_endpoints as {
      url: string;
      secret: string;
      enabled: boolean;
    } | null;
    if (!ep?.enabled) {
      await sb
        .from("webhook_deliveries")
        .update({ status: "failed", last_error: "Endpoint disabled" })
        .eq("id", row.id);
      failed += 1;
      continue;
    }

    const body = JSON.stringify(row.payload);
    const signature = signWebhookPayload(ep.secret, body);

    try {
      const res = await fetch(ep.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-RSG-Signature": signature,
          "X-RSG-Event": row.event_type,
          "Idempotency-Key": row.idempotency_key,
        },
        body,
        signal: AbortSignal.timeout(10_000),
      });

      if (res.ok) {
        await sb
          .from("webhook_deliveries")
          .update({
            status: "delivered",
            attempts: row.attempts + 1,
            response_status: res.status,
            delivered_at: new Date().toISOString(),
          })
          .eq("id", row.id);
        delivered += 1;
      } else {
        await sb
          .from("webhook_deliveries")
          .update({
            status: row.attempts + 1 >= 5 ? "failed" : "pending",
            attempts: row.attempts + 1,
            response_status: res.status,
            last_error: `HTTP ${res.status}`,
          })
          .eq("id", row.id);
        failed += 1;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Delivery failed";
      await sb
        .from("webhook_deliveries")
        .update({
          status: row.attempts + 1 >= 5 ? "failed" : "pending",
          attempts: row.attempts + 1,
          last_error: message,
        })
        .eq("id", row.id);
      failed += 1;
    }
  }

  return { delivered, failed };
}
