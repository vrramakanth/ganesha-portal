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

function generateTransactionId() {
  const seq = nextSequence("counter_transaction");
  return `GWG-${todayCompact()}-${pad(seq, 6)}`;
}

function generateReceiptId() {
  const seq = nextSequence("counter_receipt");
  return `GWG-R-${pad(seq, 6)}`;
}

function generateRegistrationId() {
  const seq = nextSequence("counter_registration");
  return `GWG-REG-${pad(seq, 6)}`;
}

function generateEntitlementId() {
  const seq = nextSequence("counter_entitlement");
  return `GWG-ENT-${pad(seq, 6)}`;
}

/** Dinner tokens are day/event-scoped, e.g. GW-D1-0342. `eventCode` should
 *  be a short slug configured on the Event (e.g. "D1"). */
function generateTokenId(eventCode) {
  const seq = nextSequence(`counter_token_${eventCode}`);
  return `GW-${eventCode}-${pad(seq, 4)}`;
}

function generateRedemptionId() {
  const seq = nextSequence("counter_redemption");
  return `GWG-RED-${pad(seq, 6)}`;
}

function generateVolunteerId() {
  const seq = nextSequence("counter_volunteer");
  return `GWG-VOL-${pad(seq, 4)}`;
}

function generateResidentId() {
  const seq = nextSequence("counter_resident");
  return `GWG-RES-${pad(seq, 6)}`;
}

function generateAnnouncementId() {
  const seq = nextSequence("counter_announcement");
  return `GWG-ANN-${pad(seq, 4)}`;
}
