/** Lightweight expense logging — deliberately simpler than the fuller
 *  vendor/budget tracking sketched in spec §29. As the event gets
 *  closer, volunteers need to jot down a purchase in a couple of taps,
 *  not fill out a procurement form — date, amount, purpose, optional
 *  receipt photo, plus who spent it and their UPI ID so it can be
 *  repaid. Anyone can record one (see recordExpense), but — mirroring
 *  Donations' MANUAL_REVIEW flow — it only counts toward totals and
 *  settlement once a Finance admin approves it (Decision 4 applies to
 *  spending claims too, not just payment claims). */

// DRAFT (an expense moved from a future-cost estimate, still being
// edited) and CANCELLED (a draft sent back to estimates) must be listed
// here: expenseStatus() below reads any unrecognised status as APPROVED,
// so an unlisted DRAFT would silently count as real spending.
const EXPENSE_STATUSES = ["DRAFT", "PENDING", "APPROVED", "REJECTED", "CANCELLED"];
const PAYMENT_STATUSES = ["UNPAID", "PAID"];

/** Rows recorded before this approval workflow existed have no status
 *  at all — treating a blank as APPROVED grandfathers them in rather
 *  than making previously-counted totals suddenly vanish. */
function expenseStatus(e) {
  const s = String(e.status || "").trim().toUpperCase();
  return EXPENSE_STATUSES.includes(s) ? s : "APPROVED";
}

/** Separate from expenseStatus above on purpose: `status` answers "is
 *  this a legitimate claim" (Decision 4), `payment_status` answers "has
 *  the cash actually left our hands yet." An APPROVED-but-UNPAID
 *  expense (e.g. a caterer running a tab across several days, paid in
 *  one lump sum at the end) is accrued — it still counts as real
 *  spending today (getExpensesTotal doesn't look at this field at all),
 *  it just hasn't been settled. Blank defaults to UNPAID so every row
 *  recorded before this existed is correctly "still owed." */
function paymentStatus(e) {
  const s = String(e.payment_status || "").trim().toUpperCase();
  return PAYMENT_STATUSES.includes(s) ? s : "UNPAID";
}

/** Self-heals the sheet and its header row so this works immediately
 *  even before anyone's re-run setupSheets() for this feature.
 *
 *  This runs on every expense read/write (record, list, approve,
 *  reject, settlement, the dashboard's getExpensesTotal — all of them),
 *  so it reads the header row exactly once per call. The original
 *  version called ensureColumn() per header once the sheet already
 *  existed, and ensureColumn() re-reads the header row itself — 12
 *  separate Sheets API round trips every single call, which is what
 *  made every expense operation (and the volunteer dashboard, which
 *  calls this indirectly) get slower as expense traffic picked up. */
function ensureExpensesSheet() {
  const spreadsheet = getSpreadsheet();
  let sheet = spreadsheet.getSheetByName(SHEETS.EXPENSES);
  if (!sheet) sheet = spreadsheet.insertSheet(SHEETS.EXPENSES);

  const headers = [
    "expense_id", "date", "amount", "purpose", "screenshot_url",
    "spender_name", "spender_mobile", "upi_id", "status", "admin_notes",
    "recorded_by", "created_at", "payment_status", "paid_at", "from_estimate_id",
  ];
  const existing = getHeaders(sheet);
  if (existing.length === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  } else {
    const missing = headers.filter((h) => !existing.includes(h));
    if (missing.length > 0) {
      sheet.getRange(1, existing.length + 1, 1, missing.length).setValues([missing]);
    }
  }
  return sheet;
}

/** An expense can have several receipts (a caterer's bill plus a payment
 *  slip, say). They're kept in the one receipt field as a comma-separated
 *  list of Drive links, which are comma-free, so a single link and the
 *  rows from before this remain valid as they are. */
function addReceiptUrl(existing, url) {
  return existing ? `${existing},${url}` : url;
}

function getExpenseReceiptsFolder() {
  const rootName = getConfig("festival_name", "Ganesha Chathurthi 2026");
  const root = getOrCreateFolder(DriveApp.getRootFolder(), rootName);
  return getOrCreateFolder(root, "Expense Receipts");
}

/** Fails soft (empty string) so a storage hiccup never blocks recording
 *  the expense itself — same pattern as savePaymentScreenshot(). */
function saveExpenseScreenshot(base64Image, mimeType) {
  if (!base64Image) return "";
  try {
    const bytes = Utilities.base64Decode(base64Image);
    const blob = Utilities.newBlob(bytes, mimeType || "image/jpeg", "expense-receipt");
    const file = getExpenseReceiptsFolder().createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    return file.getUrl();
  } catch (err) {
    return "";
  }
}

/** Open to any signed-in admin regardless of permission — whoever's
 *  holding the receipt right now can log it in a couple of taps
 *  instead of routing it through whoever has Finance access. Always
 *  starts PENDING; a Finance admin has to approve it before it counts
 *  anywhere (see getExpensesTotal/getExpenseSettlementSummary below).
 *  Viewing the itemized list or the settlement summary back is the
 *  Finance-gated part; this only ever appends. spenderMobile is
 *  required — it's the identity key that both the settlement summary
 *  and the resident's own My Stuff view group/look up by, same as
 *  every other mobile-as-identity pattern in this app. upiId is
 *  optional since some expenses get settled in cash instead. */
function recordExpense(volunteer, { date, amount, purpose, screenshot, mimeType, spenderName, spenderMobile, upiId }) {
  requireFields({ date, amount, purpose, spenderMobile }, ["date", "amount", "purpose", "spenderMobile"]);
  const amountNum = Number(amount);
  if (!(amountNum > 0)) throw new ApiError("Amount must be greater than 0", 400);
  if (!/^[6-9]\d{9}$/.test(spenderMobile)) {
    throw new ApiError("Enter a valid 10-digit mobile number for who spent this", 400);
  }

  return withLock(() => {
    const sheet = ensureExpensesSheet();
    const expense = {
      expense_id: generateExpenseId(),
      date,
      amount: amountNum,
      purpose,
      screenshot_url: screenshot ? saveExpenseScreenshot(screenshot, mimeType) : "",
      spender_name: spenderName || "",
      spender_mobile: spenderMobile,
      upi_id: upiId || "",
      status: "PENDING",
      admin_notes: "",
      recorded_by: volunteer.email,
      created_at: new Date(),
      payment_status: "UNPAID",
      paid_at: "",
    };
    appendObject(sheet, expense);
    logAudit(volunteer.email, "Recorded expense", "Expense", expense.expense_id, "", `₹${amountNum} — ${purpose}`);
    return expense;
  });
}

function listExpenses(volunteer) {
  requirePermission(volunteer, "Finance");
  return rowsToObjects(ensureExpensesSheet())
    .filter((e) => !["DRAFT", "CANCELLED"].includes(expenseStatus(e)))
    .map((e) => ({ ...e, status: expenseStatus(e), payment_status: paymentStatus(e) }))
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

function approveExpense(volunteer, expenseId) {
  requirePermission(volunteer, "Finance");
  return withLock(() => {
    const sheet = ensureExpensesSheet();
    const rowIndex = findRowIndexById(sheet, "expense_id", expenseId);
    if (rowIndex === -1) throw new ApiError("Unknown expense", 404);
    const before = getRowObject(sheet, rowIndex);
    updateRowFields(sheet, rowIndex, { status: "APPROVED" });
    invalidatePublicStatsCache();
    logAudit(volunteer.email, "Approved expense", "Expense", expenseId, expenseStatus(before), "APPROVED");
    return { expenseId, status: "APPROVED" };
  });
}

function rejectExpense(volunteer, expenseId, notes) {
  requirePermission(volunteer, "Finance");
  return withLock(() => {
    const sheet = ensureExpensesSheet();
    const rowIndex = findRowIndexById(sheet, "expense_id", expenseId);
    if (rowIndex === -1) throw new ApiError("Unknown expense", 404);
    const before = getRowObject(sheet, rowIndex);
    updateRowFields(sheet, rowIndex, { status: "REJECTED", admin_notes: notes || "" });
    logAudit(volunteer.email, "Rejected expense", "Expense", expenseId, expenseStatus(before), "REJECTED");
    return { expenseId, status: "REJECTED" };
  });
}

/** Groups every APPROVED-but-still-UNPAID expense by who's owed the
 *  money, so whoever's handling settlement can pay each spender/vendor
 *  once instead of tracking it line-by-line. Finance-only, same as the
 *  itemized list above. A still-PENDING expense isn't owed yet, so it's
 *  excluded until reviewed; a PAID one has already been settled (see
 *  settleSpender below), so it's excluded here too — this view is
 *  deliberately "what's still outstanding right now," not a running
 *  history. Rows without a spender_mobile (shouldn't happen going
 *  forward, but guards any pre-this-feature row) are skipped rather
 *  than grouped under a blank key. */
function getExpenseSettlementSummary(volunteer) {
  requirePermission(volunteer, "Finance");
  const expenses = rowsToObjects(ensureExpensesSheet()).filter(
    (e) => expenseStatus(e) === "APPROVED" && paymentStatus(e) === "UNPAID"
  );
  const byMobile = {};
  expenses.forEach((e) => {
    const mobile = String(e.spender_mobile || "").trim();
    if (!mobile) return;
    if (!byMobile[mobile]) {
      byMobile[mobile] = { spenderMobile: mobile, spenderName: "", upiId: "", total: 0, count: 0 };
    }
    byMobile[mobile].total += Number(e.amount || 0);
    byMobile[mobile].count += 1;
    // Rows iterate in sheet (chronological) order, so the last one
    // with a non-empty value wins — i.e. their most recent entry.
    if (e.spender_name) byMobile[mobile].spenderName = e.spender_name;
    if (e.upi_id) byMobile[mobile].upiId = e.upi_id;
  });
  return Object.values(byMobile).sort((a, b) => b.total - a.total);
}

/** Marks every currently APPROVED-and-UNPAID expense for one spender
 *  as PAID, in one shot — matches how a lump-sum settlement actually
 *  happens (e.g. a caterer who's run a tab across several days of
 *  meals, paid all at once at the end), rather than needing to tick
 *  off each day's entry individually. Doesn't touch getExpensesTotal —
 *  the expense already counted as real spending the moment it was
 *  approved; this only records that the cash has now actually moved. */
function settleSpender(volunteer, spenderMobile) {
  requirePermission(volunteer, "Finance");
  requireFields({ spenderMobile }, ["spenderMobile"]);
  return withLock(() => {
    const sheet = ensureExpensesSheet();
    const rows = rowsToObjects(sheet);
    const now = new Date();
    let settledCount = 0;
    let settledTotal = 0;
    rows.forEach((row, i) => {
      if (String(row.spender_mobile) !== String(spenderMobile)) return;
      if (expenseStatus(row) !== "APPROVED" || paymentStatus(row) !== "UNPAID") return;
      const rowIndex = i + 2; // rowsToObjects skips the header row
      updateRowFields(sheet, rowIndex, { payment_status: "PAID", paid_at: now });
      settledCount += 1;
      settledTotal += Number(row.amount || 0);
    });
    if (settledCount === 0) throw new ApiError("Nothing outstanding to settle for this spender", 400);
    logAudit(
      volunteer.email,
      "Settled expenses",
      "Expense",
      spenderMobile,
      "UNPAID",
      `${settledCount} expense(s), ₹${settledTotal}`
    );
    return { spenderMobile, settledCount, settledTotal };
  });
}

/** Resident's own recorded expenses for My Stuff — same mobile-as-
 *  identity-key pattern as listDonationsByMobile/listMyVolunteerStatus,
 *  public/unauthenticated by design, consistent with every other My
 *  Stuff lookup in this app. Includes status so they can see whether
 *  it's been approved yet. */
function listMyExpenses(mobile) {
  requireFields({ mobile }, ["mobile"]);
  return rowsToObjects(ensureExpensesSheet())
    .filter((e) => String(e.spender_mobile) === String(mobile))
    .filter((e) => !["DRAFT", "CANCELLED"].includes(expenseStatus(e)))
    .map((e) => ({ ...e, status: expenseStatus(e), payment_status: paymentStatus(e) }))
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

/** Unlike recordExpense/listExpenses above, this has no permission
 *  check of its own — it backs the always-visible Festival Summary
 *  total on the dashboard (spec §28), which every admin sees regardless
 *  of Finance, same as the public Home page already shows a collection
 *  total to residents. Only counts APPROVED expenses, same principle
 *  as SUCCESS_STATUSES for donations — a pending claim isn't confirmed
 *  spending yet. */
function getExpensesTotal() {
  return rowsToObjects(ensureExpensesSheet())
    .filter((e) => expenseStatus(e) === "APPROVED")
    .reduce((sum, e) => sum + Number(e.amount || 0), 0);
}

/** Money moved from a future-cost estimate that hasn't reached Spent yet
 *  (still a draft, or submitted and awaiting approval). Counted alongside
 *  the open estimates so the projection doesn't dip while an estimate is
 *  in transit; it drops out the moment the expense is approved (then it's
 *  in Spent) or rejected. */
function getInFlightEstimateExpensesTotal() {
  return rowsToObjects(ensureExpensesSheet())
    .filter((e) => e.from_estimate_id && ["DRAFT", "PENDING"].includes(expenseStatus(e)))
    .reduce((sum, e) => sum + Number(e.amount || 0), 0);
}

function getExpenseById(expenseId) {
  const sheet = ensureExpensesSheet();
  const rowIndex = findRowIndexById(sheet, "expense_id", expenseId);
  if (rowIndex === -1) throw new ApiError("Unknown expense", 404);
  return { sheet, rowIndex, expense: getRowObject(sheet, rowIndex) };
}

/** Edits a draft (an expense moved from a future-cost estimate). Open to
 *  any signed-in admin, like recording an expense. Only a DRAFT can be
 *  edited here — once submitted, changes go through Finance's review.
 *  Spender details can stay blank until the draft is submitted. */
function updateDraftExpense(volunteer, expenseId, { date, amount, purpose, spenderName, spenderMobile, upiId, screenshot, mimeType }) {
  requireFields({ expenseId, date, amount, purpose }, ["expenseId", "date", "amount", "purpose"]);
  const amountNum = Number(amount);
  if (!(amountNum > 0)) throw new ApiError("Amount must be greater than 0", 400);
  if (spenderMobile && !/^[6-9]\d{9}$/.test(spenderMobile)) {
    throw new ApiError("Enter a valid 10-digit mobile number for who spent this", 400);
  }

  return withLock(() => {
    const { sheet, rowIndex, expense } = getExpenseById(expenseId);
    if (expenseStatus(expense) !== "DRAFT") throw new ApiError("Only a draft can be edited here", 400);

    const fields = {
      date,
      amount: amountNum,
      purpose,
      spender_name: spenderName || "",
      spender_mobile: spenderMobile || "",
      upi_id: upiId || "",
    };
    if (screenshot) {
      const url = saveExpenseScreenshot(screenshot, mimeType);
      if (url) fields.screenshot_url = addReceiptUrl(expense.screenshot_url, url);
    }
    updateRowFields(sheet, rowIndex, fields);
    logAudit(
      volunteer.email,
      "Edited draft expense",
      "Expense",
      expenseId,
      `₹${expense.amount} — ${expense.purpose}`,
      `₹${amountNum} — ${purpose}`
    );
    invalidatePublicStatsCache();
    return Object.assign({}, expense, fields);
  });
}

/** Sends a finished draft to Finance for approval, the same PENDING state
 *  as any recorded expense. Needs the spender's mobile, which settlement
 *  and My Stuff group by. */
function submitDraftExpense(volunteer, expenseId) {
  requireFields({ expenseId }, ["expenseId"]);
  return withLock(() => {
    const { sheet, rowIndex, expense } = getExpenseById(expenseId);
    if (expenseStatus(expense) !== "DRAFT") throw new ApiError("This expense is not a draft", 400);
    if (!/^[6-9]\d{9}$/.test(String(expense.spender_mobile || ""))) {
      throw new ApiError("Add who spent this (a 10-digit mobile number) before submitting", 400);
    }
    updateRowFields(sheet, rowIndex, { status: "PENDING" });
    logAudit(volunteer.email, "Submitted draft expense", "Expense", expenseId, "DRAFT", "PENDING");
    invalidatePublicStatsCache();
    return { expenseId, status: "PENDING" };
  });
}

/** Backfills a missing receipt while reviewing — the spender sent it over
 *  WhatsApp instead of attaching it. Same shape as attachPaymentScreenshot
 *  for donations: Finance-gated, and it touches only screenshot_url, never
 *  the status, amount or payment fields, so it can't approve, change or
 *  re-count anything. Works on an expense in any live state, and adds to
 *  the receipts already there rather than replacing them. */
function attachExpenseReceipt(volunteer, expenseId, screenshot, mimeType) {
  requirePermission(volunteer, "Finance");
  requireFields({ expenseId, screenshot }, ["expenseId", "screenshot"]);
  return withLock(() => {
    const { sheet, rowIndex, expense } = getExpenseById(expenseId);
    if (expenseStatus(expense) === "CANCELLED") throw new ApiError("This expense was cancelled", 400);

    const url = saveExpenseScreenshot(screenshot, mimeType);
    if (!url) throw new ApiError("Could not save the receipt. Please try again.", 500);
    const all = addReceiptUrl(expense.screenshot_url, url);
    updateRowFields(sheet, rowIndex, { screenshot_url: all });
    logAudit(volunteer.email, "Attached expense receipt", "Expense", expenseId, "", url);
    return { expenseId, receiptUrl: url, receiptUrls: all };
  });
}

/** Removes an expense that shouldn't be there (a duplicate, a mistaken
 *  entry, a purchase that fell through). It's a soft delete: the row is
 *  kept as CANCELLED with the reason and an audit entry, and it drops out
 *  of every list and total. Only an unpaid expense can be deleted — once
 *  the money has been paid out, the record has to stay. Finance-gated,
 *  since deleting an approved expense lowers Spent. */
function deleteExpense(volunteer, expenseId, reason) {
  requirePermission(volunteer, "Finance");
  requireFields({ expenseId, reason }, ["expenseId", "reason"]);
  const why = String(reason).trim();
  if (!why) throw new ApiError("Enter a reason for deleting this expense", 400);

  return withLock(() => {
    const { sheet, rowIndex, expense } = getExpenseById(expenseId);
    const before = expenseStatus(expense);
    if (before === "CANCELLED") throw new ApiError("This expense was already deleted", 400);
    if (paymentStatus(expense) === "PAID") {
      throw new ApiError("This expense has already been paid, so it can't be deleted", 400);
    }
    const note = (expense.admin_notes ? expense.admin_notes + " | " : "") + `Deleted by ${volunteer.email}: ${why}`;
    updateRowFields(sheet, rowIndex, { status: "CANCELLED", admin_notes: note });
    logAudit(
      volunteer.email,
      "Deleted expense",
      "Expense",
      expenseId,
      `${before} ₹${expense.amount} — ${expense.purpose}`,
      `CANCELLED: ${why}`
    );
    invalidatePublicStatsCache();
    return { expenseId, status: "CANCELLED" };
  });
}
