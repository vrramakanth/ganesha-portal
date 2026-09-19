import { Fragment } from "react";
import { formatBlockRange, type CounterMap } from "@/lib/dinnerCounters";
import type { Household } from "@/lib/dinnerHouseholds";

const BLANK_LINES = 6;

const byBlockThenFlat = (a: Household, b: Household) =>
  a.block === b.block ? a.flat - b.flat : a.block < b.block ? -1 : 1;

function TickBoxes({ count }: { count: number }) {
  return (
    <span className="inline-flex flex-wrap gap-1">
      {Array.from({ length: count }).map((_, i) => (
        <span key={i} className="inline-block h-4 w-4 border border-black" />
      ))}
    </span>
  );
}

function HouseholdRow({ h }: { h: Household }) {
  return (
    <tr className="border-b border-gray-400 align-middle">
      <td className="py-1.5 pr-2 font-semibold whitespace-nowrap">
        {h.block}-{String(h.flat).padStart(3, "0")}
      </td>
      <td className="py-1.5 pr-2">
        {h.name}
        {!h.confirmed && <span className="ml-1 text-[10px] font-semibold">(payment not confirmed)</span>}
      </td>
      <td className="py-1.5 pr-2 text-center font-semibold">{h.members}</td>
      <td className="py-1.5 pr-2">
        <TickBoxes count={h.members} />
      </td>
      <td className="py-1.5 w-16 border-l border-gray-400" />
    </tr>
  );
}

export default function CounterSheet({
  counter,
  households,
  map,
  generatedAt,
}: {
  counter: number;
  households: Household[];
  map: CounterMap;
  generatedAt: string;
}) {
  const regular = households.filter((h) => !h.late).sort(byBlockThenFlat);
  const late = households.filter((h) => h.late).sort(byBlockThenFlat);
  const plates = households.reduce((sum, h) => sum + h.members, 0);
  const range = formatBlockRange(map, counter);

  return (
    <section className="bg-white p-4 text-black text-[12px] leading-tight print:p-0 print:break-after-page">
      <div className="border-b-2 border-black pb-2 mb-2">
        <h2 className="text-base font-bold">
          Community Dinner · Counter {counter}
          {range && ` · Blocks ${range}`}
        </h2>
        <p>
          20 September 2026 · {households.length} households · {plates} plates · List as of {generatedAt}
        </p>
        <p className="text-[11px]">
          Strike off one box for each person as they collect a plate. Members may arrive separately.
        </p>
      </div>
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b-2 border-black text-left">
            <th className="py-1 pr-2">Flat</th>
            <th className="py-1 pr-2">Name</th>
            <th className="py-1 pr-2 text-center">Members</th>
            <th className="py-1 pr-2">Strike off</th>
            <th className="py-1 w-16 border-l border-gray-400 pl-1">Plates</th>
          </tr>
        </thead>
        <tbody>
          {regular.map((h, i) => (
            <Fragment key={h.key}>
              {regular[i - 1]?.block !== h.block && (
                <tr>
                  <td colSpan={5} className="pt-2 pb-0.5 font-bold text-[11px] uppercase">
                    Block {h.block}
                  </td>
                </tr>
              )}
              <HouseholdRow h={h} />
            </Fragment>
          ))}
          {late.length > 0 && (
            <tr>
              <td colSpan={5} className="pt-3 pb-0.5 font-bold text-[11px] uppercase">
                Late registrations (any block)
              </td>
            </tr>
          )}
          {late.map((h) => (
            <HouseholdRow key={h.key} h={h} />
          ))}
          {Array.from({ length: BLANK_LINES }).map((_, i) => (
            <tr key={`blank-${i}`} className="border-b border-gray-400">
              <td className="py-3 pr-2" />
              <td className="py-3 pr-2" />
              <td className="py-3 pr-2" />
              <td className="py-3 pr-2" />
              <td className="py-3 w-16 border-l border-gray-400" />
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-3 space-y-1 border-t-2 border-black pt-2">
        <p className="font-bold">Total plates issued at Counter {counter}: ____________</p>
        <p className="text-[11px]">
          Not on this sheet? Look up their mobile number on the admin Community Dinner page to find their counter.
        </p>
      </div>
    </section>
  );
}

