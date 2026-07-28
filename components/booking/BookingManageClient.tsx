"use client";

import { useEffect, useState } from "react";
import { Loader2, Calendar, ExternalLink } from "lucide-react";
import { postJson } from "@/lib/api";

type BookingView = {
  status: string;
  displayTime: string;
  appointmentType?: string;
  description?: string;
  meetingFormat?: string;
  visitorTimezone?: string;
  contact?: { name?: string; email?: string; phone?: string; businessName?: string };
  calendarLinks?: { google: string; outlook: string; office365: string };
  canReschedule?: boolean;
  canCancel?: boolean;
  appointmentTypeId?: string;
  startsAt?: string;
};

function formatSlot(isoUtc: string, timeZone?: string): string {
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: timeZone || undefined,
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
    }).format(new Date(isoUtc));
  } catch {
    return new Date(isoUtc).toLocaleString();
  }
}

export function BookingManageClient({
  token,
  confirmedView,
}: {
  token: string;
  confirmedView?: boolean;
}) {
  const [data, setData] = useState<BookingView | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"view" | "reschedule" | "cancel">("view");
  const [slots, setSlots] = useState<{ start: string; label: string }[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  async function load() {
    const res = await fetch(`/api/booking/manage/${encodeURIComponent(token)}`);
    const json = await res.json();
    if (!res.ok) {
      setError(json.error || "Unable to load appointment.");
      return;
    }
    setData(json);
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch(`/api/booking/manage/${encodeURIComponent(token)}`);
      const json = await res.json();
      if (cancelled) return;
      if (!res.ok) {
        setError(json.error || "Unable to load appointment.");
        return;
      }
      setData(json);
    })().catch(() => {
      if (!cancelled) setError("Unable to load appointment.");
    });
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function loadSlots() {
    setBusy(true);
    try {
      const res = await postJson(`/api/booking/manage/${encodeURIComponent(token)}`, {
        action: "slots",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setSlots(json.slots || []);
      setMode("reschedule");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Failed to load times");
    } finally {
      setBusy(false);
    }
  }

  async function confirmReschedule() {
    if (!selected) return;
    setBusy(true);
    try {
      const res = await postJson(`/api/booking/manage/${encodeURIComponent(token)}`, {
        action: "reschedule",
        startsAt: selected,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setMessage("Appointment rescheduled. A confirmation email is on its way.");
      setMode("view");
      await load();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Reschedule failed");
    } finally {
      setBusy(false);
    }
  }

  async function confirmCancel() {
    setBusy(true);
    try {
      const res = await postJson(`/api/booking/manage/${encodeURIComponent(token)}`, {
        action: "cancel",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setMessage("Appointment cancelled.");
      setMode("view");
      await load();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Cancel failed");
    } finally {
      setBusy(false);
    }
  }

  if (error) {
    return (
      <div className="border border-crimson/40 bg-crimson/10 p-6 text-sm text-crimson-light">
        {error}
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex justify-center py-12 text-white/40">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {message && (
        <div className="border border-white/15 bg-white/[0.03] px-4 py-3 text-sm text-white/70">
          {message}
        </div>
      )}

      <div className="border border-white/10 bg-white/[0.02] p-6">
        <div className="flex items-start gap-3">
          <Calendar className="mt-1 h-5 w-5 text-crimson" />
          <div>
            <p className="text-lg text-white">{data.appointmentType}</p>
            <p className="mt-2 text-white/70">{data.displayTime}</p>
            <p className="mt-1 text-sm text-white/40">
              {data.visitorTimezone
                ? `Shown in your time zone: ${data.visitorTimezone.replace(/_/g, " ")}`
                : null}
            </p>
            <p className="mt-1 text-sm text-white/40">
              Status: {data.status.replace(/_/g, " ")}
              {data.meetingFormat ? ` · ${data.meetingFormat.replace(/_/g, " ")}` : ""}
            </p>
            {data.description && (
              <p className="mt-4 text-sm text-white/50">{data.description}</p>
            )}
          </div>
        </div>
      </div>

      {data.contact && (data.contact.name || data.contact.email) && (
        <div className="border border-white/10 bg-white/[0.02] p-6">
          <p className="label mb-4">Your details</p>
          <dl className="grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
            {data.contact.name && (
              <div className="flex justify-between gap-4 sm:block">
                <dt className="text-white/45">Name</dt>
                <dd className="text-white/85">{data.contact.name}</dd>
              </div>
            )}
            {data.contact.businessName && (
              <div className="flex justify-between gap-4 sm:block">
                <dt className="text-white/45">Business</dt>
                <dd className="text-white/85">{data.contact.businessName}</dd>
              </div>
            )}
            {data.contact.email && (
              <div className="flex justify-between gap-4 sm:block">
                <dt className="text-white/45">Email</dt>
                <dd className="break-all text-white/85">{data.contact.email}</dd>
              </div>
            )}
            {data.contact.phone && (
              <div className="flex justify-between gap-4 sm:block">
                <dt className="text-white/45">Phone</dt>
                <dd className="text-white/85">{data.contact.phone}</dd>
              </div>
            )}
          </dl>
        </div>
      )}

      {confirmedView && data.status !== "cancelled" && (
        <div className="border border-white/10 bg-white/[0.02] p-6">
          <p className="label mb-4">What happens on the call</p>
          <ul className="space-y-2 text-sm leading-relaxed text-white/60">
            <li>· We review what you shared before the call so we start prepared.</li>
            <li>· We talk through your goals and where your business is today.</li>
            <li>· We identify the strongest opportunities for growth, efficiency, or automation.</li>
            <li>· You leave with practical recommended next steps — no obligation.</li>
          </ul>
        </div>
      )}

      {data.calendarLinks && data.status !== "cancelled" && (
        <div>
          <p className="label mb-3">Add to calendar</p>
          <div className="flex flex-wrap gap-3">
            <a
              href={data.calendarLinks.google}
              target="_blank"
              rel="noreferrer"
              className="btn-ghost px-4 py-2 text-xs"
            >
              Google <ExternalLink className="ml-1 inline h-3 w-3" />
            </a>
            <a
              href={data.calendarLinks.outlook}
              target="_blank"
              rel="noreferrer"
              className="btn-ghost px-4 py-2 text-xs"
            >
              Outlook
            </a>
            <a
              href={data.calendarLinks.office365}
              target="_blank"
              rel="noreferrer"
              className="btn-ghost px-4 py-2 text-xs"
            >
              Microsoft 365
            </a>
            <p className="w-full text-xs text-white/35">
              Apple Calendar: open the .ics attachment from your confirmation email.
            </p>
          </div>
        </div>
      )}

      {data.status !== "cancelled" && mode === "view" && (
        <div className="flex flex-wrap gap-3">
          {data.canReschedule && (
            <button
              type="button"
              className="btn-primary px-5 py-3 text-sm"
              disabled={busy}
              onClick={loadSlots}
            >
              Reschedule
            </button>
          )}
          {data.canCancel && (
            <button
              type="button"
              className="btn-ghost px-5 py-3 text-sm"
              disabled={busy}
              onClick={() => setMode("cancel")}
            >
              Cancel
            </button>
          )}
        </div>
      )}

      {mode === "reschedule" && (
        <div className="space-y-4 border border-white/10 p-5">
          <p className="text-sm text-white/60">Choose a new time</p>
          <div className="max-h-64 space-y-2 overflow-y-auto">
            {slots.map((s) => (
              <button
                key={s.start}
                type="button"
                onClick={() => setSelected(s.start)}
                className={`block min-h-[44px] w-full border px-3 py-2 text-left text-sm ${
                  selected === s.start
                    ? "border-crimson/70 bg-crimson/10"
                    : "border-white/10"
                }`}
              >
                {formatSlot(s.start, data.visitorTimezone)}
              </button>
            ))}
            {!slots.length && (
              <p className="text-sm text-white/40">No available times.</p>
            )}
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              className="btn-primary px-4 py-2 text-sm"
              disabled={!selected || busy}
              onClick={confirmReschedule}
            >
              Confirm new time
            </button>
            <button
              type="button"
              className="btn-ghost px-4 py-2 text-sm"
              onClick={() => setMode("view")}
            >
              Back
            </button>
          </div>
        </div>
      )}

      {mode === "cancel" && (
        <div className="space-y-4 border border-crimson/30 bg-crimson/5 p-5">
          <p className="text-sm text-white/70">
            Cancel this appointment? This cannot be undone online.
          </p>
          <div className="flex gap-3">
            <button
              type="button"
              className="btn-primary px-4 py-2 text-sm"
              disabled={busy}
              onClick={confirmCancel}
            >
              Yes, cancel
            </button>
            <button
              type="button"
              className="btn-ghost px-4 py-2 text-sm"
              onClick={() => setMode("view")}
            >
              Keep appointment
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
