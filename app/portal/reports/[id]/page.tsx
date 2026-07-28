import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { getSession } from "@/lib/auth";
import { getClientById, isSessionLive } from "@/lib/store";
import { getServiceReport } from "@/lib/managed-services/store";
import type { ReportKind, ServiceReportData } from "@/lib/managed-services/types";
import { ReportActions } from "@/components/portal/ReportActions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Service Report | Redmont Strategies Group",
  robots: { index: false, follow: false },
};

const KIND_LABELS: Record<ReportKind, string> = {
  monthly: "Monthly service report",
  health: "System health report",
  baseline: "Baseline report",
  quarterly: "Quarterly report",
};

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export default async function PortalReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const session = await getSession();
  if (!session) redirect("/login");
  if (session.sid && !(await isSessionLive(session.sid))) redirect("/login");
  const client = await getClientById(session.sub);
  if (!client) redirect("/login");

  const report = await getServiceReport(id);
  if (
    !report ||
    report.clientId !== session.sub ||
    report.status !== "published"
  ) {
    notFound();
  }

  const data: ServiceReportData = report.data ?? {};
  const period = [formatDate(report.periodStart), formatDate(report.periodEnd)]
    .filter(Boolean)
    .join(" — ");

  const stats: { label: string; value: string }[] = [];
  if (data.uptimePct != null) stats.push({ label: "Uptime", value: `${data.uptimePct}%` });
  if (data.backupsCompleted != null)
    stats.push({ label: "Backups completed", value: String(data.backupsCompleted) });
  if (data.updatesInstalled != null)
    stats.push({ label: "Updates installed", value: String(data.updatesInstalled) });
  if (data.issuesResolved != null)
    stats.push({ label: "Issues resolved", value: String(data.issuesResolved) });

  return (
    <main className="report-page min-h-screen bg-base pb-20 pt-10 print:bg-white print:pb-0 print:pt-0">
      {/* Print stylesheet: clean black-on-white document, controls hidden. */}
      <style>{`
        @media print {
          body { background: #fff !important; }
          .report-page { background: #fff !important; }
          .report-actions, nav, header.site-header, footer { display: none !important; }
          .report-doc {
            border: none !important;
            box-shadow: none !important;
            background: #fff !important;
            color: #111 !important;
            max-width: none !important;
            padding: 0 !important;
          }
          .report-doc * { color: #111 !important; border-color: #ddd !important; background: transparent !important; }
          .report-doc .report-muted { color: #555 !important; }
          .report-doc .report-rule { border-color: #ccc !important; }
        }
      `}</style>

      <div className="container-px mx-auto max-w-3xl print:max-w-none">
        <ReportActions />

        <article className="report-doc mt-6 rounded-2xl border border-white/10 bg-white/[0.02] p-8 sm:p-12 print:mt-0">
          {/* Header */}
          <header>
            <p className="font-mono text-[0.62rem] uppercase tracking-label text-crimson-light report-muted">
              Redmont Strategies Group
            </p>
            <h1 className="mt-3 font-display text-3xl font-semibold text-white sm:text-4xl">
              {report.title}
            </h1>
            <div className="report-muted mt-4 flex flex-wrap gap-x-6 gap-y-1 text-sm text-white/50">
              <span>{KIND_LABELS[report.kind]}</span>
              {client.company && <span>Prepared for {client.company}</span>}
              {period && <span>{period}</span>}
            </div>
          </header>

          {/* Summary */}
          {report.summary && (
            <p className="report-rule mt-8 border-t border-white/[0.08] pt-8 text-[0.95rem] leading-relaxed text-white/75">
              {report.summary}
            </p>
          )}

          {/* Headline stats */}
          {stats.length > 0 && (
            <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
              {stats.map((s) => (
                <div
                  key={s.label}
                  className="rounded-xl border border-white/10 p-4"
                >
                  <p className="report-muted font-mono text-[0.55rem] uppercase tracking-label text-white/40">
                    {s.label}
                  </p>
                  <p className="mt-2 font-display text-2xl font-semibold text-white">
                    {s.value}
                  </p>
                </div>
              ))}
            </div>
          )}

          {data.systemsMonitored && data.systemsMonitored.length > 0 && (
            <ReportSection title="Systems monitored">
              <ul className="list-disc space-y-1 pl-5">
                {data.systemsMonitored.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </ReportSection>
          )}

          {data.securityEvents && (
            <ReportSection title="Security">
              <p>{data.securityEvents}</p>
            </ReportSection>
          )}

          {data.performanceNotes && (
            <ReportSection title="Performance">
              <p>{data.performanceNotes}</p>
            </ReportSection>
          )}

          {data.leadMetrics && data.leadMetrics.length > 0 && (
            <ReportSection title="Lead & conversion metrics">
              <table className="w-full text-left text-sm">
                <tbody>
                  {data.leadMetrics.map((m) => (
                    <tr
                      key={m.label}
                      className="report-rule border-b border-white/[0.08] last:border-0"
                    >
                      <td className="report-muted py-2.5 pr-4 text-white/55">
                        {m.label}
                      </td>
                      <td className="py-2.5 font-medium text-white">{m.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ReportSection>
          )}

          {data.automationActivity && (
            <ReportSection title="Automation activity">
              <p>{data.automationActivity}</p>
            </ReportSection>
          )}

          {data.aiActivity && (
            <ReportSection title="AI activity">
              <p>{data.aiActivity}</p>
            </ReportSection>
          )}

          {data.changesCompleted && data.changesCompleted.length > 0 && (
            <ReportSection title="Changes completed">
              <ul className="list-disc space-y-1 pl-5">
                {data.changesCompleted.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            </ReportSection>
          )}

          {data.recommendations && data.recommendations.length > 0 && (
            <ReportSection title="Recommendations">
              <ul className="list-disc space-y-1 pl-5">
                {data.recommendations.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </ReportSection>
          )}

          {data.upcomingPriorities && data.upcomingPriorities.length > 0 && (
            <ReportSection title="Upcoming priorities">
              <ul className="list-disc space-y-1 pl-5">
                {data.upcomingPriorities.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </ReportSection>
          )}

          {data.additionalOpportunities &&
            data.additionalOpportunities.length > 0 && (
              <ReportSection title="Additional opportunities">
                <ul className="list-disc space-y-1 pl-5">
                  {data.additionalOpportunities.map((o) => (
                    <li key={o}>{o}</li>
                  ))}
                </ul>
              </ReportSection>
            )}

          <footer className="report-rule report-muted mt-10 border-t border-white/[0.08] pt-6 text-[0.72rem] text-white/35">
            Prepared by Redmont Strategies Group
            {report.publishedAt ? ` · Published ${formatDate(report.publishedAt)}` : ""}.
            Questions about this report? Reach your account manager through the
            client portal.
          </footer>
        </article>
      </div>
    </main>
  );
}

function ReportSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="report-rule mt-8 border-t border-white/[0.08] pt-7">
      <h2 className="font-display text-lg font-semibold text-white">{title}</h2>
      <div className="report-muted mt-3 text-sm leading-relaxed text-white/60">
        {children}
      </div>
    </section>
  );
}
