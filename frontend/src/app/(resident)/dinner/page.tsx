"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import LoadingIndicator from "@/components/LoadingIndicator";

/** The resident-facing dinner registration flow has moved to Community
 *  Dinner (§17 replacement) — this route stays only so an old bookmark
 *  or shared link doesn't dead-end. The generic Dinner/Entitlement
 *  engine underneath (Dinner.js) is left in place for the volunteer
 *  counter/token tooling and any future non-Community-Dinner event
 *  that needs it. */
export default function DinnerPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/community-dinner");
  }, [router]);

  return <LoadingIndicator label="Redirecting…" className="px-5 pt-8" />;
}
