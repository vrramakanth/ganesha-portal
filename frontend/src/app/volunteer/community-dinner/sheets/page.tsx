"use client";

import { useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { useVolunteerAuth } from "@/lib/VolunteerAuthContext";
import { buildHouseholds, parseMap } from "@/lib/dinnerHouseholds";
import PageHeader from "@/components/PageHeader";
import LoadingIndicator from "@/components/LoadingIndicator";
import CounterSheet from "@/components/CounterSheet";
import ScannedSheets from "./ScannedSheets";

const COUNTERS = [1, 2, 3, 4];

export default function DinnerSheetsPage() {
  const { idToken, volunteer } = useVolunteerAuth();
  const hasDinner = volunteer?.permissions.includes("Dinner") ?? false;
  const [selected, setSelected] = useState(1);
  const [printAll, setPrintAll] = useState(false);

  const { data, loading, error } = useAsync(
    () =>
      hasDinner
        ? Promise.all([api.festival.get(), api.volunteer.communityDinnerList(idToken as string)])
        : Promise.resolve(null),
    [idToken, hasDinner]
  );

  const map = parseMap(data?.[0].community_dinner_counter_map);
  const mapSaved = Object.keys(map).length > 0;
  const households = data ? buildHouseholds(data[1], map) : [];
  const generatedAt = new Date().toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  });

  function print(all: boolean) {
    setPrintAll(all);
    setTimeout(() => {
      window.print();
      setPrintAll(false);
    }, 150);
  }

  return (
    <div className="flex flex-col gap-4 px-5 pt-8 print:p-0">
      <div className="print:hidden space-y-4">
        <PageHeader
          title="Counter Sheets"
          subtitle="Printable plate-distribution sheets, one per counter"
          backHref="/volunteer/community-dinner"
          backLabel="← Community Dinner"
        />
        {!hasDinner && <p className="text-sm text-muted">You don&apos;t have access to Community Dinner.</p>}
        {loading && <LoadingIndicator />}
        {error && <p className="text-sm text-red-600">{error}</p>}
        {data && !mapSaved && (
          <p className="text-sm text-red-600">
            Counters haven&apos;t been assigned yet.{" "}
            <Link href="/volunteer/community-dinner/counters" className="underline font-semibold">
              Assign blocks to counters
            </Link>{" "}
            first.
          </p>
        )}
        {data && mapSaved && (
          <>
            <div className="grid grid-cols-4 gap-2">
              {COUNTERS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setSelected(c)}
                  className={`rounded-lg border py-2 text-sm font-semibold ${
                    selected === c ? "border-maroon bg-maroon/10 text-maroon" : "border-border"
                  }`}
                >
                  Counter {c}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => print(false)}
                className="rounded-xl bg-maroon py-3 text-sm font-semibold text-white"
              >
                Print Counter {selected}
              </button>
              <button
                type="button"
                onClick={() => print(true)}
                className="rounded-xl border border-border bg-card py-3 text-sm font-semibold text-maroon"
              >
                Print all four
              </button>
            </div>
            <p className="text-xs text-muted">
              The list is as of now. Anyone registered after you print won&apos;t be on the paper. Print again, or use
              the mobile search on the Community Dinner page. In the print dialog you can also choose &quot;Save as
              PDF&quot; to share a sheet.
            </p>
          </>
        )}

        {hasDinner && idToken && <ScannedSheets idToken={idToken} />}
      </div>

      {data && mapSaved && (
        <div className="space-y-6 print:space-y-0">
          {COUNTERS.map((c) => (
            <div
              key={c}
              className={selected === c ? "block" : printAll ? "hidden print:block" : "hidden"}
            >
              <CounterSheet
                counter={c}
                households={households.filter((h) => h.counter === c)}
                map={map}
                generatedAt={generatedAt}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
