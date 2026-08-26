/** The portal avoids asking for information repeatedly (spec §6) — a
 *  resident is identified by mobile number and upserted on every
 *  donation/registration so their name/block/flat stay current. */
function upsertResident({ name, mobile, email, block, flatNumber }) {
  requireFields({ name, mobile, block, flatNumber }, ["name", "mobile", "block", "flatNumber"]);
  validateMobile(mobile);

  return withLock(() => {
    const sheet = getSheet(SHEETS.RESIDENTS);
    const rowIndex = findRowIndexById(sheet, "mobile", mobile);
    const now = new Date();

    if (rowIndex === -1) {
      const resident = {
        resident_id: generateResidentId(),
        name,
        mobile,
        email: email || "",
        block,
        flat_number: flatNumber,
        created_at: now,
        updated_at: now,
      };
      appendObject(sheet, resident);
      return resident;
    }

    updateRowFields(sheet, rowIndex, {
      name,
      email: email || "",
      block,
      flat_number: flatNumber,
      updated_at: now,
    });
    return getRowObject(sheet, rowIndex);
  });
}

function findResidentByMobile(mobile) {
  const rows = rowsToObjects(getSheet(SHEETS.RESIDENTS));
  return rows.find((r) => String(r.mobile) === String(mobile));
}

/** Mobile is the resident's identity key (used for all "my stuff" lookups
 *  by mobile-only, no OTP — spec §6), so a garbage value isn't just bad
 *  data, it's a lookup the resident can never find their own donations/
 *  tokens under again. Standard Indian mobile format: 10 digits, first
 *  digit 6-9. Frontend (MobileInput) already restricts entry to digits;
 *  this is the actual source of truth (Decision: never trust the client
 *  alone, same as Block validation below). */
function validateMobile(mobile) {
  if (!/^[6-9]\d{9}$/.test(String(mobile))) {
    throw new ApiError("Enter a valid 10-digit mobile number", 400);
  }
}

function validateBlock(block) {
  const blocks = rowsToObjects(getSheet(SHEETS.BLOCKS));
  const match = blocks.find(
    (b) => b.block_name === block && String(b.active).toUpperCase() === "TRUE"
  );
  if (!match) throw new ApiError(`Invalid or inactive block: ${block}`, 400);
}
