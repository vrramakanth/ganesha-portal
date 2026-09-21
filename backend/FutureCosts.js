/** Estimated future costs — a running log of anticipated spend not yet
 *  incurred (e.g. a caterer bill not yet paid), kept deliberately
 *  separate from the real Expenses ledger so a projection never gets
 *  mixed into money actually spent. Recording is open to any signed-in
 *  admin, same as Expenses (§30) — it's a planning note, not a claim
 *  that needs Finance approval, so there's no status/review workflow
 *  here at all. */

function ensureFutureCostsSheet() {
  const spreadsheet = getSpreadsheet();
  let sheet = spreadsheet.getSheetByName(SHEETS.FUTURE_COSTS);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(SHEETS.FUTURE_COSTS);
    const headers = SHEET_SCHEMAS[SHEETS.FUTURE_COSTS];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

const FUTURE_COSTS_CLOSED_KEY = "future_costs_closed";

/** Off unless explicitly set to "true". Once every estimate has been moved
 *  to Expenses (or discarded), Finance closes future costs for good. */
function isFutureCostsClosed() {
  return String(getConfig(FUTURE_COSTS_CLOSED_KEY, "false")).trim().toLowerCase() === "true";
}

/** Rows from before estimates could be moved or discarded have no status,
 *  which means they're still open. */
function estimateStatus(e) {
  const s = String(e.status || "").trim().toUpperCase();
  return ["OPEN", "MOVED", "DISCARDED"].includes(s) ? s : "OPEN";
}

function ensureEstimateColumns(sheet) {
  ["status", "expense_id", "closed_note"].forEach((c) => ensureColumn(sheet, c));
}

/** No receipt field — there's nothing to attach yet, the cost hasn't
 *  happened. Instead `vendorChecked` must be explicitly true: a
 *  required self-attestation ("I've checked with the vendor, this is
 *  close to actuals") rather than a free guess, so recording an
 *  estimate takes the same deliberate pause a real expense claim does. */
function recordFutureCost(volunteer, { date, amount, purpose, vendorChecked }) {
  if (isFutureCostsClosed()) throw new ApiError("Future costs are closed. Everything has moved to Expenses.", 409);
  requireFields({ date, amount, purpose }, ["date", "amount", "purpose"]);
  const amountNum = Number(amount);
  if (!(amountNum > 0)) throw new ApiError("Amount must be greater than 0", 400);
  if (vendorChecked !== true) {
    throw new ApiError("Confirm you've checked with the vendor before recording an estimate", 400);
  }

  return withLock(() => {
    const sheet = ensureFutureCostsSheet();
    const estimate = {
      estimate_id: generateFutureCostId(),
      date,
      amount: amountNum,
      purpose,
      vendor_checked: true,
      recorded_by: volunteer.email,
      created_at: new Date(),
    };
    appendObject(sheet, estimate);
    logAudit(volunteer.email, "Recorded future cost estimate", "FutureCosts", estimate.estimate_id, "", purpose);
    invalidatePublicStatsCache();
    return estimate;
  });
}

/** An estimate is a moving projection, so it can be refined as real
 *  quotes and bills come in. Editing asks for the same vendor-checked
 *  attestation as recording — a revised number should be as deliberate
 *  as the first — and the audit entry keeps the old amount, so the
 *  history of a projection isn't lost when it's overwritten. Open to any
 *  signed-in admin, same as recording. */
function updateFutureCost(volunteer, estimateId, { date, amount, purpose, vendorChecked }) {
  requireFields({ estimateId, date, amount, purpose }, ["estimateId", "date", "amount", "purpose"]);
  const amountNum = Number(amount);
  if (!(amountNum > 0)) throw new ApiError("Amount must be greater than 0", 400);
  if (vendorChecked !== true) {
    throw new ApiError("Confirm you've checked with the vendor before updating an estimate", 400);
  }

  return withLock(() => {
    const sheet = ensureFutureCostsSheet();
    const rowIndex = findRowIndexById(sheet, "estimate_id", estimateId);
    if (rowIndex === -1) throw new ApiError("Unknown estimate", 404);
    const before = getRowObject(sheet, rowIndex);
    if (estimateStatus(before) !== "OPEN") throw new ApiError("Only an open estimate can be edited", 400);

    updateRowFields(sheet, rowIndex, { date, amount: amountNum, purpose, vendor_checked: true });
    logAudit(
      volunteer.email,
      "Edited future cost estimate",
      "FutureCosts",
      estimateId,
      `₹${before.amount} · ${before.purpose}`,
      `₹${amountNum} · ${purpose}`
    );
    invalidatePublicStatsCache();
    return Object.assign({}, before, { date, amount: amountNum, purpose, vendor_checked: true });
  });
}

/** Every estimate with its status. An estimate that has been moved
 *  carries a summary of its expense: the full editable details while it's
 *  still a draft, just the status and amount once it's been submitted. */
function listFutureCosts(volunteer) {
  const expensesById = {};
  rowsToObjects(ensureExpensesSheet()).forEach((e) => (expensesById[e.expense_id] = e));

  return rowsToObjects(ensureFutureCostsSheet())
    .map((e) => {
      const status = estimateStatus(e);
      const out = Object.assign({}, e, { status });
      const expense = status === "MOVED" ? expensesById[e.expense_id] : null;
      if (expense) {
        const expenseState = expenseStatus(expense);
        out.expense =
          expenseState === "DRAFT"
            ? {
                expense_id: expense.expense_id,
                status: expenseState,
                date: expense.date,
                amount: Number(expense.amount || 0),
                purpose: expense.purpose,
                spender_name: expense.spender_name,
                spender_mobile: expense.spender_mobile,
                upi_id: expense.upi_id,
                screenshot_url: expense.screenshot_url,
              }
            : { expense_id: expense.expense_id, status: expenseState, amount: Number(expense.amount || 0), purpose: expense.purpose };
      }
      return out;
    })
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

/** Still-open estimates, plus money that has moved to Expenses but hasn't
 *  been approved into Spent yet, so the projection holds steady while an
 *  estimate is in transit. Discarded estimates, and expenses that are
 *  approved (now in Spent) or rejected, drop out. */
function getFutureCostsTotal() {
  const open = rowsToObjects(ensureFutureCostsSheet())
    .filter((e) => estimateStatus(e) === "OPEN")
    .reduce((sum, e) => sum + Number(e.amount || 0), 0);
  return open + getInFlightEstimateExpensesTotal();
}

function findEstimate(sheet, estimateId) {
  const rowIndex = findRowIndexById(sheet, "estimate_id", estimateId);
  if (rowIndex === -1) throw new ApiError("Unknown estimate", 404);
  return { rowIndex, estimate: getRowObject(sheet, rowIndex) };
}

/** The actual cost usually differs from the estimate (a tip, a negotiated
 *  discount), so moving creates a DRAFT expense pre-filled from the
 *  estimate that can be edited before it goes to Finance. The estimate
 *  is marked MOVED and linked to the draft. */
function moveFutureCostToExpense(volunteer, estimateId) {
  requireFields({ estimateId }, ["estimateId"]);
  return withLock(() => {
    const sheet = ensureFutureCostsSheet();
    const { rowIndex, estimate } = findEstimate(sheet, estimateId);
    if (estimateStatus(estimate) !== "OPEN") throw new ApiError("This estimate has already been moved or discarded", 400);

    const expense = {
      expense_id: generateExpenseId(),
      date: estimate.date,
      amount: Number(estimate.amount || 0),
      purpose: estimate.purpose,
      screenshot_url: "",
      spender_name: "",
      spender_mobile: "",
      upi_id: "",
      status: "DRAFT",
      admin_notes: "",
      recorded_by: volunteer.email,
      created_at: new Date(),
      payment_status: "UNPAID",
      paid_at: "",
      from_estimate_id: estimateId,
    };
    appendObject(ensureExpensesSheet(), expense);
    ensureEstimateColumns(sheet);
    updateRowFields(sheet, rowIndex, { status: "MOVED", expense_id: expense.expense_id });
    logAudit(volunteer.email, "Moved future cost to expense", "FutureCosts", estimateId, "OPEN", `MOVED to ${expense.expense_id}`);
    invalidatePublicStatsCache();
    return { estimateId, expenseId: expense.expense_id };
  });
}

/** For an estimate that will never materialise. Kept, not deleted, with the
 *  reason, and it stops counting toward future costs. */
function discardFutureCost(volunteer, estimateId, reason) {
  requireFields({ estimateId, reason }, ["estimateId", "reason"]);
  const why = String(reason).trim();
  if (!why) throw new ApiError("Enter a reason for discarding this estimate", 400);
  return withLock(() => {
    const sheet = ensureFutureCostsSheet();
    const { rowIndex, estimate } = findEstimate(sheet, estimateId);
    if (estimateStatus(estimate) !== "OPEN") throw new ApiError("This estimate has already been moved or discarded", 400);
    ensureEstimateColumns(sheet);
    updateRowFields(sheet, rowIndex, { status: "DISCARDED", closed_note: why });
    logAudit(volunteer.email, "Discarded future cost", "FutureCosts", estimateId, "OPEN", `DISCARDED: ${why}`);
    invalidatePublicStatsCache();
    return { estimateId, status: "DISCARDED" };
  });
}

/** Undoes a move while the expense is still a draft: the draft is
 *  cancelled and the estimate is open again. */
function returnDraftToEstimate(volunteer, estimateId) {
  requireFields({ estimateId }, ["estimateId"]);
  return withLock(() => {
    const sheet = ensureFutureCostsSheet();
    const { rowIndex, estimate } = findEstimate(sheet, estimateId);
    if (estimateStatus(estimate) !== "MOVED") throw new ApiError("This estimate has not been moved", 400);
    const found = getExpenseById(estimate.expense_id);
    if (expenseStatus(found.expense) !== "DRAFT") {
      throw new ApiError("Only a draft can be returned. This expense has already been submitted.", 400);
    }
    updateRowFields(found.sheet, found.rowIndex, { status: "CANCELLED", admin_notes: "Returned to estimate" });
    updateRowFields(sheet, rowIndex, { status: "OPEN", expense_id: "" });
    logAudit(volunteer.email, "Returned draft to future cost", "FutureCosts", estimateId, "MOVED", "OPEN");
    invalidatePublicStatsCache();
    return { estimateId, status: "OPEN" };
  });
}

/** Closing future costs is the end state: every estimate has become an
 *  expense or been discarded. Refused while any estimate is still open or
 *  any moved expense is still an unfinished draft. Finance-gated. */
function setFutureCostsClosed(volunteer, closed) {
  requirePermission(volunteer, "Finance");
  const value = closed === true || String(closed).toLowerCase() === "true" ? "true" : "false";
  if (value === "true") {
    const open = rowsToObjects(ensureFutureCostsSheet()).filter((e) => estimateStatus(e) === "OPEN").length;
    const drafts = rowsToObjects(ensureExpensesSheet()).filter(
      (e) => e.from_estimate_id && expenseStatus(e) === "DRAFT"
    ).length;
    if (open + drafts > 0) {
      throw new ApiError(
        `Move or discard the remaining ${open} estimate(s) and submit or return ${drafts} draft(s) first`,
        400
      );
    }
  }
  const before = getConfig(FUTURE_COSTS_CLOSED_KEY, "false");
  setConfig(FUTURE_COSTS_CLOSED_KEY, value);
  logAudit(
    volunteer.email,
    value === "true" ? "Closed future costs" : "Reopened future costs",
    "Configuration",
    FUTURE_COSTS_CLOSED_KEY,
    before,
    value
  );
  invalidatePublicStatsCache();
  return { closed: value === "true" };
}
