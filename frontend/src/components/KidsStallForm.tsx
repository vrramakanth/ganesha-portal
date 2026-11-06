"use client";

import { useFestivalConfig } from "@/lib/FestivalConfigContext";
import { formatCurrency } from "@/lib/date";
import StallPaymentStep from "@/components/StallPaymentStep";
import { buildStallComments, tableFee } from "@/lib/stallNeeds";
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
export default function KidsStallForm({ eventId, open, description }: { eventId: string; open: boolean; description?: string }) {
  const { profile, saveProfile, loaded } = useResidentProfile();
  const { festival } = useFestivalConfig();
  const fee = tableFee(description);
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
  const [tables, setTables] = useState("1");
  const [chairs, setChairs] = useState("2");
  const [power, setPower] = useState<boolean | null>(null);
  const [powerDetails, setPowerDetails] = useState("");
  const [other, setOther] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [step, setStep] = useState<"form" | "pay">("form");
  const [paymentRef, setPaymentRef] = useState("");

  const amountDue = (Number(tables) || 0) * fee;

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
    if (power === null) {
      setError("Tell us whether your stall needs a power socket.");
      return;
    }
    // Tables cost money, so go to payment first; a stall with no tables is free.
    if (amountDue > 0 && step === "form") {
      setStep("pay");
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
        comments: buildStallComments({
          idea,
          kids: Number(kids) || 1,
          tables: Number(tables) || 0,
          chairs: Number(chairs) || 0,
          power,
          powerDetails,
          other,
          fee: amountDue,
          paymentRef,
        }),
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

  if (step === "pay") {
    return (
      <StallPaymentStep
        amount={amountDue}
        tables={Number(tables) || 0}
        fee={fee}
        festival={festival}
        reference={paymentRef}
        onReference={setPaymentRef}
        onBack={() => setStep("form")}
        onSubmit={() => submit({ preventDefault() {} } as React.FormEvent)}
        submitting={submitting}
        error={error}
      />
    );
  }

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

      <div className="space-y-3 rounded-xl border border-border p-3">
        <p className="text-sm font-semibold">What does your stall need?</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Tables</label>
            <select value={tables} onChange={(e) => setTables(e.target.value)} className={input}>
              {[0, 1, 2, 3, 4].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Chairs</label>
            <select value={chairs} onChange={(e) => setChairs(e.target.value)} className={input}>
              {[0, 1, 2, 3, 4, 5, 6].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Do you need a power socket?</label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPower(true)}
              className={`flex-1 rounded-xl border py-2.5 text-sm font-semibold ${
                power === true ? "border-maroon bg-maroon text-white" : "border-border text-foreground"
              }`}
            >
              Yes
            </button>
            <button
              type="button"
              onClick={() => setPower(false)}
              className={`flex-1 rounded-xl border py-2.5 text-sm font-semibold ${
                power === false ? "border-maroon bg-maroon text-white" : "border-border text-foreground"
              }`}
            >
              No
            </button>
          </div>
        </div>
        {power && (
          <div className="space-y-1.5">
            <label className="text-sm font-medium">What will you plug in?</label>
            <input
              value={powerDetails}
              onChange={(e) => setPowerDetails(e.target.value)}
              placeholder="e.g. a blender, string lights, a speaker"
              className={input}
            />
          </div>
        )}
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Anything else you need? (optional)</label>
          <input
            value={other}
            onChange={(e) => setOther(e.target.value)}
            placeholder="e.g. shade, a banner stand, access to water"
            className={input}
          />
        </div>
      </div>

      {amountDue > 0 && (
        <p className="rounded-lg bg-saffron/10 px-3 py-2 text-sm font-semibold text-maroon">
          {formatCurrency(fee)} per table · {formatCurrency(amountDue)} for {Number(tables)} {Number(tables) === 1 ? "table" : "tables"}
        </p>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-xl bg-maroon py-3 text-sm font-semibold text-white disabled:opacity-60"
      >
        {submitting ? "Sending…" : amountDue > 0 ? "Next: pay for tables" : "Request a stall"}
      </button>
    </form>
  );
}
