"use client";

import { useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { api } from "@/lib/api";
import { formatCurrency } from "@/lib/date";
import { fileToBase64 } from "@/lib/file";
import type { FestivalInfo } from "@/lib/types";

type Props = {
  amount: number;
  festival: FestivalInfo | null;
  onSubmitReference: (reference: string, screenshot?: string, mimeType?: string) => void | Promise<void>;
  onCancel: () => void | Promise<void>;
  submitting: boolean;
  error: string | null;
};

/** Android: targeting a package explicitly via intent:// "package=" is
 *  what actually picks a specific app — a bare "upi://" link lets
 *  Android silently resolve to whatever it feels like (observed: always
 *  WhatsApp). All four have well-documented package names. */
const ANDROID_PACKAGES: Record<string, string> = {
  gpay: "com.google.android.apps.nbu.paisa.user",
  phonepe: "com.phonepe.app",
  bhim: "in.org.npci.upiapp",
  whatsapp: "com.whatsapp",
};

/** iOS has no intent-style targeting — only an app's own distinct URL
 *  scheme reliably opens that exact app there (a shared "upi://" is just
 *  as ambiguous as it is on Android). Limited to the two schemes this
 *  codebase can vouch for; BHIM and WhatsApp are left off iOS rather than
 *  ship a guessed scheme that might silently do nothing. Each value is
 *  the full scheme+path prefix, since GPay's differs from PhonePe's. */
const IOS_SCHEME_PREFIXES: Record<string, string> = {
  gpay: "tez://upi/",
  phonepe: "phonepe://",
};

const APP_LABELS: Record<string, string> = {
  gpay: "Google Pay",
  phonepe: "PhonePe",
  bhim: "BHIM",
  whatsapp: "WhatsApp",
};

/** TEMPORARY: the receiving Vyapar VPA currently rejects QR/deep-link-
 *  initiated UPI payments (confirmed: manually typing the same UPI ID
 *  into a UPI app succeeds; scanning a QR or opening any of the app
 *  buttons below fails) — most likely QR/collect-request payment isn't
 *  yet enabled on the merchant account. Set back to true once HDFC
 *  confirms it's enabled, which restores the Google Pay/PhonePe/BHIM/
 *  WhatsApp picker as options alongside Copy UPI ID. */
const APP_PICKER_ENABLED = false;

/** UPI QR + "how did you pay" step, shared by Donate and Dinner. Nothing
 *  here ever marks a payment successful — it only submits the resident's
 *  claimed reference for a volunteer to independently verify (Decision 4).
 *  Screenshot upload tries a best-effort OCR guess (Ocr.js) but always
 *  fails soft to an empty, editable field if extraction doesn't work. */
export default function PaymentReferenceStep({ amount, festival, onSubmitReference, onCancel, submitting, error }: Props) {
  const [reference, setReference] = useState("");
  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [screenshot, setScreenshot] = useState<{ base64: string; mimeType: string } | null>(null);
  const [selectedApp, setSelectedApp] = useState(APP_PICKER_ENABLED ? "gpay" : "copy");
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const vpa = festival?.upi_vpa || "";
  const payeeName = festival?.upi_payee_name || festival?.festival_name || "Brigade Woods";
  const upiParams = `pay?pa=${encodeURIComponent(vpa)}&pn=${encodeURIComponent(payeeName)}&am=${amount}&cu=INR`;
  // The QR code must always encode the plain "upi://" URI — a UPI app's
  // camera scanner only recognizes that scheme, not an Android intent://
  // wrapper or an iOS app-specific scheme. The *button*, on the other
  // hand, is a browser-mediated click, where a bare "upi://" scheme lets
  // both platforms silently resolve to whatever they feel like (observed:
  // always WhatsApp) rather than the app the resident actually picked.
  const upiLink = vpa ? `upi://${upiParams}` : "";
  const isAndroid = typeof navigator !== "undefined" && /android/i.test(navigator.userAgent);
  const isIOS = typeof navigator !== "undefined" && /iphone|ipad|ipod/i.test(navigator.userAgent);
  const appIds = !APP_PICKER_ENABLED ? [] : isAndroid ? ["gpay", "phonepe", "bhim", "whatsapp"] : isIOS ? ["gpay", "phonepe"] : [];
  const appOptions = [...appIds.map((id) => ({ id, label: APP_LABELS[id] })), { id: "copy", label: "Copy UPI ID" }];

  const upiButtonLink = vpa
    ? isAndroid
      ? `intent://${upiParams}#Intent;scheme=upi;package=${ANDROID_PACKAGES[selectedApp]};end;`
      : isIOS && IOS_SCHEME_PREFIXES[selectedApp]
      ? `${IOS_SCHEME_PREFIXES[selectedApp]}${upiParams}`
      : upiLink
    : "";

  async function copyVpa() {
    try {
      await navigator.clipboard.writeText(vpa);
      setCopied(true);
      setCopyFailed(false);
    } catch {
      setCopied(false);
      setCopyFailed(true);
    }
  }

  function selectApp(id: string) {
    setSelectedApp(id);
    if (id === "copy") copyVpa();
    else {
      setCopied(false);
      setCopyFailed(false);
    }
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file later
    if (!file) return;

    if (file.size > 8 * 1024 * 1024) {
      setExtractError("That image is too large — please choose one under 8MB.");
      return;
    }

    setExtractError(null);
    setExtracting(true);
    try {
      const base64 = await fileToBase64(file);
      const mimeType = file.type || "image/jpeg";
      // Keep the screenshot around (even if OCR can't read it) so it's
      // still attached when the resident submits — it's what lets a
      // volunteer visually verify the payment on the Needs Review list.
      setScreenshot({ base64, mimeType });
      const result = await api.payments.extractReference(base64, mimeType);
      if (result.guess) {
        setReference(result.guess);
      } else {
        setExtractError("Couldn't read a reference from that screenshot — please type it in below.");
      }
    } catch {
      setExtractError("Couldn't read that screenshot — please type the reference in below.");
    } finally {
      setExtracting(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-xl border border-border bg-card p-5 flex flex-col items-center gap-3 text-center">
        <p className="text-sm text-muted">Scan &amp; pay</p>
        <p className="text-2xl font-bold text-maroon">{formatCurrency(amount)}</p>

        {vpa ? (
          <>
            <div className="rounded-lg bg-white p-3">
              <QRCodeSVG value={upiLink} size={180} />
            </div>

            {appIds.length > 0 && (
              <div className="w-full grid grid-cols-2 gap-2 text-left">
                {appOptions.map((app) => (
                  <label
                    key={app.id}
                    className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                      selectedApp === app.id ? "border-saffron bg-saffron/10" : "border-border"
                    }`}
                  >
                    <input
                      type="radio"
                      name="upi-app"
                      checked={selectedApp === app.id}
                      onChange={() => selectApp(app.id)}
                    />
                    {app.label}
                  </label>
                ))}
              </div>
            )}

            {selectedApp === "copy" ? (
              <>
                <button
                  type="button"
                  onClick={copyVpa}
                  className="w-full rounded-xl bg-saffron py-3 text-center text-sm font-semibold text-white active:bg-saffron-dark transition-colors"
                >
                  {copied ? "Copied ✓" : "Copy UPI ID"}
                </button>
                <p className="text-xs text-muted">
                  Paste into your UPI app&apos;s &quot;Pay to UPI ID&quot; option, not the QR scanner.
                </p>
                {copyFailed && (
                  <p className="text-xs text-saffron-dark">Couldn&apos;t copy — select the UPI ID below instead.</p>
                )}
              </>
            ) : (
              <a
                href={upiButtonLink}
                className="w-full rounded-xl bg-saffron py-3 text-center text-sm font-semibold text-white active:bg-saffron-dark transition-colors"
              >
                Pay in UPI App
              </a>
            )}
            <p className="text-xs text-muted">{payeeName} &middot; {vpa}</p>
          </>
        ) : (
          <p className="text-sm text-muted">
            Payment QR isn&apos;t set up yet — please ask a volunteer for the payment details.
          </p>
        )}
      </div>

      <div className="space-y-3">
        <p className="text-sm font-medium">Already paid? Let us know how to find it:</p>

        <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />
        <button
          type="button"
          disabled={extracting}
          onClick={() => fileInputRef.current?.click()}
          className="w-full rounded-xl border border-border py-3 text-center text-sm font-semibold text-maroon disabled:opacity-60"
        >
          {extracting ? "Reading screenshot…" : screenshot ? "Screenshot Attached ✓" : "Upload Payment Screenshot"}
        </button>
        {extractError && <p className="text-xs text-saffron-dark">{extractError}</p>}

        <div className="space-y-1.5">
          <label className="text-sm font-medium">Or type your UPI reference / UTR</label>
          <input
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder="e.g. 123456789012"
            className="w-full rounded-lg border border-border bg-card px-3 py-3 text-sm"
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="button"
          disabled={submitting || !reference.trim()}
          onClick={() => onSubmitReference(reference.trim(), screenshot?.base64, screenshot?.mimeType)}
          className="w-full rounded-xl bg-maroon py-4 text-center text-sm font-semibold text-white disabled:opacity-60 active:bg-maroon-dark transition-colors"
        >
          {submitting ? "Submitting…" : "Submit for Verification"}
        </button>

        <button
          type="button"
          disabled={submitting}
          onClick={() => onCancel()}
          className="w-full text-center text-xs font-medium text-muted disabled:opacity-60"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
