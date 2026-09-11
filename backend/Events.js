/** Festival events (spec §14–§16). Paid event registration is Phase 2
 *  (spec §48) — only free events can be registered for here; a paid event
 *  should stay DRAFT until that flow exists. */

/** Fixed nomination types offered for Cultural events. This is the master
 *  menu an organizer picks from per-event (via sub_categories below), not
 *  a set every Cultural event must offer — a Bhajan event and a general
 *  Cultural Program don't need the same options. */
const CULTURAL_SUB_CATEGORIES = ["Dance", "Vocal/Singing", "Instrument", "Recitation", "Other"];

/** Renamed option labels — a value already saved on an event's
 *  sub_categories (or on a past registration's sub_category) under an
 *  old name still needs to keep matching after the rename, without
 *  requiring every existing event to be re-saved by hand. */
const SUB_CATEGORY_ALIASES = { Vocal: "Vocal/Singing" };
function normalizeSubCategory(name) {
  return SUB_CATEGORY_ALIASES[name] || name;
}

/** Comma-joins a validated subset of CULTURAL_SUB_CATEGORIES for storage,
 *  or "" for a non-Cultural event — used by both create and edit so the
 *  column always reflects the current category. */
function buildSubCategories(category, subCategories) {
  if (category !== "Cultural") return "";
  const list = (Array.isArray(subCategories) ? subCategories : []).map(normalizeSubCategory);
  const invalid = list.filter((c) => !CULTURAL_SUB_CATEGORIES.includes(c));
  if (invalid.length) throw new ApiError(`Invalid sub-category: ${invalid.join(", ")}`, 400);
  return list.join(",");
}

const EVENTS_CACHE_KEY = "events_rows";
const EVENTS_CACHE_SECONDS = 30; // short — capacity/status changes should show up quickly

/** ensureColumn only runs on an actual cache miss — it only ever needs to
 *  touch the sheet once (the column either already exists or gets added
 *  here), so there's no reason to pay that extra sheet touch on every
 *  cached read too. */
function getEventRows_() {
  const cache = CacheService.getScriptCache();
  const cached = cache.get(EVENTS_CACHE_KEY);
  if (cached) return JSON.parse(cached);
  const sheet = getSheet(SHEETS.EVENTS);
  ensureColumn(sheet, "sub_categories");
  const rows = rowsToObjects(sheet);
  cache.put(EVENTS_CACHE_KEY, JSON.stringify(rows), EVENTS_CACHE_SECONDS);
  return rows;
}

/** Every event write (create/edit/status change) calls this immediately,
 *  so the TTL above is only a ceiling for anything that might miss an
 *  invalidation call — normal reads always see the latest write. */
function invalidateEventsCache() {
  CacheService.getScriptCache().remove(EVENTS_CACHE_KEY);
}

function listEvents() {
  return getEventRows_();
}

function createEvent(volunteer, payload) {
  requirePermission(volunteer, "Events");
  requireFields(payload, ["name", "date", "startTime", "location", "category"]);

  const sheet = getSheet(SHEETS.EVENTS);
  ensureColumn(sheet, "sub_categories");

  const event = {
    event_id: `EVT-${Utilities.getUuid().slice(0, 8)}`,
    name: payload.name,
    description: payload.description || "",
    date: payload.date,
    start_time: payload.startTime,
    end_time: payload.endTime || "",
    location: payload.location,
    category: payload.category,
    age_group: payload.ageGroup || "",
    capacity: payload.capacity || "",
    registration_required: payload.registrationRequired ? "TRUE" : "FALSE",
    registration_deadline: payload.registrationDeadline || "",
    fee: payload.fee || 0,
    status: payload.status || "DRAFT",
    contact_volunteer: volunteer.email,
    token_code: payload.tokenCode || "",
    sub_categories: buildSubCategories(payload.category, payload.subCategories),
  };
  appendObject(sheet, event);
  invalidateEventsCache();
  logAudit(volunteer.email, "Created event", "Event", event.event_id, "", event.name);
  return event;
}

/** Edits an existing event's details — the "Publish/Close/Cancel" buttons
 *  remain the only way to change status, so this deliberately never
 *  touches it, to keep lifecycle transitions on a single path. Lets an
 *  organizer fix a mistake (e.g. a Cultural event published with the
 *  wrong sub-categories) without deleting and recreating the event and
 *  losing its existing registrations. */
function updateEvent(volunteer, eventId, payload) {
  requirePermission(volunteer, "Events");
  requireFields(payload, ["name", "date", "startTime", "location", "category"]);

  return withLock(() => {
    const sheet = getSheet(SHEETS.EVENTS);
    ensureColumn(sheet, "sub_categories");
    const rowIndex = findRowIndexById(sheet, "event_id", eventId);
    if (rowIndex === -1) throw new ApiError("Unknown event", 404);
    const before = getRowObject(sheet, rowIndex);

    const fields = {
      name: payload.name,
      description: payload.description || "",
      date: payload.date,
      start_time: payload.startTime,
      end_time: payload.endTime || "",
      location: payload.location,
      category: payload.category,
      age_group: payload.ageGroup || "",
      capacity: payload.capacity || "",
      registration_required: payload.registrationRequired ? "TRUE" : "FALSE",
      registration_deadline: payload.registrationDeadline || "",
      fee: payload.fee || 0,
      sub_categories: buildSubCategories(payload.category, payload.subCategories),
    };
    updateRowFields(sheet, rowIndex, fields);
    invalidateEventsCache();
    logAudit(volunteer.email, "Edited event", "Event", eventId, before.name, fields.name);
    return Object.assign({}, before, fields, { event_id: eventId });
  });
}

function getEvent(eventId) {
  const event = getEventRows_().find((e) => e.event_id === eventId);
  if (!event) throw new ApiError("Unknown event", 404);
  return event;
}

const EVENT_STATUSES = ["DRAFT", "OPEN", "FULL", "CLOSED", "CANCELLED", "COMPLETED"];

/** Publish/Close/Cancel on the admin Events page all funnel through
 *  here — a created event otherwise stays DRAFT (and so invisible to
 *  residents, per listEvents' status !== "DRAFT" filter on the
 *  frontend) forever, with no in-app way to change that (spec §14's
 *  status lifecycle existed on paper but had no way to actually move
 *  through it). CANCELLED/COMPLETED are treated as terminal — nothing
 *  meaningful to do with an event that's already been called off or
 *  has already happened. */
function updateEventStatus(volunteer, eventId, status) {
  requirePermission(volunteer, "Events");
  if (!EVENT_STATUSES.includes(status)) throw new ApiError(`Invalid status: ${status}`, 400);

  return withLock(() => {
    const sheet = getSheet(SHEETS.EVENTS);
    const rowIndex = findRowIndexById(sheet, "event_id", eventId);
    if (rowIndex === -1) throw new ApiError("Unknown event", 404);
    const before = getRowObject(sheet, rowIndex);
    if (before.status === "CANCELLED" || before.status === "COMPLETED") {
      throw new ApiError(`Cannot change status of a ${before.status.toLowerCase()} event`, 400);
    }

    updateRowFields(sheet, rowIndex, { status });
    invalidateEventsCache();
    logAudit(volunteer.email, "Updated event status", "Event", eventId, before.status, status);
    return { eventId, status };
  });
}

function countRegistrations(eventId) {
  return rowsToObjects(getSheet(SHEETS.EVENT_REGISTRATIONS)).filter(
    (r) => r.event_id === eventId && r.status !== "CANCELLED"
  ).length;
}

/** `mobile` is the registering resident's own contact — it's how "My
 *  Registrations" looks results up (spec §6: no OTP session yet, so
 *  mobile doubles as the identity key everywhere). `parentName`/
 *  `parentMobile` are kept separate and optional, for the children's-event
 *  form fields in spec §15 — they're display-only, not used for lookup. */
function registerForEvent({ eventId, participantName, participantAge, block, flatNumber, mobile, parentName, parentMobile, subCategory }) {
  requireFields({ eventId, participantName, block, flatNumber, mobile }, [
    "eventId",
    "participantName",
    "block",
    "flatNumber",
    "mobile",
  ]);
  const event = getEvent(eventId);
  if (event.status !== "OPEN") throw new ApiError("Registration is not open for this event", 400);
  if (Number(event.fee || 0) > 0) {
    throw new ApiError("Paid event registration is not yet supported", 400);
  }
  if (event.capacity && countRegistrations(eventId) >= Number(event.capacity)) {
    throw new ApiError("REGISTRATION_FULL", 409);
  }
  validateBlock(block);

  const normalizedSubCategory = normalizeSubCategory(subCategory);
  if (event.category === "Cultural") {
    const allowed = String(event.sub_categories || "")
      .split(",")
      .map((s) => normalizeSubCategory(s.trim()))
      .filter(Boolean);
    const options = allowed.length ? allowed : CULTURAL_SUB_CATEGORIES;
    if (!options.includes(normalizedSubCategory)) {
      throw new ApiError(`Pick a performance type: ${options.join(", ")}`, 400);
    }
  }

  const resident = upsertResident({ name: participantName, mobile, block, flatNumber });

  const sheet = getSheet(SHEETS.EVENT_REGISTRATIONS);
  ensureColumn(sheet, "sub_category");
  const registration = {
    registration_id: generateRegistrationId(),
    event_id: eventId,
    resident_id: resident.resident_id,
    participant_name: participantName,
    participant_age: participantAge || "",
    block,
    flat_number: flatNumber,
    mobile,
    parent_name: parentName || "",
    parent_mobile: parentMobile || "",
    sub_category: event.category === "Cultural" ? normalizedSubCategory : "",
    status: "CONFIRMED",
    check_in_at: "",
    created_at: new Date(),
  };
  appendObject(sheet, registration);
  return registration;
}

function listRegistrationsByMobile(mobile) {
  requireFields({ mobile }, ["mobile"]);
  return rowsToObjects(getSheet(SHEETS.EVENT_REGISTRATIONS)).filter((r) => String(r.mobile) === String(mobile));
}

function listRegistrationsForEvent(volunteer, eventId) {
  requirePermission(volunteer, "Events");
  return rowsToObjects(getSheet(SHEETS.EVENT_REGISTRATIONS)).filter((r) => r.event_id === eventId);
}

/** Idempotent — scanning an already-checked-in registration reports
 *  ALREADY_CHECKED_IN rather than erroring or double-counting (spec §16). */
function checkInRegistration(volunteer, registrationId) {
  requirePermission(volunteer, "Events");
  return withLock(() => {
    const sheet = getSheet(SHEETS.EVENT_REGISTRATIONS);
    const rowIndex = findRowIndexById(sheet, "registration_id", registrationId);
    if (rowIndex === -1) throw new ApiError("Unknown registration", 404);
    const registration = getRowObject(sheet, rowIndex);

    if (registration.check_in_at) {
      return { registrationId, alreadyCheckedIn: true, checkedInAt: registration.check_in_at };
    }
    const now = new Date();
    updateRowFields(sheet, rowIndex, { check_in_at: now });
    return { registrationId, alreadyCheckedIn: false, checkedInAt: now };
  });
}
