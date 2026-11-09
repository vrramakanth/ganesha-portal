"use client";

import { useMemo, useState } from "react";
import { api } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { useVolunteerAuth } from "@/lib/VolunteerAuthContext";
import LoadingIndicator from "@/components/LoadingIndicator";
import PageHeader from "@/components/PageHeader";
import StallListSheet from "@/components/StallListSheet";

/** Every stall for one Kids Stall event on a single printable sheet, for the
 *  organisers to keep or hand round: who runs it, what it sells, what it
 *  needs, who to call and whether the table fee is paid. "Save as PDF" is the
 *  browser's own print dialog, so it works on phones and laptops. */
export default function StallListPage() {
  const { idToken } = useVolunteerAuth();
  const { data, loading, error } = useAsync(
    () => Promise.all([api.volunteer.allRegistrations(idToken as string), api.events.list()]),
    [idToken]
  );
  const [registrations, events] = data ?? [[], []];
  const stallEvents = useMemo(() => events.filter((e) => e.category === "Kids Stall"), [events]);
  const [chosen, setChosen] = useState(() =>
    typeof window === "undefined" ? "" : (new URLSearchParams(window.location.search).get("event") ?? "")
  );
  const [includePending, setIncludePending] = useState(true);
  const event = stallEvents.find((e) => e.event_id === chosen) ?? stallEvents[0];

  const stalls = useMemo(
    () =>
      registrations
        .filter(
          (r) =>
            event &&
            r.event_id === event.event_id &&
            (r.status === "CONFIRMED" || (includePending && r.status === "PENDING_REVIEW"))
        )
        .sort((a, b) =>
          a.status !== b.status ? (a.status === "CONFIRMED" ? -1 : 1) : a.participant_name.localeCompare(b.participant_name)
        ),
    [registrations, event, includePending]
  );

  function printList() {
    if (!event) return;
    const previous = document.title;
    document.title = `${event.name} stall list`;
    window.addEventListener("afterprint", () => (document.title = previous), { once: true });
    window.print();
  }

  if (loading) return <LoadingIndicator label="Getting the stall list…" className="px-5 pt-8" />;
  if (error) return <p className="px-5 pt-8 text-sm text-red-600">{error}</p>;
  if (!event) {
    return (
      <div className="flex flex-col gap-4 px-5 pt-8">
        <PageHeader title="Stall list" backHref="/volunteer/events" backLabel="← Events" />
        <p className="text-sm text-muted">There is no Kids Stall event yet.</p>
      </div>
    );
  }

  const asOf = new Date().toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  });

  return (
    <div className="flex flex-col gap-4 px-5 pt-6 print:px-0 print:pt-0">
      <div className="space-y-2 print:hidden">
        <PageHeader title="Stall list" subtitle="All stalls on one sheet" backHref="/volunteer/events" backLabel="← Events" />
        {stallEvents.length > 1 && (
          <select
            value={event.event_id}
            onChange={(e) => setChosen(e.target.value)}
            className="w-full rounded-lg border border-border bg-card px-3 py-3 text-sm"
          >
            {stallEvents.map((e) => (
              <option key={e.event_id} value={e.event_id}>
                {e.name}
              </option>
            ))}
          </select>
        )}
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={includePending} onChange={(e) => setIncludePending(e.target.checked)} />
          Include stalls still waiting for approval
        </label>
        <button
          type="button"
          onClick={printList}
          disabled={stalls.length === 0}
          className="w-full rounded-xl bg-maroon py-3 text-sm font-semibold text-white disabled:opacity-60"
        >
          Save as PDF / Print
        </button>
      </div>

      <StallListSheet event={event} stalls={stalls} asOf={asOf} />
    </div>
  );
}
