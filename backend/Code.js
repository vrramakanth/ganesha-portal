/** Single Web App entry point. Apps Script has no real URL routing, so
 *  every request carries ?action=<name> in the query string (for both GET
 *  and POST — see README "API surface" for the full action list mapped
 *  back to the spec's §50 conceptual endpoints).
 *
 *  A route's optional `module` field ties it to a Namma Habba module
 *  (Modules.js) — the router refuses the request with a 404 before the
 *  handler ever runs if that module is off for this festival deployment.
 *  Routes with no `module` field (public info, auth, Configuration,
 *  Announcements/Feedback/Bugs, PIN lookup, Backup, Audit Log, Reports)
 *  are always available, regardless of which modules are enabled. */

const ROUTES = {
  // --- Public ---
  "festival.get": { handler: () => getFestivalInfo() },
  "blocks.list": { handler: () => listBlocks() },
  "events.list": { handler: () => listEvents() },
  "stats.public": { handler: () => getPublicStats() },
  "announcements.list": { handler: () => listActiveAnnouncements() },
  "payments.extractReference": { handler: (p) => extractPaymentReference(p.image, p.mimeType) },
  "bugs.report": { handler: (p) => reportBug(p) },
  "feedback.submit": { handler: (p) => submitFeedback(p) },
  "feedback.listPublished": { handler: () => listPublishedFeedback() },
  "residents.lookup": { handler: (p) => lookupResident(p.mobile) },
  "residents.pinStatus": { handler: (p) => getResidentPinStatus(p.mobile) },
  "residents.setPin": { handler: (p) => setResidentPin(p.mobile, p.pin, p.block, p.flatNumber) },
  "residents.verifyPin": { handler: (p) => verifyResidentPin(p.mobile, p.pin) },
  "communityDinner.publicCount": { module: "meal", handler: () => getCommunityDinnerPublicCount() },

  // --- Resident ---
  "donations.create": { module: "donations", handler: (p) => createDonation(p) },
  "donations.createHundi": { module: "donations", handler: (p) => createHundiDonation(p) },
  "donations.submitReference": { module: "donations", handler: (p) => submitPaymentReference(p) },
  "donations.cancel": { module: "donations", handler: (p) => cancelDonation(p.transactionId) },
  "donations.get": { module: "donations", handler: (p) => getDonation(p.transactionId) },
  "donations.mine": { module: "donations", handler: (p) => listDonationsByMobile(p.mobile) },
  "events.register": { module: "events", handler: (p) => registerForEvent(p) },
  "events.rsvp": { module: "events", handler: (p) => rsvpEvent(p.eventId, p.response) },
  "events.registrations.updateSong": { module: "events", handler: (p) => updateRegistrationSong(p) },
  "registrations.mine": { module: "events", handler: (p) => listRegistrationsByMobile(p.mobile) },
  "dinner.register": { module: "meal", handler: (p) => registerDinner(p) },
  "dinner.submitReference": { module: "meal", handler: (p) => submitDinnerPaymentReference(p) },
  "dinner.cancel": { module: "meal", handler: (p) => cancelDinnerRegistration(p.entitlementId) },
  "dinner.token": { module: "meal", handler: (p) => getDinnerToken(p.tokenId) },
  "dinner.mine": { module: "meal", handler: (p) => listMyDinnerTokens(p.mobile) },
  "volunteers.register": { module: "volunteers", handler: (p) => registerVolunteer(p) },
  "volunteers.mine": { module: "volunteers", handler: (p) => listMyVolunteerStatus(p.mobile) },
  "expenses.mine": { module: "expenses", handler: (p) => listMyExpenses(p.mobile) },
  "communityDinner.register": { module: "meal", handler: (p) => registerCommunityDinner(p) },
  "communityDinner.submitPayment": { module: "meal", handler: (p) => submitCommunityDinnerPayment(p) },
  "communityDinner.cancel": { module: "meal", handler: (p) => cancelCommunityDinnerRegistration(p.registrationId) },
  "communityDinner.mine": { module: "meal", handler: (p) => listMyCommunityDinnerRegistration(p.mobile) },

  // --- Volunteer (requires idToken; some also require a permission) ---
  "auth.check": { auth: true, handler: (p, v) => v },
  "volunteer.dashboard": { auth: true, handler: (p, v) => getVolunteerDashboard(v) },
  "volunteer.transactions": { auth: true, module: "donations", handler: (p, v) => listTransactions(v) },
  "volunteer.payment.verify": { auth: true, module: "donations", handler: (p, v) => verifyPaymentManual(v, p.transactionId, p.notes) },
  "volunteer.payment.reject": { auth: true, module: "donations", handler: (p, v) => rejectPayment(v, p.transactionId, p.notes) },
  "volunteer.payment.attachScreenshot": {
    auth: true,
    module: "donations",
    handler: (p, v) => attachPaymentScreenshot(v, p.transactionId, p.screenshot, p.mimeType),
  },
  "volunteer.festival.setWrappedUp": { auth: true, handler: (p, v) => setFestivalWrappedUp(v, p.wrapped) },
  "volunteer.donations.setOpen": { auth: true, module: "donations", handler: (p, v) => setDonationsOpen(v, p.open) },
  "volunteer.sponsorships.record": { auth: true, module: "sponsorships", handler: (p, v) => recordSponsorship(v, p) },
  "volunteer.events.create": { auth: true, module: "events", handler: (p, v) => createEvent(v, p) },
  "volunteer.events.update": { auth: true, module: "events", handler: (p, v) => updateEvent(v, p.eventId, p) },
  "volunteer.events.updateStatus": { auth: true, module: "events", handler: (p, v) => updateEventStatus(v, p.eventId, p.status) },
  "volunteer.events.registrations": { auth: true, module: "events", handler: (p, v) => listRegistrationsForEvent(v, p.eventId) },
  "volunteer.events.registrations.pending": { auth: true, module: "events", handler: (p, v) => listPendingRegistrations(v) },
  "volunteer.events.registrations.all": { auth: true, module: "events", handler: (p, v) => listAllRegistrations(v) },
  "volunteer.events.registrations.approve": { auth: true, module: "events", handler: (p, v) => approveRegistration(v, p.registrationId) },
  "volunteer.events.registrations.reject": { auth: true, module: "events", handler: (p, v) => rejectRegistration(v, p.registrationId, p.reason) },
  "volunteer.events.checkin": { auth: true, module: "events", handler: (p, v) => checkInRegistration(v, p.registrationId) },
  "volunteer.dinner.dashboard": { auth: true, module: "meal", handler: (p) => getDinnerDashboard(p.eventId) },
  "volunteer.dinner.redeem": { auth: true, module: "meal", handler: (p, v) => redeemDinnerToken(v, p.tokenId, p.quantity, p.counterId) },
  "volunteer.dinner.walkin": { auth: true, module: "meal", handler: (p, v) => dinnerWalkin(v, p) },
  "volunteer.dinner.payments": { auth: true, module: "meal", handler: (p, v) => listDinnerPaymentsForReview(v) },
  "volunteer.dinner.payment.approve": { auth: true, module: "meal", handler: (p, v) => approveDinnerPayment(v, p.entitlementId) },
  "volunteer.dinner.payment.reject": { auth: true, module: "meal", handler: (p, v) => rejectDinnerPayment(v, p.entitlementId, p.notes) },
  "volunteer.volunteers.list": { auth: true, module: "volunteers", handler: (p, v) => listVolunteers(v) },
  "volunteer.volunteers.activate": { auth: true, module: "volunteers", handler: (p, v) => activateVolunteer(v, p.volunteerId) },
  "volunteer.volunteers.approveArea": { auth: true, module: "volunteers", handler: (p, v) => approveVolunteerArea(v, p.volunteerId, p.area) },
  "volunteer.volunteers.declineArea": { auth: true, module: "volunteers", handler: (p, v) => declineVolunteerArea(v, p.volunteerId, p.area) },
  "volunteer.announcements.create": { auth: true, handler: (p, v) => createAnnouncement(v, p) },
  "volunteer.announcements.update": { auth: true, handler: (p, v) => updateAnnouncement(v, p.announcementId, p) },
  "volunteer.announcements.deactivate": { auth: true, handler: (p, v) => deactivateAnnouncement(v, p.announcementId) },
  "volunteer.reports.export": { auth: true, handler: (p, v) => exportReportCsv(v, p.reportKey) },
  "volunteer.config.list": { auth: true, handler: (p, v) => listConfig(v) },
  "volunteer.config.update": { auth: true, handler: (p, v) => updateConfig(v, p.updates) },
  "volunteer.modules.list": { auth: true, handler: () => getEnabledModules() },
  "volunteer.modules.update": { auth: true, handler: (p, v) => setEnabledModules(v, p.updates || {}) },
  "volunteer.backup.run": { auth: true, handler: (p, v) => runBackupNow(v) },
  "volunteer.auditLog.list": { auth: true, handler: (p, v) => listAuditLog(v) },
  "volunteer.auditLog.archive": { auth: true, handler: (p, v) => archiveOldAuditLogEntries(v) },
  "volunteer.auditLog.archived": { auth: true, handler: (p, v) => listArchivedAuditLog(v) },
  "volunteer.bugs.list": { auth: true, handler: (p, v) => listBugs(v) },
  "volunteer.bugs.updateStatus": { auth: true, handler: (p, v) => updateBugStatus(v, p.bugId, p.status) },
  "volunteer.feedback.list": { auth: true, handler: (p, v) => listFeedback(v) },
  "volunteer.feedback.updateStatus": { auth: true, handler: (p, v) => updateFeedbackStatus(v, p.feedbackId, p.status) },
  "volunteer.communityDinner.list": { auth: true, module: "meal", handler: (p, v) => listCommunityDinnerRegistrations(v) },
  "volunteer.communityDinner.payments": { auth: true, module: "meal", handler: (p, v) => listCommunityDinnerPaymentsForReview(v) },
  "volunteer.communityDinner.attachScreenshot": {
    auth: true,
    module: "meal",
    handler: (p, v) => attachCommunityDinnerScreenshot(v, p.registrationId, p.screenshot, p.mimeType),
  },
  "volunteer.communityDinner.add": {
    auth: true,
    module: "meal",
    handler: (p, v) => addCommunityDinnerRegistration(v, p),
  },
  "volunteer.communityDinner.adminCancel": {
    auth: true,
    module: "meal",
    handler: (p, v) => adminCancelCommunityDinnerRegistration(v, p.registrationId, p.reason),
  },
  "volunteer.communityDinner.tally.get": {
    auth: true,
    module: "meal",
    handler: (p, v) => getCommunityDinnerPlateTally(v),
  },
  "volunteer.communityDinner.tally.save": {
    auth: true,
    module: "meal",
    handler: (p, v) => saveCommunityDinnerPlateTally(v, p.counters),
  },
  "volunteer.communityDinner.sheetScans.upload": {
    auth: true,
    module: "meal",
    handler: (p, v) => uploadCounterSheetScan(v, p.counter, p.image, p.mimeType, p.notes),
  },
  "volunteer.communityDinner.sheetScans.list": { auth: true, module: "meal", handler: (p, v) => listCounterSheetScans(v) },
  "volunteer.communityDinner.counters.save": {
    auth: true,
    module: "meal",
    handler: (p, v) => saveCommunityDinnerCounterMap(v, p.map),
  },
  "volunteer.communityDinner.setOpen": {
    auth: true,
    module: "meal",
    handler: (p, v) => setCommunityDinnerRegistrationOpen(v, p.open),
  },
  "volunteer.communityDinner.payment.approve": {
    auth: true,
    module: "meal",
    handler: (p, v) => approveCommunityDinnerPayment(v, p.registrationId),
  },
  "volunteer.communityDinner.payment.reject": {
    auth: true,
    module: "meal",
    handler: (p, v) => rejectCommunityDinnerPayment(v, p.registrationId, p.notes),
  },
  "volunteer.communityDinner.edit": {
    auth: true,
    module: "meal",
    handler: (p, v) => editCommunityDinnerRegistration(v, p.registrationId, p),
  },

  "volunteer.bhogSponsors.lookupDonations": {
    auth: true,
    module: "sponsorships",
    handler: (p, v) => lookupBhogSponsorDonations(v, p.mobile),
  },
  "volunteer.bhogSponsors.record": { auth: true, module: "sponsorships", handler: (p, v) => recordBhogSponsor(v, p) },
  "volunteer.bhogSponsors.list": { auth: true, module: "sponsorships", handler: (p, v) => listBhogSponsors(v) },

  "volunteer.futureCosts.record": { auth: true, module: "expenses", handler: (p, v) => recordFutureCost(v, p) },
  "volunteer.futureCosts.move": { auth: true, module: "expenses", handler: (p, v) => moveFutureCostToExpense(v, p.estimateId) },
  "volunteer.futureCosts.discard": { auth: true, module: "expenses", handler: (p, v) => discardFutureCost(v, p.estimateId, p.reason) },
  "volunteer.futureCosts.returnDraft": { auth: true, module: "expenses", handler: (p, v) => returnDraftToEstimate(v, p.estimateId) },
  "volunteer.futureCosts.setClosed": { auth: true, module: "expenses", handler: (p, v) => setFutureCostsClosed(v, p.closed) },
  "volunteer.expenses.delete": { auth: true, module: "expenses", handler: (p, v) => deleteExpense(v, p.expenseId, p.reason) },
  "volunteer.expenses.attachReceipt": {
    auth: true,
    module: "expenses",
    handler: (p, v) => attachExpenseReceipt(v, p.expenseId, p.screenshot, p.mimeType),
  },
  "volunteer.expenses.updateDraft": { auth: true, module: "expenses", handler: (p, v) => updateDraftExpense(v, p.expenseId, p) },
  "volunteer.expenses.submitDraft": { auth: true, module: "expenses", handler: (p, v) => submitDraftExpense(v, p.expenseId) },
  "volunteer.futureCosts.update": {
    auth: true,
    module: "expenses",
    handler: (p, v) => updateFutureCost(v, p.estimateId, p),
  },
  "volunteer.futureCosts.list": { auth: true, module: "expenses", handler: (p, v) => listFutureCosts(v) },

  "volunteer.residents.setPin": { auth: true, handler: (p, v) => adminSetResidentPin(v, p.mobile, p.pin) },
  "volunteer.expenses.record": {
    auth: true,
    module: "expenses",
    handler: (p, v) =>
      recordExpense(v, {
        date: p.date,
        amount: p.amount,
        purpose: p.purpose,
        screenshot: p.screenshot,
        mimeType: p.mimeType,
        spenderName: p.spenderName,
        spenderMobile: p.spenderMobile,
        upiId: p.upiId,
      }),
  },
  "volunteer.expenses.list": { auth: true, module: "expenses", handler: (p, v) => listExpenses(v) },
  "volunteer.expenses.approve": { auth: true, module: "expenses", handler: (p, v) => approveExpense(v, p.expenseId) },
  "volunteer.expenses.reject": { auth: true, module: "expenses", handler: (p, v) => rejectExpense(v, p.expenseId, p.notes) },
  "volunteer.expenses.settlementSummary": { auth: true, module: "expenses", handler: (p, v) => getExpenseSettlementSummary(v) },
  "volunteer.expenses.settle": { auth: true, module: "expenses", handler: (p, v) => settleSpender(v, p.spenderMobile) },
};

function doGet(e) {
  return handleRequest(e, e.parameter || {});
}

function doPost(e) {
  const body = parseBody(e);
  // Query-string params (notably `action`) merge with the JSON body.
  return handleRequest(e, Object.assign({}, e.parameter, body));
}

function handleRequest(e, params) {
  try {
    const action = params.action;
    const route = ROUTES[action];
    if (!route) throw new ApiError(`Unknown action: ${action}`, 404);

    if (route.module) requireModuleEnabled(route.module);

    let volunteer = null;
    if (route.auth) {
      volunteer = verifyVolunteerToken(params.idToken);
    }

    const data = route.handler(params, volunteer);
    return jsonResponse({ ok: true, data });
  } catch (err) {
    return jsonResponse({ ok: false, error: err.message, status: err.status || 500 });
  }
}
