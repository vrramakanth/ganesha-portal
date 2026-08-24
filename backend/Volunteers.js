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
  volunteers
    .filter((v) => v.status === "ACTIVE")
    .forEach((v) => {
      String(v.areas)
        .split(",")
        .map((a) => a.trim())
        .filter(Boolean)
        .forEach((area) => {
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

function activateVolunteer(volunteer, volunteerId) {
  requireSuperAdmin(volunteer);
  return withLock(() => {
    const sheet = getSheet(SHEETS.VOLUNTEERS);
    const rowIndex = findRowIndexById(sheet, "volunteer_id", volunteerId);
    if (rowIndex === -1) throw new ApiError("Unknown volunteer", 404);
    const before = getRowObject(sheet, rowIndex);
    updateRowFields(sheet, rowIndex, { status: "ACTIVE" });
    logAudit(volunteer.email, "Activated volunteer", "Volunteer", volunteerId, before.status, "ACTIVE");
    return { volunteerId, status: "ACTIVE" };
  });
}
