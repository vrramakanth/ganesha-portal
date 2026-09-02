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

  // --- Resident ---
  "donations.create": { handler: (p) => createDonation(p) },
  "donations.submitReference": { handler: (p) => submitPaymentReference(p) },
  "donations.cancel": { handler: (p) => cancelDonation(p.transactionId) },
  "donations.get": { handler: (p) => getDonation(p.transactionId) },
  "donations.mine": { handler: (p) => listDonationsByMobile(p.mobile) },
  "events.register": { handler: (p) => registerForEvent(p) },
  "registrations.mine": { handler: (p) => listRegistrationsByMobile(p.mobile) },
  "dinner.register": { handler: (p) => registerDinner(p) },
  "dinner.submitReference": { handler: (p) => submitDinnerPaymentReference(p) },
  "dinner.cancel": { handler: (p) => cancelDinnerRegistration(p.entitlementId) },
  "dinner.token": { handler: (p) => getDinnerToken(p.tokenId) },
  "dinner.mine": { handler: (p) => listMyDinnerTokens(p.mobile) },
  "volunteers.register": { handler: (p) => registerVolunteer(p) },
  "volunteers.mine": { handler: (p) => listMyVolunteerStatus(p.mobile) },

  // --- Volunteer (requires idToken; some also require a permission) ---
  "auth.check": { auth: true, handler: (p, v) => v },
  "volunteer.dashboard": { auth: true, handler: (p, v) => getVolunteerDashboard(v) },
  "volunteer.transactions": { auth: true, handler: (p, v) => listTransactions(v) },
  "volunteer.payment.verify": { auth: true, handler: (p, v) => verifyPaymentManual(v, p.transactionId, p.notes) },
  "volunteer.payment.reject": { auth: true, handler: (p, v) => rejectPayment(v, p.transactionId, p.notes) },
  "volunteer.events.create": { auth: true, handler: (p, v) => createEvent(v, p) },
  "volunteer.events.registrations": { auth: true, handler: (p, v) => listRegistrationsForEvent(v, p.eventId) },
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
  "volunteer.announcements.deactivate": { auth: true, handler: (p, v) => deactivateAnnouncement(v, p.announcementId) },
  "volunteer.reports.export": { auth: true, handler: (p, v) => exportReportCsv(v, p.reportKey) },
  "volunteer.config.list": { auth: true, handler: (p, v) => listConfig(v) },
  "volunteer.config.update": { auth: true, handler: (p, v) => updateConfig(v, p.updates) },
  "volunteer.backup.run": { auth: true, handler: (p, v) => runBackupNow(v) },
  "volunteer.auditLog.list": { auth: true, handler: (p, v) => listAuditLog(v) },
  "volunteer.bugs.list": { auth: true, handler: (p, v) => listBugs(v) },
  "volunteer.bugs.updateStatus": { auth: true, handler: (p, v) => updateBugStatus(v, p.bugId, p.status) },
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
