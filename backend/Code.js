/** Single Web App entry point. Apps Script has no real URL routing, so
 *  every request carries ?action=<name> in the query string (for both GET
 *  and POST — see README "API surface" for the full action list mapped
 *  back to the spec's §50 conceptual endpoints). */

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
  "communityDinner.publicCount": { handler: () => getCommunityDinnerPublicCount() },

  // --- Resident ---
  "donations.create": { handler: (p) => createDonation(p) },
  "donations.createHundi": { handler: (p) => createHundiDonation(p) },
  "donations.submitReference": { handler: (p) => submitPaymentReference(p) },
  "donations.cancel": { handler: (p) => cancelDonation(p.transactionId) },
  "donations.get": { handler: (p) => getDonation(p.transactionId) },
  "donations.mine": { handler: (p) => listDonationsByMobile(p.mobile) },
  "events.register": { handler: (p) => registerForEvent(p) },
  "events.rsvp": { handler: (p) => rsvpEvent(p.eventId, p.response) },
  "events.registrations.updateSong": { handler: (p) => updateRegistrationSong(p) },
  "registrations.mine": { handler: (p) => listRegistrationsByMobile(p.mobile) },
  "dinner.register": { handler: (p) => registerDinner(p) },
  "dinner.submitReference": { handler: (p) => submitDinnerPaymentReference(p) },
  "dinner.cancel": { handler: (p) => cancelDinnerRegistration(p.entitlementId) },
  "dinner.token": { handler: (p) => getDinnerToken(p.tokenId) },
  "dinner.mine": { handler: (p) => listMyDinnerTokens(p.mobile) },
  "volunteers.register": { handler: (p) => registerVolunteer(p) },
  "volunteers.mine": { handler: (p) => listMyVolunteerStatus(p.mobile) },
  "expenses.mine": { handler: (p) => listMyExpenses(p.mobile) },
  "communityDinner.register": { handler: (p) => registerCommunityDinner(p) },
  "communityDinner.submitPayment": { handler: (p) => submitCommunityDinnerPayment(p) },
  "communityDinner.cancel": { handler: (p) => cancelCommunityDinnerRegistration(p.registrationId) },
  "communityDinner.mine": { handler: (p) => listMyCommunityDinnerRegistration(p.mobile) },

  // --- Volunteer (requires idToken; some also require a permission) ---
  "auth.check": { auth: true, handler: (p, v) => v },
  "volunteer.dashboard": { auth: true, handler: (p, v) => getVolunteerDashboard(v) },
  "volunteer.transactions": { auth: true, handler: (p, v) => listTransactions(v) },
  "volunteer.payment.verify": { auth: true, handler: (p, v) => verifyPaymentManual(v, p.transactionId, p.notes) },
  "volunteer.payment.reject": { auth: true, handler: (p, v) => rejectPayment(v, p.transactionId, p.notes) },
  "volunteer.payment.attachScreenshot": {
    auth: true,
    handler: (p, v) => attachPaymentScreenshot(v, p.transactionId, p.screenshot, p.mimeType),
  },
  "volunteer.festival.setWrappedUp": { auth: true, handler: (p, v) => setFestivalWrappedUp(v, p.wrapped) },
  "volunteer.donations.setOpen": { auth: true, handler: (p, v) => setDonationsOpen(v, p.open) },
  "volunteer.sponsorships.record": { auth: true, handler: (p, v) => recordSponsorship(v, p) },
  "volunteer.events.create": { auth: true, handler: (p, v) => createEvent(v, p) },
  "volunteer.events.update": { auth: true, handler: (p, v) => updateEvent(v, p.eventId, p) },
  "volunteer.events.updateStatus": { auth: true, handler: (p, v) => updateEventStatus(v, p.eventId, p.status) },
  "volunteer.events.registrations": { auth: true, handler: (p, v) => listRegistrationsForEvent(v, p.eventId) },
  "volunteer.events.registrations.pending": { auth: true, handler: (p, v) => listPendingRegistrations(v) },
  "volunteer.events.registrations.all": { auth: true, handler: (p, v) => listAllRegistrations(v) },
  "volunteer.events.registrations.approve": { auth: true, handler: (p, v) => approveRegistration(v, p.registrationId) },
  "volunteer.events.registrations.reject": { auth: true, handler: (p, v) => rejectRegistration(v, p.registrationId, p.reason) },
  "volunteer.events.checkin": { auth: true, handler: (p, v) => checkInRegistration(v, p.registrationId) },
  "volunteer.dinner.dashboard": { auth: true, handler: (p) => getDinnerDashboard(p.eventId) },
  "volunteer.dinner.redeem": { auth: true, handler: (p, v) => redeemDinnerToken(v, p.tokenId, p.quantity, p.counterId) },
  "volunteer.dinner.walkin": { auth: true, handler: (p, v) => dinnerWalkin(v, p) },
  "volunteer.dinner.payments": { auth: true, handler: (p, v) => listDinnerPaymentsForReview(v) },
  "volunteer.dinner.payment.approve": { auth: true, handler: (p, v) => approveDinnerPayment(v, p.entitlementId) },
  "volunteer.dinner.payment.reject": { auth: true, handler: (p, v) => rejectDinnerPayment(v, p.entitlementId, p.notes) },
  "volunteer.volunteers.list": { auth: true, handler: (p, v) => listVolunteers(v) },
  "volunteer.volunteers.activate": { auth: true, handler: (p, v) => activateVolunteer(v, p.volunteerId) },
  "volunteer.volunteers.approveArea": { auth: true, handler: (p, v) => approveVolunteerArea(v, p.volunteerId, p.area) },
  "volunteer.volunteers.declineArea": { auth: true, handler: (p, v) => declineVolunteerArea(v, p.volunteerId, p.area) },
  "volunteer.announcements.create": { auth: true, handler: (p, v) => createAnnouncement(v, p) },
  "volunteer.announcements.update": { auth: true, handler: (p, v) => updateAnnouncement(v, p.announcementId, p) },
  "volunteer.announcements.deactivate": { auth: true, handler: (p, v) => deactivateAnnouncement(v, p.announcementId) },
  "volunteer.reports.export": { auth: true, handler: (p, v) => exportReportCsv(v, p.reportKey) },
  "volunteer.config.list": { auth: true, handler: (p, v) => listConfig(v) },
  "volunteer.config.update": { auth: true, handler: (p, v) => updateConfig(v, p.updates) },
  "volunteer.backup.run": { auth: true, handler: (p, v) => runBackupNow(v) },
  "volunteer.auditLog.list": { auth: true, handler: (p, v) => listAuditLog(v) },
  "volunteer.auditLog.archive": { auth: true, handler: (p, v) => archiveOldAuditLogEntries(v) },
  "volunteer.auditLog.archived": { auth: true, handler: (p, v) => listArchivedAuditLog(v) },
  "volunteer.bugs.list": { auth: true, handler: (p, v) => listBugs(v) },
  "volunteer.bugs.updateStatus": { auth: true, handler: (p, v) => updateBugStatus(v, p.bugId, p.status) },
  "volunteer.feedback.list": { auth: true, handler: (p, v) => listFeedback(v) },
  "volunteer.feedback.updateStatus": { auth: true, handler: (p, v) => updateFeedbackStatus(v, p.feedbackId, p.status) },
  "volunteer.communityDinner.list": { auth: true, handler: (p, v) => listCommunityDinnerRegistrations(v) },
  "volunteer.communityDinner.payments": { auth: true, handler: (p, v) => listCommunityDinnerPaymentsForReview(v) },
  "volunteer.communityDinner.attachScreenshot": {
    auth: true,
    handler: (p, v) => attachCommunityDinnerScreenshot(v, p.registrationId, p.screenshot, p.mimeType),
  },
  "volunteer.communityDinner.add": {
    auth: true,
    handler: (p, v) => addCommunityDinnerRegistration(v, p),
  },
  "volunteer.communityDinner.adminCancel": {
    auth: true,
    handler: (p, v) => adminCancelCommunityDinnerRegistration(v, p.registrationId, p.reason),
  },
  "volunteer.communityDinner.tally.get": {
    auth: true,
    handler: (p, v) => getCommunityDinnerPlateTally(v),
  },
  "volunteer.communityDinner.tally.save": {
    auth: true,
    handler: (p, v) => saveCommunityDinnerPlateTally(v, p.counters),
  },
  "volunteer.communityDinner.counters.save": {
    auth: true,
    handler: (p, v) => saveCommunityDinnerCounterMap(v, p.map),
  },
  "volunteer.communityDinner.setOpen": {
    auth: true,
    handler: (p, v) => setCommunityDinnerRegistrationOpen(v, p.open),
  },
  "volunteer.communityDinner.payment.approve": {
    auth: true,
    handler: (p, v) => approveCommunityDinnerPayment(v, p.registrationId),
  },
  "volunteer.communityDinner.payment.reject": {
    auth: true,
    handler: (p, v) => rejectCommunityDinnerPayment(v, p.registrationId, p.notes),
  },
  "volunteer.communityDinner.edit": {
    auth: true,
    handler: (p, v) => editCommunityDinnerRegistration(v, p.registrationId, p),
  },

  "volunteer.bhogSponsors.lookupDonations": {
    auth: true,
    handler: (p, v) => lookupBhogSponsorDonations(v, p.mobile),
  },
  "volunteer.bhogSponsors.record": { auth: true, handler: (p, v) => recordBhogSponsor(v, p) },
  "volunteer.bhogSponsors.list": { auth: true, handler: (p, v) => listBhogSponsors(v) },

  "volunteer.futureCosts.record": { auth: true, handler: (p, v) => recordFutureCost(v, p) },
  "volunteer.futureCosts.move": { auth: true, handler: (p, v) => moveFutureCostToExpense(v, p.estimateId) },
  "volunteer.futureCosts.discard": { auth: true, handler: (p, v) => discardFutureCost(v, p.estimateId, p.reason) },
  "volunteer.futureCosts.returnDraft": { auth: true, handler: (p, v) => returnDraftToEstimate(v, p.estimateId) },
  "volunteer.futureCosts.setClosed": { auth: true, handler: (p, v) => setFutureCostsClosed(v, p.closed) },
  "volunteer.expenses.delete": { auth: true, handler: (p, v) => deleteExpense(v, p.expenseId, p.reason) },
  "volunteer.expenses.attachReceipt": {
    auth: true,
    handler: (p, v) => attachExpenseReceipt(v, p.expenseId, p.screenshot, p.mimeType),
  },
  "volunteer.expenses.updateDraft": { auth: true, handler: (p, v) => updateDraftExpense(v, p.expenseId, p) },
  "volunteer.expenses.submitDraft": { auth: true, handler: (p, v) => submitDraftExpense(v, p.expenseId) },
  "volunteer.futureCosts.update": {
    auth: true,
    handler: (p, v) => updateFutureCost(v, p.estimateId, p),
  },
  "volunteer.futureCosts.list": { auth: true, handler: (p, v) => listFutureCosts(v) },

  "volunteer.residents.setPin": { auth: true, handler: (p, v) => adminSetResidentPin(v, p.mobile, p.pin) },
  "volunteer.expenses.record": {
    auth: true,
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
  "volunteer.expenses.list": { auth: true, handler: (p, v) => listExpenses(v) },
  "volunteer.expenses.approve": { auth: true, handler: (p, v) => approveExpense(v, p.expenseId) },
  "volunteer.expenses.reject": { auth: true, handler: (p, v) => rejectExpense(v, p.expenseId, p.notes) },
  "volunteer.expenses.settlementSummary": { auth: true, handler: (p, v) => getExpenseSettlementSummary(v) },
  "volunteer.expenses.settle": { auth: true, handler: (p, v) => settleSpender(v, p.spenderMobile) },
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
