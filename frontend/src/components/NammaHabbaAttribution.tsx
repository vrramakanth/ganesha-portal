/** The platform-level brand — distinct from this deployment's own
 *  festival name/content (see one-portal-any-event.html's phone mockups,
 *  which sketch this exact "POWERED BY NAMMA HABBA" treatment). Small and
 *  unobtrusive by design: this is attribution for the reusable framework
 *  underneath, not this festival's own identity. */
export default function NammaHabbaAttribution() {
  return (
    <p className="text-center text-[10px] font-semibold tracking-widest text-muted uppercase">
      Powered by Namma Habba
    </p>
  );
}
