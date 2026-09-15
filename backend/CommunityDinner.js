/** Community Dinner registration — Phase 1 (registration only; the
 *  actual dinner-day token/redemption side is Phase 2, built later once
 *  registrations are done).
 *
 *  Deliberately a separate module from the generic Dinner/Entitlement
 *  engine (Dinner.js), not an extension of it — the shape here (free
 *  household headcount, a chargeable guest add-on billed at actuals,
 *  a mandatory payment receipt, and a one-time registration that's
 *  locked afterward) doesn't map cleanly onto that generic engine, and
 *  forcing it in would make both harder to reason about. */

const GUEST_ADULT_PRICE = 200;
const GUEST_CHILD_PRICE = 100;

function ensureCommunityDinnerSheet() {
  const spreadsheet = getSpreadsheet();
  let sheet = spreadsheet.getSheetByName(SHEETS.COMMUNITY_DINNER);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(SHEETS.COMMUNITY_DINNER);
    const headers = SHEET_SCHEMAS[SHEETS.COMMUNITY_DINNER];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function communityDinnerGuestAmount(guestAdults, guestChildren) {
  return Number(guestAdults || 0) * GUEST_ADULT_PRICE + Number(guestChildren || 0) * GUEST_CHILD_PRICE;
}

/** One-time registration, then locked — a second attempt for the same
 *  mobile OR the same block+flat is rejected outright (closes the
 *  loophole of retrying with a typo'd mobile). Any change after that
 *  goes through an admin via editCommunityDinnerRegistration; there's
 *  no self-service edit, since a wrong headcount has a real cost
 *  attached once guests are involved. */
function registerCommunityDinner({ residentName, mobile, block, flatNumber, adults, children, guestAdults, guestChildren }) {
  requireFields({ residentName, mobile, block, flatNumber }, ["residentName", "mobile", "block", "flatNumber"]);
  validateMobile(mobile);
  validateBlock(block);

  const adultsNum = Number(adults) || 0;
  const childrenNum = Number(children) || 0;
  const guestAdultsNum = Number(guestAdults) || 0;
  const guestChildrenNum = Number(guestChildren) || 0;
  if (adultsNum + childrenNum + guestAdultsNum + guestChildrenNum <= 0) {
    throw new ApiError("Please add at least one person attending", 400);
  }

  return withLock(() => {
    const sheet = ensureCommunityDinnerSheet();
    const existing = rowsToObjects(sheet);
    const alreadyRegistered = existing.some(
      (r) =>
        String(r.mobile) === String(mobile) ||
        (String(r.block) === String(block) && String(r.flat_number) === String(flatNumber))
    );
    if (alreadyRegistered) {
      throw new ApiError(
        "This mobile number or flat has already registered for the Community Dinner. To make a change, please message an admin on WhatsApp.",
        409
      );
    }

    const guestAmount = communityDinnerGuestAmount(guestAdultsNum, guestChildrenNum);
    const registration = {
      registration_id: generateCommunityDinnerId(),
      resident_name: residentName,
      mobile,
      block,
      flat_number: flatNumber,
      adults: adultsNum,
      children: childrenNum,
      guest_adults: guestAdultsNum,
      guest_children: guestChildrenNum,
      guest_amount: guestAmount,
      payment_reference: "",
      payment_screenshot_url: "",
      // No guests -> nothing to verify, so it's confirmed immediately.
      // Guests -> a real payment is owed, so it waits on that first.
      status: guestAmount > 0 ? "PAYMENT_PENDING" : "CONFIRMED",
      reviewed_by: "",
      reviewed_at: "",
      admin_notes: "",
      created_at: new Date(),
      updated_at: new Date(),
    };
    appendObject(sheet, registration);
    return registration;
  });
}

/** The screenshot is mandatory here — unlike donations.submitReference,
 *  where a typed reference alone is enough. A resident with no receipt
 *  to attach has nothing valid to submit; the registration just stays
 *  PAYMENT_PENDING until they can. */
function submitCommunityDinnerPayment({ registrationId, reference, screenshot, mimeType }) {
  requireFields({ registrationId, reference, screenshot }, ["registrationId", "reference", "screenshot"]);

  return withLock(() => {
    const sheet = ensureCommunityDinnerSheet();
    const rowIndex = findRowIndexById(sheet, "registration_id", registrationId);
    if (rowIndex === -1) throw new ApiError("Unknown registration", 404);
    const registration = getRowObject(sheet, rowIndex);

    if (registration.status === "CANCELLED") {
      throw new ApiError("This registration was cancelled", 400);
    }
    if (registration.status !== "PAYMENT_PENDING") {
      return { registrationId, status: registration.status };
    }

    updateRowFields(sheet, rowIndex, {
      payment_reference: reference,
      payment_screenshot_url: savePaymentScreenshot(screenshot, mimeType),
      status: "MANUAL_REVIEW",
      updated_at: new Date(),
    });
    return { registrationId, status: "MANUAL_REVIEW" };
  });
}

function cancelCommunityDinnerRegistration(registrationId) {
  requireFields({ registrationId }, ["registrationId"]);
  return withLock(() => {
    const sheet = ensureCommunityDinnerSheet();
    const rowIndex = findRowIndexById(sheet, "registration_id", registrationId);
    if (rowIndex === -1) throw new ApiError("Unknown registration", 404);
    const registration = getRowObject(sheet, rowIndex);
    if (registration.status === "CONFIRMED") {
      throw new ApiError("This registration is already confirmed — please message an admin on WhatsApp to cancel it", 400);
    }
    updateRowFields(sheet, rowIndex, { status: "CANCELLED", updated_at: new Date() });
    return { registrationId, status: "CANCELLED" };
  });
}

/** Public — for My Stuff, same mobile-as-identity pattern as
 *  everything else in this app. At most one row per mobile, given the
 *  one-time lock above. */
function listMyCommunityDinnerRegistration(mobile) {
  requireFields({ mobile }, ["mobile"]);
  return rowsToObjects(ensureCommunityDinnerSheet()).find((r) => String(r.mobile) === String(mobile)) || null;
}

/** Full roster — Dinner permission, for general admin visibility and
 *  as the lookup list behind editCommunityDinnerRegistration below. */
function listCommunityDinnerRegistrations(volunteer) {
  requirePermission(volunteer, "Dinner");
  return rowsToObjects(ensureCommunityDinnerSheet()).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

/** Payment verification is Finance-gated, same as every other payment
 *  review in this app (Decision 4) — separate from the Dinner-gated
 *  general list/edit above, same "money needs Finance, ops don't"
 *  split already used for Expenses. */
function listCommunityDinnerPaymentsForReview(volunteer) {
  requirePermission(volunteer, "Finance");
  return rowsToObjects(ensureCommunityDinnerSheet()).filter((r) => r.status === "MANUAL_REVIEW");
}

function approveCommunityDinnerPayment(volunteer, registrationId) {
  requirePermission(volunteer, "Finance");
  return withLock(() => {
    const sheet = ensureCommunityDinnerSheet();
    const rowIndex = findRowIndexById(sheet, "registration_id", registrationId);
    if (rowIndex === -1) throw new ApiError("Unknown registration", 404);
    const before = getRowObject(sheet, rowIndex);
    updateRowFields(sheet, rowIndex, {
      status: "CONFIRMED",
      reviewed_by: volunteer.email,
      reviewed_at: new Date(),
      updated_at: new Date(),
    });
    logAudit(volunteer.email, "Approved Community Dinner payment", "CommunityDinner", registrationId, before.status, "CONFIRMED");
    return { registrationId, status: "CONFIRMED" };
  });
}

function rejectCommunityDinnerPayment(volunteer, registrationId, notes) {
  requirePermission(volunteer, "Finance");
  return withLock(() => {
    const sheet = ensureCommunityDinnerSheet();
    const rowIndex = findRowIndexById(sheet, "registration_id", registrationId);
    if (rowIndex === -1) throw new ApiError("Unknown registration", 404);
    const before = getRowObject(sheet, rowIndex);
    updateRowFields(sheet, rowIndex, {
      status: "REJECTED",
      reviewed_by: volunteer.email,
      reviewed_at: new Date(),
      admin_notes: notes || "",
      updated_at: new Date(),
    });
    logAudit(volunteer.email, "Rejected Community Dinner payment", "CommunityDinner", registrationId, before.status, "REJECTED");
    return { registrationId, status: "REJECTED" };
  });
}

/** The only way a locked registration ever changes — a resident
 *  messages an admin on WhatsApp (My Stuff has a pre-filled "Request a
 *  Change" link for this) and the admin applies it here. Recomputes
 *  guest_amount if either guest count changed; does not re-trigger a
 *  payment step even if the amount goes up — reconciling a
 *  higher/lower guest payment after the fact is a manual, off-app
 *  conversation, not something this form automates. */
function editCommunityDinnerRegistration(volunteer, registrationId, fields) {
  requirePermission(volunteer, "Dinner");
  return withLock(() => {
    const sheet = ensureCommunityDinnerSheet();
    const rowIndex = findRowIndexById(sheet, "registration_id", registrationId);
    if (rowIndex === -1) throw new ApiError("Unknown registration", 404);
    const before = getRowObject(sheet, rowIndex);

    const update = {};
    ["resident_name", "mobile", "block", "flat_number", "status", "admin_notes"].forEach((key) => {
      if (fields[key] !== undefined) update[key] = fields[key];
    });
    ["adults", "children", "guest_adults", "guest_children"].forEach((key) => {
      if (fields[key] !== undefined) update[key] = Number(fields[key]) || 0;
    });
    if (fields.guest_adults !== undefined || fields.guest_children !== undefined) {
      const guestAdultsNum = fields.guest_adults !== undefined ? Number(fields.guest_adults) || 0 : Number(before.guest_adults) || 0;
      const guestChildrenNum =
        fields.guest_children !== undefined ? Number(fields.guest_children) || 0 : Number(before.guest_children) || 0;
      update.guest_amount = communityDinnerGuestAmount(guestAdultsNum, guestChildrenNum);
    }
    update.updated_at = new Date();

    updateRowFields(sheet, rowIndex, update);
    logAudit(volunteer.email, "Edited Community Dinner registration", "CommunityDinner", registrationId, "", "edited");
    return Object.assign({}, before, update, { registration_id: registrationId });
  });
}
