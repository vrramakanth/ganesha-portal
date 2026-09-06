"use client";

import NavBar from "@/components/NavBar";
import { useVolunteerAuth } from "@/lib/VolunteerAuthContext";

export default function VolunteerNav() {
  const { volunteer } = useVolunteerAuth();

  const items = [
    { href: "/volunteer", label: "Dashboard" },
    ...(volunteer?.permissions.includes("Finance")
      ? [{ href: "/volunteer/donations", label: "Donations", matchPrefix: true }]
      : []),
    { href: "/volunteer/events", label: "Events", matchPrefix: true },
    { href: "/volunteer/dinner", label: "Dinner", matchPrefix: true },
    ...(volunteer?.permissions.includes("Operations")
      ? [{ href: "/volunteer/volunteers", label: "Seva", matchPrefix: true }]
      : []),
    { href: "/volunteer/more", label: "More", matchPrefix: true },
  ] as const;

  return <NavBar items={items} />;
}
