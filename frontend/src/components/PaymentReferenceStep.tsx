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
  onSubmitReference: (reference: string) => void | Promise<void>;
  onCancel: () => void | Promise<void>;
  submitting: boolean;
  error: string | null;
};

/** UPI QR + "how did you pay" step, shared by Donate and Dinner. Nothing
 *  here ever marks a payment successful — it only submits the resident's
 *  claimed reference for a volunteer to independently verify (Decision 4).
 *  Screenshot upload tries a best-effort OCR guess (Ocr.js) but always
 *  fails soft to an empty, editable field if extraction doesn't work. */
export default function PaymentReferenceStep({ amount, festival, onSubmitReference, onCancel, submitting, error }: Props) {
  const [reference, setReference] = useState("");
  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const vpa = festival?.upi_vpa || "";
  const payeeName = festival?.upi_payee_name || festival?.festival_name || "Brigade Woods";
  const upiLink = vpa
    ? `upi://pay?pa=${encodeURIComponent(vpa)}&pn=${encodeURIComponent(payeeName)}&am=${amount}&cu=INR`
    : "";

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
      const result = await api.payments.extractReference(base64, file.type || "image/jpeg");
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
            <a
              href={upiLink}
              className="w-full rounded-xl bg-saffron py-3 text-center text-sm font-semibold text-white active:bg-saffron-dark transition-colors"
            >
              Pay in UPI App
            </a>
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
          {extracting ? "Reading screenshot…" : "Upload Payment Screenshot"}
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
          onClick={() => onSubmitReference(reference.trim())}
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
