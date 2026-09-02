/** Volunteer sign-up and roster (spec §25–§26). Registering as a
 *  volunteer is separate from being granted portal login access — that
 *  requires an existing admin to add the person's email to the Admins
 *  sheet (spec §34 keeps "Volunteers" and "Admins/Permissions" distinct). */

function registerVolunteer({ name, mobile, email, block, flatNumber, areas, availability }) {
  requireFields({ name, mobile, block, flatNumber, areas }, [
    "name",
    "mobile",
    "block",
    "flatNumber",
    "areas",
  ]);
  validateBlock(block);
  const resident = upsertResident({ name, mobile, email, block, flatNumber });

  const volunteer = {
    volunteer_id: generateVolunteerId(),
    resident_id: resident.resident_id,
    name,
    mobile,
    block,
    flat_number: flatNumber,
    areas: Array.isArray(areas) ? areas.join(",") : areas,
    availability: availability || "",
    status: "PENDING",
    created_at: new Date(),
  };
  appendObject(getSheet(SHEETS.VOLUNTEERS), volunteer);
  return volunteer;
}

function listMyVolunteerStatus(mobile) {
  requireFields({ mobile }, ["mobile"]);
  return rowsToObjects(getSheet(SHEETS.VOLUNTEERS)).filter((v) => String(v.mobile) === String(mobile));
}

function splitList(value) {
  return String(value || "")
    .split(",")
    .map((a) => a.trim())
    .filter(Boolean);
}

/** Areas approved for this volunteer. Rows created before per-area
 *  approval existed have no "approved_areas" value — for those, fall
 *  back to "every area they applied for" if the row is already ACTIVE,
 *  so volunteers approved under the old all-or-nothing flow don't drop
 *  out of headcounts once this reads per-area instead of by status. */
function approvedAreasFor(v) {
  const explicit = splitList(v.approved_areas);
  if (explicit.length > 0) return explicit;
  return v.status === "ACTIVE" ? splitList(v.areas) : [];
}

function listVolunteers(volunteer) {
  requireSuperAdmin(volunteer);
  const volunteers = rowsToObjects(getSheet(SHEETS.VOLUNTEERS));

  const requirementsJson = getConfig("volunteer_requirements", "{}");
  let requirements = {};
  try {
    requirements = JSON.parse(requirementsJson);
  } catch (e) {
    requirements = {};
  }

  const filled = {};
  volunteers.forEach((v) => {
    approvedAreasFor(v).forEach((area) => {
      filled[area] = (filled[area] || 0) + 1;
    });
  });

  const areas = Array.from(new Set([...Object.keys(filled), ...Object.keys(requirements)])).map(
    (area) => ({ area, filled: filled[area] || 0, required: requirements[area] || 0 })
  );

  return {
    registered: volunteers.length,
    required: Object.values(requirements).reduce((sum, n) => sum + Number(n), 0),
    byArea: areas,
    volunteers,
  };
}

/** Config keys for the per-area guidelines sent along with the
 *  post-approval confirmation (spec §43 — operational text should be
 *  editable without a code change). Bhog/Prasadam defaults to a note
 *  about it being an offering to God, since satvik prep (no garlic/
 *  onion) is a real, easy-to-miss expectation. */
const SEVA_GUIDELINE_CONFIG_KEYS = {
  "Decorate Idol/Pooja/Aarti": "seva_guidelines_decorate",
  "Bhog/Prasadam/Food": "seva_guidelines_bhog",
};

const SEVA_GUIDELINE_DEFAULTS = {
  "Decorate Idol/Pooja/Aarti":
    "Please arrive a few minutes early and coordinate with other volunteers to check if everything needed is intact.",
  "Bhog/Prasadam/Food":
    "This is prepared as an offering to God, a traditional sattvic food, kindly avoid garlic, onion and non-vegetarian ingredients, use fresh ingredients, and keep the cooking area clean.",
};

/** Guideline text for an area, editable by an admin via Settings once
 *  it exists as a Configuration row — seeded with a sensible default
 *  the first time it's needed so it's visible there right away instead
 *  of requiring someone to add the row manually. Returns "" for an
 *  area with no guideline key. */
function getSevaGuidelines(area) {
  const key = SEVA_GUIDELINE_CONFIG_KEYS[area];
  if (!key) return "";
  const existing = getConfig(key, "");
  if (existing) return existing;
  const fallback = SEVA_GUIDELINE_DEFAULTS[area] || "";
  if (fallback) setConfig(key, fallback);
  return fallback;
}

/** Makes sure both areas' guideline Configuration rows exist (with
 *  defaults) so they show up in Settings for an admin to review/edit
 *  before any approval has actually happened — called from listConfig()
 *  rather than waiting for the first approveVolunteerArea() call. */
function seedSevaGuidelineDefaults() {
  Object.keys(SEVA_GUIDELINE_CONFIG_KEYS).forEach((area) => getSevaGuidelines(area));
}

/** Approves one area of a volunteer's application, independent of any
 *  other area they also applied for — a volunteer who signed up for
 *  both Decorate and Bhog/Prasadam might have a conflict in only one of
 *  them, and shouldn't have to be all-approved-or-all-rejected. Overall
 *  `status` only flips to ACTIVE once every applied area is approved;
 *  it stays PENDING while any area is still outstanding. */
function approveVolunteerArea(volunteer, volunteerId, area) {
  requireSuperAdmin(volunteer);
  requireFields({ volunteerId, area }, ["volunteerId", "area"]);
  return withLock(() => {
    const sheet = getSheet(SHEETS.VOLUNTEERS);
    ensureColumn(sheet, "approved_areas");
    const rowIndex = findRowIndexById(sheet, "volunteer_id", volunteerId);
    if (rowIndex === -1) throw new ApiError("Unknown volunteer", 404);
    const before = getRowObject(sheet, rowIndex);

    const requestedAreas = splitList(before.areas);
    if (!requestedAreas.includes(area)) {
      throw new ApiError("This volunteer didn't apply for that area", 400);
    }

    const approved = new Set(splitList(before.approved_areas));
    approved.add(area);
    const allApproved = requestedAreas.every((a) => approved.has(a));
    const status = allApproved ? "ACTIVE" : "PENDING";

    updateRowFields(sheet, rowIndex, { approved_areas: Array.from(approved).join(","), status });
    logAudit(volunteer.email, "Approved volunteer area", "Volunteer", volunteerId, `${before.status} (${area})`, status);
    return { volunteerId, area, approvedAreas: Array.from(approved), status, guidelines: getSevaGuidelines(area) };
  });
}

/** Removes one area from a volunteer's request outright rather than
 *  leaving it sitting as a pending entry — used when an admin asks the
 *  volunteer to reconsider (different date/session) so there's exactly
 *  one open request per area at a time instead of stale ones piling up
 *  once the admin's already reached out. If the volunteer wants to try
 *  again they sign up fresh; nothing here notifies them, the frontend
 *  handles that via WhatsApp. Leaves the row itself intact (with the
 *  area stripped) rather than deleting it, so the audit trail and any
 *  other area they applied for are preserved. */
function declineVolunteerArea(volunteer, volunteerId, area) {
  requireSuperAdmin(volunteer);
  requireFields({ volunteerId, area }, ["volunteerId", "area"]);
  return withLock(() => {
    const sheet = getSheet(SHEETS.VOLUNTEERS);
    const rowIndex = findRowIndexById(sheet, "volunteer_id", volunteerId);
    if (rowIndex === -1) throw new ApiError("Unknown volunteer", 404);
    const before = getRowObject(sheet, rowIndex);

    const remainingAreas = splitList(before.areas).filter((a) => a !== area);
    const remainingApproved = splitList(before.approved_areas).filter((a) => a !== area);
    const remainingAvailability = String(before.availability || "")
      .split(";")
      .map((s) => s.trim())
      .filter(Boolean)
      .filter((segment) => {
        const match = segment.match(/^(.+?):/);
        return !(match && match[1].trim() === area);
      })
      .join("; ");
    const status = remainingAreas.length > 0 && remainingAreas.every((a) => remainingApproved.includes(a))
      ? "ACTIVE"
      : "PENDING";

    updateRowFields(sheet, rowIndex, {
      areas: remainingAreas.join(","),
      approved_areas: remainingApproved.join(","),
      availability: remainingAvailability,
      status,
    });
    logAudit(volunteer.email, "Declined volunteer area", "Volunteer", volunteerId, `${before.status} (${area})`, status);
    return { volunteerId, area, remainingAreas };
  });
}

function activateVolunteer(volunteer, volunteerId) {
  requireSuperAdmin(volunteer);
  return withLock(() => {
    const sheet = getSheet(SHEETS.VOLUNTEERS);
    ensureColumn(sheet, "approved_areas");
    const rowIndex = findRowIndexById(sheet, "volunteer_id", volunteerId);
    if (rowIndex === -1) throw new ApiError("Unknown volunteer", 404);
    const before = getRowObject(sheet, rowIndex);
    updateRowFields(sheet, rowIndex, { status: "ACTIVE", approved_areas: before.areas });
    logAudit(volunteer.email, "Activated volunteer", "Volunteer", volunteerId, before.status, "ACTIVE");
    return { volunteerId, status: "ACTIVE" };
  });
}
