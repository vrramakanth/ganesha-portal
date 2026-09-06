/** Lightweight expense logging — deliberately simpler than the fuller
 *  vendor/budget tracking sketched in spec §29. As the event gets
 *  closer, volunteers need to jot down a purchase in a couple of taps,
 *  not fill out a procurement form — date, amount, purpose, optional
 *  receipt photo, plus who spent it and their UPI ID so it can be
 *  repaid. Gated behind Finance, same as the rest of the money-handling
 *  surface — except recording itself, see recordExpense() below. */

/** Self-heals the sheet and its header row so this works immediately
 *  even before anyone's re-run setupSheets() for this feature — same
 *  principle as ensureColumn() elsewhere in this codebase. */
function ensureExpensesSheet() {
  const spreadsheet = getSpreadsheet();
  let sheet = spreadsheet.getSheetByName(SHEETS.EXPENSES);
  if (!sheet) sheet = spreadsheet.insertSheet(SHEETS.EXPENSES);

  const headers = [
    "expense_id", "date", "amount", "purpose", "screenshot_url",
    "spender_name", "spender_mobile", "upi_id", "recorded_by", "created_at",
  ];
  if (sheet.getLastColumn() === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  } else {
    headers.forEach((h) => ensureColumn(sheet, h));
  }
  return sheet;
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
 *  instead of routing it through whoever has Finance access. Viewing
 *  the itemized list or the settlement summary back is the
 *  Finance-gated part (below); this only ever appends. spenderMobile is
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
      recorded_by: volunteer.email,
      created_at: new Date(),
    };
    appendObject(sheet, expense);
    logAudit(volunteer.email, "Recorded expense", "Expense", expense.expense_id, "", `₹${amountNum} — ${purpose}`);
    return expense;
  });
}

function listExpenses(volunteer) {
  requirePermission(volunteer, "Finance");
  return rowsToObjects(ensureExpensesSheet()).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

/** Groups every recorded expense by who actually spent the money, so
 *  whoever's handling reimbursement can settle each volunteer once
 *  instead of tracking it line-by-line. Finance-only, same as the
 *  itemized list above. Rows without a spender_mobile (shouldn't
 *  happen going forward, but guards any pre-this-feature row) are
 *  skipped rather than grouped under a blank key. */
function getExpenseSettlementSummary(volunteer) {
  requirePermission(volunteer, "Finance");
  const expenses = rowsToObjects(ensureExpensesSheet());
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

/** Resident's own recorded expenses for My Stuff — same mobile-as-
 *  identity-key pattern as listDonationsByMobile/listMyVolunteerStatus,
 *  public/unauthenticated by design, consistent with every other My
 *  Stuff lookup in this app. */
function listMyExpenses(mobile) {
  requireFields({ mobile }, ["mobile"]);
  return rowsToObjects(ensureExpensesSheet())
    .filter((e) => String(e.spender_mobile) === String(mobile))
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

/** Unlike recordExpense/listExpenses above, this has no permission
 *  check of its own — it backs the always-visible Festival Summary
 *  total on the dashboard (spec §28), which every admin sees regardless
 *  of Finance, same as the public Home page already shows a collection
 *  total to residents. Only the itemized list, the settlement summary,
 *  and the ability to add an expense are Finance-gated (recording
 *  itself is open to all, see recordExpense above). */
function getExpensesTotal() {
  return rowsToObjects(ensureExpensesSheet()).reduce((sum, e) => sum + Number(e.amount || 0), 0);
}
