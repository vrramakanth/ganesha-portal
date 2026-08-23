/** Festival events (spec §14–§16). Paid event registration is Phase 2
 *  (spec §48) — only free events can be registered for here; a paid event
 *  should stay DRAFT until that flow exists. */

function listEvents() {
  return rowsToObjects(getSheet(SHEETS.EVENTS));
}

function createEvent(volunteer, payload) {
  requirePermission(volunteer, "Events");
  requireFields(payload, ["name", "date", "startTime", "location", "category"]);

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
  };
  appendObject(getSheet(SHEETS.EVENTS), event);
  logAudit(volunteer.email, "Created event", "Event", event.event_id, "", event.name);
  return event;
}

function getEvent(eventId) {
  const event = rowsToObjects(getSheet(SHEETS.EVENTS)).find((e) => e.event_id === eventId);
  if (!event) throw new ApiError("Unknown event", 404);
  return event;
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
function registerForEvent({ eventId, participantName, participantAge, block, flatNumber, mobile, parentName, parentMobile }) {
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

  const resident = upsertResident({ name: participantName, mobile, block, flatNumber });

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
    status: "CONFIRMED",
    check_in_at: "",
    created_at: new Date(),
  };
  appendObject(getSheet(SHEETS.EVENT_REGISTRATIONS), registration);
  return registration;
}

function listRegistrationsByMobile(mobile) {
  requireFields({ mobile }, ["mobile"]);
  return rowsToObjects(getSheet(SHEETS.EVENT_REGISTRATIONS)).filter((r) => r.mobile === mobile);
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
