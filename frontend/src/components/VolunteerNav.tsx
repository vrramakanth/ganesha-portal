"use client";

import NavBar from "@/components/NavBar";
import { useVolunteerAuth } from "@/lib/VolunteerAuthContext";
import { useFestivalConfig } from "@/lib/FestivalConfigContext";

export default function VolunteerNav() {
  const { volunteer } = useVolunteerAuth();
  const { modules } = useFestivalConfig();

  const items = [
    { href: "/volunteer", label: "Dashboard" },
    ...(modules.donations && volunteer?.permissions.includes("Finance")
      ? [{ href: "/volunteer/donations", label: "Donations", matchPrefix: true }]
      : []),
    ...(modules.events ? [{ href: "/volunteer/events", label: "Events", matchPrefix: true }] : []),
    ...(modules.meal ? [{ href: "/volunteer/dinner", label: "Dinner", matchPrefix: true }] : []),
    ...(modules.volunteers && volunteer?.permissions.includes("Operations")
      ? [{ href: "/volunteer/volunteers", label: "Seva", matchPrefix: true }]
      : []),
    { href: "/volunteer/more", label: "More", matchPrefix: true },
  ] as const;

  return <NavBar items={items} />;
}
