"use client";

import Link from "next/link";
import { api } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { useVolunteerAuth } from "@/lib/VolunteerAuthContext";
import { takePrefetchedDashboard } from "@/lib/dashboardPrefetch";
import { useFestivalConfig } from "@/lib/FestivalConfigContext";
import { formatCurrency } from "@/lib/date";
import PageHeader from "@/components/PageHeader";
import StatTile from "@/components/StatTile";
import LoadingIndicator from "@/components/LoadingIndicator";

export default function VolunteerDashboardPage() {
  const { idToken, volunteer } = useVolunteerAuth();
  const { modules } = useFestivalConfig();
  const { data, loading, error } = useAsync(
    () => takePrefetchedDashboard(idToken as string) ?? api.volunteer.dashboard(idToken as string),
    [idToken]
  );

  const quickActions = [
    ...(modules.donations && volunteer?.permissions.includes("Finance")
      ? [{ href: "/volunteer/donations", label: "Review Payments" }]
      : []),
    ...(modules.sponsorships && volunteer?.permissions.includes("Finance")
      ? [{ href: "/volunteer/sponsorships", label: "Record Sponsorship" }]
      : []),
    ...(modules.meal && (volunteer?.permissions.includes("Finance") || volunteer?.permissions.includes("Dinner"))
      ? [{ href: "/volunteer/community-dinner", label: "Community Dinner" }]
      : []),
    ...(modules.meal ? [{ href: "/volunteer/dinner/counter", label: "Dinner Counter" }] : []),
    // A bhog sponsor is recorded against a donation the sponsor already made
    // (BhogSponsors.js), so it only applies when Donations is on too.
    ...(modules.sponsorships && modules.donations
      ? [{ href: "/volunteer/bhog-sponsors", label: "Bhog Sponsors" }]
      : []),
    ...(modules.events ? [{ href: "/volunteer/events", label: "Events" }] : []),
    ...(volunteer?.permissions.includes("Operations")
      ? [{ href: "/volunteer/reset-pin", label: "Change Resident PIN" }]
      : []),
    ...(modules.expenses
      ? [
          { href: "/volunteer/expenses", label: "Record Expense" },
          { href: "/volunteer/future-costs", label: "Future Costs" },
        ]
      : []),
    ...(modules.expenses && volunteer?.permissions.includes("Finance")
      ? [{ href: "/volunteer/expenses/review", label: "Review Expenses" }]
      : []),
    ...(volunteer?.permissions.includes("Content")
      ? [{ href: "/volunteer/feedback", label: "Resident Feedback" }]
      : []),
  ];

  return (
    <div className="flex flex-col gap-6 px-5 pt-8">
      <PageHeader title="Festival Dashboard" />

      {loading && <LoadingIndicator />}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {data && (
        <>
          <section className="space-y-2">
            <h2 className="text-sm font-semibold tracking-wide uppercase text-muted">Festival Summary</h2>
            <div className="grid grid-cols-3 gap-3">
              <StatTile value={formatCurrency(data.festivalSummary.income)} label="Income" />
              <StatTile value={formatCurrency(data.festivalSummary.expenses)} label="Expenses" />
              <StatTile value={formatCurrency(data.festivalSummary.balance)} label="Balance" />
              {modules.expenses && (
                <>
                  <StatTile value={formatCurrency(data.festivalSummary.futureCosts)} label="Future Costs" />
                  <StatTile value={formatCurrency(data.festivalSummary.projectedBalance)} label="Projected Balance" />
                </>
              )}
            </div>
          </section>

          <div className="grid grid-cols-2 gap-3">
            {modules.donations && data.collected !== null && (
              <StatTile value={formatCurrency(data.collected)} label="Collected" />
            )}
            {modules.donations && data.donationCount !== null && (
              <StatTile value={String(data.donationCount)} label="Donations" />
            )}
            {modules.meal && <StatTile value={data.mealsRegistered.toLocaleString()} label="Meals Registered" />}
            {modules.meal && <StatTile value={data.mealsServed.toLocaleString()} label="Meals Served" />}
            {modules.volunteers && <StatTile value={String(data.volunteerCount)} label="Seva Sign-Ups" />}
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
