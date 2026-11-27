import { formatCurrency, formatEventDate, formatEventTime } from "@/lib/date";
import { summariseStalls } from "@/lib/stallNeeds";
import type { EventRecord, EventRegistration } from "@/lib/types";
import StallDetails from "@/components/StallDetails";
import StatusBadge from "@/components/StatusBadge";

const STATUS_LABEL: Record<string, string> = { PENDING_REVIEW: "Pending", CONFIRMED: "Confirmed" };

/** The printable stall sheet itself: the event, totals, and one card per stall
 *  with everything an organiser needs. Print styles keep cards whole across
 *  pages and put them two to a row. */
export default function StallListSheet({
  event,
  stalls,
  asOf,
}: {
  event: EventRecord;
  stalls: EventRegistration[];
  asOf: string;
}) {
  const totals = summariseStalls(stalls);
  return (
    <>
      <header className="space-y-1 text-center">
        <h1 className="text-2xl font-extrabold">{event.name}</h1>
        <p className="text-sm text-muted">
          Stall list · {formatEventDate(event.date)} · {formatEventTime(event.start_time)} · {event.location}
        </p>
        <p className="text-[11px] text-muted">As of {asOf}</p>
      </header>

      <div className="grid grid-cols-3 gap-2 text-center print:grid-cols-6">
        {[
          { value: stalls.length, label: "stalls" },
          { value: totals.kids, label: "kids" },
          { value: totals.tables, label: "tables" },
          { value: totals.chairs, label: "chairs" },
          { value: totals.power, label: "need power" },
          { value: totals.feeDue ? `${formatCurrency(totals.feeVerified)} / ${formatCurrency(totals.feeDue)}` : "–", label: "fees verified / due" },
        ].map((t) => (
          <div key={t.label} className="rounded-lg border border-border bg-card px-2 py-2">
            <p className="text-base font-bold leading-tight text-maroon">{t.value}</p>
            <p className="text-[11px] leading-tight text-muted">{t.label}</p>
          </div>
        ))}
      </div>

      {stalls.length === 0 && <p className="text-sm text-muted">No stalls to list yet.</p>}
      <div className="grid gap-3 print:grid-cols-2 sm:grid-cols-2">
        {stalls.map((r, i) => (
          <section key={r.registration_id} className="rounded-xl border border-border bg-card px-3 py-3 print:break-inside-avoid">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-bold">
                  {i + 1}. {r.participant_name}
                  {r.participant_age ? `, ${r.participant_age}` : ""}
                </p>
                <p className="text-xs text-muted">
                  Block {r.block}, Flat {r.flat_number} · {r.mobile}
                </p>
              </div>
              <StatusBadge label={STATUS_LABEL[r.status] ?? r.status} tone={r.status === "CONFIRMED" ? "success" : "warning"} />
            </div>
            <StallDetails registration={r} isStall />
          </section>
        ))}
      </div>

      <p className="pb-6 text-center text-[11px] text-muted print:break-inside-avoid">
        {event.name} · {stalls.length} {stalls.length === 1 ? "stall" : "stalls"} · list made {asOf}
      </p>
    </>
  );
}
