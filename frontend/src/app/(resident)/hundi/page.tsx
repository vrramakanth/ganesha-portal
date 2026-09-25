"use client";

import { useFestivalConfig } from "@/lib/FestivalConfigContext";
import PageHeader from "@/components/PageHeader";
import LoadingIndicator from "@/components/LoadingIndicator";
import DonationsClosed from "@/components/DonationsClosed";

/** The eHundi — literally just the bank's payment QR, nothing else. No
 *  amount picker, no transaction, no reference form: this page exists so
 *  the QR can be shared as a stable link (in a WhatsApp message, or
 *  scanned from a printed sign) instead of passing the raw image file
 *  around. Deliberately not linked from the Donate page, Home page, or
 *  any nav menu — reached only by whoever has this direct URL. Once
 *  donations close, the QR is replaced by a thank-you. */
export default function HundiPage() {
  const { festival, loading, error } = useFestivalConfig();

  if (loading) return <LoadingIndicator className="px-5 pt-8" />;
  if (festival?.donations_open === "false") return <DonationsClosed />;

  return (
    <div className="flex flex-col gap-6 px-5 pt-8 items-center text-center">
      <PageHeader title="Ganesha Hundi" subtitle="Scan and pay directly — no details needed." />
      {error && <p className="text-xs text-muted">Could not check whether donations are open.</p>}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/images/hdfc-vyapar-qr.png"
        alt="HDFC Vyapar UPI QR code"
        className="w-full max-w-sm rounded-lg"
      />
    </div>
  );
}
