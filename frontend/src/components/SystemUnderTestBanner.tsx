const RAZORPAY_KEY_ID = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || "";

const isUnderTest =
  process.env.NEXT_PUBLIC_TEST_MODE === "true" || RAZORPAY_KEY_ID.startsWith("rzp_test_");

/** Shown whenever payments are running through the mock bypass or
 *  Razorpay's own test-mode keys, so residents/volunteers don't mistake a
 *  test session for the real thing — no money moves in either case, but
 *  neither is obvious from the UI alone. */
export default function SystemUnderTestBanner() {
  if (!isUnderTest) return null;

  return (
    <div className="sticky top-0 z-50 flex items-center justify-center gap-2 bg-saffron px-3 py-1.5 text-center text-xs font-semibold tracking-wide text-white">
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-3.5 w-3.5 shrink-0"
        aria-hidden="true"
      >
        <path d="M9 2v6.5L4.5 17a2 2 0 0 0 1.8 3h11.4a2 2 0 0 0 1.8-3L15 8.5V2" />
        <path d="M9 2h6" />
        <path d="M8 15h8" />
      </svg>
      <span>SYSTEM UNDER TEST — no real payments are being made</span>
    </div>
  );
}
