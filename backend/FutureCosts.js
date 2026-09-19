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

/** No receipt field — there's nothing to attach yet, the cost hasn't
 *  happened. Instead `vendorChecked` must be explicitly true: a
 *  required self-attestation ("I've checked with the vendor, this is
 *  close to actuals") rather than a free guess, so recording an
 *  estimate takes the same deliberate pause a real expense claim does. */
function recordFutureCost(volunteer, { date, amount, purpose, vendorChecked }) {
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

function listFutureCosts(volunteer) {
  return rowsToObjects(ensureFutureCostsSheet()).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

function getFutureCostsTotal() {
  return rowsToObjects(ensureFutureCostsSheet()).reduce((sum, e) => sum + Number(e.amount || 0), 0);
}
