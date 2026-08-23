/** Records sensitive volunteer actions (spec §32). */
function logAudit(volunteerEmail, action, entity, entityId, oldValue, newValue) {
  appendObject(getSheet(SHEETS.AUDIT_LOG), {
    timestamp: new Date(),
    volunteer_id: volunteerEmail || "system",
    action,
    entity,
    entity_id: entityId,
    old_value: oldValue !== undefined ? String(oldValue) : "",
    new_value: newValue !== undefined ? String(newValue) : "",
  });
}

function listAuditLog(volunteer) {
  requirePermission(volunteer, "Operations");
  return rowsToObjects(getSheet(SHEETS.AUDIT_LOG)).sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
}
