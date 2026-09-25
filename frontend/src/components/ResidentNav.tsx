"use client";

import NavBar from "@/components/NavBar";
import { useFestivalConfig } from "@/lib/FestivalConfigContext";

export default function ResidentNav() {
  const { modules } = useFestivalConfig();

  const items = [
    { href: "/", label: "Home" },
    ...(modules.events ? [{ href: "/events", label: "Events" }] : []),
    ...(modules.donations ? [{ href: "/donate", label: "Donate" }] : []),
    { href: "/my-stuff", label: "My Stuff" },
    { href: "/more", label: "More" },
  ] as const;

  return <NavBar items={items} />;
}
