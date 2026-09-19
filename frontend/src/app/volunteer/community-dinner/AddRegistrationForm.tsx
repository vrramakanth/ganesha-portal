"use client";

import { useState } from "react";
import { api, ApiClientError } from "@/lib/api";
import { fileToBase64 } from "@/lib/file";
import { formatCurrency } from "@/lib/date";
import BlockSelect from "@/components/BlockSelect";
import FlatInput from "@/components/FlatInput";
import MobileInput from "@/components/MobileInput";

const GUEST_ADULT_PRICE = 200;
const GUEST_CHILD_PRICE = 100;

const inputClass = "w-full rounded-lg border border-border bg-card px-3 py-3 text-sm";

/** For a resident who reached out (e.g. on WhatsApp) after registrations
 *  closed. Works whether registration is open or closed. Guests owe a
 *  payment, so the admin records its reference and a Finance admin
 *  verifies it under Needs Review, same as a resident's own payment. */
export default function AddRegistrationForm({ idToken, onAdded }: { idToken: string; onAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [block, setBlock] = useState("");
  const [flatNumber, setFlatNumber] = useState("");
  const [adults, setAdults] = useState("");
  const [children, setChildren] = useState("");
  const [guestAdults, setGuestAdults] = useState("");
  const [guestChildren, setGuestChildren] = useState("");
  const [reference, setReference] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState<string | null>(null);

  const guestAmount =
    (Number(guestAdults) || 0) * GUEST_ADULT_PRICE + (Number(guestChildren) || 0) * GUEST_CHILD_PRICE;

  function reset() {
    setName("");
    setMobile("");
    setBlock("");
    setFlatNumber("");
    setAdults("");
    setChildren("");
    setGuestAdults("");
    setGuestChildren("");
    setReference("");
    setFile(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setAdded(null);
    if (!name.trim()) {
      setError("Enter the resident's name.");
      return;
    }
    if (!/^[6-9]\d{9}$/.test(mobile)) {
      setError("Enter a valid 10-digit mobile number.");
      return;
    }
    if (!block || flatNumber.length !== 3) {
      setError("Enter the block and a 3-digit flat number.");
      return;
    }
    const total =
      (Number(adults) || 0) + (Number(children) || 0) + (Number(guestAdults) || 0) + (Number(guestChildren) || 0);
    if (total <= 0) {
      setError("Add at least one person attending.");
      return;
    }
    if (guestAmount > 0 && !reference.trim()) {
      setError("Guests are chargeable. Enter the payment reference (UTR, or Cash).");
      return;
    }

    setSubmitting(true);
    try {
      const result = await api.volunteer.addCommunityDinnerRegistration(idToken, {
        residentName: name.trim(),
        mobile,
        block,
        flatNumber,
        adults: Number(adults) || 0,
        children: Number(children) || 0,
        guestAdults: Number(guestAdults) || 0,
        guestChildren: Number(guestChildren) || 0,
        reference: guestAmount > 0 ? reference.trim() : undefined,
        screenshot: guestAmount > 0 && file ? await fileToBase64(file) : undefined,
        mimeType: guestAmount > 0 && file ? file.type : undefined,
      });
      setAdded(
        result.status === "CONFIRMED"
          ? `${result.resident_name} is registered and confirmed (${result.registration_id}).`
          : `${result.resident_name} is added (${result.registration_id}). The guest payment is waiting under Needs Review.`
      );
      reset();
      setOpen(false);
      onAdded();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Could not add this registration.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-2">
      {added && <p className="text-sm text-green-700">{added}</p>}
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="w-full rounded-xl border border-border bg-card py-3 text-sm font-semibold text-maroon"
        >
          + Add a late registration
        </button>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-3 rounded-xl border border-border bg-card p-4">
          <p className="text-sm font-semibold">Add a late registration</p>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" className={inputClass} />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Mobile</label>
            <MobileInput value={mobile} onChange={setMobile} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Block</label>
              <BlockSelect value={block} onChange={setBlock} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Flat (3 digits)</label>
              <FlatInput value={flatNumber} onChange={setFlatNumber} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Adults</label>
              <input type="number" min="0" inputMode="numeric" value={adults} onChange={(e) => setAdults(e.target.value)} className={inputClass} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Children</label>
              <input type="number" min="0" inputMode="numeric" value={children} onChange={(e) => setChildren(e.target.value)} className={inputClass} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Guest adults</label>
              <input type="number" min="0" inputMode="numeric" value={guestAdults} onChange={(e) => setGuestAdults(e.target.value)} className={inputClass} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Guest children</label>
              <input type="number" min="0" inputMode="numeric" value={guestChildren} onChange={(e) => setGuestChildren(e.target.value)} className={inputClass} />
            </div>
          </div>
          {guestAmount > 0 && (
            <div className="space-y-3 rounded-lg border border-border p-3">
              <p className="text-sm font-semibold text-maroon">
                Guests owe {formatCurrency(guestAmount)} (₹{GUEST_ADULT_PRICE}/adult, ₹{GUEST_CHILD_PRICE}/child)
              </p>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Payment reference</label>
                <input
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder="UTR, or Cash"
                  autoComplete="off"
                  className={inputClass}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Screenshot (optional)</label>
                <input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="w-full text-sm" />
              </div>
            </div>
          )}
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 rounded-lg bg-maroon py-3 text-sm font-semibold text-white disabled:opacity-60"
            >
              {submitting ? "Adding…" : "Add registration"}
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setError(null);
              }}
              className="rounded-lg border border-border px-4 py-3 text-sm font-semibold text-muted"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
