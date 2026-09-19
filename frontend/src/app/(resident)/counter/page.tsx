"use client";

import { api } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import PageHeader from "@/components/PageHeader";
import LoadingIndicator from "@/components/LoadingIndicator";
import FindYourCounter from "@/components/FindYourCounter";

/** A direct, shareable link (WhatsApp / MyGate) to the counter lookup. */
export default function CounterPage() {
  const { data, loading } = useAsync(() => api.communityDinner.publicCount(), []);
  return (
    <div className="flex flex-col gap-6 px-5 pt-8">
      <PageHeader title="Community Dinner" subtitle="Find where to collect your plates" backHref="/" backLabel="← Home" />
      {loading && <LoadingIndicator />}
      <FindYourCounter counters={data?.counters} lateCounter={data?.lateCounter} />
      {data && Object.keys(data.counters ?? {}).length === 0 && (
        <p className="text-sm text-muted">Counter details will appear here shortly.</p>
      )}
    </div>
  );
}
