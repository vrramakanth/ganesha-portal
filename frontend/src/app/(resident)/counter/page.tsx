"use client";

import { useFestivalConfig } from "@/lib/FestivalConfigContext";
import { mealName } from "@/lib/meal";
import { api } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import PageHeader from "@/components/PageHeader";
import LoadingIndicator from "@/components/LoadingIndicator";
import FindYourCounter from "@/components/FindYourCounter";

/** A direct, shareable link (WhatsApp / MyGate) to the counter lookup. */
export default function CounterPage() {
  const { festival } = useFestivalConfig();
  const { data, loading } = useAsync(() => api.communityDinner.publicCount(), []);
  return (
    <div className="flex flex-col gap-6 px-5 pt-8">
      <PageHeader
        title={mealName(festival)}
        subtitle={data?.wrappedUp ? undefined : "Find where to collect your plates"}
        backHref="/"
        backLabel="← Home"
      />
      {loading && <LoadingIndicator />}
      <FindYourCounter counters={data?.counters} lateCounter={data?.lateCounter} />
      {data && Object.keys(data.counters ?? {}).length === 0 && (
        <p className="text-sm text-muted">
          {data.wrappedUp
            ? `The ${mealName(festival)} is over. Thank you for joining us! 🙏`
            : "Counter details will appear here shortly."}
        </p>
      )}
    </div>
  );
}
