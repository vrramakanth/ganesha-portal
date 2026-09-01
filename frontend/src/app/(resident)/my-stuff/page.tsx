"use client";

import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { api } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { useResidentProfile } from "@/lib/useResidentProfile";
import { formatCurrency } from "@/lib/date";
import MobileInput from "@/components/MobileInput";
import PageHeader from "@/components/PageHeader";
import StatusBadge from "@/components/StatusBadge";

export default function MyStuffPage() {
  const { profile, loaded } = useResidentProfile();
  const [mobileInput, setMobileInput] = useState("");
  const [mobile, setMobile] = useState<string | null>(null);
  // Overrides the profile.mobile auto-fill below when the resident
  // explicitly asks to look up a different number — otherwise the saved
  // profile would just override an empty `mobile` right back.
  const [searchingNew, setSearchingNew] = useState(false);

  const activeMobile = searchingNew ? null : mobile || (loaded && profile.mobile ? profile.mobile : null);

  const { data, loading, error } = useAsync(
    () =>
      activeMobile
        ? Promise.all([
            api.donations.mine(activeMobile),
            api.registrations.mine(activeMobile),
            api.dinner.mine(activeMobile),
            api.volunteers.mine(activeMobile),
          ])
        : Promise.resolve(null),
    [activeMobile]
  );

  if (!activeMobile) {
    return (
      <div className="flex flex-col gap-6 px-5 pt-8">
        <PageHeader title="My Stuff" subtitle="Look up your donations, registrations and tokens" />
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (mobileInput) {
              setMobile(mobileInput);
              setSearchingNew(false);
            }
          }}
          className="space-y-3"
        >
          <MobileInput value={mobileInput} onChange={setMobileInput} />
          <button
            type="submit"
            className="w-full rounded-xl bg-saffron py-3.5 text-center text-sm font-semibold text-white active:bg-saffron-dark transition-colors"
          >
            Look Up
          </button>
        </form>
      </div>
    );
  }

  const [donations, registrations, dinnerTokens, volunteerStatus] = data ?? [[], [], [], []];

  return (
    <div className="flex flex-col gap-6 px-5 pt-8">
      <PageHeader title="My Stuff" subtitle={`Showing results for ${activeMobile}`} />
      <button
        type="button"
        onClick={() => {
          setMobile(null);
          setMobileInput("");
          setSearchingNew(true);
        }}
        className="text-left text-xs font-medium text-maroon underline -mt-4"
      >
        Look up a different number
      </button>

      {loading && <p className="text-sm text-muted">Loading…</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {!loading && (
        <>
          <Section title="My Donations">
            {donations.length === 0 && <Empty>No donations yet.</Empty>}
            {donations.map((d) => (
              <Row key={d.transactionId}>
                <div>
                  <p className="font-semibold text-sm">{formatCurrency(d.amount)}</p>
                  <p className="text-xs text-muted">{d.transactionId}</p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge label={d.status} tone={statusTone(d.status)} />
                  {d.receiptUrl && (
                    <a href={d.receiptUrl} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-maroon">
                      Receipt
                    </a>
                  )}
                </div>
              </Row>
            ))}
          </Section>

          <Section title="My Event Registrations">
            {registrations.length === 0 && <Empty>No event registrations yet.</Empty>}
            {registrations.map((r) => (
              <Row key={r.registration_id}>
                <div>
                  <p className="font-semibold text-sm">{r.participant_name}</p>
                  <p className="text-xs text-muted">{r.registration_id}</p>
                </div>
                <StatusBadge label={r.check_in_at ? "CHECKED IN" : r.status} tone={r.check_in_at ? "success" : "info"} />
              </Row>
            ))}
          </Section>

          <Section title="My Dinner Tokens">
            {dinnerTokens.length === 0 && <Empty>No dinner tokens yet.</Empty>}
            {dinnerTokens.map((t) =>
              t.tokenId ? (
                <div key={t.entitlementId} className="px-4 py-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-sm">{t.tokenId}</p>
                    <p className="text-xs text-muted">
                      Allocated {t.allocated} · Served {t.served} · Remaining {t.remaining}
                    </p>
                  </div>
                  <QRCodeSVG value={t.tokenId} size={48} />
                </div>
              ) : (
                <Row key={t.entitlementId}>
                  <p className="text-sm text-muted">Dinner registration</p>
                  <StatusBadge label={t.status.replace(/_/g, " ")} tone={t.status === "CANCELLED" ? "danger" : "warning"} />
                </Row>
              )
            )}
          </Section>

          <Section title="My Seva Status">
            {volunteerStatus.length === 0 && <Empty>You haven&apos;t signed up for Seva yet.</Empty>}
            {volunteerStatus.map((v) => (
              <Row key={v.volunteer_id}>
                <div>
                  <p className="font-semibold text-sm">{v.areas}</p>
                  <p className="text-xs text-muted">{v.volunteer_id}</p>
                </div>
                <StatusBadge label={v.status} tone={v.status === "ACTIVE" ? "success" : "warning"} />
              </Row>
            ))}
          </Section>
        </>
      )}
    </div>
  );
}

function statusTone(status: string) {
  if (status === "SUCCESS" || status === "VERIFIED_SUCCESS") return "success" as const;
  if (status === "MANUAL_REVIEW" || status === "PAYMENT_PENDING") return "warning" as const;
  if (status === "FAILED" || status === "EXPIRED" || status === "CANCELLED") return "danger" as const;
  return "neutral" as const;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-sm font-semibold tracking-wide uppercase text-muted">{title}</h2>
      <div className="rounded-xl border border-border bg-card divide-y divide-border">{children}</div>
    </section>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="px-4 py-3 flex items-center justify-between gap-2">{children}</div>;
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="px-4 py-3 text-sm text-muted">{children}</p>;
}
