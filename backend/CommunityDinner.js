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
const COMMUNITY_DINNER_COUNT_CACHE_KEY = "community_dinner_public_count";
// 10 min — was 5, doubled alongside stats.public's TTL as the
// operational spreadsheet grew; same public-aggregate caching
// principle (§13, §55).
const COMMUNITY_DINNER_COUNT_CACHE_SECONDS = 600;

const COMMUNITY_DINNER_OPEN_KEY = "community_dinner_registration_open";

/** Open unless explicitly set to "false" in Configuration, so a missing
 *  row (the state before anyone's ever closed it) means open. */
function isCommunityDinnerRegistrationOpen() {
  return String(getConfig(COMMUNITY_DINNER_OPEN_KEY, "true")).trim().toLowerCase() !== "false";
}

/** Closing only stops NEW registrations (enforced in
 *  registerCommunityDinner, not just hidden in the UI). Someone already
 *  mid-registration can still pay for their guests, existing
 *  registrations stay visible, and admins can still edit them. */
function setCommunityDinnerRegistrationOpen(volunteer, open) {
  requirePermission(volunteer, "Dinner");
  const value = open === true || String(open).toLowerCase() === "true" ? "true" : "false";
  const before = getConfig(COMMUNITY_DINNER_OPEN_KEY, "true");
  setConfig(COMMUNITY_DINNER_OPEN_KEY, value);
  logAudit(
    volunteer.email,
    value === "true" ? "Opened Community Dinner registration" : "Closed Community Dinner registration",
    "Configuration",
    COMMUNITY_DINNER_OPEN_KEY,
    before,
    value
  );
  return { open: value === "true" };
}

/** Households added by an admin after registrations closed all go to one
 *  counter, whatever their block, so the block-based split stays stable.
 *  The marker is the "Added by ..." note addCommunityDinnerRegistration
 *  writes; listCommunityDinnerRegistrations turns it into counter_override
 *  so the frontend never has to know about the note. */
const COMMUNITY_DINNER_LATE_COUNTER = 4;
const COMMUNITY_DINNER_LATE_NOTE_PREFIX = "Added by ";

function isLateCommunityDinnerRegistration(registration) {
  return String(registration.admin_notes || "").indexOf(COMMUNITY_DINNER_LATE_NOTE_PREFIX) === 0;
}

const COMMUNITY_DINNER_COUNTER_MAP_KEY = "community_dinner_counter_map";

/** The saved block -> counter map, or {} if none is saved (or it's unreadable). */
function getCommunityDinnerCounterMap() {
  try {
    const parsed = JSON.parse(getConfig(COMMUNITY_DINNER_COUNTER_MAP_KEY, "") || "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (e) {
    return {};
  }
}
const COMMUNITY_DINNER_COUNTER_COUNT = 4;

/** Which plate-distribution counter (1-4) serves each block, stored as a
 *  JSON object {"A":1,"B":1,...} in Configuration. Public by design
 *  (getFestivalInfo) — it maps a block to a counter and carries no
 *  household data. Every active block must be assigned, so no resident
 *  is ever shown "no counter". */
function saveCommunityDinnerCounterMap(volunteer, map) {
  requirePermission(volunteer, "Dinner");
  if (!map || typeof map !== "object") throw new ApiError("Counter assignments are required", 400);

  const clean = {};
  listBlocks().forEach((b) => {
    const counter = Number(map[b.block_name]);
    if (!Number.isInteger(counter) || counter < 1 || counter > COMMUNITY_DINNER_COUNTER_COUNT) {
      throw new ApiError(
        `Assign block ${b.block_name} to a counter from 1 to ${COMMUNITY_DINNER_COUNTER_COUNT}`,
        400
      );
    }
    clean[b.block_name] = counter;
  });

  const before = getConfig(COMMUNITY_DINNER_COUNTER_MAP_KEY, "");
  setConfig(COMMUNITY_DINNER_COUNTER_MAP_KEY, JSON.stringify(clean));
  logAudit(
    volunteer.email,
    "Updated Community Dinner counter assignments",
    "Configuration",
    COMMUNITY_DINNER_COUNTER_MAP_KEY,
    before,
    JSON.stringify(clean)
  );
  return clean;
}

const COMMUNITY_DINNER_TALLY_KEY = "community_dinner_plate_tally";

/** Plates issued at each counter, as reported by the counter volunteers.
 *  Stored as one JSON setting; the last save wins, and every save is
 *  audited with the old and new numbers. */
function getCommunityDinnerPlateTally(volunteer) {
  requirePermission(volunteer, "Dinner");
  try {
    const parsed = JSON.parse(getConfig(COMMUNITY_DINNER_TALLY_KEY, "") || "{}");
    return parsed && typeof parsed === "object" && parsed.counters ? parsed : { counters: {}, updatedBy: "", updatedAt: "" };
  } catch (e) {
    return { counters: {}, updatedBy: "", updatedAt: "" };
  }
}

function saveCommunityDinnerPlateTally(volunteer, counters) {
  requirePermission(volunteer, "Dinner");
  if (!counters || typeof counters !== "object") throw new ApiError("Plate counts are required", 400);
  const clean = {};
  for (let c = 1; c <= COMMUNITY_DINNER_COUNTER_COUNT; c++) {
    const n = Number(counters[c]);
    if (!Number.isInteger(n) || n < 0) throw new ApiError(`Enter a whole number of plates for Counter ${c}`, 400);
    clean[c] = n;
  }
  const before = getConfig(COMMUNITY_DINNER_TALLY_KEY, "");
  const value = { counters: clean, updatedBy: volunteer.email, updatedAt: new Date().toISOString() };
  setConfig(COMMUNITY_DINNER_TALLY_KEY, JSON.stringify(value));
  logAudit(
    volunteer.email,
    "Updated Community Dinner plate tally",
    "Configuration",
    COMMUNITY_DINNER_TALLY_KEY,
    before,
    JSON.stringify(clean)
  );
  return value;
}

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

/** One-time registration, then locked once it's genuinely settled —
 *  any change after that goes through an admin via
 *  editCommunityDinnerRegistration; there's no self-service edit,
 *  since a wrong headcount has a real cost attached once guests are
 *  involved. "Settled" specifically means CONFIRMED (done) or
 *  MANUAL_REVIEW (already submitted, awaiting a decision) — those two
 *  throw. REJECTED/CANCELLED don't count as registered at all (that
 *  attempt just didn't work out), and PAYMENT_PENDING isn't locked
 *  either: nothing's been paid or reviewed yet, so a resubmit (e.g.
 *  from a browser that lost the saved profile the resume flow relies
 *  on) just picks the existing pending registration back up instead
 *  of erroring. */
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

  // Closed: only an already-started (PAYMENT_PENDING) registration may be
  // picked back up, so nobody's left stranded mid-payment. Checked before
  // upsertResident so a refused attempt never touches the Residents sheet.
  if (!isCommunityDinnerRegistrationOpen()) {
    const pendingWhileClosed = rowsToObjects(ensureCommunityDinnerSheet()).find(
      (r) =>
        r.status === "PAYMENT_PENDING" &&
        (String(r.mobile) === String(mobile) ||
          (String(r.block) === String(block) && String(r.flat_number) === String(flatNumber)))
    );
    if (pendingWhileClosed) return pendingWhileClosed;
    throw new ApiError(
      "Community Dinner registrations are now closed. Please message an admin on WhatsApp if you still need to register.",
      409
    );
  }

  // Every other registration flow (Donations, Dinner, Events,
  // Volunteers) upserts Residents so the details show up in future
  // lookups (e.g. the "Lookup" autofill button) — Community Dinner had
  // been the one outlier that didn't, so a resident who only ever
  // registered here had nothing on file to autofill from next time.
  upsertResident({ name: residentName, mobile, block, flatNumber });

  return withLock(() => {
    const sheet = ensureCommunityDinnerSheet();
    const existing = rowsToObjects(sheet);
    const matches = (r) =>
      String(r.mobile) === String(mobile) ||
      (String(r.block) === String(block) && String(r.flat_number) === String(flatNumber));

    const pending = existing.find((r) => r.status === "PAYMENT_PENDING" && matches(r));
    if (pending) return pending;

    const locked = existing.some((r) => (r.status === "CONFIRMED" || r.status === "MANUAL_REVIEW") && matches(r));
    if (locked) {
      throw new ApiError(
        "This mobile number or flat is already registered for the Community Dinner. Go to My Stuff in the app to message an admin directly if you need to make a change.",
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
    invalidateCommunityDinnerCountCache();
    return registration;
  });
}

/** Admin-only late registration, for a resident who reached out (e.g.
 *  over WhatsApp) after registrations closed. Works whether registration
 *  is open or closed. No guests -> confirmed immediately, same as the
 *  resident flow. Guests -> a real payment is owed, so the admin records
 *  its reference (screenshot optional) and it goes to MANUAL_REVIEW for a
 *  Finance admin to verify, never straight to CONFIRMED (Decision 4).
 *  Refuses if the mobile or flat already has a live registration — that
 *  one should be edited instead of duplicated. */
function addCommunityDinnerRegistration(
  volunteer,
  { residentName, mobile, block, flatNumber, adults, children, guestAdults, guestChildren, reference, screenshot, mimeType }
) {
  requirePermission(volunteer, "Dinner");
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
  const guestAmount = communityDinnerGuestAmount(guestAdultsNum, guestChildrenNum);
  if (guestAmount > 0) requireFields({ reference }, ["reference"]);

  upsertResident({ name: residentName, mobile, block, flatNumber });

  return withLock(() => {
    const sheet = ensureCommunityDinnerSheet();
    // Flats compare numerically: the sheet stores "007" as 7, so a plain
    // string compare would miss the very duplicates this check exists for.
    const sameFlat = (r) =>
      String(r.block).trim().toUpperCase() === String(block).trim().toUpperCase() &&
      Number(r.flat_number) === Number(flatNumber);
    const live = rowsToObjects(sheet).find(
      (r) =>
        ["CONFIRMED", "MANUAL_REVIEW", "PAYMENT_PENDING"].includes(r.status) &&
        (String(r.mobile) === String(mobile) || sameFlat(r))
    );
    if (live) {
      throw new ApiError(
        `This mobile number or flat is already registered (${live.registration_id}). Edit that registration instead.`,
        409
      );
    }

    const now = new Date();
    const registration = {
      registration_id: generateCommunityDinnerId(),
      resident_name: String(residentName).trim(),
      mobile,
      block,
      flat_number: flatNumber,
      adults: adultsNum,
      children: childrenNum,
      guest_adults: guestAdultsNum,
      guest_children: guestChildrenNum,
      guest_amount: guestAmount,
      payment_reference: guestAmount > 0 ? String(reference).trim() : "",
      payment_screenshot_url: guestAmount > 0 && screenshot ? savePaymentScreenshot(screenshot, mimeType) : "",
      status: guestAmount > 0 ? "MANUAL_REVIEW" : "CONFIRMED",
      reviewed_by: guestAmount > 0 ? "" : volunteer.email,
      reviewed_at: guestAmount > 0 ? "" : now,
      admin_notes: COMMUNITY_DINNER_LATE_NOTE_PREFIX + volunteer.email,
      created_at: now,
      updated_at: now,
    };
    appendObject(sheet, registration);
    logAudit(
      volunteer.email,
      "Added Community Dinner registration",
      "CommunityDinner",
      registration.registration_id,
      "",
      registration.status
    );
    invalidateCommunityDinnerCountCache();
    return registration;
  });
}

/** Public headcount for the Home page's live "X already registered"
 *  figure — sums adults + children + guest_adults + guest_children
 *  across every registration that hasn't fallen through (REJECTED/
 *  CANCELLED don't represent someone actually coming, so they're
 *  excluded the same way listMyCommunityDinnerRegistration treats
 *  them as dead ends). Cached the same way as stats.public (§13, §55)
 *  since this is an aggregate-only, non-personal number — no names,
 *  blocks or flats are exposed. */
function getCommunityDinnerPublicCount() {
  const cache = CacheService.getScriptCache();
  const cached = cache.get(COMMUNITY_DINNER_COUNT_CACHE_KEY);
  if (cached != null) return communityDinnerPublicCount(Number(cached));

  const rows = rowsToObjects(ensureCommunityDinnerSheet()).filter(
    (r) => r.status !== "REJECTED" && r.status !== "CANCELLED"
  );
  const registered = rows.reduce(
    (sum, r) =>
      sum +
      Number(r.adults || 0) +
      Number(r.children || 0) +
      Number(r.guest_adults || 0) +
      Number(r.guest_children || 0),
    0
  );

  cache.put(COMMUNITY_DINNER_COUNT_CACHE_KEY, String(registered), COMMUNITY_DINNER_COUNT_CACHE_SECONDS);
  return communityDinnerPublicCount(registered);
}

/** Open/closed and the block -> counter map are read live (config is
 *  already cached and invalidated on write); only the headcount is cached
 *  here, so a saved counter change shows up immediately. */
function communityDinnerPublicCount(registered) {
  const wrappedUp = isFestivalWrappedUp();
  return {
    registered,
    open: isCommunityDinnerRegistrationOpen(),
    wrappedUp,
    // Once the festival is over there's no counter to find, so the public
    // map is withheld; every "Find your counter" surface hides when empty.
    counters: wrappedUp ? {} : getCommunityDinnerCounterMap(),
    lateCounter: COMMUNITY_DINNER_LATE_COUNTER,
  };
}

function invalidateCommunityDinnerCountCache() {
  CacheService.getScriptCache().remove(COMMUNITY_DINNER_COUNT_CACHE_KEY);
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
    invalidateCommunityDinnerCountCache();
    return { registrationId, status: "CANCELLED" };
  });
}

/** Admin cancellation with a mandatory reason — for duplicates and other
 *  corrections. Unlike the resident's own cancel above, this works on a
 *  CONFIRMED registration. The row is kept (status CANCELLED, reason
 *  appended to admin_notes, audit entry), never deleted, so it can be
 *  traced or restored, and it drops out of the headcount. */
function adminCancelCommunityDinnerRegistration(volunteer, registrationId, reason) {
  requirePermission(volunteer, "Dinner");
  requireFields({ registrationId, reason }, ["registrationId", "reason"]);
  const why = String(reason).trim();
  if (!why) throw new ApiError("Enter a reason for cancelling", 400);

  return withLock(() => {
    const sheet = ensureCommunityDinnerSheet();
    const rowIndex = findRowIndexById(sheet, "registration_id", registrationId);
    if (rowIndex === -1) throw new ApiError("Unknown registration", 404);
    const before = getRowObject(sheet, rowIndex);
    if (["CANCELLED", "REJECTED"].includes(before.status)) {
      throw new ApiError(`This registration is already ${before.status.toLowerCase()}`, 400);
    }

    const note = (before.admin_notes ? before.admin_notes + " | " : "") + `Cancelled by ${volunteer.email}: ${why}`;
    updateRowFields(sheet, rowIndex, { status: "CANCELLED", admin_notes: note, updated_at: new Date() });
    logAudit(
      volunteer.email,
      "Cancelled Community Dinner registration",
      "CommunityDinner",
      registrationId,
      before.status,
      `CANCELLED: ${why}`
    );
    invalidateCommunityDinnerCountCache();
    return { registrationId, status: "CANCELLED" };
  });
}

/** Public — for My Stuff, same mobile-as-identity pattern as
 *  everything else in this app. At most one row per mobile, given the
 *  one-time lock above. */
function listMyCommunityDinnerRegistration(mobile) {
  requireFields({ mobile }, ["mobile"]);
  const matches = rowsToObjects(ensureCommunityDinnerSheet()).filter((r) => String(r.mobile) === String(mobile));
  if (matches.length === 0) return null;
  // A resident can now have more than one row here (a rejected/
  // cancelled attempt no longer blocks trying again), so prefer
  // whichever is still active over a past dead end, and the most
  // recent among ties — this is what both My Stuff and the resident
  // page's "resume where I left off" flow rely on.
  const active = matches.filter((r) => r.status !== "REJECTED" && r.status !== "CANCELLED");
  const pool = active.length > 0 ? active : matches;
  const mine = pool.reduce((latest, r) => (new Date(r.created_at) > new Date(latest.created_at) ? r : latest));

  // Admin notes hold admin emails and internal reasons — never for a resident.
  const resident = Object.assign({}, mine);
  delete resident.admin_notes;
  delete resident.reviewed_by;
  const map = getCommunityDinnerCounterMap();
  resident.counter = isLateCommunityDinnerRegistration(mine)
    ? COMMUNITY_DINNER_LATE_COUNTER
    : map[String(mine.block).trim().toUpperCase()] || null;
  return resident;
}

/** Full roster — Dinner permission, for general admin visibility and
 *  as the lookup list behind editCommunityDinnerRegistration below. */
function listCommunityDinnerRegistrations(volunteer) {
  requirePermission(volunteer, "Dinner");
  return rowsToObjects(ensureCommunityDinnerSheet())
    .map((r) => Object.assign({}, r, { counter_override: isLateCommunityDinnerRegistration(r) ? COMMUNITY_DINNER_LATE_COUNTER : "" }))
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

/** Payment verification is Finance-gated, same as every other payment
 *  review in this app (Decision 4) — separate from the Dinner-gated
 *  general list/edit above, same "money needs Finance, ops don't"
 *  split already used for Expenses. */
function listCommunityDinnerPaymentsForReview(volunteer) {
  requirePermission(volunteer, "Finance");
  return rowsToObjects(ensureCommunityDinnerSheet()).filter((r) => r.status === "MANUAL_REVIEW");
}

/** Backfills a screenshot for a registration whose resident sent it
 *  directly over WhatsApp instead of through the app's own upload step
 *  — same pattern as Donations' attachPaymentScreenshot. Touches only
 *  payment_screenshot_url (plus updated_at), never status or amount,
 *  so it's pure reconciliation, not a payment decision. */
function attachCommunityDinnerScreenshot(volunteer, registrationId, screenshot, mimeType) {
  requirePermission(volunteer, "Finance");
  requireFields({ registrationId, screenshot }, ["registrationId", "screenshot"]);
  return withLock(() => {
    const sheet = ensureCommunityDinnerSheet();
    const rowIndex = findRowIndexById(sheet, "registration_id", registrationId);
    if (rowIndex === -1) throw new ApiError("Unknown registration", 404);

    const url = savePaymentScreenshot(screenshot, mimeType);
    if (!url) throw new ApiError("Could not save screenshot — please try again", 500);

    updateRowFields(sheet, rowIndex, { payment_screenshot_url: url, updated_at: new Date() });
    logAudit(volunteer.email, "Attached payment screenshot", "CommunityDinner", registrationId, "", url);
    return { registrationId, screenshotUrl: url };
  });
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
    invalidateCommunityDinnerCountCache();
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
    invalidateCommunityDinnerCountCache();
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
    invalidateCommunityDinnerCountCache();
    return Object.assign({}, before, update, { registration_id: registrationId });
  });
}
