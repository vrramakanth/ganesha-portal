/** Volunteer authentication.
 *
 * The frontend signs the volunteer in with Google Identity Services and
 * sends the resulting Google ID token with every volunteer request. We
 * verify it server-side by asking Google's tokeninfo endpoint (Google
 * checks the signature/expiry for us — Apps Script has no RSA-verify
 * primitive of its own), confirm it was issued for our OAuth client, then
 * check the verified email against the Admins sheet. Hiding the volunteer
 * menu in the UI is NOT security — every volunteer-only route must call
 * this and check permissions server-side (spec §6, §38).
 */

function verifyVolunteerToken(idToken) {
  if (!idToken) throw new ApiError("Missing idToken", 401);

  const resp = UrlFetchApp.fetch(
    `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`,
    { muteHttpExceptions: true }
  );
  if (resp.getResponseCode() !== 200) {
    throw new ApiError("Invalid or expired Google sign-in token", 401);
  }
  const payload = JSON.parse(resp.getContentText());

  const clientId = getScriptProperty("GOOGLE_OAUTH_CLIENT_ID");
  if (payload.aud !== clientId) {
    throw new ApiError("Token was not issued for this app", 401);
  }
  if (payload.email_verified !== "true" && payload.email_verified !== true) {
    throw new ApiError("Google account email is not verified", 401);
  }

  const admin = findAdminByEmail(payload.email);
  if (!admin || String(admin.active).toUpperCase() !== "TRUE") {
    throw new ApiError("This Google account is not an authorized volunteer", 403);
  }

  return {
    email: payload.email,
    name: admin.name,
    permissions: String(admin.permissions || "")
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean),
  };
}

function findAdminByEmail(email) {
  const rows = rowsToObjects(getSheet(SHEETS.ADMINS));
  return rows.find((r) => String(r.email).toLowerCase() === String(email).toLowerCase());
}

/** Throws unless the authenticated volunteer holds the given permission
 *  area (Operations, Events, Dinner, Finance, Content — spec §4.2). */
function requirePermission(volunteer, area) {
  if (!volunteer.permissions.includes(area)) {
    throw new ApiError(`Missing "${area}" permission`, 403);
  }
}
