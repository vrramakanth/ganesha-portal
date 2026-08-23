import NavBar from "@/components/NavBar";

const NAV_ITEMS = [
  { href: "/volunteer", label: "Dashboard" },
  { href: "/volunteer/donations", label: "Donations", matchPrefix: true },
  { href: "/volunteer/events", label: "Events", matchPrefix: true },
  { href: "/volunteer/dinner", label: "Dinner", matchPrefix: true },
  { href: "/volunteer/volunteers", label: "Volunteers", matchPrefix: true },
  { href: "/volunteer/more", label: "More", matchPrefix: true },
] as const;

export default function VolunteerNav() {
  return <NavBar items={NAV_ITEMS} />;
}
