"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { api, ApiClientError } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { useResidentProfile } from "@/lib/useResidentProfile";
import { formatCurrency } from "@/lib/date";
import BlockSelect from "@/components/BlockSelect";
import FlatInput from "@/components/FlatInput";
import MobileInput from "@/components/MobileInput";
import PaymentReferenceStep from "@/components/PaymentReferenceStep";
import PageHeader from "@/components/PageHeader";
import LoadingIndicator from "@/components/LoadingIndicator";
import FindYourCounter from "@/components/FindYourCounter";

const GUEST_ADULT_PRICE = 200;
const GUEST_CHILD_PRICE = 100;

type Step = "checking" | "form" | "creating" | "payment" | "confirmed" | "submitted" | "cancelled" | "already";

/** Phase 1 of the Community Dinner: registration only (headcount +
 *  chargeable guests + payment where needed) — now the live resident
 *  flow, replacing the old generic Dinner registration (/dinner, which
 *  now just redirects here). The actual dinner-day token/redemption
 *  side (Phase 2) comes later, once registrations are settled. */
export default function CommunityDinnerPage() {
  const { profile, saveProfile, loaded } = useResidentProfile();
  const { data: festival } = useAsync(() => api.festival.get(), []);
  const { data: dinnerCount, loading: loadingCount } = useAsync(() => api.communityDinner.publicCount(), []);

  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [block, setBlock] = useState("");
  const [flatNumber, setFlatNumber] = useState("");
  const [adults, setAdults] = useState("");
  const [children, setChildren] = useState("");
  const [hasGuests, setHasGuests] = useState(false);
  const [guestAdults, setGuestAdults] = useState("");
  const [guestChildren, setGuestChildren] = useState("");

  const [step, setStep] = useState<Step>("checking");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [registrationId, setRegistrationId] = useState<string | null>(null);
  const [guestAmount, setGuestAmount] = useState(0);
  const [hasCheckedExisting, setHasCheckedExisting] = useState(false);
  const [lookingUp, setLookingUp] = useState(false);
  const [lookupMessage, setLookupMessage] = useState<string | null>(null);
  const adultsInputRef = useRef<HTMLInputElement>(null);

  // One-time hydration from the saved profile, same trick as Donate —
  // prev || profile.x means a field the resident clears stays cleared
  // instead of snapping back on every keystroke.
  useEffect(() => {
    if (!loaded) return;
    setName((prev) => prev || profile.name);
    setMobile((prev) => prev || profile.mobile);
    setBlock((prev) => prev || profile.block);
    setFlatNumber((prev) => prev || profile.flatNumber);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);

  // A resident who registered with guests, left to pay in their UPI app,
  // then came back later has no way to get back to the payment step —
  // the form itself now looks fresh, and resubmitting just hits the
  // one-time lock. This is the exact "comeback user, ends up double
  // entering" problem seen with Donations, fixed here by checking for
  // an already-saved mobile's existing registration on load and
  // resuming straight into payment instead of showing the form again.
  const existingLookupMobile = loaded && /^[6-9]\d{9}$/.test(profile.mobile) ? profile.mobile : null;
  const { data: existingRegistration, loading: checkingExisting } = useAsync(
    () => (existingLookupMobile ? api.communityDinner.mine(existingLookupMobile) : Promise.resolve(null)),
    [existingLookupMobile]
  );

  useEffect(() => {
    if (!loaded || hasCheckedExisting) return;
    if (!existingLookupMobile) {
      setHasCheckedExisting(true);
      setStep("form");
      return;
    }
    if (checkingExisting) return;
    setHasCheckedExisting(true);
    if (!existingRegistration) {
      setStep("form");
    } else if (existingRegistration.status === "PAYMENT_PENDING") {
      setRegistrationId(existingRegistration.registration_id);
      setGuestAmount(existingRegistration.guest_amount);
      setStep("payment");
    } else {
      setRegistrationId(existingRegistration.registration_id);
      setStep("already");
    }
  }, [loaded, hasCheckedExisting, existingLookupMobile, checkingExisting, existingRegistration]);

  const computedGuestAmount =
    (Number(guestAdults) || 0) * GUEST_ADULT_PRICE + (Number(guestChildren) || 0) * GUEST_CHILD_PRICE;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError("Please enter your name.");
      return;
    }
    if (!/^[6-9]\d{9}$/.test(mobile)) {
      setError("Enter a valid 10-digit mobile number.");
      return;
    }
    if (!block || !flatNumber) {
      setError("Please enter your block and flat number.");
      return;
    }
    const adultsNum = Number(adults) || 0;
    const childrenNum = Number(children) || 0;
    const guestAdultsNum = hasGuests ? Number(guestAdults) || 0 : 0;
    const guestChildrenNum = hasGuests ? Number(guestChildren) || 0 : 0;
    if (adultsNum + childrenNum + guestAdultsNum + guestChildrenNum <= 0) {
      setError("Please add at least one person attending.");
      return;
    }

    setStep("creating");
    try {
      const registration = await api.communityDinner.register({
        residentName: name.trim(),
        mobile,
        block,
        flatNumber,
        adults: adultsNum,
        children: childrenNum,
        guestAdults: guestAdultsNum,
        guestChildren: guestChildrenNum,
      });
      saveProfile({ name: name.trim(), mobile, block, flatNumber });
      setRegistrationId(registration.registration_id);
      setGuestAmount(registration.guest_amount);
      setStep(registration.status === "CONFIRMED" ? "confirmed" : "payment");
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Something went wrong. Please try again.");
      setStep("form");
    }
  }

  // Explicit, resident-triggered fetch of their last known name/block/
  // flat by mobile (a Lookup button, not an automatic call on every
  // keystroke) — saves retyping details already on file without
  // turning every visit to this page into a background lookup.
  async function handleLookup() {
    setError(null);
    if (!/^[6-9]\d{9}$/.test(mobile)) {
      setLookupMessage("Enter a valid 10-digit mobile number first.");
      return;
    }
    setLookingUp(true);
    setLookupMessage(null);
    try {
      const result = await api.residents.lookup(mobile);
      if (result) {
        setName(result.name);
        setBlock(result.block);
        setFlatNumber(result.flatNumber);
        setLookupMessage(null);
        adultsInputRef.current?.focus();
      } else {
        setLookupMessage("No saved details found for this number — please fill in below.");
      }
    } catch (err) {
      setLookupMessage(err instanceof ApiClientError ? err.message : "Could not look up details. Please fill in manually.");
    } finally {
      setLookingUp(false);
    }
  }

  async function handleSubmitReference(reference: string, screenshot?: string, mimeType?: string) {
    if (!registrationId || !screenshot) return;
    setSubmitting(true);
    setError(null);
    try {
      await api.communityDinner.submitPayment(registrationId, reference, screenshot, mimeType || "image/jpeg");
      setStep("submitted");
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Could not submit your payment. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCancel() {
    if (!registrationId) return;
    setSubmitting(true);
    try {
      await api.communityDinner.cancel(registrationId);
      setStep("cancelled");
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Could not cancel. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (step === "checking") {
    return <LoadingIndicator label="Checking your registration…" className="px-5 pt-8" />;
  }

  if (step === "already") {
    return (
      <div className="flex flex-col gap-4 px-5 pt-8 text-center items-center">
        <PageHeader title="Already Registered" backHref="/more" backLabel="← More" />
        <p className="text-sm text-muted">
          You&apos;ve already registered for the Community Dinner.
          <br />
          Registration ID: {registrationId}
        </p>
        <Link href="/my-stuff" className="text-sm font-semibold text-maroon underline">
          Check status in My Stuff
        </Link>
        <div className="w-full text-left">
          <FindYourCounter counters={dinnerCount?.counters} lateCounter={dinnerCount?.lateCounter} />
        </div>
      </div>
    );
  }

  if (step === "payment") {
    return (
      <div className="flex flex-col gap-6 px-5 pt-8">
        <PageHeader
          title="Pay for Your Guests"
          subtitle={`${formatCurrency(guestAmount)} for the guests you added`}
          backHref="/more"
          backLabel="← More"
        />
        <PaymentReferenceStep
          amount={guestAmount}
          festival={festival ?? null}
          onSubmitReference={handleSubmitReference}
          onCancel={handleCancel}
          submitting={submitting}
          error={error}
          requireScreenshot
        />
      </div>
    );
  }

  if (step === "confirmed") {
    return (
      <div className="flex flex-col gap-4 px-5 pt-8 text-center items-center">
        <PageHeader title="You're Registered!" backHref="/more" backLabel="← More" />
        <p className="text-sm text-muted">
          Your Community Dinner registration is confirmed.
          <br />
          Registration ID: {registrationId}
        </p>
        <div className="w-full text-left">
          <FindYourCounter counters={dinnerCount?.counters} lateCounter={dinnerCount?.lateCounter} />
        </div>
      </div>
    );
  }

  if (step === "submitted") {
    return (
      <div className="flex flex-col gap-4 px-5 pt-8 text-center items-center">
        <PageHeader title="Thank You!" backHref="/more" backLabel="← More" />
        <p className="text-sm text-muted">
          Your payment is being reviewed by a volunteer — you&apos;ll be confirmed once it&apos;s verified.
        </p>
      </div>
    );
  }

  if (step === "cancelled") {
    return (
      <div className="flex flex-col gap-4 px-5 pt-8 text-center items-center">
        <PageHeader title="Registration Cancelled" backHref="/more" backLabel="← More" />
      </div>
    );
  }

  if (loadingCount && !dinnerCount) {
    return <LoadingIndicator className="px-5 pt-8" />;
  }

  // Only the fresh-registration form is closed off — a resident already
  // registered or mid-payment was routed to their own step above.
  if (dinnerCount?.open === false) {
    const whatsappNumber = festival?.admin_whatsapp_number;
    return (
      <div className="flex flex-col gap-4 px-5 pt-8 text-center items-center">
        <PageHeader
          title={dinnerCount.wrappedUp ? "Thank You 🙏" : "Registrations Closed"}
          backHref="/more"
          backLabel="← More"
        />
        <p className="text-sm text-muted">
          {dinnerCount.wrappedUp
            ? "The Community Dinner is over. Thank you for joining us!"
            : "Community Dinner registrations are now closed. Thank you to everyone who signed up!"}
        </p>
        <div className="w-full text-left">
          <FindYourCounter counters={dinnerCount?.counters} lateCounter={dinnerCount?.lateCounter} />
        </div>
        {!dinnerCount.wrappedUp && (
          <Link href="/my-stuff" className="text-sm font-semibold text-maroon underline">
            Already registered? Check status in My Stuff
          </Link>
        )}
        {whatsappNumber && !dinnerCount.wrappedUp && (
          <a
            href={`https://wa.me/${whatsappNumber}?text=${encodeURIComponent(
              "Hi, I'd like to ask about registering for the Community Dinner after registrations closed.\nName: \nBlock/Flat: \nNumber of people: "
            )}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-semibold text-maroon underline"
          >
            Need help? Message an admin
          </a>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 px-5 pt-8">
      <PageHeader
        title="Community Dinner"
        subtitle="Register your household — this is one-time, so please double-check before submitting."
        backHref="/more"
        backLabel="← More"
      />
      <p className="-mt-4 text-sm font-medium text-saffron">20th September, evening — details to follow</p>
      <p className="-mt-4 text-sm font-semibold">
        Free for all residents — guests welcome at ₹{GUEST_ADULT_PRICE}/adult, ₹{GUEST_CHILD_PRICE}/child
      </p>
      {!!dinnerCount && dinnerCount.registered > 0 && (
        <p className="-mt-4 text-sm font-semibold text-maroon">{dinnerCount.registered} already registered</p>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Mobile</label>
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <MobileInput
                value={mobile}
                onChange={(v) => {
                  setMobile(v);
                  setLookupMessage(null);
                }}
              />
            </div>
            <button
              type="button"
              onClick={handleLookup}
              disabled={lookingUp}
              title="Lookup — autofill your saved details"
              aria-label="Lookup — autofill your saved details"
              className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-lg border border-maroon text-maroon disabled:opacity-50 active:bg-maroon/10 transition-colors"
            >
              {lookingUp ? (
                <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" />
                  <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                </svg>
              ) : (
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="7" strokeLinecap="round" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" strokeLinecap="round" />
                </svg>
              )}
            </button>
          </div>
          {lookupMessage && <p className="text-xs text-muted">{lookupMessage}</p>}
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Name</label>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="off"
            className="w-full rounded-lg border border-border bg-card px-3 py-3 text-sm"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Block</label>
          <BlockSelect value={block} onChange={setBlock} />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Flat (3-digit number only)</label>
          <FlatInput value={flatNumber} onChange={setFlatNumber} />
        </div>

        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <p className="text-xs font-medium text-muted uppercase tracking-wide">Your Household</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Adults (12+)</label>
              <input
                ref={adultsInputRef}
                type="number"
                min="0"
                inputMode="numeric"
                value={adults}
                onChange={(e) => setAdults(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-3 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Children (6-12)</label>
              <input
                type="number"
                min="0"
                inputMode="numeric"
                value={children}
                onChange={(e) => setChildren(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-3 text-sm"
              />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <label className="flex items-center gap-2 text-sm font-medium">
            <input type="checkbox" checked={hasGuests} onChange={(e) => setHasGuests(e.target.checked)} />
            Bringing guests?
          </label>
          <p className="text-xs text-muted">
            Guests are chargeable at actuals — ₹{GUEST_ADULT_PRICE}/plate for adults (12+), ₹{GUEST_CHILD_PRICE}/plate
            for children (6-12).
          </p>
          {hasGuests && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Guest Adults</label>
                  <input
                    type="number"
                    min="0"
                    inputMode="numeric"
                    value={guestAdults}
                    onChange={(e) => setGuestAdults(e.target.value)}
                    className="w-full rounded-lg border border-border bg-background px-3 py-3 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Guest Children</label>
                  <input
                    type="number"
                    min="0"
                    inputMode="numeric"
                    value={guestChildren}
                    onChange={(e) => setGuestChildren(e.target.value)}
                    className="w-full rounded-lg border border-border bg-background px-3 py-3 text-sm"
                  />
                </div>
              </div>
              {computedGuestAmount > 0 && (
                <p className="text-sm font-semibold text-maroon">
                  Guest total: {formatCurrency(computedGuestAmount)} — payable right after you submit
                </p>
              )}
            </>
          )}
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={step === "creating"}
          className="w-full rounded-xl bg-maroon py-4 text-center text-sm font-semibold text-white disabled:opacity-60 active:bg-maroon-dark transition-colors"
        >
          {step === "creating" ? "Registering…" : "Register"}
        </button>
        <p className="text-xs text-muted text-center">
          This is a one-time registration and gets locked once submitted — to change anything afterward, please
          message an admin on WhatsApp.
        </p>
      </form>
    </div>
  );
}
