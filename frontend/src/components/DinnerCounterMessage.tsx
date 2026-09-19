import { formatBlockRange, type CounterMap } from "@/lib/dinnerCounters";

export default function DinnerCounterMessage({ counter, counters }: { counter: number; counters: CounterMap }) {
  const range = formatBlockRange(counters, counter);
  return (
    <p className="text-sm">
      We&apos;re glad you&apos;re joining us! Please visit{" "}
      <span className="font-semibold text-maroon">
        Counter {counter}
        {range ? ` (Blocks ${range})` : ""}
      </span>{" "}
      for your plates, then enjoy your meal at any serving counter. Family members need not come together; each can
      collect their plate as they arrive.
    </p>
  );
}
