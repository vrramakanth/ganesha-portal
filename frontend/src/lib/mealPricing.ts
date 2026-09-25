/** Mirrors backend/CommunityDinner.js's `communityDinnerAmountDue` exactly
 *  — used only for a live preview while filling the form; the server is
 *  always the authoritative amount (see PaymentReferenceStep / the
 *  registration response's own `guest_amount`). Kept in one place so the
 *  resident form and the volunteer "add registration" form can't drift,
 *  the same problem this replaced (each used to hardcode its own copy of
 *  ₹200/₹100). */

export type MealPricingMode = "household_free_guest_paid" | "everyone_paid";

export function mealAmountDue(
  mode: MealPricingMode | string | undefined,
  adultPrice: number,
  childPrice: number,
  adults: number,
  children: number,
  guestAdults: number,
  guestChildren: number
): number {
  if (mode === "everyone_paid") {
    return (adults + guestAdults) * adultPrice + (children + guestChildren) * childPrice;
  }
  return guestAdults * adultPrice + guestChildren * childPrice;
}
