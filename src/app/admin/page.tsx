import Link from "next/link";
import { ShieldAlert, ShieldCheck } from "lucide-react";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireOwnerAdmin } from "@/lib/security/admin-guard";
import { PRIVATE_PAGE_ROBOTS } from "@/lib/site";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Owner Security Console",
  robots: PRIVATE_PAGE_ROBOTS,
};

export default async function AdminPage() {
  const auth = await requireOwnerAdmin({ resource: "PAGE /admin" });

  if (!auth.ok) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-page px-4 text-ink">
        <div
          data-testid="admin-denied-panel"
          data-deny-code={auth.code}
          className="w-full max-w-md rounded-2xl border border-rose-400/35 bg-panel p-6 text-center"
        >
          <div className="mx-auto inline-flex h-11 w-11 items-center justify-center rounded-xl border border-rose-400/35 bg-rose-500/10 text-rose-200">
            <ShieldAlert className="h-5 w-5" />
          </div>
          <h1 className="mt-4 text-lg font-bold text-ink">Access denied</h1>
          <p className="mt-2 text-xs leading-relaxed text-ink-secondary">
            {auth.error}
          </p>
          <div className="mt-5 flex justify-center gap-2">
            <Link
              href="/projects"
              className="rounded-xl border border-ink/15 bg-elevated px-4 py-2 text-xs font-semibold text-ink hover:border-accent/55"
            >
              Back to Projects
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const admin = createSupabaseAdminClient();
  const [projectsCount, auditRes] = await Promise.all([
    admin.from("projects").select("id", { count: "exact", head: true }),
    admin
      .from("security_audit_events")
      .select("id, event_type, outcome, target_resource, created_at")
      .order("created_at", { ascending: false })
      .limit(15),
  ]);

  const events = auditRes.data ?? [];

  return (
    <main className="min-h-screen bg-page px-4 py-8 text-ink sm:px-6">
      <div
        data-testid="admin-console-panel"
        className="mx-auto max-w-4xl space-y-6"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink/10 pb-4">
          <div className="flex items-center gap-2.5">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-accent/40 bg-accent-soft text-accent">
              <ShieldCheck className="h-5 w-5" />
            </span>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-ink">
                Owner Security Console
              </h1>
              <p className="font-mono text-xs text-ink-secondary">
                Verified AAL2 Owner · {auth.user.id}
              </p>
            </div>
          </div>

          <Link
            href="/projects"
            className="rounded-xl border border-ink/12 bg-panel px-3.5 py-2 text-xs font-medium text-ink-secondary hover:border-accent/55 hover:text-ink"
          >
            Back to Projects
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-ink/10 bg-panel p-4">
            <p className="text-xs text-ink-muted">Total Projects</p>
            <p className="mt-1 font-mono text-2xl font-bold text-ink">
              {projectsCount.count ?? 0}
            </p>
          </div>
          <div className="rounded-2xl border border-ink/10 bg-panel p-4">
            <p className="text-xs text-ink-muted">Session Assurance</p>
            <p className="mt-1 font-mono text-2xl font-bold text-accent">
              {auth.aal.toUpperCase()}
            </p>
          </div>
        </div>

        <section className="rounded-2xl border border-ink/10 bg-panel p-4">
          <h2 className="text-sm font-semibold text-ink">
            Recent Redacted Security Audit Events
          </h2>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left font-mono text-xs">
              <thead className="border-b border-ink/10 text-ink-muted">
                <tr>
                  <th className="py-2 pr-3">Event</th>
                  <th className="py-2 pr-3">Outcome</th>
                  <th className="py-2 pr-3">Resource</th>
                  <th className="py-2">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink/8 text-ink-secondary">
                {events.map((ev) => (
                  <tr key={ev.id}>
                    <td className="py-2 pr-3 text-ink">{ev.event_type}</td>
                    <td className="py-2 pr-3">{ev.outcome}</td>
                    <td className="py-2 pr-3">{ev.target_resource ?? "-"}</td>
                    <td className="py-2">
                      {new Date(ev.created_at).toISOString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
