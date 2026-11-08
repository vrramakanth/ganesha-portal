import { formatCurrency } from "@/lib/date";
import { parseStallNeeds } from "@/lib/stallNeeds";
import type { EventRegistration } from "@/lib/types";

/** The full picture of one kids' stall sign-up for an organiser: what it
 *  sells, how many kids run it, tables, chairs and power, anything else it
 *  needs, who to call, and what was paid. Renders nothing for a registration
 *  that isn't a stall sign-up. */
export default function StallDetails({
  registration: r,
  isStall = false,
}: {
  registration: EventRegistration;
  /** True for a registration known to be a stall sign-up (its event is a Kids
   *  Stall event). One made before the form asked for tables, chairs and
   *  power has none of those answers; it is shown with what it did give. */
  isStall?: boolean;
}) {
  const needs = parseStallNeeds(r.comments);
  if (!needs) {
    if (!isStall) return null;
    const parent = [r.parent_name, r.parent_mobile && r.parent_mobile !== r.mobile ? r.parent_mobile : ""].filter(Boolean).join(" · ");
    return (
      <div className="mt-1 space-y-0.5 rounded-lg bg-background px-3 py-2 text-xs">
        <p>
          <span className="font-semibold">🎈 {r.sub_category || "Stall"}</span>
          {r.comments ? `: ${r.comments.replace(/\s*\n\s*/g, " · ")}` : ""}
        </p>
        {parent && <p className="text-muted">Parent: {parent}</p>}
        <p className="text-saffron-text">
          No tables, chairs, power or payment details on this one. It was sent before the form asked for them.
        </p>
      </div>
    );
  }
  const parent = [r.parent_name, r.parent_mobile && r.parent_mobile !== r.mobile ? r.parent_mobile : ""].filter(Boolean).join(" · ");
  return (
    <div className="mt-1 space-y-0.5 rounded-lg bg-background px-3 py-2 text-xs">
      <p>
        <span className="font-semibold">🎈 {r.sub_category || "Stall"}</span>
        {needs.idea ? `: ${needs.idea}` : ""}
      </p>
      <p className="text-muted">
        {needs.kids} {needs.kids === 1 ? "kid" : "kids"} · {needs.tables} {needs.tables === 1 ? "table" : "tables"} ·{" "}
        {needs.chairs} {needs.chairs === 1 ? "chair" : "chairs"} ·{" "}
        {needs.power ? `Power${needs.powerDetails ? ` (${needs.powerDetails})` : ""}` : "No power"}
      </p>
      {needs.other && <p className="text-muted">Also needs: {needs.other}</p>}
      {parent && <p className="text-muted">Parent: {parent}</p>}
      {needs.fee > 0 && (
        <p className={needs.paymentRef ? "text-green-700" : "text-saffron-text"}>
          {formatCurrency(needs.fee)} for tables ·{" "}
          {needs.paymentRef ? `UPI ref ${needs.paymentRef} (check against the bank)` : "no payment reference yet"}
        </p>
      )}
    </div>
  );
}
