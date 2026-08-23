/** Generic entitlement/token engine (spec §37) — dinner meals, prasadam,
 *  and paid-event admissions are all just entitlements with a quantity. */

const ENTITLEMENT_STATUS = {
  PAYMENT_PENDING: "PAYMENT_PENDING",
  ACTIVE: "ACTIVE",
  PARTIALLY_REDEEMED: "PARTIALLY_REDEEMED",
  REDEEMED: "REDEEMED",
};

function createEntitlement({ eventId, residentId, block, flatNumber, allocatedQuantity, source, tokenCode }) {
  return withLock(() => {
    const entitlementId = generateEntitlementId();
    const tokenId = generateTokenId(tokenCode);
    const entitlement = {
      entitlement_id: entitlementId,
      event_id: eventId,
      resident_id: residentId,
      token_id: tokenId,
      allocated_quantity: allocatedQuantity,
      redeemed_quantity: 0,
      remaining_quantity: allocatedQuantity,
      source,
      status: ENTITLEMENT_STATUS.ACTIVE,
      block,
      flat_number: flatNumber,
      created_at: new Date(),
    };
    appendObject(getSheet(SHEETS.ENTITLEMENTS), entitlement);
    return entitlement;
  });
}

/** Creates a placeholder entitlement before payment; finalized quantities
 *  are only set once confirmEntitlementPayment succeeds (spec §18: "token
 *  is generated only after successful payment"). */
function createPendingEntitlement({ eventId, residentId, block, flatNumber, requestedQuantity, source }) {
  return withLock(() => {
    const entitlementId = generateEntitlementId();
    const entitlement = {
      entitlement_id: entitlementId,
      event_id: eventId,
      resident_id: residentId,
      token_id: "",
      allocated_quantity: requestedQuantity,
      redeemed_quantity: 0,
      remaining_quantity: 0,
      source,
      status: ENTITLEMENT_STATUS.PAYMENT_PENDING,
      block,
      flat_number: flatNumber,
      created_at: new Date(),
    };
    appendObject(getSheet(SHEETS.ENTITLEMENTS), entitlement);
    return entitlement;
  });
}

function activateEntitlement(entitlementId, tokenCode) {
  return withLock(() => {
    const sheet = getSheet(SHEETS.ENTITLEMENTS);
    const rowIndex = findRowIndexById(sheet, "entitlement_id", entitlementId);
    if (rowIndex === -1) throw new ApiError("Unknown entitlement", 404);
    const entitlement = getRowObject(sheet, rowIndex);
    if (entitlement.status !== ENTITLEMENT_STATUS.PAYMENT_PENDING) {
      return entitlement; // idempotent
    }
    const tokenId = generateTokenId(tokenCode);
    updateRowFields(sheet, rowIndex, {
      token_id: tokenId,
      remaining_quantity: entitlement.allocated_quantity,
      status: ENTITLEMENT_STATUS.ACTIVE,
    });
    return getRowObject(sheet, rowIndex);
  });
}

function getEntitlementByToken(tokenId) {
  const rows = rowsToObjects(getSheet(SHEETS.ENTITLEMENTS));
  const entitlement = rows.find((e) => e.token_id === tokenId);
  if (!entitlement) throw new ApiError("Token not found", 404);
  return entitlement;
}

/** Redeems `quantity` units of a token. Locked so concurrent scans of the
 *  same token cannot over-redeem it (spec §39 — protect against
 *  accidental double scans / duplicate redemption). */
function redeemEntitlement(volunteer, tokenId, quantity, counterId) {
  return withLock(() => {
    const sheet = getSheet(SHEETS.ENTITLEMENTS);
    const rows = rowsToObjects(sheet);
    const idx = rows.findIndex((e) => e.token_id === tokenId);
    if (idx === -1) throw new ApiError("Token not found", 404);
    const rowIndex = idx + 2;
    const entitlement = rows[idx];

    if (entitlement.status === ENTITLEMENT_STATUS.REDEEMED || Number(entitlement.remaining_quantity) === 0) {
      throw new ApiError("ALREADY_REDEEMED", 409);
    }
    const qty = Number(quantity);
    if (qty <= 0 || qty > Number(entitlement.remaining_quantity)) {
      throw new ApiError(`Only ${entitlement.remaining_quantity} remaining`, 400);
    }

    const remaining = Number(entitlement.remaining_quantity) - qty;
    const redeemed = Number(entitlement.redeemed_quantity) + qty;
    const status = remaining === 0 ? ENTITLEMENT_STATUS.REDEEMED : ENTITLEMENT_STATUS.PARTIALLY_REDEEMED;

    updateRowFields(sheet, rowIndex, {
      redeemed_quantity: redeemed,
      remaining_quantity: remaining,
      status,
    });

    appendObject(getSheet(SHEETS.REDEMPTION_LOG), {
      redemption_id: generateRedemptionId(),
      entitlement_id: entitlement.entitlement_id,
      quantity: qty,
      counter_id: counterId || "",
      volunteer_id: volunteer.email,
      redeemed_at: new Date(),
    });

    return { tokenId, redeemed: qty, remaining, status };
  });
}
