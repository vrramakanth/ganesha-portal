import { HUB_URL } from "@/lib/hub";

/** The platform-level brand — distinct from this deployment's own festival
 *  name/content. Small and unobtrusive by design: this is attribution for
 *  the reusable framework underneath, not this festival's own identity.
 *  It also links back to the Namma Habba hub listing every festival. */
export default function NammaHabbaAttribution() {
  return (
    <a
      href={HUB_URL}
      className="block text-center text-[10px] font-semibold tracking-widest text-muted uppercase underline-offset-2 hover:underline"
    >
      Powered by Namma Habba · All festivals
    </a>
  );
}
