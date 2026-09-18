/** The portal avoids asking for information repeatedly (spec §6) — a
 *  resident is identified by mobile number and upserted on every
 *  donation/registration so their name/block/flat stay current. */
function upsertResident({ name, mobile, email, block, flatNumber }) {
  requireFields({ name, mobile, block, flatNumber }, ["name", "mobile", "block", "flatNumber"]);
  validateMobile(mobile);

  return withLock(() => {
    const sheet = getSheet(SHEETS.RESIDENTS);
    const rowIndex = findRowIndexById(sheet, "mobile", mobile);
    const now = new Date();

    if (rowIndex === -1) {
      const resident = {
        resident_id: generateResidentId(),
        name,
        mobile,
        email: email || "",
        block,
        flat_number: flatNumber,
        created_at: now,
        updated_at: now,
      };
      appendObject(sheet, resident);
      return resident;
    }

    updateRowFields(sheet, rowIndex, {
      name,
      email: email || "",
      block,
      flat_number: flatNumber,
      updated_at: now,
    });
    return getRowObject(sheet, rowIndex);
  });
}

function findResidentByMobile(mobile) {
  const rows = rowsToObjects(getSheet(SHEETS.RESIDENTS));
  return rows.find((r) => String(r.mobile) === String(mobile));
}

/** Public, resident-triggered lookup (a "Lookup" button next to the
 *  mobile field on forms like Community Dinner) so a returning
 *  resident doesn't retype name/block/flat that's already on file —
 *  same identity model as My Stuff (mobile only, no OTP), just used
 *  to pre-fill a form instead of list past activity. Returns null
 *  rather than erroring when nobody's on file yet, since that's the
 *  ordinary first-time-resident case, not a failure. */
function lookupResident(mobile) {
  validateMobile(mobile);
  const resident = findResidentByMobile(mobile);
  if (!resident) return null;
  return { name: resident.name, block: resident.block, flatNumber: resident.flat_number };
}

/** Mobile is the resident's identity key (used for all "my stuff" lookups
 *  by mobile-only, no OTP — spec §6), so a garbage value isn't just bad
 *  data, it's a lookup the resident can never find their own donations/
 *  tokens under again. Standard Indian mobile format: 10 digits, first
 *  digit 6-9. Frontend (MobileInput) already restricts entry to digits;
 *  this is the actual source of truth (Decision: never trust the client
 *  alone, same as Block validation below). */
function validateMobile(mobile) {
  if (!/^[6-9]\d{9}$/.test(String(mobile))) {
    throw new ApiError("Enter a valid 10-digit mobile number", 400);
  }
}

function validateBlock(block) {
  const blocks = rowsToObjects(getSheet(SHEETS.BLOCKS));
  const match = blocks.find(
    (b) => b.block_name === block && String(b.active).toUpperCase() === "TRUE"
  );
  if (!match) throw new ApiError(`Invalid or inactive block: ${block}`, 400);
}

/** My Stuff's PIN gate — a lightweight second factor on top of
 *  mobile-as-identity (spec §6's known open gap), added because typing
 *  any valid-format mobile number alone currently unlocks that
 *  resident's full donation/registration/dinner/expense history. This
 *  doesn't verify phone ownership like real OTP would — it verifies
 *  "the same person who set this PIN is back" — but it closes the
 *  actual failure mode that matters most today: a bare guess of a
 *  10-digit number. A mobile with no Residents row at all skips the
 *  gate entirely (getResidentPinStatus below) since there's nothing to
 *  protect yet.
 *
 *  Hashed with a per-mobile salt via SHA-256 rather than stored in the
 *  clear — not because it needs to resist an attacker with direct
 *  Sheet access (a 4-digit PIN's keyspace is tiny either way, and the
 *  Sheet is only ever readable by already-trusted admins, same trust
 *  boundary every other field in this backend relies on), just so a
 *  glance at the sheet doesn't hand out a plaintext PIN for free. */
const PIN_MAX_ATTEMPTS = 5;
const PIN_LOCKOUT_SECONDS = 900; // 15 min

function hashPin(pin, mobile) {
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, `${pin}:${mobile}`);
  return bytes.map((b) => ((b < 0 ? b + 256 : b).toString(16).padStart(2, "0"))).join("");
}

function validatePinFormat(pin) {
  if (!/^\d{4}$/.test(String(pin || ""))) {
    throw new ApiError("PIN must be exactly 4 digits", 400);
  }
}

/** Public — called before My Stuff shows anything. Reveals only
 *  whether an account exists and whether a PIN is set for it, nothing
 *  else about the resident. */
function getResidentPinStatus(mobile) {
  requireFields({ mobile }, ["mobile"]);
  validateMobile(mobile);
  const resident = findResidentByMobile(mobile);
  if (!resident) return { hasAccount: false, hasPin: false };
  return { hasAccount: true, hasPin: !!resident.pin_hash };
}

/** First-time setup only — throws if one's already set; from then on
 *  only resetResidentPin (admin, via the Forgot PIN WhatsApp path) can
 *  clear it so a new one can be chosen. */
function setResidentPin(mobile, pin) {
  requireFields({ mobile, pin }, ["mobile", "pin"]);
  validateMobile(mobile);
  validatePinFormat(pin);

  return withLock(() => {
    const sheet = getSheet(SHEETS.RESIDENTS);
    ensureColumn(sheet, "pin_hash");
    const rowIndex = findRowIndexById(sheet, "mobile", mobile);
    if (rowIndex === -1) throw new ApiError("No account found for this number yet", 404);
    const resident = getRowObject(sheet, rowIndex);
    if (resident.pin_hash) {
      throw new ApiError("A PIN is already set for this number — use Forgot PIN to reset it", 400);
    }
    updateRowFields(sheet, rowIndex, { pin_hash: hashPin(pin, mobile) });
    return { mobile };
  });
}

/** Locked out after 5 wrong tries for 15 minutes (CacheService, not a
 *  Sheet column — this is throwaway rate-limit state, not a durable
 *  record). Resets the counter on a correct PIN. */
function verifyResidentPin(mobile, pin) {
  requireFields({ mobile, pin }, ["mobile", "pin"]);
  validateMobile(mobile);

  const cache = CacheService.getScriptCache();
  const attemptsKey = `pin_attempts_${mobile}`;
  const attempts = Number(cache.get(attemptsKey) || 0);
  if (attempts >= PIN_MAX_ATTEMPTS) {
    throw new ApiError("Too many incorrect attempts — try again in 15 minutes, or use Forgot PIN", 429);
  }

  const sheet = getSheet(SHEETS.RESIDENTS);
  ensureColumn(sheet, "pin_hash");
  const resident = findResidentByMobile(mobile);
  if (!resident || !resident.pin_hash) {
    throw new ApiError("No PIN set for this number yet", 400);
  }

  if (resident.pin_hash !== hashPin(pin, mobile)) {
    cache.put(attemptsKey, String(attempts + 1), PIN_LOCKOUT_SECONDS);
    throw new ApiError("Incorrect PIN", 401);
  }

  cache.remove(attemptsKey);
  return { mobile, verified: true };
}

/** Operations-gated — the only way a PIN ever gets cleared once set.
 *  Clearing just lets the resident set a fresh one next visit; it
 *  never reveals or resets it to anything guessable. */
function resetResidentPin(volunteer, mobile) {
  requirePermission(volunteer, "Operations");
  requireFields({ mobile }, ["mobile"]);
  validateMobile(mobile);

  return withLock(() => {
    const sheet = getSheet(SHEETS.RESIDENTS);
    ensureColumn(sheet, "pin_hash");
    const rowIndex = findRowIndexById(sheet, "mobile", mobile);
    if (rowIndex === -1) throw new ApiError("No account found for this number", 404);
    updateRowFields(sheet, rowIndex, { pin_hash: "" });
    logAudit(volunteer.email, "Reset My Stuff PIN", "Residents", mobile, "", "");
    return { mobile };
  });
}
