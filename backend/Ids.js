/** Sequential ID generation backed by counters in the Configuration sheet.
 *  Always call from inside withLock() to avoid duplicate IDs under
 *  concurrent requests. */

function nextSequence(counterKey) {
  const current = Number(getConfig(counterKey, "0")) || 0;
  const next = current + 1;
  setConfig(counterKey, String(next));
  return next;
}

function pad(num, width) {
  return String(num).padStart(width, "0");
}

function todayCompact() {
  return Utilities.formatDate(new Date(), "Asia/Kolkata", "yyyyMMdd");
}

/** This deployment's ID prefix — every generator below used to hardcode
 *  the literal "GWG" (and "GW" for dinner tokens), so a future festival
 *  sharing this codebase would either collide with or have to fork this
 *  file. Configurable via the `id_prefix` Configuration key, seeded to
 *  "GWG" (Setup.js) so this deployment's existing IDs are unaffected. */
function getIdPrefix() {
  return getConfig("id_prefix", "GWG");
}

/** The 2-letter dinner-token variant, derived the same way "GWG" → "GW"
 *  was derived by hand today: drop the trailing letter of the base
 *  prefix when it's 3+ letters, otherwise reuse it as-is. */
function getTokenIdPrefix() {
  const base = getIdPrefix();
  return base.length > 2 ? base.slice(0, -1) : base;
}

function generateTransactionId() {
  const seq = nextSequence("counter_transaction");
  return `${getIdPrefix()}-${todayCompact()}-${pad(seq, 6)}`;
}

function generateReceiptId() {
  const seq = nextSequence("counter_receipt");
  return `${getIdPrefix()}-R-${pad(seq, 6)}`;
}

function generateRegistrationId() {
  const seq = nextSequence("counter_registration");
  return `${getIdPrefix()}-REG-${pad(seq, 6)}`;
}

function generateEntitlementId() {
  const seq = nextSequence("counter_entitlement");
  return `${getIdPrefix()}-ENT-${pad(seq, 6)}`;
}

/** Dinner tokens are day/event-scoped, e.g. GW-D1-0342. `eventCode` should
 *  be a short slug configured on the Event (e.g. "D1"). */
function generateTokenId(eventCode) {
  const seq = nextSequence(`counter_token_${eventCode}`);
  return `${getTokenIdPrefix()}-${eventCode}-${pad(seq, 4)}`;
}

function generateRedemptionId() {
  const seq = nextSequence("counter_redemption");
  return `${getIdPrefix()}-RED-${pad(seq, 6)}`;
}

function generateVolunteerId() {
  const seq = nextSequence("counter_volunteer");
  return `${getIdPrefix()}-VOL-${pad(seq, 4)}`;
}

function generateResidentId() {
  const seq = nextSequence("counter_resident");
  return `${getIdPrefix()}-RES-${pad(seq, 6)}`;
}

function generateAnnouncementId() {
  const seq = nextSequence("counter_announcement");
  return `${getIdPrefix()}-ANN-${pad(seq, 4)}`;
}

function generateBugId() {
  const seq = nextSequence("counter_bug");
  return `${getIdPrefix()}-BUG-${pad(seq, 4)}`;
}

function generateExpenseId() {
  const seq = nextSequence("counter_expense");
  return `${getIdPrefix()}-EXP-${pad(seq, 4)}`;
}

function generateFeedbackId() {
  const seq = nextSequence("counter_feedback");
  return `${getIdPrefix()}-FB-${pad(seq, 4)}`;
}

function generateGuestId() {
  const seq = nextSequence("counter_guest");
  return `${getIdPrefix()}-GST-${pad(seq, 4)}`;
}

function generateCommunityDinnerId() {
  const seq = nextSequence("counter_community_dinner");
  return `${getIdPrefix()}-CD-${pad(seq, 4)}`;
}

function generateBhogSponsorId() {
  const seq = nextSequence("counter_bhog_sponsor");
  return `${getIdPrefix()}-BHOG-${pad(seq, 4)}`;
}

function generateFutureCostId() {
  const seq = nextSequence("counter_future_cost");
  return `${getIdPrefix()}-FC-${pad(seq, 4)}`;
}

function generateCounterSheetScanId() {
  const seq = nextSequence("counter_sheet_scan");
  return `${getIdPrefix()}-SCAN-${pad(seq, 4)}`;
}
