/** Razorpay integration.
 *
 * IMPORTANT — Apps Script Web Apps cannot read custom request headers, so
 * a classic server-to-server webhook (which authenticates itself via the
 * X-Razorpay-Signature header) cannot be verified here. Instead we use
 * Razorpay's standard client-checkout flow: after Checkout.js completes,
 * the browser calls confirmPayment() below with
 * { razorpay_order_id, razorpay_payment_id, razorpay_signature }. That
 * signature is HMAC-SHA256(order_id + "|" + payment_id, key_secret) — it
 * only depends on body fields we already have, so we can verify it
 * entirely server-side without needing header access. This satisfies
 * "payment truth comes from the backend" (spec Decision 4): the frontend
 * cannot mark a donation SUCCESS by itself, only by presenting a
 * signature Razorpay computed.
 *
 * A residual gap: if the browser is closed before the callback fires, the
 * transaction is left at PAYMENT_PENDING rather than being reconciled
 * automatically. For production hardening, add a small relay (Cloud
 * Run/Vercel function) that verifies Razorpay's real webhook header and
 * forwards a trusted, HMAC-signed call to this Web App — everything else
 * in this backend stays the same. Until then, anything stuck at
 * PAYMENT_PENDING should be reconciled by a volunteer via MANUAL_REVIEW
 * (spec §11 already models this state).
 */

function createRazorpayOrder(amountRupees, receiptLabel) {
  if (isTestMode()) {
    return { id: `test_order_${Utilities.getUuid()}` };
  }

  const keyId = getScriptProperty("RAZORPAY_KEY_ID");
  const keySecret = getScriptProperty("RAZORPAY_KEY_SECRET");

  const resp = UrlFetchApp.fetch("https://api.razorpay.com/v1/orders", {
    method: "post",
    contentType: "application/json",
    headers: {
      Authorization: "Basic " + Utilities.base64Encode(`${keyId}:${keySecret}`),
    },
    payload: JSON.stringify({
      amount: Math.round(amountRupees * 100),
      currency: "INR",
      receipt: receiptLabel,
    }),
    muteHttpExceptions: true,
  });

  if (resp.getResponseCode() >= 300) {
    throw new ApiError(`Payment gateway error: ${resp.getContentText()}`, 502);
  }
  return JSON.parse(resp.getContentText());
}

function verifyCheckoutSignature(orderId, paymentId, signature) {
  if (isTestMode()) return true;

  const keySecret = getScriptProperty("RAZORPAY_KEY_SECRET");
  const expected = Utilities.computeHmacSha256Signature(`${orderId}|${paymentId}`, keySecret)
    .map((b) => (b < 0 ? b + 256 : b).toString(16).padStart(2, "0"))
    .join("");
  return expected === signature;
}
