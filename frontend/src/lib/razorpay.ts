"use client";

type RazorpaySuccessResponse = {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
};

type RazorpayOptions = {
  amount: number; // rupees
  orderId: string;
  name: string;
  description: string;
  prefill: { name: string; contact: string; email?: string };
  onSuccess: (response: RazorpaySuccessResponse) => void;
  onDismiss: () => void;
};

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Razorpay?: new (options: any) => { open: () => void };
  }
}

let scriptPromise: Promise<void> | null = null;

function loadRazorpayScript(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Could not load the payment gateway. Please try again."));
    document.body.appendChild(script);
  });
  return scriptPromise;
}

/** Test config (not a real integration): when NEXT_PUBLIC_TEST_MODE is
 *  "true", skip Razorpay Checkout entirely and simulate a successful
 *  payment so the rest of the flow (backend confirm, receipt, tokens) can
 *  be exercised without real Razorpay keys. The backend must have its own
 *  matching TEST_MODE Script Property set — see backend/README.md. Unset
 *  either side to resume real payments. */
function isTestMode() {
  return process.env.NEXT_PUBLIC_TEST_MODE === "true";
}

export async function openRazorpayCheckout(options: RazorpayOptions) {
  if (isTestMode()) {
    setTimeout(() => {
      options.onSuccess({
        razorpay_order_id: options.orderId,
        razorpay_payment_id: `test_pay_${Date.now()}`,
        razorpay_signature: "TEST_SIGNATURE",
      });
    }, 400);
    return;
  }

  const keyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
  if (!keyId) throw new Error("NEXT_PUBLIC_RAZORPAY_KEY_ID is not set.");

  await loadRazorpayScript();
  if (!window.Razorpay) throw new Error("Payment gateway failed to load.");

  const checkout = new window.Razorpay({
    key: keyId,
    amount: Math.round(options.amount * 100),
    currency: "INR",
    order_id: options.orderId,
    name: options.name,
    description: options.description,
    prefill: options.prefill,
    handler: options.onSuccess,
    modal: { ondismiss: options.onDismiss },
    theme: { color: "#f4791f" },
  });
  checkout.open();
}
