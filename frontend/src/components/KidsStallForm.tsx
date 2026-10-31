"use client";

import { useState } from "react";
import { api, ApiClientError } from "@/lib/api";
import { useResidentProfile } from "@/lib/useResidentProfile";
import BlockSelect from "@/components/BlockSelect";
import FlatInput from "@/components/FlatInput";
import MobileInput from "@/components/MobileInput";

const STALL_TYPES = ["Food & snacks", "Drinks", "Games", "Art & crafts", "Toys & books", "Something else"];

/** Sign-up for a "Kids Stall" event (e.g. Children's Day, where children set
 *  up and run their own stalls): the child's details, a grown-up's contact,
 *  and what the stall will offer. Goes through the ordinary event
 *  registration, so volunteers approve each stall in the volunteer Events
 *  area like any other registration. */
export default function KidsStallForm({ eventId, open }: { eventId: string; open: boolean }) {
  const { profile, saveProfile, loaded } = useResidentProfile();
  const [childName, setChildName] = useState("");
  const [age, setAge] = useState("");
  const [parentName, setParentName] = useState("");
  const [typedMobile, setMobile] = useState<string | null>(null);
  const [typedBlock, setBlock] = useState<string | null>(null);
  const [typedFlat, setFlat] = useState<string | null>(null);
  const mobile = typedMobile ?? (loaded ? profile.mobile : "");
  const block = typedBlock ?? (loaded ? profile.block : "");
  const flat = typedFlat ?? (loaded ? profile.flatNumber : "");
  const [stallType, setStallType] = useState("");
  const [idea, setIdea] = useState("");
  const [kids, setKids] = useState("1");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  if (!open) {
    return (
      <p className="rounded-xl border border-border bg-card p-4 text-sm text-muted">
        🎈 Stall sign-ups aren&apos;t open yet. Check back soon!
      </p>
    );
  }

  if (done) {
    return (
      <div className="space-y-2 rounded-xl border border-border bg-card p-4 text-sm">
        <p className="font-semibold text-green-700">🎈 Stall request received!</p>
        <p className="text-muted">
          A volunteer will review it and get in touch on the mobile number you gave. Start dreaming up a great stall.
        </p>
      </div>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!/^[6-9]\d{9}$/.test(mobile)) {
      setError("Enter a valid 10-digit mobile number.");
      return;
    }
    if (!stallType) {
      setError("Pick what kind of stall it will be.");
      return;
    }
    setSubmitting(true);
    try {
      await api.events.register({
        eventId,
        participantName: childName.trim(),
        participantAge: age,
        parentName: parentName.trim() || undefined,
        parentMobile: mobile,
        block,
        flatNumber: flat,
        mobile,
        subCategory: stallType,
        comments: [idea.trim(), `Kids running the stall: ${Number(kids) || 1}`].filter(Boolean).join("\n"),
      });
      saveProfile({ name: parentName.trim() || profile.name, mobile, block, flatNumber: flat });
      setDone(true);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const input = "w-full rounded-lg border border-border bg-card px-3 py-3 text-sm";

  return (
    <form onSubmit={submit} className="space-y-4 rounded-xl border border-border bg-card p-4">
      <p className="text-sm font-semibold">🎈 Set up your own stall</p>

      <div className="space-y-1.5">
        <label className="text-sm font-medium">Child&apos;s name</label>
        <input required value={childName} onChange={(e) => setChildName(e.target.value)} className={input} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Age</label>
          <input
            required
            type="number"
            inputMode="numeric"
            min={3}
            max={17}
            value={age}
            onChange={(e) => setAge(e.target.value.replace(/\D/g, "").slice(0, 2))}
            className={input}
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Kids at the stall</label>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={20}
            value={kids}
            onChange={(e) => setKids(e.target.value.replace(/\D/g, "").slice(0, 2))}
            className={input}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium">Parent / guardian name</label>
        <input required value={parentName} onChange={(e) => setParentName(e.target.value)} className={input} />
      </div>
      <div className="space-y-1.5">
        <label className="text-sm font-medium">Parent&apos;s mobile</label>
        <MobileInput value={mobile} onChange={setMobile} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Block</label>
          <BlockSelect value={block} onChange={setBlock} />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Flat (3 digits)</label>
          <FlatInput value={flat} onChange={setFlat} />
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium">What kind of stall?</label>
        <select required value={stallType} onChange={(e) => setStallType(e.target.value)} className={input}>
          <option value="" disabled>
            Choose one
          </option>
          {STALL_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1.5">
        <label className="text-sm font-medium">What will your stall offer?</label>
        <textarea
          required
          rows={3}
          value={idea}
          onChange={(e) => setIdea(e.target.value)}
          placeholder="e.g. Homemade lemonade and cookies, or ring toss and face painting"
          className={input}
        />
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-xl bg-maroon py-3 text-sm font-semibold text-white disabled:opacity-60"
      >
        {submitting ? "Sending…" : "Request a stall"}
      </button>
    </form>
  );
}
