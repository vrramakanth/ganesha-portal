/** Lightweight expense logging — deliberately simpler than the fuller
 *  vendor/budget tracking sketched in spec §29. As the event gets
 *  closer, volunteers need to jot down a purchase in a couple of taps,
 *  not fill out a procurement form — date, amount, purpose, optional
 *  receipt photo. Gated behind Finance, same as the rest of the
 *  money-handling surface. */

/** Self-heals the sheet and its header row so this works immediately
 *  even before anyone's re-run setupSheets() for this feature — same
 *  principle as ensureColumn() elsewhere in this codebase. */
function ensureExpensesSheet() {
  const spreadsheet = getSpreadsheet();
  let sheet = spreadsheet.getSheetByName(SHEETS.EXPENSES);
  if (!sheet) sheet = spreadsheet.insertSheet(SHEETS.EXPENSES);

  const headers = ["expense_id", "date", "amount", "purpose", "screenshot_url", "recorded_by", "created_at"];
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
 *  the itemized list back is the Finance-gated part (listExpenses
 *  below); this only ever appends. */
function recordExpense(volunteer, { date, amount, purpose, screenshot, mimeType }) {
  requireFields({ date, amount, purpose }, ["date", "amount", "purpose"]);
  const amountNum = Number(amount);
  if (!(amountNum > 0)) throw new ApiError("Amount must be greater than 0", 400);

  return withLock(() => {
    const sheet = ensureExpensesSheet();
    const expense = {
      expense_id: generateExpenseId(),
      date,
      amount: amountNum,
      purpose,
      screenshot_url: screenshot ? saveExpenseScreenshot(screenshot, mimeType) : "",
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

/** Unlike recordExpense/listExpenses above, this has no permission
 *  check of its own — it backs the always-visible Festival Summary
 *  total on the dashboard (spec §28), which every admin sees regardless
 *  of Finance, same as the public Home page already shows a collection
 *  total to residents. Only the itemized list and the ability to add
 *  an expense are Finance-gated. */
function getExpensesTotal() {
  return rowsToObjects(ensureExpensesSheet()).reduce((sum, e) => sum + Number(e.amount || 0), 0);
}
