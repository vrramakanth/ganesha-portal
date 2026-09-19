"use client";

import { useState } from "react";
import { counterForBlock, type CounterMap } from "@/lib/dinnerCounters";
import BlockSelect from "@/components/BlockSelect";
import DinnerCounterMessage from "@/components/DinnerCounterMessage";

/** Public and block-only: which plate counter serves a block. Renders
 *  nothing until admins have saved the block-to-counter map. */
export default function FindYourCounter({
  counters,
  lateCounter,
}: {
  counters: CounterMap | undefined;
  lateCounter: number | undefined;
}) {
  const [block, setBlock] = useState("");
  if (!counters || Object.keys(counters).length === 0) return null;
  const counter = block ? counterForBlock(counters, block) : null;

  return (
    <div className="space-y-2 rounded-xl border border-border bg-background p-4">
      <p className="text-sm font-semibold">Find your counter</p>
      <BlockSelect value={block} onChange={setBlock} />
      {counter !== null && <DinnerCounterMessage counter={counter} counters={counters} />}
      {lateCounter && (
        <p className="text-xs text-muted">
          Registered after registration closed? Please visit Counter {lateCounter}.
        </p>
      )}
    </div>
  );
}
