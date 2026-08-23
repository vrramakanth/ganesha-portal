/** Community Dinner / Prasadam (spec §17–§24) — a thin wrapper over the
 *  generic entitlement engine with dinner-specific validation. */

function getDinnerEvent(eventId) {
  const event = rowsToObjects(getSheet(SHEETS.EVENTS)).find((e) => e.event_id === eventId);
  if (!event) throw new ApiError("Unknown dinner day", 404);
  return event;
}

function countMealsForEvent(eventId) {
  return rowsToObjects(getSheet(SHEETS.ENTITLEMENTS))
    .filter((e) => e.event_id === eventId && e.status !== ENTITLEMENT_STATUS.PAYMENT_PENDING)
    .reduce((sum, e) => sum + Number(e.allocated_quantity || 0), 0);
}

function checkDinnerCapacity(event, requestedMeals) {
  const capacity = Number(event.capacity || 0);
  if (!capacity) return;
  const already = countMealsForEvent(event.event_id);
  if (already + requestedMeals > capacity) {
    throw new ApiError("REGISTRATION_FULL", 409);
  }
}

function registerDinner({ eventId, name, mobile, email, block, flatNumber, adults, children }) {
  requireFields({ eventId, name, mobile, block, flatNumber }, [
    "eventId",
    "name",
    "mobile",
    "block",
    "flatNumber",
  ]);
  const event = getDinnerEvent(eventId);
  if (event.status !== "OPEN") throw new ApiError("Dinner registration is not open", 400);

  const meals = Number(adults || 0) + Number(children || 0);
  if (meals <= 0) throw new ApiError("At least one meal is required", 400);
  checkDinnerCapacity(event, meals);
  validateBlock(block);

  const resident = upsertResident({ name, mobile, email, block, flatNumber });
  const fee = Number(event.fee || 0);

  if (fee > 0) {
    const entitlement = createPendingEntitlement({
      eventId,
      residentId: resident.resident_id,
      block,
      flatNumber,
      requestedQuantity: meals,
      source: "ONLINE",
    });
    const order = createRazorpayOrder(fee * meals, entitlement.entitlement_id);
    withLock(() =>
      updateRowFields(
        getSheet(SHEETS.ENTITLEMENTS),
        findRowIndexById(getSheet(SHEETS.ENTITLEMENTS), "entitlement_id", entitlement.entitlement_id),
        { source: `ONLINE:${order.id}` }
      )
    );
    return {
      entitlementId: entitlement.entitlement_id,
      paymentRequired: true,
      razorpayOrderId: order.id,
      amount: fee * meals,
      currency: "INR",
    };
  }

  const entitlement = createEntitlement({
    eventId,
    residentId: resident.resident_id,
    block,
    flatNumber,
    allocatedQuantity: meals,
    source: "ONLINE",
    tokenCode: event.token_code || eventId,
  });
  return { entitlementId: entitlement.entitlement_id, tokenId: entitlement.token_id, paymentRequired: false };
}

function confirmDinnerPayment({ entitlementId, razorpay_order_id, razorpay_payment_id, razorpay_signature }) {
  requireFields(
    { entitlementId, razorpay_order_id, razorpay_payment_id, razorpay_signature },
    ["entitlementId", "razorpay_order_id", "razorpay_payment_id", "razorpay_signature"]
  );
  const valid = verifyCheckoutSignature(razorpay_order_id, razorpay_payment_id, razorpay_signature);
  if (!valid) throw new ApiError("Payment signature verification failed", 400);

  const sheet = getSheet(SHEETS.ENTITLEMENTS);
  const rowIndex = findRowIndexById(sheet, "entitlement_id", entitlementId);
  if (rowIndex === -1) throw new ApiError("Unknown entitlement", 404);
  const entitlement = getRowObject(sheet, rowIndex);
  const event = getDinnerEvent(entitlement.event_id);

  const activated = activateEntitlement(entitlementId, event.token_code || event.event_id);
  return { entitlementId, tokenId: activated.token_id, status: activated.status };
}

function getDinnerToken(tokenId) {
  const entitlement = getEntitlementByToken(tokenId);
  return {
    tokenId: entitlement.token_id,
    flatNumber: entitlement.flat_number,
    block: entitlement.block,
    allocated: entitlement.allocated_quantity,
    served: entitlement.redeemed_quantity,
    remaining: entitlement.remaining_quantity,
    status: entitlement.status,
  };
}

function redeemDinnerToken(volunteer, tokenId, quantity, counterId) {
  requirePermission(volunteer, "Dinner");
  return redeemEntitlement(volunteer, tokenId, quantity, counterId);
}

/** "My dinner tokens" for the resident My Stuff page — looked up via the
 *  same mobile-as-identity-key pattern as donations/registrations. Walk-in
 *  entitlements have no resident_id and so never show up here. */
function listMyDinnerTokens(mobile) {
  requireFields({ mobile }, ["mobile"]);
  const resident = findResidentByMobile(mobile);
  if (!resident) return [];

  return rowsToObjects(getSheet(SHEETS.ENTITLEMENTS))
    .filter((e) => e.resident_id === resident.resident_id && e.status !== ENTITLEMENT_STATUS.PAYMENT_PENDING)
    .map((e) => ({
      tokenId: e.token_id,
      eventId: e.event_id,
      allocated: e.allocated_quantity,
      served: e.redeemed_quantity,
      remaining: e.remaining_quantity,
      status: e.status,
    }));
}

function dinnerWalkin(volunteer, { eventId, block, flatNumber, meals }) {
  requirePermission(volunteer, "Dinner");
  requireFields({ eventId, block, flatNumber, meals }, ["eventId", "block", "flatNumber", "meals"]);
  const event = getDinnerEvent(eventId);
  const mealCount = Number(meals);
  checkDinnerCapacity(event, mealCount);
  validateBlock(block);

  const entitlement = createEntitlement({
    eventId,
    residentId: "",
    block,
    flatNumber,
    allocatedQuantity: mealCount,
    source: "WALK_IN",
    tokenCode: event.token_code || eventId,
  });
  logAudit(volunteer.email, "Created walk-in dinner token", "Entitlement", entitlement.entitlement_id, "", mealCount);
  return { entitlementId: entitlement.entitlement_id, tokenId: entitlement.token_id };
}

function getDinnerDashboard(eventId) {
  const event = getDinnerEvent(eventId);
  const entitlements = rowsToObjects(getSheet(SHEETS.ENTITLEMENTS)).filter(
    (e) => e.event_id === eventId && e.status !== ENTITLEMENT_STATUS.PAYMENT_PENDING
  );

  const allocated = entitlements.reduce((s, e) => s + Number(e.allocated_quantity || 0), 0);
  const served = entitlements.reduce((s, e) => s + Number(e.redeemed_quantity || 0), 0);
  const advance = entitlements
    .filter((e) => e.source.startsWith("ONLINE"))
    .reduce((s, e) => s + Number(e.allocated_quantity || 0), 0);
  const walkIns = entitlements
    .filter((e) => e.source === "WALK_IN")
    .reduce((s, e) => s + Number(e.allocated_quantity || 0), 0);

  return {
    eventId,
    capacity: Number(event.capacity || 0),
    allocated,
    served,
    remaining: allocated - served,
    advance,
    walkIns,
    utilization: allocated ? Math.round((served / allocated) * 100) : 0,
  };
}
