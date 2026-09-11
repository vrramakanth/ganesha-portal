"use client";

import { useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { api, ApiClientError } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { useResidentProfile } from "@/lib/useResidentProfile";
import { formatCurrency } from "@/lib/date";
import { fileToBase64 } from "@/lib/file";
import { parseVolunteerAvailability, isAreaApproved } from "@/lib/volunteerAreas";
import type { EventRegistration } from "@/lib/types";
import MobileInput from "@/components/MobileInput";
import PageHeader from "@/components/PageHeader";
import StatusBadge from "@/components/StatusBadge";
import LoadingIndicator from "@/components/LoadingIndicator";

const MAX_SONG_BYTES = 10 * 1024 * 1024; // 10MB — comfortably covers a full song at typical MP3 bitrates

export default function MyStuffPage() {
  const { profile, loaded } = useResidentProfile();
  const [mobileInput, setMobileInput] = useState("");
  const [mobile, setMobile] = useState<string | null>(null);
  // Overrides the profile.mobile auto-fill below when the resident
  // explicitly asks to look up a different number — otherwise the saved
  // profile would just override an empty `mobile` right back.
  const [searchingNew, setSearchingNew] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const activeMobile = searchingNew ? null : mobile || (loaded && profile.mobile ? profile.mobile : null);

  const { data, loading, error } = useAsync(
    () =>
      activeMobile
        ? Promise.all([
            api.donations.mine(activeMobile),
            api.registrations.mine(activeMobile),
            api.dinner.mine(activeMobile),
            api.volunteers.mine(activeMobile),
            api.expenses.mine(activeMobile),
          ])
        : Promise.resolve(null),
    [activeMobile, refreshKey]
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

  const [donations, registrations, dinnerTokens, volunteerStatus, expenses] = data ?? [[], [], [], [], []];
  const totalSpent = expenses
    .filter((e) => e.status === "APPROVED")
    .reduce((sum, e) => sum + Number(e.amount || 0), 0);

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

      {loading && <LoadingIndicator />}
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
              <div key={r.registration_id} className="px-4 py-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold text-sm">{r.participant_name}</p>
                    <p className="text-xs text-muted">
                      {r.sub_category ? `${r.sub_category} · ` : ""}
                      {r.registration_id}
                    </p>
                  </div>
                  <StatusBadge
                    label={r.check_in_at ? "CHECKED IN" : r.status === "PENDING_REVIEW" ? "PENDING" : r.status}
                    tone={r.check_in_at ? "success" : statusTone(r.status)}
                  />
                </div>
                {r.sub_category && r.status !== "REJECTED" && r.status !== "CANCELLED" && (
                  <SongUploader registration={r} mobile={activeMobile} onUpdated={() => setRefreshKey((k) => k + 1)} />
                )}
              </div>
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
            {volunteerStatus.flatMap((v) => {
              const picks = parseVolunteerAvailability(v.availability);
              if (picks.length === 0) {
                return [
                  <Row key={v.volunteer_id}>
                    <p className="font-semibold text-sm">{v.areas}</p>
                    <StatusBadge label={v.status} tone={v.status === "ACTIVE" ? "success" : "warning"} />
                  </Row>,
                ];
              }
              return picks.map((pick, i) => {
                const confirmed = isAreaApproved(v, pick.area);
                return (
                  <Row key={`${v.volunteer_id}-${i}`}>
                    <div>
                      <p className="font-semibold text-sm">{pick.area}</p>
                      <p className="text-xs text-muted">
                        {pick.dates.join(", ")} · {pick.sessions.join(", ")}
                      </p>
                    </div>
                    <StatusBadge label={confirmed ? "CONFIRMED" : "PENDING"} tone={confirmed ? "success" : "warning"} />
                  </Row>
                );
              });
            })}
          </Section>

          <Section title="My Expenses">
            {expenses.length === 0 && <Empty>No expenses recorded yet.</Empty>}
            {expenses.length > 0 && (
              <div className="px-4 py-3 flex items-center justify-between bg-saffron/5">
                <p className="text-sm font-medium">Total spent (approved)</p>
                <p className="font-semibold text-maroon">{formatCurrency(totalSpent)}</p>
              </div>
            )}
            {expenses.map((e) => (
              <Row key={e.expense_id}>
                <div>
                  <p className="font-semibold text-sm">{e.purpose}</p>
                  <p className="text-xs text-muted">{e.date}</p>
                </div>
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-maroon">{formatCurrency(Number(e.amount))}</p>
                  {e.screenshot_url && (
                    <a href={e.screenshot_url} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-maroon">
                      Receipt
                    </a>
                  )}
                  <StatusBadge
                    label={e.status}
                    tone={e.status === "APPROVED" ? "success" : e.status === "REJECTED" ? "danger" : "warning"}
                  />
                </div>
              </Row>
            ))}
          </Section>
        </>
      )}
    </div>
  );
}

function statusTone(status: string) {
  if (status === "SUCCESS" || status === "VERIFIED_SUCCESS" || status === "CONFIRMED") return "success" as const;
  if (status === "MANUAL_REVIEW" || status === "PAYMENT_PENDING" || status === "PENDING_REVIEW") return "warning" as const;
  if (status === "FAILED" || status === "EXPIRED" || status === "CANCELLED" || status === "REJECTED") return "danger" as const;
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

/** Lets a resident add or replace their song right up until the event —
 *  the nomination form makes it optional since the recording may not be
 *  ready at registration time, so this is the way to fill it in (or swap
 *  it) later without needing to re-register. */
function SongUploader({
  registration,
  mobile,
  onUpdated,
}: {
  registration: EventRegistration;
  mobile: string;
  onUpdated: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File | undefined) {
    setError(null);
    if (!file) return;
    if (!/\.mp3$/i.test(file.name) && file.type !== "audio/mpeg") {
      setError("Please choose an MP3 file.");
      return;
    }
    if (file.size > MAX_SONG_BYTES) {
      setError("Song file is too large — please keep it under 10MB.");
      return;
    }
    setUploading(true);
    try {
      const base64 = await fileToBase64(file);
      await api.events.updateSong(registration.registration_id, mobile, base64, file.type || "audio/mpeg");
      onUpdated();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Could not upload the song.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-1">
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/mpeg,.mp3"
        onChange={(e) => handleFile(e.target.files?.[0])}
        className="hidden"
      />
      <div className="flex items-center gap-2">
        {registration.song_url && (
          <a
            href={registration.song_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-semibold text-maroon underline"
          >
            🎵 Play song
          </a>
        )}
        <button
          type="button"
          disabled={uploading}
          onClick={() => fileInputRef.current?.click()}
          className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-maroon disabled:opacity-60"
        >
          {uploading ? "Uploading…" : registration.song_url ? "Change Song" : "Upload Song"}
        </button>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
