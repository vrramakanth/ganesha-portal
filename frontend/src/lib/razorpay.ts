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

export async function openRazorpayCheckout(options: RazorpayOptions) {
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
