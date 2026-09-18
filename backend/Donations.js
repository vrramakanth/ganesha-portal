/** Donation lifecycle (spec §9–§12). Status must only ever move forward
 *  through backend-verified transitions — never trust a client claim of
 *  "I have paid" (Decision 4). */

/** Reserved "block" value for sponsorships, which are recorded only by an
 *  admin (recordSponsorship below) — sponsors often aren't residents. It's
 *  deliberately not a row in the Blocks sheet, so validateBlock rejects it
 *  on every resident-facing form, including this one. */
const SPONSOR_BLOCK = "SPONSOR";

function createDonation({ name, mobile, email, block, flatNumber, amount }) {
  requireFields({ name, mobile, block, flatNumber, amount }, [
    "name",
    "mobile",
    "block",
    "flatNumber",
    "amount",
  ]);

  const amountNum = Number(amount);
  const minimum = Number(getConfig("minimum_donation", "0")) || 0;
  const maximum = Number(getConfig("maximum_donation", "100000")) || 100000;
  if (!(amountNum > 0) || amountNum < minimum) {
    throw new ApiError(`Amount must be at least ₹${minimum}`, 400);
  }
  if (amountNum > maximum) {
    throw new ApiError(`Amount cannot exceed ₹${maximum}`, 400);
  }
  validateBlock(block);
  const resident = upsertResident({ name, mobile, email, block, flatNumber });

  return withLock(() => {
    const transactionId = generateTransactionId();

    const transaction = {
      transaction_id: transactionId,
      resident_id: resident.resident_id,
      created_at: new Date(),
      resident_name: name,
      block,
      flat_number: flatNumber,
      mobile,
      email: email || "",
      amount: amountNum,
      currency: "INR",
      payment_provider: "upi_qr",
      payment_order_id: "",
      payment_id: "",
      payment_reference: "",
      status: "PAYMENT_PENDING",
      verified_at: "",
      receipt_id: "",
      receipt_url: "",
      source: "ONLINE",
      admin_notes: "",
      updated_at: new Date(),
    };
    appendObject(getSheet(SHEETS.TRANSACTIONS), transaction);

    return { transactionId, amount: amountNum, currency: "INR" };
  });
}

/** Admin-only: records a sponsorship the sponsor paid outside the app
 *  (bank transfer, cheque, cash, UPI to a volunteer). Sponsors often
 *  aren't residents, so there's no resident account, block or flat, and
 *  mobile is optional. Lands in MANUAL_REVIEW rather than success —
 *  the same Payment Review queue verifies it against the bank statement
 *  and issues the receipt (Decision 4: recording a claim never makes it
 *  count). No maximum applies, unlike household donations. */
function recordSponsorship(volunteer, { name, mobile, amount, reference, screenshot, mimeType, notes }) {
  requirePermission(volunteer, "Finance");
  requireFields({ name, amount, reference }, ["name", "amount", "reference"]);
  const amountNum = Number(amount);
  const minimum = Number(getConfig("minimum_donation", "0")) || 0;
  if (!(amountNum > 0) || amountNum < minimum) {
    throw new ApiError(`Amount must be at least ₹${minimum}`, 400);
  }
  if (mobile) validateMobile(mobile);

  return withLock(() => {
    const sheet = getSheet(SHEETS.TRANSACTIONS);
    const transactionId = generateTransactionId();
    const fields = {
      transaction_id: transactionId,
      resident_id: "",
      created_at: new Date(),
      resident_name: String(name).trim(),
      block: SPONSOR_BLOCK,
      flat_number: "",
      mobile: mobile || "",
      email: "",
      amount: amountNum,
      currency: "INR",
      payment_provider: "manual_admin",
      payment_order_id: "",
      payment_id: "",
      payment_reference: String(reference).trim(),
      status: "MANUAL_REVIEW",
      verified_at: "",
      receipt_id: "",
      receipt_url: "",
      source: "SPONSOR",
      admin_notes: notes || "",
      updated_at: new Date(),
    };
    if (screenshot) {
      ensureColumn(sheet, "payment_screenshot_url");
      fields.payment_screenshot_url = savePaymentScreenshot(screenshot, mimeType);
    }
    appendObject(sheet, fields);
    logAudit(volunteer.email, "Recorded sponsorship", "Transaction", transactionId, "", `${fields.resident_name} ₹${amountNum}`);
    return { transactionId, status: "MANUAL_REVIEW" };
  });
}

/** The "eHundi" path — a no-questions-asked offering, same spirit as a
 *  physical Hundi box: no name/mobile/block/flat collected, and no
 *  minimum/maximum enforced. Decision 4 (a volunteer independently
 *  verifies every payment before it counts) still applies exactly as it
 *  does for a named donation — anonymity only removes whose name goes
 *  on it, not the verification step. Marked via source: "HUNDI" so
 *  verifyPaymentManual knows to skip issuing a receipt, and so
 *  getPublicStats can exclude it from the block/families breakdown
 *  while still counting the amount toward the public collection total. */
/** The "eHundi" path — a public, no-questions-asked offering, same
 *  spirit as a physical Hundi box: no name/mobile/block/flat collected,
 *  and no minimum/maximum enforced. Reached only via a printed QR at the
 *  physical Hundi near the pandal (an unlisted page, never linked from
 *  the resident's own Donate page or any nav menu) — someone standing
 *  there scans it and pays directly on their own phone, no login of any
 *  kind. Decision 4 (a volunteer independently verifies every payment)
 *  still applies exactly as it does for a named donation; anonymity only
 *  removes whose name goes on it, not the verification step. */
function createHundiDonation({ amount }) {
  requireFields({ amount }, ["amount"]);
  const amountNum = Number(amount);
  if (!(amountNum > 0)) {
    throw new ApiError("Amount must be greater than 0", 400);
  }

  return withLock(() => {
    const transactionId = generateTransactionId();

    const transaction = {
      transaction_id: transactionId,
      resident_id: "",
      created_at: new Date(),
      resident_name: "",
      block: "",
      flat_number: "",
      mobile: "",
      email: "",
      amount: amountNum,
      currency: "INR",
      payment_provider: "upi_qr",
      payment_order_id: "",
      payment_id: "",
      payment_reference: "",
      status: "PAYMENT_PENDING",
      verified_at: "",
      receipt_id: "",
      receipt_url: "",
      source: "HUNDI",
      admin_notes: "",
      updated_at: new Date(),
    };
    appendObject(getSheet(SHEETS.TRANSACTIONS), transaction);

    return { transactionId, amount: amountNum, currency: "INR" };
  });
}

/** Called once the resident scans the UPI QR, pays in their own app, and
 *  reports back a reference (typed, or pre-filled from a screenshot —
 *  either way it's just a claim). This only ever reaches MANUAL_REVIEW,
 *  never SUCCESS — a volunteer must independently confirm the money
 *  actually arrived before verifyPaymentManual() issues a receipt
 *  (Decision 4: payment truth comes from the backend, not the resident). */
function submitPaymentReference({ transactionId, reference, screenshot, mimeType }) {
  requireFields({ transactionId, reference }, ["transactionId", "reference"]);

  return withLock(() => {
    const sheet = getSheet(SHEETS.TRANSACTIONS);
    const rowIndex = findRowIndexById(sheet, "transaction_id", transactionId);
    if (rowIndex === -1) throw new ApiError("Unknown transaction", 404);
    const transaction = getRowObject(sheet, rowIndex);

    if (SUCCESS_STATUSES.includes(transaction.status)) {
      return { transactionId, status: transaction.status };
    }
    if (transaction.status === "CANCELLED") {
      throw new ApiError("This donation was cancelled", 400);
    }

    const fields = {
      payment_reference: reference,
      status: "MANUAL_REVIEW",
      updated_at: new Date(),
    };
    if (screenshot) {
      ensureColumn(sheet, "payment_screenshot_url");
      fields.payment_screenshot_url = savePaymentScreenshot(screenshot, mimeType);
    }
    updateRowFields(sheet, rowIndex, fields);
    return { transactionId, status: "MANUAL_REVIEW" };
  });
}

/** Backfills a screenshot for a transaction an admin already moved to
 *  MANUAL_REVIEW (or beyond) by hand — the resident sent it directly
 *  over WhatsApp instead of through the app's own upload step. Reuses
 *  the same Drive folder/helper as submitPaymentReference() so it shows
 *  up identically on the Needs Review list. Deliberately touches only
 *  payment_screenshot_url (plus updated_at) — never status, amount, or
 *  receipt fields, so it can't affect collection totals or reissue a
 *  receipt; this is pure reconciliation, not a payment action. */
function attachPaymentScreenshot(volunteer, transactionId, screenshot, mimeType) {
  requirePermission(volunteer, "Finance");
  requireFields({ transactionId, screenshot }, ["transactionId", "screenshot"]);
  return withLock(() => {
    const sheet = getSheet(SHEETS.TRANSACTIONS);
    const rowIndex = findRowIndexById(sheet, "transaction_id", transactionId);
    if (rowIndex === -1) throw new ApiError("Unknown transaction", 404);

    ensureColumn(sheet, "payment_screenshot_url");
    const url = savePaymentScreenshot(screenshot, mimeType);
    if (!url) throw new ApiError("Could not save screenshot — please try again", 500);

    updateRowFields(sheet, rowIndex, { payment_screenshot_url: url, updated_at: new Date() });
    logAudit(volunteer.email, "Attached payment screenshot", "Transaction", transactionId, "", url);
    return { transactionId, screenshotUrl: url };
  });
}

/** Lets a resident back out of their own still-pending donation (the
 *  "Cancel" option on the QR/reference screen) so it doesn't sit around
 *  as an orphaned PAYMENT_PENDING row forever. */
function cancelDonation(transactionId) {
  requireFields({ transactionId }, ["transactionId"]);

  return withLock(() => {
    const sheet = getSheet(SHEETS.TRANSACTIONS);
    const rowIndex = findRowIndexById(sheet, "transaction_id", transactionId);
    if (rowIndex === -1) throw new ApiError("Unknown transaction", 404);
    const transaction = getRowObject(sheet, rowIndex);

    if (SUCCESS_STATUSES.includes(transaction.status)) {
      throw new ApiError("Cannot cancel a completed donation", 400);
    }

    updateRowFields(sheet, rowIndex, { status: "CANCELLED", updated_at: new Date() });
    return { transactionId, status: "CANCELLED" };
  });
}

function getDonation(transactionId) {
  const sheet = getSheet(SHEETS.TRANSACTIONS);
  const rowIndex = findRowIndexById(sheet, "transaction_id", transactionId);
  if (rowIndex === -1) throw new ApiError("Unknown transaction", 404);
  return sanitizeTransactionForResident(getRowObject(sheet, rowIndex));
}

function listDonationsByMobile(mobile) {
  requireFields({ mobile }, ["mobile"]);
  return rowsToObjects(getSheet(SHEETS.TRANSACTIONS))
    .filter((t) => String(t.mobile) === String(mobile))
    .map(sanitizeTransactionForResident);
}

/** Residents may see their own transaction, but never internal payment
 *  gateway identifiers (spec §33). */
function sanitizeTransactionForResident(t) {
  return {
    transactionId: t.transaction_id,
    amount: t.amount,
    status: t.status,
    createdAt: t.created_at,
    receiptUrl: t.receipt_url,
  };
}

function listTransactions(volunteer) {
  requirePermission(volunteer, "Finance");
  return rowsToObjects(getSheet(SHEETS.TRANSACTIONS));
}

function verifyPaymentManual(volunteer, transactionId, notes) {
  requirePermission(volunteer, "Finance");
  return withLock(() => {
    const sheet = getSheet(SHEETS.TRANSACTIONS);
    const rowIndex = findRowIndexById(sheet, "transaction_id", transactionId);
    if (rowIndex === -1) throw new ApiError("Unknown transaction", 404);
    const transaction = getRowObject(sheet, rowIndex);
    if (SUCCESS_STATUSES.includes(transaction.status)) {
      return { transactionId, status: transaction.status };
    }

    // A Hundi offering is anonymous by design — there's no one to issue
    // a receipt to, so skip it entirely rather than generating one with
    // a blank name/block/flat.
    const isHundi = transaction.source === "HUNDI";
    const receipt = isHundi ? null : generateReceipt({ ...transaction, status: "VERIFIED_SUCCESS" });
    updateRowFields(sheet, rowIndex, {
      status: "VERIFIED_SUCCESS",
      verified_at: new Date(),
      receipt_id: receipt ? receipt.receiptId : "",
      receipt_url: receipt ? receipt.url : "",
      admin_notes: notes || "",
      updated_at: new Date(),
    });
    logAudit(volunteer.email, "Verified payment", "Transaction", transactionId, transaction.status, "VERIFIED_SUCCESS");
    invalidatePublicStatsCache();
    return { transactionId, status: "VERIFIED_SUCCESS", receiptUrl: receipt ? receipt.url : "" };
  });
}

function rejectPayment(volunteer, transactionId, notes) {
  requirePermission(volunteer, "Finance");
  return withLock(() => {
    const sheet = getSheet(SHEETS.TRANSACTIONS);
    const rowIndex = findRowIndexById(sheet, "transaction_id", transactionId);
    if (rowIndex === -1) throw new ApiError("Unknown transaction", 404);
    const transaction = getRowObject(sheet, rowIndex);
    if (SUCCESS_STATUSES.includes(transaction.status)) {
      throw new ApiError("Cannot reject an already-successful payment", 400);
    }

    updateRowFields(sheet, rowIndex, {
      status: "FAILED",
      admin_notes: notes || "",
      updated_at: new Date(),
    });
    logAudit(volunteer.email, "Rejected payment", "Transaction", transactionId, transaction.status, "FAILED");
    return { transactionId, status: "FAILED" };
  });
}
