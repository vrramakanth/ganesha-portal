/** Donation lifecycle (spec §9–§12). Status must only ever move forward
 *  through backend-verified transitions — never trust a client claim of
 *  "I have paid" (Decision 4). */

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

/** Called once the resident scans the UPI QR, pays in their own app, and
 *  reports back a reference (typed, or pre-filled from a screenshot —
 *  either way it's just a claim). This only ever reaches MANUAL_REVIEW,
 *  never SUCCESS — a volunteer must independently confirm the money
 *  actually arrived before verifyPaymentManual() issues a receipt
 *  (Decision 4: payment truth comes from the backend, not the resident). */
function submitPaymentReference({ transactionId, reference }) {
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

    updateRowFields(sheet, rowIndex, {
      payment_reference: reference,
      status: "MANUAL_REVIEW",
      updated_at: new Date(),
    });
    return { transactionId, status: "MANUAL_REVIEW" };
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

    const receipt = generateReceipt({ ...transaction, status: "VERIFIED_SUCCESS" });
    updateRowFields(sheet, rowIndex, {
      status: "VERIFIED_SUCCESS",
      verified_at: new Date(),
      receipt_id: receipt.receiptId,
      receipt_url: receipt.url,
      admin_notes: notes || "",
      updated_at: new Date(),
    });
    logAudit(volunteer.email, "Verified payment", "Transaction", transactionId, transaction.status, "VERIFIED_SUCCESS");
    return { transactionId, status: "VERIFIED_SUCCESS", receiptUrl: receipt.url };
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
