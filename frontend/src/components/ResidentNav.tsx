import NavBar from "@/components/NavBar";

const NAV_ITEMS = [
  { href: "/", label: "Home" },
  { href: "/events", label: "Events" },
  { href: "/donate", label: "Donate" },
  { href: "/my-stuff", label: "My Stuff" },
  { href: "/more", label: "More" },
] as const;

export default function ResidentNav() {
  return <NavBar items={NAV_ITEMS} />;
}
