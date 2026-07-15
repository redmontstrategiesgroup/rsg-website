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
              Status: {data.status.replace(/_/g, " ")}
              {data.meetingFormat ? ` · ${data.meetingFormat.replace(/_/g, " ")}` : ""}
            </p>
            {data.description && (
              <p className="mt-4 text-sm text-white/50">{data.description}</p>
            )}
          </div>
        </div>
      </div>

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

      {!confirmedView && data.status !== "cancelled" && mode === "view" && (
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
                className={`block w-full border px-3 py-2 text-left text-sm ${
                  selected === s.start
                    ? "border-crimson/70 bg-crimson/10"
                    : "border-white/10"
                }`}
              >
                {new Date(s.start).toLocaleString()} ({s.label})
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
