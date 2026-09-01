"use client";

import { useEffect, useMemo, useState } from "react";
import { api, ApiClientError } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { useResidentProfile } from "@/lib/useResidentProfile";
import { parseFestivalDateRange } from "@/lib/date";
import BlockSelect from "@/components/BlockSelect";
import FlatInput from "@/components/FlatInput";
import MobileInput from "@/components/MobileInput";
import PageHeader from "@/components/PageHeader";

const AREA_OPTIONS = [
  { label: "Decorate Idol/Pooja/Aarti", note: "Expected time: 45 mins" },
  { label: "Bhog/Prasadam/Food", note: null as string | null },
];

const SESSIONS = ["Morning", "Evening"] as const;
type Session = (typeof SESSIONS)[number];

type Commitment = {
  id: string;
  area: string;
  dates: string[];
  session: Session | "";
};

function newCommitment(): Commitment {
  return { id: crypto.randomUUID(), area: "", dates: [], session: "" };
}

export default function VolunteerSignupPage() {
  const { profile, saveProfile, loaded } = useResidentProfile();
  const { data: festival } = useAsync(() => api.festival.get(), []);
  const festivalDates = useMemo(() => parseFestivalDateRange(festival?.dates ?? ""), [festival?.dates]);
  const dateLabels = useMemo(
    () => Object.fromEntries(festivalDates.map((d) => [d.iso, d.label])),
    [festivalDates]
  );

  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [email, setEmail] = useState("");
  const [block, setBlock] = useState("");
  const [flatNumber, setFlatNumber] = useState("");
  const [commitments, setCommitments] = useState<Commitment[]>([newCommitment()]);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  // One-time hydration from the saved profile once it loads — see Donate
  // page for why: without this, fields || profile.x can never be cleared
  // to empty, since "" is falsy and falls straight back to the saved value.
  useEffect(() => {
    if (!loaded) return;
    setName((prev) => prev || profile.name);
    setMobile((prev) => prev || profile.mobile);
    setBlock((prev) => prev || profile.block);
    setFlatNumber((prev) => prev || profile.flatNumber);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);

  const fields = { name, mobile, block, flatNumber };

  function updateCommitment(id: string, patch: Partial<Commitment>) {
    setCommitments((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }

  function toggleDate(id: string, iso: string) {
    setCommitments((prev) =>
      prev.map((c) =>
        c.id === id
          ? { ...c, dates: c.dates.includes(iso) ? c.dates.filter((d) => d !== iso) : [...c.dates, iso] }
          : c
      )
    );
  }

  function addCommitment() {
    setCommitments((prev) => [...prev, newCommitment()]);
  }

  function removeCommitment(id: string) {
    setCommitments((prev) => prev.filter((c) => c.id !== id));
  }

  function formatDates(dates: string[]) {
    return dates
      .slice()
      .sort()
      .map((iso) => dateLabels[iso] ?? iso)
      .join(", ");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!/^[6-9]\d{9}$/.test(fields.mobile)) {
      setError("Enter a valid 10-digit mobile number.");
      return;
    }
    if (commitments.some((c) => !c.area || c.dates.length === 0 || !c.session)) {
      setError("Finish each area you've added — pick preferred dates and a session, or remove it.");
      return;
    }

    setSubmitting(true);
    try {
      await api.volunteers.register({
        name: fields.name,
        mobile: fields.mobile,
        email: email || undefined,
        block: fields.block,
        flatNumber: fields.flatNumber,
        areas: commitments.map((c) => c.area),
        availability: commitments
          .map((c) => `${c.area}: ${formatDates(c.dates)} (${c.session})`)
          .join("; "),
      });
      saveProfile({ name: fields.name, mobile: fields.mobile, block: fields.block, flatNumber: fields.flatNumber });
      setDone(true);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="flex flex-col gap-3 px-5 pt-8 text-center">
        <PageHeader title="Thank you!" subtitle="Waiting for admin's approval." />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 px-5 pt-8">
      <PageHeader title="I Want to Volunteer" />

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Name</label>
          <input
            required
            value={fields.name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="off"
            autoCapitalize="off"
            autoCorrect="off"
            className="w-full rounded-lg border border-border bg-card px-3 py-3 text-sm"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Mobile</label>
          <MobileInput value={fields.mobile} onChange={setMobile} />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Email (optional)</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-border bg-card px-3 py-3 text-sm"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Block</label>
          <BlockSelect value={fields.block} onChange={setBlock} />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Flat (3-digit number only)</label>
          <FlatInput value={fields.flatNumber} onChange={setFlatNumber} />
        </div>

        <div className="space-y-3">
          <label className="text-sm font-medium">How would you like to help?</label>
          <p className="text-xs text-muted">
            Dates below are your preference — final days and sessions will be confirmed based on how many
            volunteers sign up.
          </p>

          {commitments.map((c) => {
            const usedElsewhere = commitments.filter((x) => x.id !== c.id).map((x) => x.area);
            const complete = Boolean(c.area) && c.dates.length > 0 && Boolean(c.session);

            return (
              <div key={c.id} className="rounded-xl border border-border bg-card p-4 space-y-3">
                {commitments.length > 1 && (
                  <div className="flex justify-end -mt-1 -mr-1">
                    <button
                      type="button"
                      onClick={() => removeCommitment(c.id)}
                      className="text-xs font-medium text-muted"
                    >
                      Remove
                    </button>
                  </div>
                )}

                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted uppercase tracking-wide">Areas currently open</p>
                  <div className="flex flex-col gap-2">
                    {AREA_OPTIONS.map((opt) => {
                      const disabled = usedElsewhere.includes(opt.label);
                      const selected = c.area === opt.label;
                      return (
                        <button
                          key={opt.label}
                          type="button"
                          disabled={disabled}
                          onClick={() => updateCommitment(c.id, { area: opt.label })}
                          className={`w-full rounded-lg border px-3 py-2.5 text-left text-sm font-semibold transition-colors ${
                            selected
                              ? "border-saffron bg-saffron/10 text-saffron-dark"
                              : disabled
                              ? "border-border text-muted opacity-50"
                              : "border-border text-foreground"
                          }`}
                        >
                          {opt.label}
                          {opt.note && (
                            <span className="block text-xs font-normal text-muted mt-0.5">{opt.note}</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted uppercase tracking-wide">Preferred Date(s)</p>
                  {festivalDates.length === 0 ? (
                    <p className="text-xs text-muted">Dates aren&apos;t available yet.</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {festivalDates.map((d) => (
                        <button
                          key={d.iso}
                          type="button"
                          onClick={() => toggleDate(c.id, d.iso)}
                          className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                            c.dates.includes(d.iso)
                              ? "border-saffron bg-saffron/10 text-saffron-dark"
                              : "border-border text-foreground"
                          }`}
                        >
                          {d.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted uppercase tracking-wide">Session</p>
                  <div className="flex gap-2">
                    {SESSIONS.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => updateCommitment(c.id, { session: s })}
                        className={`flex-1 rounded-lg border px-3 py-2.5 text-sm font-semibold transition-colors ${
                          c.session === s
                            ? "border-saffron bg-saffron/10 text-saffron-dark"
                            : "border-border text-foreground"
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                {complete && (
                  <p className="text-xs text-muted">
                    You&apos;ll help with <span className="font-semibold text-foreground">{c.area}</span> on{" "}
                    <span className="font-semibold text-foreground">{formatDates(c.dates)}</span> —{" "}
                    <span className="font-semibold text-foreground">{c.session}</span>.
                  </p>
                )}
              </div>
            );
          })}

          {commitments.length < AREA_OPTIONS.length && (
            <button
              type="button"
              onClick={addCommitment}
              className="w-full rounded-xl border border-dashed border-border py-3 text-center text-sm font-semibold text-maroon"
            >
              + Add another area
            </button>
          )}
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-xl bg-maroon py-4 text-center text-sm font-semibold text-white disabled:opacity-60 active:bg-maroon-dark transition-colors"
        >
          {submitting ? "Submitting…" : "Sign Up"}
        </button>
      </form>
    </div>
  );
}
