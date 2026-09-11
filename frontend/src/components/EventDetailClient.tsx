"use client";

import { useEffect, useState } from "react";
import { api, ApiClientError } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { useResidentProfile } from "@/lib/useResidentProfile";
import { formatEventDate, formatEventTime } from "@/lib/date";
import { eventSubCategories } from "@/lib/culturalSubCategories";
import { fileToBase64 } from "@/lib/file";
import type { EventRegistration } from "@/lib/types";
import BlockSelect from "@/components/BlockSelect";
import FlatInput from "@/components/FlatInput";
import MobileInput from "@/components/MobileInput";
import PageHeader from "@/components/PageHeader";
import LoadingIndicator from "@/components/LoadingIndicator";

const MAX_SONG_BYTES = 10 * 1024 * 1024; // 10MB — comfortably covers a full song at typical MP3 bitrates

type Song = { base64: string; mimeType: string; name: string };

type Performance = {
  key: string;
  subCategory: string;
  comments: string;
  song: Song | null;
  songError: string | null;
};

function newPerformance(): Performance {
  return { key: Math.random().toString(36).slice(2), subCategory: "", comments: "", song: null, songError: null };
}

type SubmitOutcome =
  | { performance: Performance; registration: EventRegistration; error?: undefined }
  | { performance: Performance; registration?: undefined; error: string };

export default function EventDetailClient({ eventId }: { eventId: string }) {
  const { data: events, loading, error } = useAsync(() => api.events.list(), []);
  const event = (events ?? []).find((e) => e.event_id === eventId);
  const { profile, saveProfile, loaded } = useResidentProfile();

  const [participantName, setParticipantName] = useState("");
  const [participantAge, setParticipantAge] = useState("");
  const [mobile, setMobile] = useState("");
  const [block, setBlock] = useState("");
  const [flatNumber, setFlatNumber] = useState("");
  // A resident nominating for more than one performance type in the same
  // Cultural event (e.g. both Dance and Vocal) fills in their shared
  // details once, then adds a block per performance — each becomes its
  // own registration on submit, same as registering separately would,
  // just without re-typing name/mobile/block/flat each time.
  const [performances, setPerformances] = useState<Performance[]>([newPerformance()]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [outcomes, setOutcomes] = useState<SubmitOutcome[] | null>(null);

  // One-time hydration from the saved profile once it loads — see Donate
  // page for why: without this, fields || profile.x can never be cleared
  // to empty, since "" is falsy and falls straight back to the saved value.
  useEffect(() => {
    if (!loaded) return;
    setParticipantName((prev) => prev || profile.name);
    setMobile((prev) => prev || profile.mobile);
    setBlock((prev) => prev || profile.block);
    setFlatNumber((prev) => prev || profile.flatNumber);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);

  if (loading) return <LoadingIndicator label="Loading event…" className="px-5 pt-8" />;
  if (error) return <p className="px-5 pt-8 text-sm text-red-600">{error}</p>;
  if (!event) return <p className="px-5 pt-8 text-sm text-muted">Event not found.</p>;

  const fields = { participantName, mobile, block, flatNumber };

  const canRegister = event.status === "OPEN" && Number(event.fee || 0) === 0;
  const isCultural = event.category === "Cultural";

  function updatePerformance(key: string, patch: Partial<Performance>) {
    setPerformances((prev) => prev.map((p) => (p.key === key ? { ...p, ...patch } : p)));
  }

  function addPerformance() {
    setPerformances((prev) => [...prev, newPerformance()]);
  }

  function removePerformance(key: string) {
    setPerformances((prev) => (prev.length > 1 ? prev.filter((p) => p.key !== key) : prev));
  }

  async function handleSongFile(key: string, file: File | undefined) {
    updatePerformance(key, { songError: null });
    if (!file) return;
    if (!/\.mp3$/i.test(file.name) && file.type !== "audio/mpeg") {
      updatePerformance(key, { songError: "Please choose an MP3 file." });
      return;
    }
    if (file.size > MAX_SONG_BYTES) {
      updatePerformance(key, { songError: "Song file is too large — please keep it under 10MB." });
      return;
    }
    const base64 = await fileToBase64(file);
    updatePerformance(key, { song: { base64, mimeType: file.type || "audio/mpeg", name: file.name } });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);
    if (!/^[6-9]\d{9}$/.test(fields.mobile)) {
      setSubmitError("Enter a valid 10-digit mobile number.");
      return;
    }
    if (isCultural && performances.some((p) => !p.subCategory)) {
      setSubmitError("Pick a performance type for each entry.");
      return;
    }
    setSubmitting(true);
    // Registered one at a time, not in parallel — each nomination should
    // fail independently (e.g. one performance type closes mid-submit)
    // without losing the ones that already succeeded.
    const results: SubmitOutcome[] = [];
    for (const performance of performances) {
      try {
        const registration = await api.events.register({
          eventId,
          participantName: fields.participantName,
          participantAge,
          block: fields.block,
          flatNumber: fields.flatNumber,
          mobile: fields.mobile,
          subCategory: isCultural ? performance.subCategory : undefined,
          song: isCultural ? performance.song?.base64 : undefined,
          songMimeType: isCultural ? performance.song?.mimeType : undefined,
          comments: isCultural ? performance.comments.trim() || undefined : undefined,
        });
        results.push({ performance, registration });
      } catch (err) {
        results.push({
          performance,
          error: err instanceof ApiClientError ? err.message : "Something went wrong. Please try again.",
        });
      }
    }
    saveProfile({ name: fields.participantName, mobile: fields.mobile, block: fields.block, flatNumber: fields.flatNumber });
    setOutcomes(results);
    setSubmitting(false);
  }

  if (outcomes) {
    const succeeded = outcomes.filter(
      (o): o is Extract<SubmitOutcome, { registration: EventRegistration }> => o.registration !== undefined
    );
    const failed = outcomes.filter((o): o is Extract<SubmitOutcome, { error: string }> => o.error !== undefined);
    return (
      <div className="flex flex-col gap-6 px-5 pt-8 items-center text-center">
        <PageHeader
          title={succeeded.length > 0 ? "Nomination submitted!" : "Something went wrong"}
          subtitle={event.name}
          backHref="/events"
          backLabel="← Events"
        />
        {succeeded.length > 0 && (
          <p className="text-sm text-muted">
            A volunteer will review it shortly — check My Stuff for updates.
          </p>
        )}
        <div className="w-full space-y-2">
          {succeeded.map((o, i) => (
            <div key={o.registration.registration_id} className="rounded-xl border border-border bg-card p-3 text-left">
              <p className="text-sm font-semibold">
                {o.performance.subCategory || `Entry ${i + 1}`}
              </p>
              <p className="text-xs text-muted">Registration ID: {o.registration.registration_id}</p>
            </div>
          ))}
          {failed.map((o, i) => (
            <div key={i} className="rounded-xl border border-red-200 bg-red-50 p-3 text-left">
              <p className="text-sm font-semibold text-red-700">{o.performance.subCategory || "Entry"} — not submitted</p>
              <p className="text-xs text-red-600">{o.error}</p>
            </div>
          ))}
        </div>
        {isCultural && succeeded.length > 0 && (
          <p className="text-sm text-muted">
            Need to add or change a song? You can do that from My Stuff any time before the event.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 px-5 pt-8">
      <PageHeader
        title={event.name}
        subtitle={`${formatEventDate(event.date)} · ${formatEventTime(event.start_time)} · ${event.location}`}
        backHref="/events"
        backLabel="← Events"
      />
      {event.description && <p className="text-sm text-muted">{event.description}</p>}

      {!canRegister && (
        <p className="rounded-xl border border-border bg-card p-4 text-sm text-muted">
          {event.status !== "OPEN"
            ? "Registration is not currently open for this event."
            : "Registration for paid events is coming soon."}
        </p>
      )}

      {canRegister && (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Participant Name</label>
            <input
              required
              value={fields.participantName}
              onChange={(e) => setParticipantName(e.target.value)}
              autoComplete="off"
              autoCapitalize="off"
              autoCorrect="off"
              className="w-full rounded-lg border border-border bg-card px-3 py-3 text-sm"
            />
          </div>

          {isCultural &&
            performances.map((performance, i) => (
              <div key={performance.key} className="space-y-4 rounded-xl border border-border p-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-muted uppercase tracking-wide">
                    Performance {i + 1}
                  </p>
                  {performances.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removePerformance(performance.key)}
                      className="text-xs font-semibold text-red-600"
                    >
                      Remove
                    </button>
                  )}
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Performance Type</label>
                  <select
                    required
                    value={performance.subCategory}
                    onChange={(e) => updatePerformance(performance.key, { subCategory: e.target.value })}
                    className="w-full rounded-lg border border-border bg-card px-3 py-3 text-sm"
                  >
                    <option value="" disabled>
                      Choose one
                    </option>
                    {eventSubCategories(event.sub_categories).map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Comments</label>
                  <textarea
                    value={performance.comments}
                    onChange={(e) => updatePerformance(performance.key, { comments: e.target.value })}
                    rows={3}
                    className="w-full rounded-lg border border-border bg-card px-3 py-3 text-sm"
                  />
                  <p className="text-xs text-muted">Add any details about your performance that you&apos;d like to share.</p>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Song (MP3, optional)</label>
                  <input
                    type="file"
                    accept="audio/mpeg,.mp3"
                    onChange={(e) => handleSongFile(performance.key, e.target.files?.[0])}
                    className="block w-full text-sm"
                  />
                  {performance.songError && <p className="text-xs text-red-600">{performance.songError}</p>}
                  <p className="text-xs text-muted">Not ready yet? You can add or change this later from My Stuff.</p>
                </div>
              </div>
            ))}
          {isCultural && (
            <button
              type="button"
              onClick={addPerformance}
              className="w-full rounded-xl border border-dashed border-border py-3 text-center text-sm font-semibold text-maroon"
            >
              + Add Another Performance
            </button>
          )}

          {(event.age_group || isCultural) && (
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Age</label>
              <input
                value={participantAge}
                onChange={(e) => setParticipantAge(e.target.value)}
                className="w-full rounded-lg border border-border bg-card px-3 py-3 text-sm"
              />
              {isCultural && <p className="text-xs text-muted">For adults, enter 18+</p>}
            </div>
          )}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Mobile</label>
            <MobileInput value={fields.mobile} onChange={setMobile} />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Block</label>
            <BlockSelect value={fields.block} onChange={setBlock} />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Flat (3-digit number only)</label>
            <FlatInput value={fields.flatNumber} onChange={setFlatNumber} />
          </div>

          {submitError && <p className="text-sm text-red-600">{submitError}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl bg-saffron py-4 text-center text-sm font-semibold text-white disabled:opacity-60 active:bg-saffron-dark transition-colors"
          >
            {submitting
              ? "Registering…"
              : performances.length > 1
                ? `Register ${performances.length} Performances`
                : "Register"}
          </button>
        </form>
      )}
    </div>
  );
}
