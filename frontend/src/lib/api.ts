import type {
  Announcement,
  AuditLogEntry,
  BhogSponsor,
  BhogSponsorLookup,
  Block,
  BugReport,
  CancelResult,
  CommunityDinnerPublicCount,
  CommunityDinnerRegistration,
  ConfigEntry,
  CreateDonationResult,
  DinnerDashboard,
  DinnerRegisterResult,
  DinnerSubmitReferenceResult,
  DinnerToken,
  DonationSummary,
  EntitlementRow,
  EventRecord,
  EventRegistration,
  Expense,
  ExpenseSettlement,
  ExtractReferenceResult,
  FeedbackReport,
  FestivalInfo,
  FutureCost,
  MyDinnerToken,
  PublicStats,
  RedeemResult,
  ReportExport,
  ResidentLookup,
  ResidentPinStatus,
  SubmitReferenceResult,
  Transaction,
  Volunteer,
  VolunteerDashboard,
  VolunteerRegistration,
  VolunteerRoster,
} from "./types";

export class ApiClientError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

function apiUrl() {
  const url = process.env.NEXT_PUBLIC_API_URL;
  if (!url) {
    throw new ApiClientError(
      "NEXT_PUBLIC_API_URL is not set — copy frontend/.env.example to .env.local and fill it in.",
      500
    );
  }
  return url;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Params = Record<string, any>;

function unwrap<T>(json: unknown): T {
  const res = json as { ok: boolean; data?: T; error?: string; status?: number };
  if (!res.ok) throw new ApiClientError(res.error || "Request failed", res.status || 500);
  return res.data as T;
}

/** Apps Script Web Apps occasionally serve an HTML page (a timeout,
 *  a quota limit, an auth interstitial) instead of the script's actual
 *  JSON response — reading as text first and parsing ourselves lets us
 *  surface one friendly message for that case, instead of a raw
 *  "Unexpected token '<'" (or Safari's differently-worded equivalent)
 *  parse error leaking straight to the screen. */
async function parseJsonResponse<T>(res: Response): Promise<T> {
  const text = await res.text();
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new ApiClientError("Something went wrong — please try again in a moment.", 502);
  }
  return unwrap<T>(json);
}

/** Shares one in-flight request across simultaneous identical GETs —
 *  e.g. the announcements ticker (rendered on every page, in the root
 *  layout) and a page's own `announcements.list()` call both firing on
 *  the same load previously meant two separate Apps Script executions
 *  for the same read. Keyed by the full request URL, cleared once the
 *  request settles, so it only collapses truly-concurrent calls — a
 *  later page visit still fetches fresh data, never stale. */
const inFlightGets = new Map<string, Promise<unknown>>();

async function apiGet<T>(action: string, params: Params = {}): Promise<T> {
  const url = new URL(apiUrl());
  url.searchParams.set("action", action);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
  });
  const key = url.toString();
  const existing = inFlightGets.get(key);
  if (existing) return existing as Promise<T>;

  const promise = (async () => {
    try {
      const res = await fetch(key);
      return await parseJsonResponse<T>(res);
    } finally {
      inFlightGets.delete(key);
    }
  })();
  inFlightGets.set(key, promise);
  return promise;
}

async function apiPost<T>(action: string, body: Params = {}): Promise<T> {
  const url = new URL(apiUrl());
  url.searchParams.set("action", action);
  const res = await fetch(url.toString(), {
    method: "POST",
    // text/plain avoids a CORS preflight (OPTIONS), which Apps Script Web
    // Apps don't handle. The body is still JSON — the backend parses it
    // regardless of the declared content type.
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(body),
  });
  return parseJsonResponse<T>(res);
}

export const api = {
  festival: {
    get: () => apiGet<FestivalInfo>("festival.get"),
  },
  blocks: {
    list: () => apiGet<Block[]>("blocks.list"),
  },
  events: {
    list: () => apiGet<EventRecord[]>("events.list"),
    register: (payload: {
      eventId: string;
      participantName: string;
      participantAge?: string;
      block: string;
      flatNumber: string;
      mobile: string;
      parentName?: string;
      parentMobile?: string;
      subCategory?: string;
      song?: string;
      songMimeType?: string;
      comments?: string;
    }) => apiPost<EventRegistration>("events.register", payload),
    updateSong: (registrationId: string, mobile: string, song: string, songMimeType: string) =>
      apiPost<{ registrationId: string; songUrl: string }>("events.registrations.updateSong", {
        registrationId,
        mobile,
        song,
        songMimeType,
      }),
    rsvp: (eventId: string, response: "YES" | "NO") =>
      apiPost<{ eventId: string; rsvpYes: number; rsvpNo: number }>("events.rsvp", { eventId, response }),
  },
  stats: {
    public: () => apiGet<PublicStats>("stats.public"),
  },
  announcements: {
    list: () => apiGet<Announcement[]>("announcements.list"),
  },
  bugs: {
    report: (payload: {
      description: string;
      screenshot?: string;
      mimeType?: string;
      reporterName?: string;
      reporterMobile?: string;
      pageUrl?: string;
    }) => apiPost<BugReport>("bugs.report", payload),
  },
  feedback: {
    submit: (payload: { message: string; reporterName?: string; reporterMobile?: string; pageUrl?: string }) =>
      apiPost<FeedbackReport>("feedback.submit", payload),
    listPublished: () => apiGet<FeedbackReport[]>("feedback.listPublished"),
  },
  payments: {
    extractReference: (image: string, mimeType: string) =>
      apiPost<ExtractReferenceResult>("payments.extractReference", { image, mimeType }),
  },
  donations: {
    create: (payload: { name: string; mobile: string; email?: string; block: string; flatNumber: string; amount: number }) =>
      apiPost<CreateDonationResult>("donations.create", payload),
    createHundi: (payload: { amount: number }) => apiPost<CreateDonationResult>("donations.createHundi", payload),
    submitReference: (transactionId: string, reference: string, screenshot?: string, mimeType?: string) =>
      apiPost<SubmitReferenceResult>("donations.submitReference", { transactionId, reference, screenshot, mimeType }),
    cancel: (transactionId: string) => apiPost<CancelResult>("donations.cancel", { transactionId }),
    get: (transactionId: string) => apiGet<DonationSummary>("donations.get", { transactionId }),
    mine: (mobile: string) => apiGet<DonationSummary[]>("donations.mine", { mobile }),
  },
  registrations: {
    mine: (mobile: string) => apiGet<EventRegistration[]>("registrations.mine", { mobile }),
  },
  dinner: {
    register: (payload: {
      eventId: string;
      name: string;
      mobile: string;
      email?: string;
      block: string;
      flatNumber: string;
      adults: number;
      children: number;
    }) => apiPost<DinnerRegisterResult>("dinner.register", payload),
    submitReference: (entitlementId: string, reference: string, screenshot?: string, mimeType?: string) =>
      apiPost<DinnerSubmitReferenceResult>("dinner.submitReference", { entitlementId, reference, screenshot, mimeType }),
    cancel: (entitlementId: string) => apiPost<CancelResult>("dinner.cancel", { entitlementId }),
    token: (tokenId: string) => apiGet<DinnerToken>("dinner.token", { tokenId }),
    mine: (mobile: string) => apiGet<MyDinnerToken[]>("dinner.mine", { mobile }),
  },
  volunteers: {
    register: (payload: {
      name: string;
      mobile: string;
      email?: string;
      block: string;
      flatNumber: string;
      areas: string[];
      availability?: string;
    }) => apiPost<VolunteerRegistration>("volunteers.register", payload),
    mine: (mobile: string) => apiGet<VolunteerRegistration[]>("volunteers.mine", { mobile }),
  },
  expenses: {
    mine: (mobile: string) => apiGet<Expense[]>("expenses.mine", { mobile }),
  },
  residents: {
    lookup: (mobile: string) => apiGet<ResidentLookup | null>("residents.lookup", { mobile }),
    pinStatus: (mobile: string) => apiGet<ResidentPinStatus>("residents.pinStatus", { mobile }),
    setPin: (mobile: string, pin: string) => apiPost<{ mobile: string }>("residents.setPin", { mobile, pin }),
    verifyPin: (mobile: string, pin: string) =>
      apiPost<{ mobile: string; verified: boolean }>("residents.verifyPin", { mobile, pin }),
  },
  communityDinner: {
    register: (payload: {
      residentName: string;
      mobile: string;
      block: string;
      flatNumber: string;
      adults: number;
      children: number;
      guestAdults?: number;
      guestChildren?: number;
    }) => apiPost<CommunityDinnerRegistration>("communityDinner.register", payload),
    submitPayment: (registrationId: string, reference: string, screenshot: string, mimeType: string) =>
      apiPost<{ registrationId: string; status: string }>("communityDinner.submitPayment", {
        registrationId,
        reference,
        screenshot,
        mimeType,
      }),
    cancel: (registrationId: string) =>
      apiPost<{ registrationId: string; status: string }>("communityDinner.cancel", { registrationId }),
    mine: (mobile: string) => apiGet<CommunityDinnerRegistration | null>("communityDinner.mine", { mobile }),
    publicCount: () => apiGet<CommunityDinnerPublicCount>("communityDinner.publicCount"),
  },
  volunteer: {
    authCheck: (idToken: string) => apiGet<Volunteer>("auth.check", { idToken }),
    dashboard: (idToken: string) => apiGet<VolunteerDashboard>("volunteer.dashboard", { idToken }),
    // Dedupes by transaction_id defensively — a duplicate row in the
    // Transactions sheet (e.g. from a manual edit) would otherwise
    // double-count into totals and break React's list keys everywhere
    // this feeds. Doesn't fix the underlying sheet, just the app's view.
    transactions: async (idToken: string) => {
      const rows = await apiGet<Transaction[]>("volunteer.transactions", { idToken });
      const seen = new Set<string>();
      return rows.filter((t) => {
        if (seen.has(t.transaction_id)) return false;
        seen.add(t.transaction_id);
        return true;
      });
    },
    verifyPayment: (idToken: string, transactionId: string, notes?: string) =>
      apiPost<{ transactionId: string; status: string; receiptUrl: string }>("volunteer.payment.verify", {
        idToken,
        transactionId,
        notes,
      }),
    rejectPayment: (idToken: string, transactionId: string, notes?: string) =>
      apiPost<{ transactionId: string; status: string }>("volunteer.payment.reject", {
        idToken,
        transactionId,
        notes,
      }),
    attachPaymentScreenshot: (idToken: string, transactionId: string, screenshot: string, mimeType: string) =>
      apiPost<{ transactionId: string; screenshotUrl: string }>("volunteer.payment.attachScreenshot", {
        idToken,
        transactionId,
        screenshot,
        mimeType,
      }),
    createEvent: (
      idToken: string,
      payload: {
        name: string;
        description?: string;
        date: string;
        startTime: string;
        endTime?: string;
        location: string;
        category: string;
        ageGroup?: string;
        capacity?: number;
        fee?: number;
        status?: string;
        tokenCode?: string;
        subCategories?: string[];
        whatsappIntro?: string;
      }
    ) => apiPost<EventRecord>("volunteer.events.create", { idToken, ...payload }),
    updateEvent: (
      idToken: string,
      eventId: string,
      payload: {
        name: string;
        description?: string;
        date: string;
        startTime: string;
        endTime?: string;
        location: string;
        category: string;
        ageGroup?: string;
        capacity?: number;
        fee?: number;
        subCategories?: string[];
        whatsappIntro?: string;
      }
    ) => apiPost<EventRecord>("volunteer.events.update", { idToken, eventId, ...payload }),
    updateEventStatus: (idToken: string, eventId: string, status: string) =>
      apiPost<{ eventId: string; status: string }>("volunteer.events.updateStatus", { idToken, eventId, status }),
    eventRegistrations: (idToken: string, eventId: string) =>
      apiGet<EventRegistration[]>("volunteer.events.registrations", { idToken, eventId }),
    pendingRegistrations: (idToken: string) =>
      apiGet<EventRegistration[]>("volunteer.events.registrations.pending", { idToken }),
    allRegistrations: (idToken: string) =>
      apiGet<EventRegistration[]>("volunteer.events.registrations.all", { idToken }),
    approveRegistration: (idToken: string, registrationId: string) =>
      apiPost<EventRegistration>("volunteer.events.registrations.approve", { idToken, registrationId }),
    rejectRegistration: (idToken: string, registrationId: string, reason?: string) =>
      apiPost<EventRegistration>("volunteer.events.registrations.reject", { idToken, registrationId, reason }),
    checkIn: (idToken: string, registrationId: string) =>
      apiPost<{ registrationId: string; alreadyCheckedIn: boolean; checkedInAt: string }>(
        "volunteer.events.checkin",
        { idToken, registrationId }
      ),
    dinnerDashboard: (idToken: string, eventId: string) =>
      apiGet<DinnerDashboard>("volunteer.dinner.dashboard", { idToken, eventId }),
    dinnerRedeem: (idToken: string, tokenId: string, quantity: number, counterId?: string) =>
      apiPost<RedeemResult>("volunteer.dinner.redeem", { idToken, tokenId, quantity, counterId }),
    dinnerWalkin: (
      idToken: string,
      payload: { eventId: string; block: string; flatNumber: string; meals: number }
    ) => apiPost<{ entitlementId: string; tokenId: string }>("volunteer.dinner.walkin", { idToken, ...payload }),
    dinnerPayments: (idToken: string) => apiGet<EntitlementRow[]>("volunteer.dinner.payments", { idToken }),
    approveDinnerPayment: (idToken: string, entitlementId: string) =>
      apiPost<{ entitlementId: string; tokenId: string; status: string }>("volunteer.dinner.payment.approve", {
        idToken,
        entitlementId,
      }),
    rejectDinnerPayment: (idToken: string, entitlementId: string, notes?: string) =>
      apiPost<{ entitlementId: string; status: string }>("volunteer.dinner.payment.reject", {
        idToken,
        entitlementId,
        notes,
      }),
    volunteersList: (idToken: string) => apiGet<VolunteerRoster>("volunteer.volunteers.list", { idToken }),
    activateVolunteer: (idToken: string, volunteerId: string) =>
      apiPost<{ volunteerId: string; status: string }>("volunteer.volunteers.activate", { idToken, volunteerId }),
    approveVolunteerArea: (idToken: string, volunteerId: string, area: string) =>
      apiPost<{ volunteerId: string; area: string; approvedAreas: string[]; status: string; guidelines: string }>(
        "volunteer.volunteers.approveArea",
        { idToken, volunteerId, area }
      ),
    declineVolunteerArea: (idToken: string, volunteerId: string, area: string) =>
      apiPost<{ volunteerId: string; area: string; remainingAreas: string[] }>(
        "volunteer.volunteers.declineArea",
        { idToken, volunteerId, area }
      ),
    createAnnouncement: (
      idToken: string,
      payload: { title: string; message: string; expiresAt?: string; relatedEventId?: string }
    ) => apiPost<Announcement>("volunteer.announcements.create", { idToken, ...payload }),
    updateAnnouncement: (
      idToken: string,
      announcementId: string,
      payload: { title: string; message: string; expiresAt?: string }
    ) =>
      apiPost<{ announcementId: string; title: string; message: string; expiresAt: string }>(
        "volunteer.announcements.update",
        { idToken, announcementId, ...payload }
      ),
    deactivateAnnouncement: (idToken: string, announcementId: string) =>
      apiPost<{ announcementId: string; active: boolean }>("volunteer.announcements.deactivate", {
        idToken,
        announcementId,
      }),
    exportReport: (idToken: string, reportKey: string) =>
      apiGet<ReportExport>("volunteer.reports.export", { idToken, reportKey }),
    listConfig: (idToken: string) => apiGet<ConfigEntry[]>("volunteer.config.list", { idToken }),
    updateConfig: (idToken: string, updates: Record<string, string>) =>
      apiPost<ConfigEntry[]>("volunteer.config.update", { idToken, updates }),
    runBackup: (idToken: string) =>
      apiPost<{ name: string; url: string; created: boolean }>("volunteer.backup.run", { idToken }),
    auditLog: (idToken: string) => apiGet<AuditLogEntry[]>("volunteer.auditLog.list", { idToken }),
    bugsList: (idToken: string) => apiGet<BugReport[]>("volunteer.bugs.list", { idToken }),
    updateBugStatus: (idToken: string, bugId: string, status: "OPEN" | "IN_PROGRESS" | "CLOSED") =>
      apiPost<{ bugId: string; status: string }>("volunteer.bugs.updateStatus", { idToken, bugId, status }),
    feedbackList: (idToken: string) => apiGet<FeedbackReport[]>("volunteer.feedback.list", { idToken }),
    updateFeedbackStatus: (idToken: string, feedbackId: string, status: "PENDING" | "PUBLISHED" | "DECLINED") =>
      apiPost<{ feedbackId: string; status: string }>("volunteer.feedback.updateStatus", {
        idToken,
        feedbackId,
        status,
      }),
    communityDinnerList: (idToken: string) =>
      apiGet<CommunityDinnerRegistration[]>("volunteer.communityDinner.list", { idToken }),
    communityDinnerPayments: (idToken: string) =>
      apiGet<CommunityDinnerRegistration[]>("volunteer.communityDinner.payments", { idToken }),
    approveCommunityDinnerPayment: (idToken: string, registrationId: string) =>
      apiPost<{ registrationId: string; status: string }>("volunteer.communityDinner.payment.approve", {
        idToken,
        registrationId,
      }),
    rejectCommunityDinnerPayment: (idToken: string, registrationId: string, notes?: string) =>
      apiPost<{ registrationId: string; status: string }>("volunteer.communityDinner.payment.reject", {
        idToken,
        registrationId,
        notes,
      }),
    editCommunityDinnerRegistration: (
      idToken: string,
      registrationId: string,
      fields: Partial<{
        resident_name: string;
        mobile: string;
        block: string;
        flat_number: string;
        adults: number;
        children: number;
        guest_adults: number;
        guest_children: number;
        status: string;
        admin_notes: string;
      }>
    ) => apiPost<CommunityDinnerRegistration>("volunteer.communityDinner.edit", { idToken, registrationId, ...fields }),
    lookupBhogSponsorDonations: (idToken: string, mobile: string) =>
      apiGet<BhogSponsorLookup>("volunteer.bhogSponsors.lookupDonations", { idToken, mobile }),
    recordBhogSponsor: (
      idToken: string,
      payload: { mobile: string; residentName: string; transactionIds?: string[]; amount: number; bhogDate: string }
    ) => apiPost<BhogSponsor>("volunteer.bhogSponsors.record", { idToken, ...payload }),
    bhogSponsorsList: (idToken: string) => apiGet<BhogSponsor[]>("volunteer.bhogSponsors.list", { idToken }),
    recordFutureCost: (
      idToken: string,
      payload: { date: string; amount: number; purpose: string; vendorChecked: boolean }
    ) => apiPost<FutureCost>("volunteer.futureCosts.record", { idToken, ...payload }),
    futureCostsList: (idToken: string) => apiGet<FutureCost[]>("volunteer.futureCosts.list", { idToken }),
    resetResidentPin: (idToken: string, mobile: string) =>
      apiPost<{ mobile: string }>("volunteer.residents.resetPin", { idToken, mobile }),
    recordExpense: (
      idToken: string,
      payload: {
        date: string;
        amount: number;
        purpose: string;
        screenshot?: string;
        mimeType?: string;
        spenderName?: string;
        spenderMobile: string;
        upiId?: string;
      }
    ) => apiPost<Expense>("volunteer.expenses.record", { idToken, ...payload }),
    expensesList: (idToken: string) => apiGet<Expense[]>("volunteer.expenses.list", { idToken }),
    approveExpense: (idToken: string, expenseId: string) =>
      apiPost<{ expenseId: string; status: string }>("volunteer.expenses.approve", { idToken, expenseId }),
    rejectExpense: (idToken: string, expenseId: string, notes?: string) =>
      apiPost<{ expenseId: string; status: string }>("volunteer.expenses.reject", { idToken, expenseId, notes }),
    expensesSettlementSummary: (idToken: string) =>
      apiGet<ExpenseSettlement[]>("volunteer.expenses.settlementSummary", { idToken }),
    settleSpenderExpenses: (idToken: string, spenderMobile: string) =>
      apiPost<{ spenderMobile: string; settledCount: number; settledTotal: number }>(
        "volunteer.expenses.settle",
        { idToken, spenderMobile }
      ),
  },
};
