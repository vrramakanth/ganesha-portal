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
  if (!(amountNum > 0) || amountNum < minimum) {
    throw new ApiError(`Amount must be at least ₹${minimum}`, 400);
  }
  validateBlock(block);
  const resident = upsertResident({ name, mobile, email, block, flatNumber });

  return withLock(() => {
    const transactionId = generateTransactionId();
    const order = createRazorpayOrder(amountNum, transactionId);

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
      payment_provider: "razorpay",
      payment_order_id: order.id,
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

    return { transactionId, razorpayOrderId: order.id, amount: amountNum, currency: "INR" };
  });
}

/** Called by the frontend once Razorpay Checkout reports success. */
function confirmPayment({ transactionId, razorpay_order_id, razorpay_payment_id, razorpay_signature }) {
  requireFields(
    { transactionId, razorpay_order_id, razorpay_payment_id, razorpay_signature },
    ["transactionId", "razorpay_order_id", "razorpay_payment_id", "razorpay_signature"]
  );

  return withLock(() => {
    const sheet = getSheet(SHEETS.TRANSACTIONS);
    const rowIndex = findRowIndexById(sheet, "transaction_id", transactionId);
    if (rowIndex === -1) throw new ApiError("Unknown transaction", 404);
    const transaction = getRowObject(sheet, rowIndex);

    // Idempotent: webhook/callback may fire more than once (spec §39).
    if (SUCCESS_STATUSES.includes(transaction.status)) {
      return { transactionId, status: transaction.status, receiptUrl: transaction.receipt_url };
    }
    if (transaction.payment_order_id !== razorpay_order_id) {
      throw new ApiError("Order mismatch", 400);
    }

    const valid = verifyCheckoutSignature(razorpay_order_id, razorpay_payment_id, razorpay_signature);
    if (!valid) {
      updateRowFields(sheet, rowIndex, { status: "FAILED", updated_at: new Date() });
      throw new ApiError("Payment signature verification failed", 400);
    }

    const receipt = generateReceipt({ ...transaction, payment_id: razorpay_payment_id, status: "SUCCESS" });

    updateRowFields(sheet, rowIndex, {
      payment_id: razorpay_payment_id,
      payment_reference: razorpay_payment_id,
      status: "SUCCESS",
      verified_at: new Date(),
      receipt_id: receipt.receiptId,
      receipt_url: receipt.url,
      updated_at: new Date(),
    });

    return { transactionId, status: "SUCCESS", receiptUrl: receipt.url };
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
