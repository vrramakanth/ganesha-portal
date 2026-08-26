/**
 * Shapes mirror exactly what the Apps Script backend returns. Some
 * endpoints return raw Sheet rows (snake_case, whatever the sheet's header
 * row says) and some return hand-built response objects (camelCase) — see
 * backend/README.md's API surface table. Kept as-is rather than
 * normalized here so this file stays an honest mirror of the backend.
 */

export type FestivalInfo = {
  festival_name: string;
  dates: string;
  venue: string;
  donation_goal: string;
  minimum_donation: string;
  contact: string;
  upi_vpa: string;
  upi_payee_name: string;
};

export type Block = {
  block_id: string;
  block_name: string;
  active: string;
};

export type EventRecord = {
  event_id: string;
  name: string;
  description: string;
  date: string;
  start_time: string;
  end_time: string;
  location: string;
  category: string;
  age_group: string;
  capacity: number | string;
  registration_required: string;
  registration_deadline: string;
  fee: number | string;
  status: "DRAFT" | "OPEN" | "FULL" | "CLOSED" | "CANCELLED" | "COMPLETED";
  contact_volunteer: string;
  token_code: string;
};

export type PublicStats = {
  totalCollected: number;
  donationCount: number;
  families: number;
  goal: number;
  byBlock: { block: string; amount: number }[];
};

export type Announcement = {
  announcement_id: string;
  title: string;
  message: string;
  published_at: string;
  expires_at: string;
  active: string;
  related_event_id: string;
};

export type CreateDonationResult = {
  transactionId: string;
  amount: number;
  currency: string;
};

export type SubmitReferenceResult = {
  transactionId: string;
  status: string;
};

export type CancelResult = {
  transactionId: string;
  status: string;
};

export type DonationSummary = {
  transactionId: string;
  amount: number;
  status: string;
  createdAt: string;
  receiptUrl: string;
};

export type EventRegistration = {
  registration_id: string;
  event_id: string;
  resident_id: string;
  participant_name: string;
  participant_age: string;
  block: string;
  flat_number: string;
  mobile: string;
  parent_name: string;
  parent_mobile: string;
  status: string;
  check_in_at: string;
  created_at: string;
};

export type DinnerRegisterResult =
  | { entitlementId: string; tokenId: string; paymentRequired: false }
  | { entitlementId: string; paymentRequired: true; amount: number; currency: string };

export type DinnerSubmitReferenceResult = {
  entitlementId: string;
  status: string;
};

export type ExtractReferenceResult = {
  guess: string;
  rawText: string;
};

export type DinnerToken = {
  tokenId: string;
  flatNumber: string;
  block: string;
  allocated: number;
  served: number;
  remaining: number;
  status: string;
};

/** Raw Entitlements sheet row, as returned by listDinnerPaymentsForReview. */
export type EntitlementRow = {
  entitlement_id: string;
  event_id: string;
  resident_id: string;
  token_id: string;
  allocated_quantity: number;
  redeemed_quantity: number;
  remaining_quantity: number;
  source: string;
  status: string;
  block: string;
  flat_number: string;
  created_at: string;
};

export type MyDinnerToken = {
  entitlementId: string;
  tokenId: string;
  eventId: string;
  allocated: number;
  served: number;
  remaining: number;
  status: string;
};

export type VolunteerRegistration = {
  volunteer_id: string;
  resident_id: string;
  name: string;
  mobile: string;
  block: string;
  flat_number: string;
  areas: string;
  availability: string;
  status: string;
  created_at: string;
};

export type ApiErrorPayload = {
  ok: false;
  error: string;
  status: number;
};

// --- Volunteer-side ---

export type Volunteer = {
  email: string;
  name: string;
  permissions: string[];
  isSuperAdmin: boolean;
};

export type Transaction = {
  transaction_id: string;
  resident_id: string;
  created_at: string;
  resident_name: string;
  block: string;
  flat_number: string;
  mobile: string;
  email: string;
  amount: number;
  currency: string;
  payment_provider: string;
  payment_order_id: string;
  payment_id: string;
  payment_reference: string;
  status: string;
  verified_at: string;
  receipt_id: string;
  receipt_url: string;
  source: string;
  admin_notes: string;
  updated_at: string;
};

export type VolunteerDashboard = {
  collected: number;
  donationCount: number;
  mealsRegistered: number;
  mealsServed: number;
  volunteerCount: number;
  alerts: string[];
};

export type VolunteerRosterArea = { area: string; filled: number; required: number };

export type VolunteerRoster = {
  registered: number;
  required: number;
  byArea: VolunteerRosterArea[];
  volunteers: VolunteerRegistration[];
};

export type DinnerDashboard = {
  eventId: string;
  capacity: number;
  allocated: number;
  served: number;
  remaining: number;
  advance: number;
  walkIns: number;
  utilization: number;
};

export type RedeemResult = {
  tokenId: string;
  redeemed: number;
  remaining: number;
  status: string;
};

export type ReportExport = { filename: string; csv: string };

export type ConfigEntry = { key: string; value: string };

export type AuditLogEntry = {
  timestamp: string;
  volunteer_id: string;
  action: string;
  entity: string;
  entity_id: string;
  old_value: string;
  new_value: string;
};
