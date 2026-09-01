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
    return { volunteerId, area, approvedAreas: Array.from(approved), status };
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
