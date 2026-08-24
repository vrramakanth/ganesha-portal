"use client";

import Link from "next/link";
import { api } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { useVolunteerAuth } from "@/lib/VolunteerAuthContext";
import { formatCurrency } from "@/lib/date";
import PageHeader from "@/components/PageHeader";
import StatTile from "@/components/StatTile";

export default function VolunteerDashboardPage() {
  const { idToken, volunteer } = useVolunteerAuth();
  const { data, loading, error } = useAsync(
    () => api.volunteer.dashboard(idToken as string),
    [idToken]
  );

  const quickActions = [
    { href: "/volunteer/donations", label: "Review Payments" },
    { href: "/volunteer/dinner/counter", label: "Dinner Counter" },
    { href: "/volunteer/events", label: "Events" },
    ...(volunteer?.isSuperAdmin ? [{ href: "/volunteer/volunteers", label: "Volunteers" }] : []),
    { href: "/volunteer/reports", label: "Reports" },
  ];

  return (
    <div className="flex flex-col gap-6 px-5 pt-8">
      <PageHeader title="Festival Dashboard" />

      {loading && <p className="text-sm text-muted">Loading…</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {data && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <StatTile value={formatCurrency(data.collected)} label="Collected" />
            <StatTile value={String(data.donationCount)} label="Donations" />
            <StatTile value={data.mealsRegistered.toLocaleString()} label="Meals Registered" />
            <StatTile value={data.mealsServed.toLocaleString()} label="Meals Served" />
            <StatTile value={String(data.volunteerCount)} label="Volunteers" />
          </div>

          <section className="space-y-2">
            <h2 className="text-sm font-semibold tracking-wide uppercase text-muted">Alerts</h2>
            <div className="rounded-xl border border-border bg-card divide-y divide-border">
              {data.alerts.length === 0 && <p className="px-4 py-3 text-sm text-muted">No alerts.</p>}
              {data.alerts.map((alert) => (
                <p key={alert} className="px-4 py-3 text-sm flex items-center gap-2">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-saffron" />
                  {alert}
                </p>
              ))}
            </div>
          </section>
        </>
      )}

      <section className="space-y-2">
        <h2 className="text-sm font-semibold tracking-wide uppercase text-muted">Quick Actions</h2>
        <div className="grid grid-cols-2 gap-3">
          {quickActions.map((action) => (
            <Link
              key={action.href}
              href={action.href}
              className="rounded-xl bg-maroon py-4 px-3 text-center text-sm font-semibold text-white active:bg-maroon-dark transition-colors"
            >
              {action.label}
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
