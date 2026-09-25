/** Namma Habba module registry.
 *
 * A "module" is a toggleable slice of the ROUTES table (Code.js) that a
 * given festival deployment may or may not need — e.g. Navratri has no
 * Meal module, an early Karnataka Rajyotsava deployment may not need
 * Sponsorships turned on yet. Announcements, Feedback, Bugs, auth,
 * Configuration, Backup and the Audit Log are never gated here — they're
 * always included regardless of which festival this is (spec claude.md
 * "one-portal-any-event" discussion draft's "always included" list).
 *
 * This is deliberately a single flat on/off flag per module, not a
 * per-sub-feature toggle — donations_open / festival_wrapped_up /
 * community_dinner_registration_open / future_costs_closed (Donations.js,
 * Config.js, CommunityDinner.js, FutureCosts.js) already handle "is this
 * *currently* open," which is a different, complementary question from "is
 * this module part of this festival at all."
 */

const MODULE_KEYS = [
  "donations",
  "sponsorships",
  "events",
  "meal",
  "guests",
  "volunteers",
  "expenses",
];

const ENABLED_MODULES_KEY = "enabled_modules";

/** This deployment's current live shape — every module this Ganesha
 *  Chathurthi 2026 festival actually uses is on; Guests (not yet built
 *  anywhere in this codebase) is off. Used both as the seeded default
 *  (Setup.js) and to fill in any module key missing from a stored value,
 *  the same self-heal pattern as volunteer_requirements/seva guidelines. */
const DEFAULT_ENABLED_MODULES = {
  donations: true,
  sponsorships: true,
  events: true,
  meal: true,
  guests: false,
  volunteers: true,
  expenses: true,
};

function getEnabledModules() {
  const raw = getConfig(ENABLED_MODULES_KEY, "");
  let stored = {};
  if (raw) {
    try {
      stored = JSON.parse(raw);
    } catch (e) {
      stored = {};
    }
  }
  const merged = {};
  MODULE_KEYS.forEach((key) => {
    merged[key] = typeof stored[key] === "boolean" ? stored[key] : DEFAULT_ENABLED_MODULES[key];
  });
  return merged;
}

function isModuleEnabled(moduleKey) {
  return getEnabledModules()[moduleKey] === true;
}

/** Thrown by the router (Code.js) before a gated route's handler runs. */
function requireModuleEnabled(moduleKey) {
  if (!isModuleEnabled(moduleKey)) {
    throw new ApiError("This feature isn't enabled for this festival.", 404);
  }
}

/** Not money, so Operations alone is enough — same tier as every other
 *  non-financial Configuration key (Config.js FINANCE_ONLY_CONFIG_KEYS). */
function setEnabledModules(volunteer, updates) {
  requirePermission(volunteer, "Operations");
  const before = getEnabledModules();
  const next = Object.assign({}, before);
  MODULE_KEYS.forEach((key) => {
    if (typeof updates[key] === "boolean") next[key] = updates[key];
  });
  setConfig(ENABLED_MODULES_KEY, JSON.stringify(next));
  logAudit(
    volunteer.email,
    "Updated enabled modules",
    "Configuration",
    ENABLED_MODULES_KEY,
    JSON.stringify(before),
    JSON.stringify(next)
  );
  return next;
}
