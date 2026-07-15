import type { ReactNode } from "react";
import {
  Instagram,
  Facebook,
  MessageSquare,
  Phone,
  Mail,
  Globe,
  Zap,
  CalendarDays,
  ArrowRightLeft,
  Bell,
  Star,
  CheckSquare,
  Megaphone,
  type LucideIcon,
} from "lucide-react";
import type { ActivityIcon, Channel, LeadTemp } from "../types";

export const CHANNEL_META: Record<Channel, { label: string; icon: LucideIcon }> = {
  sms: { label: "SMS", icon: MessageSquare },
  instagram: { label: "Instagram", icon: Instagram },
  facebook: { label: "Facebook", icon: Facebook },
  phone: { label: "Phone", icon: Phone },
  email: { label: "Email", icon: Mail },
  web: { label: "Website", icon: Globe },
};

export const ACTIVITY_ICONS: Record<ActivityIcon, LucideIcon> = {
  automation: Zap,
  message: MessageSquare,
  call: Phone,
  calendar: CalendarDays,
  pipeline: ArrowRightLeft,
  alert: Bell,
  review: Star,
  task: CheckSquare,
  campaign: Megaphone,
};

export function ChannelBadge({ channel }: { channel: Channel }) {
  const meta = CHANNEL_META[channel];
  const Icon = meta.icon;
  return (
    <span className="inline-flex items-center gap-1.5 rounded border border-white/10 bg-white/[0.04] px-1.5 py-0.5 text-[0.6rem] font-medium uppercase tracking-wider text-white/55">
      <Icon size={10} aria-hidden />
      {meta.label}
    </span>
  );
}

export function TempBadge({ temp }: { temp: LeadTemp }) {
  const styles: Record<LeadTemp, string> = {
    hot: "border-crimson/40 bg-crimson/15 text-crimson-light",
    warm: "border-amber-500/30 bg-amber-500/10 text-amber-300/90",
    cold: "border-white/10 bg-white/[0.04] text-white/45",
  };
  return (
    <span
      className={`inline-flex rounded border px-1.5 py-0.5 text-[0.6rem] font-medium uppercase tracking-wider ${styles[temp]}`}
    >
      {temp}
    </span>
  );
}

export function StatusPill({
  tone,
  children,
}: {
  tone: "green" | "amber" | "red" | "gray" | "crimson";
  children: ReactNode;
}) {
  const styles = {
    green: "border-emerald-500/25 bg-emerald-500/10 text-emerald-300/90",
    amber: "border-amber-500/25 bg-amber-500/10 text-amber-300/90",
    red: "border-red-500/30 bg-red-500/10 text-red-300/90",
    gray: "border-white/10 bg-white/[0.04] text-white/50",
    crimson: "border-crimson/40 bg-crimson/15 text-crimson-light",
  } as const;
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded border px-2 py-0.5 text-[0.62rem] font-medium uppercase tracking-wider ${styles[tone]}`}
    >
      {children}
    </span>
  );
}

/** Small "sample data" tag required on every demo surface. */
export function SampleDataTag({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-[0.6rem] font-medium uppercase tracking-[0.16em] text-white/30 ${className}`}
    >
      <span className="h-1 w-1 rounded-full bg-white/30" aria-hidden />
      Interactive demonstration using sample data
    </span>
  );
}

export function PanelHeading({
  title,
  right,
}: {
  title: string;
  right?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-white/[0.07] px-4 py-3">
      <h4 className="text-[0.68rem] font-medium uppercase tracking-[0.18em] text-white/45">
        {title}
      </h4>
      {right}
    </div>
  );
}

export function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
      <span className="h-8 w-8 rounded-full border border-dashed border-white/15" aria-hidden />
      <p className="text-xs text-white/35">{text}</p>
    </div>
  );
}
