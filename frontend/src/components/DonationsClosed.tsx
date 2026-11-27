"use client";

import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import { useFestivalConfig } from "@/lib/FestivalConfigContext";
import { closingMessage } from "@/lib/festivalVoice";

export default function DonationsClosed({ withHeader = true }: { withHeader?: boolean }) {
  const { festival, communityName } = useFestivalConfig();
  const closing = closingMessage(festival);
  return (
    <div className="flex flex-col gap-4 px-5 pt-8 text-center items-center">
      {withHeader && <PageHeader title={`Thank You, ${communityName} 🙏`} />}
      <p className="text-sm">
        Donations are now closed. Your generosity made {festival?.festival_name || "this celebration"} possible, and we
        are grateful to every family, volunteer and sponsor who stood with us.
      </p>
      <p className="text-sm text-muted">
        Already paid? Your receipt will appear under My Stuff once a volunteer has verified your payment.
      </p>
      <Link href="/my-stuff" className="text-sm font-semibold text-maroon underline">
        Go to My Stuff
      </Link>
      {closing && <p className="text-sm font-semibold text-maroon">{closing}</p>}
    </div>
  );
}
