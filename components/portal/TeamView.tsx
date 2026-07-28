"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Avatar,
  Banner,
  Button,
  Modal,
  SectionCard,
  StatusPill,
} from "@/components/portal/ui";
import { inputClass, Field } from "@/components/booking/ui";
import { postJson } from "@/lib/api";

type Member = {
  id: string;
  name: string;
  email: string;
  title: string | null;
  role: string;
  active: boolean;
  hasAccepted: boolean;
  lastLoginAt: string | null;
};

export function TeamView({
  users,
  legacyOwner,
  selfId,
}: {
  users: Member[];
  legacyOwner: { email: string; name: string } | null;
  selfId: string;
}) {
  const router = useRouter();
  const [inviting, setInviting] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [title, setTitle] = useState("");
  const [role, setRole] = useState<"admin" | "member">("member");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function invite() {
    setError(null);
    if (name.trim().length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("A name and a valid email are required.");
      return;
    }
    setBusy(true);
    try {
      const res = await postJson("/api/portal/team", {
        action: "invite",
        name: name.trim(),
        email: email.trim(),
        title: title.trim() || undefined,
        role,
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error || "Couldn't send the invite.");
      setSent(true);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't send the invite.");
    } finally {
      setBusy(false);
    }
  }

  async function act(body: Record<string, unknown>) {
    setBusy(true);
    try {
      const res = await postJson("/api/portal/team", body);
      if (res.ok) router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const roleHint: Record<string, string> = {
    owner: "Full access, including billing and team",
    admin: "Approvals, billing, and team management",
    member: "Project, requests, support, and training",
  };

  return (
    <div className="mt-8 space-y-6">
      <div className="flex justify-end">
        <Button
          onClick={() => {
            setInviting(true);
            setSent(false);
          }}
        >
          Invite a teammate
        </Button>
      </div>

      <SectionCard title="People with access" padded={false}>
        <ul className="divide-y divide-white/[0.06]">
          {legacyOwner && !users.some((u) => u.role === "owner" && u.active) && (
            <li className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
              <div className="flex items-center gap-3">
                <Avatar name={legacyOwner.name} />
                <div>
                  <p className="text-sm text-white/85">{legacyOwner.name}</p>
                  <p className="text-xs text-white/40">{legacyOwner.email}</p>
                </div>
              </div>
              <StatusPill status="active" label="Owner" />
            </li>
          )}
          {users.map((u) => (
            <li key={u.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
              <div className="flex min-w-0 items-center gap-3">
                <Avatar name={u.name} />
                <div className="min-w-0">
                  <p className="truncate text-sm text-white/85">
                    {u.name}
                    {u.title && <span className="ml-2 text-xs text-white/40">{u.title}</span>}
                  </p>
                  <p className="truncate text-xs text-white/40">
                    {u.email}
                    {u.lastLoginAt &&
                      ` · last signed in ${new Date(u.lastLoginAt).toLocaleDateString("en-US", { dateStyle: "medium" })}`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {!u.hasAccepted && u.active === false ? (
                  <StatusPill status="pending" label="Invite sent" />
                ) : (
                  <StatusPill
                    status={u.active ? "active" : "cancelled"}
                    label={`${u.role}${u.active ? "" : " · deactivated"}`}
                  />
                )}
                {u.id !== selfId && u.role !== "owner" && u.active && (
                  <Button
                    variant="ghost"
                    busy={busy}
                    onClick={() => void act({ action: "deactivate", userId: u.id })}
                  >
                    Remove access
                  </Button>
                )}
              </div>
            </li>
          ))}
          {users.length === 0 && !legacyOwner && (
            <li className="px-5 py-8 text-center text-sm text-white/40">
              No team members yet.
            </li>
          )}
        </ul>
      </SectionCard>

      <Banner tone="info" title="Access is personal">
        Each person gets their own login and their own permissions. If someone
        leaves your team, remove their access here — it takes effect
        immediately.
      </Banner>

      <Modal
        open={inviting}
        onClose={() => setInviting(false)}
        title={sent ? "Invitation sent" : "Invite a teammate"}
        footer={
          sent ? (
            <Button onClick={() => setInviting(false)}>Done</Button>
          ) : (
            <>
              <Button variant="ghost" onClick={() => setInviting(false)} disabled={busy}>
                Cancel
              </Button>
              <Button onClick={invite} busy={busy}>
                Send invitation
              </Button>
            </>
          )
        }
      >
        {sent ? (
          <p className="text-sm leading-relaxed text-white/70">
            {name} will receive an email with a secure link to set their own
            password. The link expires in 7 days.
          </p>
        ) : (
          <div className="space-y-4">
            <Field label="Full name">
              {(props) => (
                <input
                  {...props}
                  type="text"
                  className={inputClass(false)}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              )}
            </Field>
            <Field label="Work email">
              {(props) => (
                <input
                  {...props}
                  type="email"
                  className={inputClass(false)}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              )}
            </Field>
            <Field label="Title" optional>
              {(props) => (
                <input
                  {...props}
                  type="text"
                  className={inputClass(false)}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Office Manager"
                />
              )}
            </Field>
            <Field label="Access level" hint={roleHint[role]}>
              {(props) => (
                <select
                  {...props}
                  className={inputClass(false)}
                  value={role}
                  onChange={(e) => setRole(e.target.value as "admin" | "member")}
                >
                  <option value="member">Team member</option>
                  <option value="admin">Administrator</option>
                </select>
              )}
            </Field>
            {error && (
              <p role="alert" className="text-xs text-crimson-light">{error}</p>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
