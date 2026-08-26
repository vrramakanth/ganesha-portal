import type {
  Announcement,
  AuditLogEntry,
  Block,
  CancelResult,
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
  ExtractReferenceResult,
  FestivalInfo,
  MyDinnerToken,
  PublicStats,
  RedeemResult,
  ReportExport,
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

async function apiGet<T>(action: string, params: Params = {}): Promise<T> {
  const url = new URL(apiUrl());
  url.searchParams.set("action", action);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
  });
  const res = await fetch(url.toString());
  return unwrap<T>(await res.json());
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
  return unwrap<T>(await res.json());
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
    }) => apiPost<EventRegistration>("events.register", payload),
  },
  stats: {
    public: () => apiGet<PublicStats>("stats.public"),
  },
  announcements: {
    list: () => apiGet<Announcement[]>("announcements.list"),
  },
  payments: {
    extractReference: (image: string, mimeType: string) =>
      apiPost<ExtractReferenceResult>("payments.extractReference", { image, mimeType }),
  },
  donations: {
    create: (payload: { name: string; mobile: string; email?: string; block: string; flatNumber: string; amount: number }) =>
      apiPost<CreateDonationResult>("donations.create", payload),
    submitReference: (transactionId: string, reference: string) =>
      apiPost<SubmitReferenceResult>("donations.submitReference", { transactionId, reference }),
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
    submitReference: (entitlementId: string, reference: string) =>
      apiPost<DinnerSubmitReferenceResult>("dinner.submitReference", { entitlementId, reference }),
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
  volunteer: {
    authCheck: (idToken: string) => apiGet<Volunteer>("auth.check", { idToken }),
    dashboard: (idToken: string) => apiGet<VolunteerDashboard>("volunteer.dashboard", { idToken }),
    transactions: (idToken: string) => apiGet<Transaction[]>("volunteer.transactions", { idToken }),
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
      }
    ) => apiPost<EventRecord>("volunteer.events.create", { idToken, ...payload }),
    eventRegistrations: (idToken: string, eventId: string) =>
      apiGet<EventRegistration[]>("volunteer.events.registrations", { idToken, eventId }),
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
    createAnnouncement: (
      idToken: string,
      payload: { title: string; message: string; expiresAt?: string; relatedEventId?: string }
    ) => apiPost<Announcement>("volunteer.announcements.create", { idToken, ...payload }),
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
    auditLog: (idToken: string) => apiGet<AuditLogEntry[]>("volunteer.auditLog.list", { idToken }),
  },
};
