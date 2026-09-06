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

/** Every volunteer permission area (spec §4.2). There is only one
 *  public-facing Volunteer role — what an admin can actually do once
 *  signed in comes from their own Admins-sheet `permissions` cell
 *  (comma-separated, e.g. "Operations,Events,Dinner,Content"), read in
 *  permissionsForAdmin() below. A blank cell means every existing admin
 *  from before this was enforced keeps full access, rather than being
 *  silently locked out the moment this shipped. */
const ALL_PERMISSIONS = ["Operations", "Events", "Dinner", "Finance", "Content"];

function permissionsForAdmin(admin) {
  const raw = String(admin.permissions || "").trim();
  if (!raw) return ALL_PERMISSIONS;
  return raw
    .split(",")
    .map((p) => p.trim())
    .filter((p) => ALL_PERMISSIONS.includes(p));
}

/** Comma-separated emails, configurable via the Configuration sheet's
 *  `super_admin_email` key, that alone may approve volunteer applications
 *  (Volunteers.js). Defaults to mc.bwaoa@gmail.com, vrramakanth@gmail.com,
 *  and kalindeemi@gmail.com so this works with no Sheet edits required;
 *  override by adding a `super_admin_email` row (comma-separate multiple
 *  addresses). */
function getSuperAdminEmails() {
  return getConfig("super_admin_email", "mc.bwaoa@gmail.com,vrramakanth@gmail.com,kalindeemi@gmail.com")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

function requireSuperAdmin(volunteer) {
  if (!volunteer.isSuperAdmin) {
    throw new ApiError("Only the super admin can approve volunteers", 403);
  }
}

/** Test config: when TEST_MODE is "true", the sentinel idToken "TEST_TOKEN"
 *  signs in as a mock volunteer with every permission, skipping real Google
 *  verification and the Admins sheet lookup — see also the frontend's
 *  "Sign in as Test Volunteer" button in volunteer/layout.tsx. Set
 *  TEST_MODE=false (or delete the property) to close this off. */
function verifyVolunteerToken(idToken) {
  if (!idToken) throw new ApiError("Missing idToken", 401);

  if (isTestMode() && idToken === "TEST_TOKEN") {
    return {
      email: "test-volunteer@example.com",
      name: "Test Volunteer",
      permissions: ALL_PERMISSIONS,
      isSuperAdmin: true,
    };
  }

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
    permissions: permissionsForAdmin(admin),
    isSuperAdmin: getSuperAdminEmails().includes(payload.email.toLowerCase()),
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
