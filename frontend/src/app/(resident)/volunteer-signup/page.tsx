"use client";

import { useEffect, useState } from "react";
import { api, ApiClientError } from "@/lib/api";
import { useResidentProfile } from "@/lib/useResidentProfile";
import BlockSelect from "@/components/BlockSelect";
import FlatInput from "@/components/FlatInput";
import MobileInput from "@/components/MobileInput";
import PageHeader from "@/components/PageHeader";

const AREAS = [
  "Event coordination", "Decorations", "Food/prasadam", "Kids activities",
  "Cultural programs", "Stage", "Sound/light", "Security coordination",
  "Parking", "Photography", "First aid", "Clean-up", "Waste management",
];

export default function VolunteerSignupPage() {
  const { profile, saveProfile, loaded } = useResidentProfile();

  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [email, setEmail] = useState("");
  const [block, setBlock] = useState("");
  const [flatNumber, setFlatNumber] = useState("");
  const [areas, setAreas] = useState<string[]>([]);
  const [availability, setAvailability] = useState("");

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

  function toggleArea(area: string) {
    setAreas((prev) => (prev.includes(area) ? prev.filter((a) => a !== area) : [...prev, area]));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!/^[6-9]\d{9}$/.test(fields.mobile)) {
      setError("Enter a valid 10-digit mobile number.");
      return;
    }
    if (areas.length === 0) {
      setError("Pick at least one area you'd like to help with.");
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
        areas,
        availability,
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

        <div className="space-y-1.5">
          <label className="text-sm font-medium">Areas you&apos;d like to help with</label>
          <div className="flex flex-wrap gap-2">
            {AREAS.map((area) => (
              <button
                key={area}
                type="button"
                onClick={() => toggleArea(area)}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                  areas.includes(area) ? "border-saffron bg-saffron/10 text-saffron-dark" : "border-border text-foreground"
                }`}
              >
                {area}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium">Availability (optional)</label>
          <input
            placeholder="e.g. Evenings, all 9 days"
            value={availability}
            onChange={(e) => setAvailability(e.target.value)}
            className="w-full rounded-lg border border-border bg-card px-3 py-3 text-sm"
          />
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
