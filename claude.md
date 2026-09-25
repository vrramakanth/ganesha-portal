# claude.md
## Brigade Woods Community Festival Portal — Consolidated Product & Technical Specification

This document is both the original product spec and a living description of what is actually built. Sections describe the **current implementation** unless marked "Not yet built" / "Future". Where the build has deliberately diverged from the original plan (e.g. the payment flow, the event nomination workflow, volunteer areas), that is called out explicitly rather than silently replaced, so the reasoning survives.

---

# 1. Product Overview

Build a simple, mobile-first web portal for organising the **Brigade Woods Ganesha Chathurthi 2026** community festival.

The portal should deliberately remain simple and have only **two user experiences**:

1. **Resident**
2. **Volunteer**

Volunteers have higher privileges and act as the operational/admin users of the system.

The portal should not feel like a complex enterprise application. A resident should be able to complete common tasks in a few taps, while volunteers should have a practical dashboard to manage the festival.

The architecture should be reusable for future Brigade Woods community festivals and events.

---

# 2. Core Product Principle

## Keep the interface extremely simple

A resident should see approximately:

```text
BRIGADE WOODS
GANESHA CHATHURTHI

[ DONATE ]

[ EVENTS ]

[ DINNER / PRASADAM ]

[ MY REGISTRATIONS ]

[ VOLUNTEER ]

Collection so far
₹XX,XXX
```

A volunteer should see:

```text
VOLUNTEER DASHBOARD

₹XX,XXX collected
XXX donations
XXX dinner meals
XXX volunteers
XXX event registrations

[ DONATIONS ]
[ DINNER ]
[ EVENTS ]
[ VOLUNTEERS ]
[ REPORTS ]
```

Avoid unnecessary menus, account management and complex workflows.

---

# 3. Goals

## Resident Goals

Residents should be able to:

- Understand the festival.
- Donate easily.
- Receive a receipt.
- See collection progress.
- View festival events.
- Register for activities — including multiple Cultural performances in one visit.
- Register for community dinner/prasadam.
- Receive digital tokens where applicable.
- Check their registrations.
- Volunteer.
- Report a bug they hit in the portal itself.
- Receive important festival information.

## Volunteer Goals

Volunteers should be able to:

- See festival status.
- Manage donations and reconciliation, including OCR-assisted UPI reference review.
- Manage events and registrations, including a nomination review queue for Cultural/other events.
- Manage dinner/prasadam tokens, including payment review for paid dinner days.
- Scan and redeem tokens.
- Manage volunteers, including per-area approval.
- Handle walk-ins.
- Record and settle lightweight expense reimbursements.
- Triage bug reports.
- View operational reports.
- Export data.
- Update festival configuration where permitted.
- Run an on-demand backup of the operational spreadsheet.

---

# 4. User Roles

Only two roles exist.

## 4.1 Resident

Default user.

Residents can:

- View public festival information.
- Donate.
- Register for events.
- Register for dinner/prasadam.
- View their own registrations.
- View their own receipts/tokens/expense claims.
- Volunteer.
- Report a bug.
- View aggregate collection information.

Residents cannot:

- View other residents' data.
- View individual donations.
- Modify transactions.
- Manage events.
- Manage volunteers.
- Reconcile payments.
- Access administrative reports.

## 4.2 Volunteer

Volunteers have higher privileges.

Volunteers can:

- View individual donations.
- Verify payments where required.
- Generate/view receipts.
- Manage events, including approving/rejecting nominations.
- Manage registrations.
- Manage dinner/prasadam, including reviewing paid dinner payments.
- Scan and redeem tokens.
- Create walk-in registrations.
- Manage volunteers, area by area.
- Record and approve expense claims.
- Triage bug reports.
- View operational reports.
- Export data.
- Publish/update festival information where permitted.
- Run a manual backup.

Certain sensitive actions should require a higher volunteer permission internally, even though the product still presents only one "Volunteer" role.

Actual permission areas (stored comma-separated on each row of the `Admins` sheet):

```text
VOLUNTEER
├── Operations
├── Events
├── Dinner
├── Finance
└── Content
```

A blank `permissions` cell means "every permission" — this grandfathers in any admin added before this was enforced.

A further tier sits above these five areas: a small, configurable list of **super admin** emails (`super_admin_email` in Configuration, defaulting to three founding admins) is the only group allowed to approve/decline/activate volunteer applications, regardless of who else holds the `Operations` permission. This is checked server-side (`requireSuperAdmin`), not just hidden in the UI.

This is permission-based access, not a third public-facing role.

---

# 5. Navigation

## Resident

Keep the primary navigation to five items:

```text
HOME
EVENTS
DONATE
MY STUFF
MORE
```

"MY STUFF" is a single mobile-number lookup (no login) covering:

- My donations
- My receipts
- My event/Cultural nominations (with status, and a place to add/replace a song)
- My dinner tokens
- My volunteer application status (per area)
- My expense claims

## Volunteer

Primary navigation:

```text
DASHBOARD
DONATIONS
EVENTS
DINNER
VOLUNTEERS
MORE
```

"MORE":

- Reports
- Announcements
- Bug reports
- Settings (festival configuration + manual backup)
- Audit log

Resident "MORE" additionally carries: a How-To Guide PDF, Report a Bug, Share Your Feedback (§65), a highlighted "Upload & Check Photos" tile linking to the external Festival Photos album (§67), a "Join Seva" CTA, and a "Clear My Saved Details" control for the browser-local resident profile.

Expenses live under **Donations → Finance** permission rather than their own top-level tab (see §30).

On mobile, use a bottom navigation bar where practical.

---

# 6. Authentication

## Resident — not yet a real authentication system

The original plan (mobile OTP / magic link / Google sign-in) is **not implemented**. A resident is identified purely by whatever 10-digit mobile number they type into a form (validated as `^[6-9]\d{9}$`, nothing more) — every resident-facing endpoint (`donations.mine`, `registrations.mine`, `dinner.mine`, `volunteers.mine`, `expenses.mine`) trusts that number as-is, with no verification step. This is a deliberate, documented interim tradeoff (see `Residents.js`, `backend/README.md`) while there's no resident-facing frontend auth calling these endpoints — it must be closed before the portal is exposed beyond the current trusted rollout.

What *is* implemented for residents:

- The frontend saves a resident's last-used name/mobile/block/flat in the browser (`useResidentProfile`) so forms pre-fill and the portal doesn't ask for the same details twice, per spec's original intent — this is a client-side convenience only, not a session.
- Every donation/registration/volunteer sign-up upserts a `Residents` row keyed by mobile number, so the same person's identity stays consistent across the portal even without a login step.

## Volunteer

Implemented as specified:

- The frontend signs a volunteer in with **Google Identity Services**; the resulting Google ID token is sent with every volunteer request.
- The backend verifies it server-side against Google's `tokeninfo` endpoint (signature + expiry + audience + verified email), then looks the verified email up in the `Admins` sheet (`Auth.js`).
- A volunteer's `permissions` cell drives what they can do; hiding the Volunteer menu in the UI is explicitly not treated as security — every volunteer route re-checks `idToken` and permission server-side.

A volunteer is a resident too, just with elevated access (Decision 1) — signing in to the Volunteer experience does not replace the Resident experience. A "Resident View" link in the volunteer header returns to the resident-facing pages at any time, and a "Volunteer Login" link on the resident Home page returns to the volunteer dashboard without re-authenticating, since the sign-in session persists for the browser session.

---

# 7. Home Page

The home page should immediately answer:

**What is happening?**

**How can I participate?**

**How much has the community collected?**

Suggested layout:

```text
------------------------------------------------
BRIGADE WOODS

GANESHA CHATHURTHI 2026

Celebrate. Participate. Contribute.

[ DONATE NOW ]

₹4,25,000
COLLECTED

278 FAMILIES PARTICIPATING

------------------------------------------------

UPCOMING

Today
Community Dinner
7:00 PM

Tomorrow
Kids Cultural Program
5:30 PM

[ VIEW ALL EVENTS ]

------------------------------------------------

COMMUNITY DINNER
Day 1 registrations open

[ REGISTER ]

------------------------------------------------
```

The original mockup above is the intent; the actual build has since evolved past it — both in what it shows and, after a deliberate decluttering pass, in how much of it shows by default:

```text
[ small "Magic Moments" pill, top-right — links to the
  external Festival Photos album, §67 ]

(hero image)
BRIGADE WOODS
GANESHA CHATHURTHI 2026
Celebrate. Participate. Contribute.

[ DONATE NOW ]

₹4,25,000            ₹1,20,000
COLLECTED            SPENT (SO FAR)
186 families participating

UPCOMING
(next 2 OPEN events, soonest first — the very first shows an
 "N attending" badge if it has RSVP yeses; RSVP/register CTA
 text per §15)
View all events →

NEWS
(single most recent active announcement only)
See all updates →                 -- only if more than one is active

COMMUNITY DINNER
(current OPEN dinner event, if any)
[ REGISTER ]

COMMUNITY VOICES
(single most recent PUBLISHED feedback quote, §65 — clamped to
 4 lines with a Read more / Show less toggle)

Need help?
Admin Login
```

Notes on what changed from the original design and why:

- **Collected + Spent (so far)** are shown side by side, same size/color/shape, from `stats.public` (`totalCollected`/`totalExpenses`), both cached server-side (§13, §55).
- **Upcoming** shows only the next `OPEN` event's RSVP count, not every card's — showing it everywhere made the list feel like a leaderboard instead of pointing at what's happening soonest.
- **News and Community Voices are capped to one item each** on Home, with a link to see more (News → the full list on More; Community Voices has no "see all" surface today, it's Home-only). This was a deliberate UX trim: the page had accumulated 11 stacked sections and ~7 competing CTAs over the course of feature additions, past the "keep it simple" standard this spec itself sets (§2, §43) — so it was pulled back to one item per section, "View all events" and "See all updates" demoted from full-width buttons to small text links, and only one pulsing/attention-grabbing accent kept on screen at a time (the RSVP prompts' `animate-twinkle`, not the Magic Moments badge).
- **The hero Ganesha image** is cropped tightly to its actual content (the original asset had large internal transparent padding — the deity filled only ~47% of the canvas height) so the same rendered box shows a visibly bigger image.
- The original "COMMUNITY DINNER" card is unchanged in spirit — shown only when a dinner event is currently `OPEN`.

---

# 8. Festival Information

Maintain a simple festival information page containing:

- Festival name
- Dates
- Location
- Key timings
- Event schedule
- Contact volunteers
- Important instructions
- Payment information where relevant

Content should be configurable by volunteers (see §46 Festival Configuration — this is backed by the `Configuration` sheet's key/value rows, editable from Volunteer → More → Settings).

---

# 9. Donations

## Resident Workflow (as built)

```text
DONATE
   |
   v
Name, Mobile, Email (optional), Block, Flat, Amount
   |
   v
Create Donation  →  transaction created as PAYMENT_PENDING
   |
   v
Pay via UPI (QR / app link / copy VPA)
   |
   v
Enter UPI reference (OCR-assisted) + optional screenshot
   |
   v
MANUAL_REVIEW
   |
   v
Volunteer verifies  →  VERIFIED_SUCCESS
   |
   v
Receipt (auto-generated, PDF in Drive)
```

Mandatory:

- Resident name
- Mobile (also the identity key used for "My Stuff" lookups — not optional in practice, unlike the original plan)
- Block
- Flat number
- Donation amount

Optional:

- Email

Not implemented: an anonymous/public-recognition preference on the donation form. The public dashboard never shows names regardless (see §13), so this hasn't been needed yet.

The resident can back out of a still-pending donation with a **Cancel** option on the reference-entry screen — this moves it to `CANCELLED` rather than leaving an orphaned `PAYMENT_PENDING` row.

## Block Input

Block is a single letter, typed directly rather than chosen from a dropdown, restricted client-side to a fixed set: **A–H, J–N, P–S** (I and O are excluded — easily confused with 1 and 0).

The backend independently validates the typed block against the master list in Google Sheets (`Blocks`) — the frontend restriction is a UX convenience, not the source of truth.

## Flat Number

Flat number is a mandatory 3-digit number. Flats 1–99 must be zero-padded (e.g. `005`, `023`); the input restricts entry to digits only, capped at 3 characters.

## Donation Amount

Quick amounts, as built:

```text
₹500
₹1,000
₹2,000
₹5,000
Other
```

Minimum and maximum donation are both configurable (`minimum_donation`, `maximum_donation` in Configuration; maximum defaults to ₹1,00,000), and enforced server-side, not just as input hints.

---

# 10. Payment Architecture (as built)

## What actually ships today

There is no live payment-gateway integration wired into the UI. The active, and only, path is the **manual-review UPI flow** the original spec offered as the HDFC-static-QR fallback — this is now the primary and sole payment path for both donations and paid dinner days:

```text
Resident
   |
   v
Display UPI QR / app-link picker / copy VPA
   |
   v
Resident pays in their own UPI app
   |
   v
Resident types (or uploads a screenshot of) the UPI reference
   |
   v
Best-effort OCR pre-fill of the reference (never authoritative)
   |
   v
MANUAL_REVIEW
   |
   v
Volunteer independently verifies against the bank/UPI statement
   |
   v
VERIFIED_SUCCESS
   |
   v
Receipt
```

A resident's own claim of "I have paid" is never sufficient — `submitPaymentReference` (`Donations.js`) can only ever move a transaction to `MANUAL_REVIEW`, never to a success state. Only `verifyPaymentManual`, gated behind the `Finance` permission, can do that (Decision 4).

**OCR pre-fill** (`Ocr.js`, `payments.extractReference`): an uploaded screenshot is sent through Apps Script's Drive-based OCR to guess the UPI reference — a 12-digit RRN/UTR pattern first, then a labelled fallback ("UPI transaction ID", "RRN", "UTR", "Ref No.", "Txn ID", …) to cover GPay/PhonePe/BHIM/Paytm/CRED/bank-app phrasing. The guess pre-fills an editable field; if OCR fails or isn't enabled, the resident just types the reference by hand. Either way, a volunteer still checks the real statement before verifying — OCR is a convenience, never a trust boundary.

**Screenshot storage**: both the resident's own upload (at reference-submission time) and a volunteer's later `attachPaymentScreenshot` backfill (for a screenshot sent over WhatsApp instead of through the app) save to a `Payment Screenshots` Drive folder and are linked from the transaction row, so a volunteer reviewing the Donations queue can open the actual image next to the claimed reference.

**A volunteer's static UPI QR is currently shown** (`USE_STATIC_BANK_QR = true` in `PaymentReferenceStep.tsx`) rather than a dynamically-generated one encoding the exact amount — the bank-hosted merchant QR was confirmed to accept payments where a dynamically generated collect-request QR was not, at the cost of the resident having to type the amount in manually after scanning. A "pick your UPI app" button picker exists in the code but is currently disabled (`APP_PICKER_ENABLED = false`) for the same underlying reason; "Copy UPI ID" is the one option offered today. Both are one-line flags to flip back once the merchant account issue is resolved.

## Legacy/dormant gateway code

`Payments.js` (server) and `frontend/src/lib/razorpay.ts` implement a full Razorpay client-checkout integration — order creation, HMAC signature verification of `{order_id, payment_id, signature}` (chosen specifically because Apps Script Web Apps can't read the `X-Razorpay-Signature` header a real webhook needs), and a `TEST_MODE` short-circuit. **None of this is currently called from the resident-facing UI** — no page invokes `openRazorpayCheckout`, and `confirmDinnerPayment` (the dinner-side Razorpay confirmation handler) isn't routed from `Code.js`. It's kept in place, working and tested via `TEST_MODE`, so a real payment gateway can be re-enabled later without redesigning the transaction/entitlement model — everything else in this backend stays the same either way.

Never mark a donation successful merely because the resident clicks:

> "I have paid."

---

# 11. Payment States

Defined (spec list, unchanged):

```text
INITIATED
PAYMENT_PENDING
SUCCESS
FAILED
EXPIRED
MANUAL_REVIEW
VERIFIED_SUCCESS
CANCELLED
REFUNDED
```

States actually reached by the current UPI-manual-review flow: `PAYMENT_PENDING` → `MANUAL_REVIEW` → `VERIFIED_SUCCESS`, or → `CANCELLED` (resident-initiated) / `FAILED` (volunteer rejects). `SUCCESS` is reserved for the dormant automated-gateway path (§10) and isn't produced by anything live today; `INITIATED`, `EXPIRED`, `REFUNDED` aren't used yet either.

Successful collection totals must include only:

```text
SUCCESS
VERIFIED_SUCCESS
```

---

# 12. Receipts

Generate a receipt only after verified payment — `generateReceipt` runs automatically inside `verifyPaymentManual`, never as a separate step a resident can trigger.

Receipt template (Google Doc → PDF):

```text
BRIGADE WOODS
GANESHA CHATHURTHI 2026

DONATION RECEIPT

Receipt No: GWG-R-000123
Transaction: GWG-20260822-000123

Name: John Doe
Block: F
Flat: 204

Amount: ₹1,000
Date: 22-Aug-2026
Payment Reference: XXXXX

STATUS: VERIFIED_SUCCESS

Thank you for contributing.
```

Receipt is:

- Viewable online (Drive-hosted PDF link)
- Downloadable as PDF
- Shareable (plain link)
- Stored in Google Drive (`<Festival Name>/Receipts`)
- Referenced from Google Sheets (`receipt_id`, `receipt_url` columns on `Transactions`)

Do not store large PDF files directly inside Sheets.

---

# 13. Public Collection Dashboard

Residents can see aggregate statistics only. `stats.public` (cached 5 minutes, invalidated on every payment verification) returns:

```text
TOTAL COLLECTION
₹4,25,000

DONATIONS
312

FAMILIES
278   (unique block+flat combinations with a successful donation)
```

Also block-wise collection:

```text
Block A   ₹85,000
Block B   ₹72,000
Block C   ₹64,000
...
```

Do not show:

- Resident names
- Flat numbers
- Individual donation amounts
- UTRs
- Payment IDs

The donation goal (`donation_goal` config) is returned alongside the total so the frontend can render progress (e.g. `₹4.25L of ₹7.50L goal`). A "participation %" figure from the original mockups isn't computed anywhere yet — only the raw families/donations counts are.

---

# 14. Festival Events

Volunteers can create and manage events.

Each event contains:

- Event name
- Description
- Date
- Start time
- End time
- Location
- Category — including a `Cultural` category with its own sub-flow (see below)
- Age group
- Capacity
- Registration required
- Registration deadline
- Fee (paid events accept configuration but registration is still blocked — see §15)
- Contact volunteer (defaults to the creating volunteer's email)
- Status

Event statuses:

```text
DRAFT
OPEN
FULL
CLOSED
CANCELLED
COMPLETED
```

Publish/Close/Cancel are the only ways to move status (`volunteer.events.updateStatus`) — a newly created event stays `DRAFT` (and invisible to residents) until explicitly published. `CANCELLED`/`COMPLETED` are terminal.

## Cultural sub-categories

For events with `category = "Cultural"`, an organizer picks a subset of performance types when creating/editing the event — not every Cultural event needs the same options (a Bhajan event and a general Cultural Program can differ):

```text
Dance
Vocal/Singing
Instrument
Recitation
Other
```

Stored comma-separated on the event's `sub_categories` column. (An older saved value of `Vocal` is transparently treated as `Vocal/Singing` so a rename doesn't orphan existing data.)

---

# 15. Resident Event Registration

Example:

```text
KIDS DRAWING COMPETITION

Age: 6–10
Date: 29 Aug
Time: 4:00 PM
Venue: Central Courtyard

[ REGISTER ]
```

Registration form is minimal: participant name, mobile, block, flat — plus, for children's events, age/parent name/parent mobile as originally specced.

Only free events (`fee = 0`) can be registered for; a paid event stays blocked with "Registration for paid events is coming soon" (Phase 2, unchanged from the original plan).

## One-tap RSVP — every event, no form at all

Formal registration (below) turned out to be more friction than most events need — a resident sharing an event link in the community WhatsApp broadcast just wants a quick "are you coming?" tally, not a name/mobile/block/flat form. Every event (any category, as long as it isn't `CANCELLED`/`COMPLETED`) shows an "Are you coming?" prompt with two buttons — **Yes, I'm coming!** / **Can't make it** — that calls the public, anonymous `events.rsvp` action, incrementing an `rsvp_yes`/`rsvp_no` counter on the Event row (self-healing columns, same `ensureColumn` pattern as elsewhere). No mobile number, no sign-in, one tap. The resident's own answer is remembered per-browser via `localStorage` (best-effort only — a private/cleared browser just shows the buttons again) so a returning visitor sees their choice instead of the prompt again.

This sits **above and separate from** the formal Cultural nomination form below — a Cultural event shows both ("Want to register formally?" appears under the RSVP section); every other category shows only the RSVP prompt, since it has no registration form at all.

## Sharing an event to WhatsApp

Every event (in Volunteer → Events) has a **Share** button that opens WhatsApp's own chat picker (a numberless `wa.me/?text=...` link, so the volunteer picks the destination — the Community broadcast/group — themselves) with an editable, pre-filled message: the event name, an intro line, date/time/location, and a call-to-action linking back to the event's own page. The intro line is `event.whatsapp_intro` if the organizer set one for that specific event, otherwise a category default (`Dinner`, `Kids`, `Cultural`, `Sports`, or `General`) baked into the frontend. The call-to-action text also depends on category — Cultural events say "Details & nominate your performance", everything else says "Details & RSVP — just one tap!" — matching what the linked page actually offers. This closes the original "we have to write every event announcement twice, once in the app and once for WhatsApp" gap without needing any backend change — the share text is built fresh from the event's own fields, so it works on events published before this button existed too.

## Nomination review — every registration, not just Cultural

Every event registration now lands as `PENDING_REVIEW`, not an immediate confirmation — the same "never trust a client claim" principle used for payments (Decision 4) applies to "I'm eligible for this event" too. A volunteer with the `Events` permission must `Approve` (→ `CONFIRMED`) or `Reject` (→ `REJECTED`, with a stored reason) before the registration is real; only `CONFIRMED` registrations can be checked in (§16) or hold a capacity slot (a `REJECTED`/`CANCELLED` one frees its slot back up).

## Cultural nominations — extra fields, multi-performance registration, songs

For a `Cultural` event, the registration form additionally asks for:

- **Performance Type** — one of the event's configured sub-categories (required).
- **Comments** — free text the nominee can add about their performance.
- **Song (MP3, optional)** — up to 10MB, uploaded to a `Cultural Songs` Drive folder and linked from the registration (`song_url`). Not required at registration time — a resident can add or replace it later from **My Stuff** (`updateRegistrationSong`), right up until the event, as long as the registration isn't `REJECTED`/`CANCELLED`.
- **Age** — shown for Cultural events even when the event itself has no configured age group, since organizers use it for age-appropriate slotting; adults are asked to enter `18+`.

**Multiple performances in one visit**: a resident nominating for more than one performance type in the same Cultural event (e.g. both Dance and Vocal) fills in their shared details (name/mobile/block/flat) once, then adds a block per performance ("+ Add Another Performance") — each becomes its own registration on submit, registered one at a time so one failing (e.g. a type closing mid-submit) doesn't lose the ones that already succeeded.

The system generates a registration ID per performance.

---

# 16. Event Check-in

Where required, generate a QR check-in token.

Workflow:

```text
Resident Registration (PENDING_REVIEW)
       |
       v
Volunteer Approves  →  CONFIRMED
       |
       v
Event entrance
       |
       v
Volunteer scans/looks up
       |
       v
CHECKED IN
```

A registration that's still `PENDING_REVIEW` or was `REJECTED` cannot be checked in — otherwise the review step in §15 would be purely cosmetic, bypassable by walking up to the door regardless.

Volunteer sees:

```text
VALID REGISTRATION

John Doe
Block F, Flat 204
Kids Drawing — Age 8

[ CHECK IN ]
```

Duplicate check-in is idempotent and reports:

```text
ALREADY CHECKED IN
```

---

# 17. Community Dinner / Prasadam

Dinner is a core festival module — a thin wrapper over the generic entitlement engine (§40) with dinner-specific validation.

It supports:

- One or multiple days
- Free or paid meals
- Advance registration
- Family registration (adult/child counts)
- Capacity
- Digital QR tokens
- Partial redemption
- Walk-ins
- Live meals served / remaining tracking

Not yet built: multiple named serving counters as a first-class concept (a free-text `counterId` is recorded per redemption, but there's no counter management UI), and formal food-planning tooling.

---

# 18. Dinner Registration

Resident example:

```text
COMMUNITY DINNER

Day 1 — 28 Aug

Adults     3
Children   2

Total      5 meals

[ REGISTER ]
```

**Free dinner day**: an entitlement (and its QR token) is created immediately, `ACTIVE`, same as the original plan.

**Paid dinner day**: registering creates a `PAYMENT_PENDING` entitlement with no token yet. The resident then goes through the **exact same UPI QR → reference (OCR-assisted) → screenshot → `MANUAL_REVIEW`** flow as donations (§10), via `submitDinnerPaymentReference`. A volunteer with the `Finance` permission reviews it (`volunteer.dinner.payments` queue) and either approves — which generates the token and activates the entitlement — or rejects, which cancels it. This replaces the original "pay via gateway, token generated on confirm" plan; the dormant Razorpay confirmation path (`confirmDinnerPayment`) still exists but isn't routed.

A resident can cancel their own still-pending/under-review dinner registration the same way as a donation.

---

# 19. Dinner Token

Each day gets a separate entitlement.

Example:

```text
DAY 1
Token: GW-D1-0342
Meals: 5

DAY 2
Token: GW-D2-0198
Meals: 4
```

Each token contains:

- Token ID
- Event/day
- Flat/block
- Meal entitlement (allocated/redeemed/remaining)
- QR code

---

# 20. Partial Token Redemption

A family with five meals may redeem them separately.

Example:

```text
Allocated: 5
Served: 2
Remaining: 3
```

Volunteer actions:

```text
[ SERVE 1 ]
[ SERVE 2 ]
[ SERVE ALL ]
```

Every redemption records (append-only `Redemption Log`, and is lock-protected so concurrent scans of the same token can never over-redeem it):

- Token
- Meals served
- Date/time
- Volunteer
- Counter

---

# 21. Volunteer Dinner Counter

A dedicated high-speed interface.

```text
DINNER — DAY 1

Meals Allocated       1,320
Meals Served          1,047
Meals Remaining         273

[ SCAN QR ]

[ SEARCH TOKEN ]
```

After scanning:

```text
VALID TOKEN

Block F, Flat 204
Allocated: 5
Served: 2
Remaining: 3

[ SERVE 1 ]
[ SERVE 2 ]
[ SERVE ALL ]
```

If already fully redeemed:

```text
ALREADY REDEEMED

Allocated: 5
Served: 5
Remaining: 0
```

---

# 22. Dinner Walk-ins

Volunteers can create a walk-in registration directly (`Dinner` permission), bypassing the resident-facing form and payment-reference flow entirely — a walk-in entitlement is activated immediately with a token, on the assumption payment was collected in person.

```text
WALK-IN

Block
Flat
Meals

[ GENERATE TOKEN ]
```

Store:

```text
source = WALK_IN
```

Advance registrations:

```text
source = ONLINE
```

This makes final reconciliation easy — the dinner dashboard (§25) splits advance vs. walk-in using this field.

---

# 23. Dinner Capacity

Each dinner day can have:

- Maximum meals (`capacity` on the Event row)
- Registration cutoff (`registration_deadline`)

When capacity is reached, registration/walk-in creation fails with:

```text
REGISTRATION_FULL
```

Not yet built: an explicit walk-in allowance separate from overall capacity, or a waitlist.

---

# 24. Dinner Payment Review

New module, mirroring Donations' Payment Review (§10) for paid dinner days — a volunteer with the `Finance` permission sees every entitlement sitting at `MANUAL_REVIEW`:

```text
DINNER PAYMENTS — NEEDS REVIEW

Block F, Flat 204 — 5 meals — Day 1
Reference: 002011866106  [view screenshot]

[ APPROVE ]   [ REJECT ]
```

- **Approve** activates the entitlement (generates the token, sets `remaining_quantity = allocated_quantity`) and is audited.
- **Reject** cancels the entitlement (frees its capacity) and is audited, with an optional note.

---

# 25. Dinner Operations Dashboard

Volunteers see (`volunteer.dinner.dashboard`, scoped to one dinner day/event):

```text
DAY 1 DINNER

Meals Allocated        1,320
Meals Served            1,047
Meals Remaining           273

Advance                 1,180
Walk-ins                   140

Utilization                79%
```

Not yet built from the original wishlist: by-block, by-hour, by-counter, adult/child split, and no-show-estimate breakdowns — only the top-line numbers above exist today.

---

# 26. Volunteer Registration

Residents can volunteer through:

```text
I WANT TO VOLUNTEER
```

## Currently offered areas — deliberately narrowed for this festival

Unlike the original open-ended area list, the sign-up form today offers exactly **two** areas (kept in one shared file, `frontend/src/lib/volunteerAreas.ts`, so the resident form and the admin roster can never drift apart):

```text
Decorate Idol/Pooja/Aarti   (expected ~45 mins)
Bhog/Prasadam/Food
```

For each area applied to, the resident picks specific dates and sessions (Morning/Evening), stored as a structured `"Area: date1, date2 (Session1, Session2); Area2: ..."` string in the `availability` column.

Capture:

- Name
- Mobile
- Block
- Flat
- One or more areas, each with its own date/session availability

The area list is designed to grow again later (Event coordination, Decorations, Kids activities, Cultural programs, Stage, Sound/light, Security coordination, Parking, Photography, First aid, Clean-up, Waste management, etc., per the original plan) — it's just not open today.

---

# 27. Volunteer Management

## Per-area approval, not all-or-nothing

A volunteer who applied for both areas might have a scheduling conflict in only one — so approval happens **per area**, not per application. A super admin (§4.2) can:

- **Approve an area** (`approveVolunteerArea`) — adds it to `approved_areas`. The volunteer's overall `status` only flips to `ACTIVE` once every area they applied for is approved; it stays `PENDING` while any is outstanding. Approving returns the configured Seva guideline text for that area (see below) so the frontend can hand it to the volunteer, typically via WhatsApp.
- **Decline an area** (`declineVolunteerArea`) — removes that area (and its availability entries) from the application outright rather than leaving a stale pending entry, so there's exactly one open request per area at a time. Nothing auto-notifies the volunteer; the frontend surfaces a WhatsApp draft for the admin to send if they choose.
- **Activate** (`activateVolunteer`) — a simpler one-shot action that marks the volunteer `ACTIVE` and copies every requested area straight into `approved_areas`, for grandfathering rows created before per-area approval existed, or a quick "approve everything" case.

Viewing the roster only needs the `Operations` permission; approving/declining/activating requires super admin.

## Seva guidelines

Each approvable area can carry admin-editable guideline text (`seva_guidelines_decorate`, `seva_guidelines_bhog` in Configuration, seeded with sensible defaults — e.g. Bhog/Prasadam reminds volunteers it's prepared as an offering and should stay sattvic, no garlic/onion/non-veg). Editable from Settings.

## Roster view

Volunteers can see:

```text
VOLUNTEERS

46 registered
50 required

Decorate Idol/Pooja/Aarti   12 / 12
Bhog/Prasadam/Food           9 / 8
```

`required` per area comes from the `volunteer_requirements` Configuration value (a JSON object); `filled` counts approved areas across all volunteers, falling back to "every area applied for" for legacy `ACTIVE` rows with no `approved_areas` recorded yet.

---

# 28. Volunteer Dashboard

The volunteer landing page is action-oriented.

```text
FESTIVAL DASHBOARD

₹4.25L
COLLECTED

312
DONATIONS

1,320
MEALS REGISTERED

1,047
MEALS SERVED

46
VOLUNTEERS

Collections ₹5.35L · Expenses ₹2.35L · Balance ₹3.00L

------------------------------------------------

[ DONATIONS ]

[ DINNER COUNTER ]

[ EVENTS ]

[ VOLUNTEERS ]

[ REPORTS ]
```

`collected`/`donationCount` are financial figures and are returned as `null` for an admin without the `Finance` permission, same principle as the Configuration split in §46 — hidden server-side, not just client-side. Meals/volunteer counts and alerts aren't financial, so every admin sees those. The income/expense/balance Festival Summary (§29) is likewise shown to every admin regardless of `Finance`, same as the public Home page already shows a collection total to residents.

Alerts shown when applicable:

```text
8 payments need review
3 dinner payments need review
2 events close registration today
```

("Dinner capacity 88%" and "3 volunteer gaps" from the original mockup aren't computed as alerts yet, though the underlying numbers are visible on their own dashboards.)

## Quick Actions

Below the Festival Summary and stat tiles, the dashboard shows a grid of shortcut buttons, permission-filtered so an admin only sees what they can actually use: Review Payments and Review Expenses (`Finance`), Seva/volunteer roster (`Operations`), Resident Feedback (`Content`, §65), plus Dinner Counter, Record Expense, and Reports, which are open to any signed-in admin regardless of permission (the underlying actions still re-check server-side either way).

---

# 29. Finance for Volunteers

Volunteers with the `Finance` permission can see:

## Collections

- Total donations
- Payments needing manual review (donations + dinner)
- Block-wise collection
- Transaction-level detail (`volunteer.transactions`)

## Expenses

See §30 — implemented as a lightweight claim-and-approve flow, not full vendor/budget tracking.

## Festival Summary

```text
Collections     ₹5.35L
Expenses        ₹2.35L
Balance         ₹3.00L
```

Visible to every admin on the dashboard regardless of `Finance` permission (§28); the itemized Collections/Expenses views above remain `Finance`-gated.

---

# 30. Expense Reimbursement

Deliberately simpler than the original vendor/budget-tracking sketch — this is for a volunteer to jot down a purchase in a couple of taps as the event approaches, not fill out a procurement form. It supersedes the original "Vendor / Operational Tracking" plan for now; vendor-contact/budget-vs-actual tracking isn't built.

**Recording** (`volunteer.expenses.record`) is open to **any signed-in admin**, regardless of permission — whoever's holding the receipt can log it immediately instead of routing it through whoever holds `Finance`:

```text
RECORD EXPENSE

Date
Amount
Purpose
Receipt photo (optional)
Spender name
Spender mobile (required — identity key for settlement)
UPI ID (optional — some expenses settle in cash)

[ SAVE ]
```

Every expense starts `PENDING`. Viewing the itemized list, approving, or rejecting requires `Finance` — mirroring Donations' manual-review pattern (Decision 4 applied to spending claims, not just payment claims):

```text
EXPENSE STATUSES
PENDING → APPROVED / REJECTED
```

Only `APPROVED` expenses count toward the Festival Summary's Expenses total or the settlement view below.

## Settlement summary

Groups every `APPROVED` expense by who actually spent the money (`spender_mobile`), so whoever handles reimbursement can settle each volunteer once instead of tracking line by line:

```text
SETTLE REIMBURSEMENTS

Ramesh K — 9xxxxxxxxx — UPI: ramesh@okhdfc
  3 expenses · ₹4,200

Priya S — 9xxxxxxxxx — UPI: priya@okicici
  1 expense · ₹850
```

A resident can also see their own recorded expenses (and whether they've been approved) from **My Stuff**, looked up by the same mobile-as-identity pattern as everything else.

---

# 31. Bug Reporting

New module — lets anyone (resident or volunteer, no sign-in required, since a bug in the sign-in flow itself should still be reportable) flag something broken directly from the app.

```text
REPORT A BUG

What went wrong?
Screenshot (optional)

[ SUBMIT ]
```

Captured: description (required), optional screenshot (stored in a `Bug Screenshots` Drive folder, never in the Sheet), optional reporter name/mobile, and the page URL it was reported from. Mobile is an explicit optional field on the form (not silently pulled from a resident's saved profile only) specifically so **Ask for Input** below actually has someone to reach.

Volunteers with the `Operations` permission see the full list and manage a three-state workflow — `OPEN` → `IN_PROGRESS` → `CLOSED`, with **Reopen** available from `CLOSED` back to `OPEN`; every status change is audited. A separate **Ask for Input** action (shown on any non-closed bug that has a reporter mobile) opens an editable, pre-filled WhatsApp draft asking the reporter for more detail — same volunteer-reviewed, nothing-auto-sent pattern as everywhere else WhatsApp is used (§45). It doesn't change status by itself; a volunteer can ask for input at any point in the `OPEN`/`IN_PROGRESS` lifecycle.

A near-identical public-submit/admin-review pattern is also used for Resident Feedback — see §65.

---

# 32. Announcements

Volunteers can publish simple announcements.

Examples:

```text
Community dinner registration is now open.

Drawing competition registrations close tomorrow.

Please report at Central Courtyard by 5:30 PM.
```

Each announcement has:

- Title
- Message
- Date/time
- Optional expiry
- Optional related event

Residents see active announcements two ways: the single most recent one on the Home page's News section (§7), and the full active list on More, both with any `http(s)` URL inside the message rendered as a real clickable link (a small `LinkifiedText` helper — announcement text is free-typed by a volunteer, so a pasted form link or WhatsApp group invite needed to actually be tappable, not just inert text). A scrolling marquee ticker (`AnnouncementsTicker`) also shows every active announcement's title and message at the very top of every resident page, above the hero/header, cycling continuously.

Volunteers can **create**, **edit** (title/message — `updateAnnouncement`), and **deactivate** an announcement from Volunteer → Announcements; there's no delete, only deactivate, consistent with the rest of this codebase's "state moves forward, nothing is destroyed" pattern.

WhatsApp sharing is supported — and has become a broader pattern across the volunteer UI, not just Announcements: approving/rejecting an event nomination, following up on a Cultural participant, and (implicitly) area approval/decline all offer an editable, pre-filled `wa.me` deep link rather than an automated send, so a volunteer reviews the message before it goes out.

---

# 33. Reports

Volunteer reports include, as CSV export (`volunteer.reports.export`):

| Report | Permission required | Contents |
|---|---|---|
| `donations` | `Finance` | transaction_id, resident_name, block, flat_number, amount, status, created_at |
| `registrations` | `Events` | full `Event Registrations` rows (every event, every status) |
| `dinner` | `Dinner` | full `Entitlements` rows |
| `volunteers` | `Operations` | full `Volunteers` rows |

Only the donations export is financial, so it alone requires `Finance` — the others are operational rosters/logs and use their own matching permission area instead.

In addition, the **Event Registrations** volunteer page has a dedicated **Participant Report**: every nomination across every event, sorted by event then name, each row showing status, whether a song was uploaded (and a play link if so), with a one-click "Download CSV" and a per-row WhatsApp follow-up link — built for event-day planning/print rather than raw sheet data.

---

# 34. Audit Trail

Important volunteer actions are logged to the `Audit Log` sheet.

Example:

```text
22-Aug 20:42
Volunteer: ramakanth@example.com

Action:
Verified payment

Transaction:
GWG-123

Old:
MANUAL_REVIEW

New:
VERIFIED_SUCCESS
```

Audited actions today include: payment verification/rejection (donations and dinner), payment screenshot attachment, event creation/edit/status change, event registration approval/rejection, expense recording/approval/rejection, volunteer area approval/decline/activation, bug status changes, announcement create/deactivate, configuration changes, and manual backups.

---

# 35. Privacy

Residents must not see other residents' personal or financial information.

Protect:

- Name
- Flat
- Mobile
- Email
- Donation amount
- UTR
- Payment ID
- Registration details

Public statistics must be aggregated (§13). Residents' own data is only ever returned when they supply the matching mobile number themselves (§6 — this is the actual security boundary in place today, not a login).

Volunteer access to individual information is scoped by permission area (§4.2) — e.g. an `Events`-only admin can't see the Donations transaction list.

---

# 36. Google Sheets Backend

For the initial community-scale implementation, Google Sheets is the operational datastore.

Actual sheet tabs (`setupSheets()` in `backend/Setup.js` creates all of these; `Bugs`, `Expenses`, and `Feedback` also self-heal on first use if `setupSheets` hasn't been re-run):

```text
Transactions
Blocks
Residents
Events
Event Registrations
Entitlements
Redemption Log
Volunteers
Volunteer Assignments
Expenses
Announcements
Configuration
Admins
Audit Log
Bugs
Feedback
```

("Admins" replaces the original "Admins / Permissions" name — same purpose.)

Google Sheets should never be exposed directly to residents.

Architecture:

```text
Browser
   |
   v
Backend API (Apps Script Web App)
   |
   v
Google Sheets
```

---

# 37. Google Drive

Google Drive holds every generated/uploaded document, all under one root folder named after `festival_name`:

```text
Ganesha Chathurthi 2026
|
+-- Receipts
+-- Payment Screenshots
+-- Cultural Songs
+-- Expense Receipts
+-- Bug Screenshots
+-- Backups
```

Google Sheet rows store URLs/references (`receipt_url`, `payment_screenshot_url`, `song_url`, `screenshot_url`) rather than binaries.

---

# 38. Automated Backups

New module (`backend/Backup.js`) — a full native-Sheets copy of the operational spreadsheet, dated, kept in the `Backups` Drive folder, so a bad edit or accidental delete during the festival doesn't lose data.

- **Daily automatic backup**: a time-based Apps Script trigger fires once a day in a window around 8:00 AM IST (installed once via `installBackupTrigger()`, run manually from the Apps Script editor — pushing code alone doesn't create the trigger).
- **Manual "Backup Now"**: a button on Volunteer → More → Settings (`volunteer.backup.run`, `Operations` permission) runs the same backup on demand and is audited.
- Safe to run more than once a day — a second run the same day is a no-op if that day's backup already exists, rather than piling up duplicates.

---

# 39. Core Data Model

## Resident

```text
resident_id
name
mobile
email
block
flat_number
created_at
updated_at
```

## Transaction

```text
transaction_id
resident_id
created_at
resident_name
block
flat_number
mobile
email
amount
currency
payment_provider      -- "upi_qr" for the current live path
payment_order_id
payment_id
payment_reference      -- resident-claimed UPI reference (RRN/UTR)
status
verified_at
receipt_id
receipt_url
source                 -- ONLINE | WALK_IN
admin_notes
updated_at
payment_screenshot_url
```

## Event

```text
event_id
name
description
date
start_time
end_time
location
category               -- includes "Cultural"
age_group
capacity
registration_required
registration_deadline
fee
status
contact_volunteer
token_code
sub_categories          -- Cultural only: comma-separated performance types
```

## Event Registration

```text
registration_id
event_id
resident_id
participant_name
participant_age
block
flat_number
mobile
parent_name
parent_mobile
sub_category            -- Cultural only
song_url                -- Cultural only, optional
comments                -- Cultural only, optional
status                  -- PENDING_REVIEW | CONFIRMED | REJECTED | CANCELLED
reviewed_by
reviewed_at
rejection_reason
check_in_at
created_at
```

## Entitlement

```text
entitlement_id
event_id
resident_id
token_id
allocated_quantity
redeemed_quantity
remaining_quantity
source                   -- ONLINE | ONLINE:MANUAL:<reference> | WALK_IN
status                   -- PAYMENT_PENDING | MANUAL_REVIEW | ACTIVE | PARTIALLY_REDEEMED | REDEEMED | CANCELLED
block
flat_number
created_at
payment_screenshot_url
```

## Redemption

```text
redemption_id
entitlement_id
quantity
counter_id
volunteer_id
redeemed_at
```

## Volunteer

```text
volunteer_id
resident_id
name
mobile
block
flat_number
areas                    -- comma-separated, applied for
availability             -- "Area: dates (sessions); ..."
approved_areas           -- comma-separated subset of `areas`
status                   -- PENDING | ACTIVE
created_at
```

## Volunteer Assignment

```text
assignment_id
volunteer_id
event_id
area
shift
status
```

## Expense

```text
expense_id
date
amount
purpose
screenshot_url
spender_name
spender_mobile
upi_id
status                   -- PENDING | APPROVED | REJECTED
admin_notes
recorded_by
created_at
```

## Bug

```text
bug_id
description
screenshot_url
status                   -- OPEN | IN_PROGRESS | CLOSED
reporter_name
reporter_mobile
page_url
reported_at
updated_at
```

## Feedback

```text
feedback_id
message
reporter_name
reporter_mobile
page_url
status                   -- PENDING | PUBLISHED | DECLINED
reviewed_by
reviewed_at
created_at
updated_at
```

---

# 40. Generic Token / Entitlement Engine

Do not hard-code QR tokens only for dinner.

```text
EVENT
   |
   v
ENTITLEMENT
   |
   v
TOKEN
   |
   v
REDEMPTION / CHECK-IN
```

Today, dinner meals are the only consumer of the entitlement/redemption side of this engine; event check-in (§16) uses the simpler registration/`check_in_at` path instead of a redeemable-quantity entitlement, since event admissions are 1-for-1 rather than a partially-redeemable count. Both share the same "never trust the client, only a volunteer action moves state forward" principle.

Examples:

```text
Dinner
→ 5 meal entitlement
→ up to 5 partial redemptions

Kids Workshop
→ 1 registration
→ 1 check-in
```

---

# 41. Security

Backend must:

- Validate every request.
- Validate block against master data.
- Validate amount.
- Prevent unauthorized transaction access.
- Verify payment signatures (where a gateway is in play — §10).
- Prevent duplicate webhooks.
- Prevent duplicate redemptions.
- Protect volunteer endpoints (every `auth: true` route in `Code.js` re-verifies the Google ID token and the specific permission area server-side).
- Rate-limit sensitive APIs. *(Not yet implemented — Apps Script's own per-user quota is the only current backstop.)*
- Keep secrets server-side (Razorpay keys, OAuth client ID — Script Properties, never shipped to the frontend).
- Prevent transaction ID enumeration.

Never put payment secrets in frontend code.

Known open gap (see §6): resident-facing endpoints authenticate by mobile number alone, with no verification that the caller actually owns that number.

---

# 42. Idempotency

Payment callbacks/manual reviews must be idempotent — `verifyPaymentManual`, `approveDinnerPayment`, and `activateEntitlement` all short-circuit and return the existing state if the transaction/entitlement is already in a success status, rather than re-issuing a receipt or re-activating a token.

Token redemption is lock-protected (`withLock`) against accidental double scans/concurrent over-redemption (§20, §42).

---

# 43. Resident UX Principles

The portal should be:

- Mobile-first
- Fast
- Clean
- Minimal
- WhatsApp-friendly
- Large buttons
- Minimal typing
- Clear success/error messages

Avoid:

- Complex dashboards
- Too many menus
- Mandatory accounts
- Long forms
- Technical terminology

---

# 44. Volunteer UX Principles

Volunteer workflows should optimize for speed.

Especially:

- QR scanning
- Payment verification (donations and dinner)
- Nomination review
- Walk-in registration
- Event check-in
- Dinner redemption
- Recording an expense on the spot

A volunteer at a dinner counter should be able to process a token in **a few seconds**.

---

# 45. Notifications

Support:

- Donation submitted / verified
- Receipt availability
- Event nomination approved/rejected
- Dinner token generation
- Event reminder
- Schedule changes
- Volunteer area approved/declined

Delivery channel implemented today: **volunteer-reviewed WhatsApp deep links** with an editable, pre-filled message. Nothing sends automatically; a volunteer always reviews the draft first. Two link shapes are used depending on the audience:

- **To one specific resident** — `wa.me/91<mobile>?text=...`: nomination approval/rejection, participant-report follow-ups, area decline, Resident Feedback publish/decline replies (§65), and Bug Report "Ask for Input" (§31).
- **To a broadcast/group the volunteer picks themselves** — numberless `wa.me/?text=...`, opening WhatsApp's own chat picker: sharing an event to the community (§15).

In-app status (via My Stuff) and email are not yet built as delivery channels; SMS/WhatsApp automation remains explicitly out of scope for now, per the original plan.

---

# 46. Festival Configuration

Volunteers with the `Operations` permission can update most Configuration keys from Settings; a subset that touches money (`donation_goal`, `minimum_donation`, `maximum_donation`, `upi_vpa`, `upi_payee_name`) additionally requires `Finance` — an `Operations`-only admin can manage every other setting but can't redirect where donations pay out to or change the amounts involved. This is enforced server-side (`listConfig`/`updateConfig` filter and gate by permission), not just hidden in the UI.

Configurable keys in active use: `festival_name`, `dates`, `venue`, `donation_goal`, `minimum_donation`, `maximum_donation`, `contact`, `upi_vpa`, `upi_payee_name`, `volunteer_requirements` (JSON), `super_admin_email`, `seva_guidelines_decorate`, `seva_guidelines_bhog`.

This avoids code changes for operational changes.

---

# 47. Operational Workflow

## Before Festival

```text
Configure Festival
      ↓
Configure Blocks
      ↓
Create Events
      ↓
Configure Dinner
      ↓
Open Donations
      ↓
Open Registrations
      ↓
Recruit Volunteers
```

## During Festival

```text
Donations + Payment Review
Events + Nomination Review
Dinner + Dinner Payment Review
Token Scanning
Volunteer Operations
Expense Recording
Bug Triage
Announcements
```

## After Festival

```text
Close Registrations
      ↓
Reconcile Payments
      ↓
Close Dinner
      ↓
Settle Expense Reimbursements
      ↓
Export Reports
      ↓
Publish Community Summary
```

---

# 48. Post-Festival Community Report

The system should be able to produce a simple summary:

```text
GANESHA CHATHURTHI 2026
BRIGADE WOODS

₹5.35L
COLLECTED

342
DONATIONS

287
FAMILIES PARTICIPATED

1,850
MEALS SERVED

52
VOLUNTEERS

14
EVENTS
```

Not yet built as a single generated report — the underlying numbers all exist individually (dashboard + CSV exports), but there's no one-shot "Community Summary" export/page yet.

---

# 49. Sustainability / Waste

Keep this optional and simple. Not yet built — no sustainability/waste tracking exists today.

Possible metrics, unchanged from the original plan:

- Waste generated
- Waste segregated
- Food waste
- Plastic avoided
- Reusable materials
- Cleanup volunteers

---

# 50. Recommended MVP — status

## Resident

- [x] Home page
- [x] Festival information *(partial — Configuration exists; no dedicated info page confirmed)*
- [x] Donation
- [x] Payment (manual-review UPI, not a live gateway — §10)
- [x] Receipt
- [x] Collection dashboard
- [x] Event listing
- [x] Event registration (now review-gated — §15)
- [x] Dinner registration
- [x] Digital dinner token
- [x] My registrations (My Stuff)
- [x] Volunteer registration

## Volunteer

- [x] Login
- [x] Dashboard
- [x] Donation management
- [x] Payment verification
- [x] Receipt lookup *(via the transactions list)*
- [x] Event management
- [x] Registration management (incl. nomination review)
- [x] Event check-in
- [x] Dinner token scanning
- [x] Dinner walk-ins
- [x] Volunteer management (per-area approval)
- [x] Announcements
- [x] Basic reports
- [x] CSV export

Shipped beyond the original MVP scope: Cultural nomination workflow with songs and multi-performance registration, dinner payment review, expense reimbursement, bug reporting (now with an In Progress status and a WhatsApp "ask for input" reach-out), automated backups, OCR-assisted payment reference entry, WhatsApp-deep-link follow-ups, one-tap anonymous event RSVP (§15), per-event WhatsApp sharing with category-aware messaging (§15), Resident Feedback with admin moderation and Home-page publishing (§65), announcement editing and a scrolling ticker with clickable links (§32), a deliberately untracked eHundi offering page (§66), and a Festival Photos entry point linking to an externally-managed Google Photos album (§67).

---

# 51. Phase 2 — status

- [ ] Paid event registration — still blocked (`fee > 0` rejected).
- [x] Expense tracking — shipped, as a lightweight claim/approve/settle flow rather than full vendor/budget tracking.
- [ ] Vendor tracking (vendor name/contact/budget-vs-actual) — not built.
- [ ] Volunteer shifts as a distinct concept — partially covered by per-area date/session availability, but no shift/assignment UI.
- [ ] Multiple dinner counters — `counterId` is recorded per redemption, no management UI.
- [ ] Advanced dinner analytics (by block/hour/counter, no-show estimate).
- [ ] WhatsApp notification integration — implemented as volunteer-reviewed deep links (§45), not automated sending.
- [ ] Email receipts.
- [ ] Public receipt verification.
- [ ] Waitlists.
- [ ] Post-event impact report (single generated summary — §48).

New items shipped that weren't in the original Phase 2 list: bug reporting, automated/manual backups, OCR-assisted payment reference, one-tap event RSVP, resident feedback with moderation, an externally-hosted community photo album, and a public eHundi offering page.

---

# 52. Technical Architecture

Actual stack:

```text
                    RESIDENT
                       |
                       v
                WEB APPLICATION (Next.js)
                       |
              +--------+--------+
              |                 |
              v                 v
        Resident actions   Volunteer actions
              |                 |
              +--------+--------+
                       |
                       v
          Apps Script Web App (single ?action= router)
                       |
        +--------------+--------------+-----------------+
        |              |              |                 |
        v              v              v                 v
    Google Sheets   Google Drive   Google OAuth      (Razorpay —
   (datastore)   (receipts/screen-  tokeninfo         dormant,
                  shots/songs/        (volunteer         not wired
                  backups)            auth)              in — §10)
```

Frontend:

- React (Next.js App Router)
- TypeScript
- Tailwind CSS

Backend:

- Google Apps Script Web App (single entry point, `?action=<name>` routing — see `backend/Code.js`)

Alternative production backend (unchanged aspiration, not started):

- Node.js / TypeScript
- Vercel / Cloud Run
- PostgreSQL/Supabase if the system grows beyond festival-scale usage

---

# 53. API Surface

Every request is `GET`/`POST <web-app-url>?action=<name>` (Apps Script has no real URL routing) — the full action set from `backend/Code.js`, grouped:

## Public (no auth)

```text
festival.get
blocks.list
events.list
stats.public
announcements.list
payments.extractReference        -- OCR pre-fill guess
bugs.report
feedback.submit                  -- §65
feedback.listPublished           -- §65
```

## Resident (mobile-as-identity or fully anonymous; no auth token)

```text
donations.create
donations.createHundi            -- orphaned: route exists, no frontend page calls it — see §66
donations.submitReference
donations.cancel
donations.get
donations.mine

events.register
events.rsvp                      -- anonymous, no mobile — §15
events.registrations.updateSong

registrations.mine

dinner.register
dinner.submitReference
dinner.cancel
dinner.token
dinner.mine

volunteers.register
volunteers.mine

expenses.mine
```

## Volunteer (requires `idToken`; permission noted where relevant)

```text
auth.check
volunteer.dashboard

volunteer.transactions                          Finance
volunteer.payment.verify                        Finance
volunteer.payment.reject                        Finance
volunteer.payment.attachScreenshot               Finance

volunteer.events.create                         Events
volunteer.events.update                         Events
volunteer.events.updateStatus                    Events
volunteer.events.registrations                   Events
volunteer.events.registrations.pending            Events
volunteer.events.registrations.all                Events
volunteer.events.registrations.approve            Events
volunteer.events.registrations.reject             Events
volunteer.events.checkin                          Events

volunteer.dinner.dashboard
volunteer.dinner.redeem                          Dinner
volunteer.dinner.walkin                          Dinner
volunteer.dinner.payments                        Finance
volunteer.dinner.payment.approve                  Finance
volunteer.dinner.payment.reject                   Finance

volunteer.volunteers.list                        Operations
volunteer.volunteers.activate                     super admin
volunteer.volunteers.approveArea                  super admin
volunteer.volunteers.declineArea                  super admin

volunteer.expenses.record                        (any admin)
volunteer.expenses.list                          Finance
volunteer.expenses.approve                       Finance
volunteer.expenses.reject                        Finance
volunteer.expenses.settlementSummary              Finance

volunteer.announcements.create                    Content
volunteer.announcements.update                    Content
volunteer.announcements.deactivate                Content

volunteer.bugs.list                              Operations
volunteer.bugs.updateStatus                       Operations   -- OPEN | IN_PROGRESS | CLOSED

volunteer.feedback.list                          Content
volunteer.feedback.updateStatus                   Content       -- PENDING | PUBLISHED | DECLINED, §65

volunteer.reports.export                          varies by report — see §33

volunteer.config.list                            Operations (Finance-only keys filtered further)
volunteer.config.update                          Operations (Finance-only keys need Finance too)

volunteer.backup.run                             Operations
volunteer.auditLog.list                          Operations
```

---

# 54. Google Sheets Structure

Exact columns as created by `setupSheets()` (`backend/Setup.js`).

## Transactions

```text
transaction_id, resident_id, created_at, resident_name, block, flat_number,
mobile, email, amount, currency, payment_provider, payment_order_id,
payment_id, payment_reference, status, verified_at, receipt_id, receipt_url,
source, admin_notes, updated_at, payment_screenshot_url
```

## Blocks

```text
block_id, block_name, active
```

## Residents

```text
resident_id, name, mobile, email, block, flat_number, created_at, updated_at
```

## Events

```text
event_id, name, description, date, start_time, end_time, location, category,
age_group, capacity, registration_required, registration_deadline, fee,
status, contact_volunteer, token_code, sub_categories
```

## Event Registrations

```text
registration_id, event_id, resident_id, participant_name, participant_age,
block, flat_number, mobile, parent_name, parent_mobile, sub_category,
song_url, comments, status, reviewed_by, reviewed_at, rejection_reason,
check_in_at, created_at
```

## Entitlements

```text
entitlement_id, event_id, resident_id, token_id, allocated_quantity,
redeemed_quantity, remaining_quantity, source, status, block, flat_number,
created_at, payment_screenshot_url
```

## Redemption Log

```text
redemption_id, entitlement_id, quantity, counter_id, volunteer_id, redeemed_at
```

## Volunteers

```text
volunteer_id, resident_id, name, mobile, block, flat_number, areas,
availability, status, created_at
```

(`approved_areas` is added on first use via `ensureColumn` rather than in the base schema, so older sheets self-heal.)

## Volunteer Assignments

```text
assignment_id, volunteer_id, event_id, area, shift, status
```

## Expenses

```text
expense_id, date, amount, purpose, screenshot_url, spender_name,
spender_mobile, upi_id, status, admin_notes, recorded_by, created_at
```

## Announcements

```text
announcement_id, title, message, published_at, expires_at, active, related_event_id
```

## Configuration

```text
key, value
```

## Admins

```text
email, name, permissions, active
```

## Audit Log

```text
timestamp, volunteer_id, action, entity, entity_id, old_value, new_value
```

## Bugs

```text
bug_id, description, screenshot_url, status, reporter_name, reporter_mobile,
page_url, reported_at, updated_at
```

## Feedback

```text
feedback_id, message, reporter_name, reporter_mobile, page_url, status,
reviewed_by, reviewed_at, created_at, updated_at
```

---

# 55. Performance

Target:

- Initial load < 3 seconds on normal mobile broadband.
- Donation form response < 2 seconds excluding payment provider.
- Dashboard < 3 seconds.
- Token scan/redeem response ideally < 2 seconds.

Public aggregate statistics may be cached (implemented: `stats.public`, `blocks.list`, `Configuration`, `events.list` all use `CacheService`, each invalidated on the relevant write).

Individual information must not be publicly cached.

A self-heal pattern worth flagging for anyone adding a new sheet: a sheet that re-verifies every column on every call (via a header-existence check per column) costs one Sheets API round trip per column, per call — this quietly slowed every expense operation, including the volunteer dashboard's expense total, as expense traffic grew, until `ensureExpensesSheet()` was fixed to read the header row once and only backfill genuinely missing columns. `getBugsSheet()`/`getFeedbackSheet()` avoid this by only ever writing headers once, at sheet creation.

---

# 56. Error Handling

Keep errors simple.

Examples:

```text
Payment could not be confirmed.
Please try again.

Registration is currently full.

This token has already been redeemed.

We could not find this registration.

Something went wrong.
Please try again.
```

Do not expose backend errors. `ApiError` carries a message + status; every response is HTTP 200 with `{ ok: true/false }` (an Apps Script Web App constraint — no custom status codes are possible), and the frontend surfaces `error.message` directly.

---

# 57. Testing

## Resident

Test:

- Donation → reference entry (with/without OCR) → manual review → receipt
- Event registration, including multi-performance Cultural nominations and song upload/replace
- Dinner registration (free and paid)
- QR token
- My Stuff lookups
- Volunteer registration (per area)
- Bug report submission
- Expense recording

## Volunteer

Test:

- Login
- Payment verification (donations and dinner)
- Nomination review (approve/reject, WhatsApp draft)
- Event creation, incl. Cultural sub-categories
- Check-in
- Dinner scanning, partial redemption, walk-in
- Volunteer per-area approval/decline
- Expense approval/rejection, settlement summary
- Bug triage
- Reports export
- Manual backup

## Security

Test:

- Unauthorized volunteer access
- Data leakage across permission areas
- Duplicate token redemption
- Invalid transaction/registration IDs
- A resident looking up someone else's mobile number (known open gap — §6, §41)

## Devices

Test:

- Android Chrome
- iPhone Safari
- Desktop Chrome
- Desktop Safari

## Test Mode

A `TEST_MODE` toggle lets the volunteer journey (and the dormant gateway code) be exercised without a registered Google admin account or real Razorpay keys. Because the live payment path today is the manual-review UPI flow (§10), which never calls Razorpay at all, `TEST_MODE`'s payment-side effect only matters if/when the gateway path is re-enabled:

- Backend Script Property `TEST_MODE=true` makes `createRazorpayOrder`/`verifyCheckoutSignature` (`Payments.js`) return a mock order and skip signature verification, and makes `verifyVolunteerToken` (`Auth.js`) accept the sentinel idToken `TEST_TOKEN` as a mock volunteer with every permission.
- Frontend `NEXT_PUBLIC_TEST_MODE=true` shows a "Sign in as Test Volunteer" button on the volunteer sign-in screen, and (per `razorpay.ts`) would skip Razorpay Checkout in favour of an auto-completing mock payment if that code path were ever invoked from the UI again.
- A `SYSTEM UNDER TEST` banner shows whenever `NEXT_PUBLIC_TEST_MODE=true` or the configured Razorpay key looks like a `rzp_test_...` key, so no one mistakes a test session for the real thing.
- Both default off. Turning either side off independently resumes real behaviour — no code changes needed either way.

---

# 58. Acceptance Criteria

The MVP is ready when:

- [x] Resident can access portal without complicated login.
- [x] Resident can donate.
- [x] Block is restricted to the fixed letter set (A–H, J–N, P–S) client-side and validated server-side.
- [x] Flat number is mandatory and restricted to 3 digits.
- [x] Payment is confirmed only by an independent volunteer review, never a client claim (manual-review UPI flow, not yet a live gateway).
- [x] Successful donation generates exactly one receipt.
- [x] Total collection is accurate.
- [x] Block-wise collection is accurate.
- [x] Individual donations are hidden from residents.
- [x] Volunteer login is protected (Google ID token, verified server-side).
- [x] Volunteers can view individual transactions.
- [x] Volunteers can reconcile payments, with OCR-assisted reference review.
- [x] Residents can view events.
- [x] Residents can register for events, subject to volunteer nomination review.
- [x] Volunteers can manage events, including Cultural sub-categories.
- [x] Event check-in works where enabled, and only for approved registrations.
- [x] Residents can register for dinner (free or paid, both via the same manual-review flow).
- [x] Dinner token QR is generated.
- [x] Volunteers can scan dinner tokens.
- [x] Partial redemption works.
- [x] Duplicate redemption is prevented.
- [x] Walk-in dinner registration works.
- [x] Meals allocated and served are tracked.
- [x] Residents can volunteer, for the currently-offered areas.
- [x] Volunteers can manage volunteer participation, per area.
- [x] Basic reports can be exported.
- [x] Important volunteer actions are audited.
- [x] Residents can report a bug from the app.
- [x] An operational spreadsheet backup runs daily and on demand.
- [x] The portal works well on mobile.
- [ ] Resident identity is verified, not just self-reported by mobile number (§6 — open gap).

---

# 59. Product Design Direction

The visual design should be **simple, warm and premium**, reflecting Brigade Woods rather than looking like a commercial ticketing platform.

Suggested:

- Clean white/off-white background
- Festive saffron/orange accent
- Deep maroon secondary accent
- Large typography
- Large touch-friendly buttons
- Subtle Ganesha/festival visual elements
- Minimal cards
- Clear status indicators

Avoid:

- Excessive animation
- Complex dashboards for residents
- Too many colours
- Long forms
- Excessive festival ornamentation
- Dense tables on mobile

---

# 60. Critical Design Decisions

## Decision 1 — Two User Experiences Only

The product exposes:

```text
RESIDENT
VOLUNTEER
```

Volunteers have higher privileges.

Do not create separate public interfaces for finance, event managers, dinner counters etc. Use permissions inside the Volunteer experience.

## Decision 2 — Resident First

Every resident workflow should take as few steps as possible.

## Decision 3 — Volunteer Operational Simplicity

Volunteer screens should be optimized for doing work quickly, particularly QR scanning.

## Decision 4 — Payment (and Claim) Truth Comes From Backend

Never trust a client-side claim. This applies not just to "I have paid" (donations, dinner) but to every other claim added since: "I'm eligible for this event" (nomination review, §15), "I actually spent this" (expense approval, §30), and "this is worth sharing publicly" (Resident Feedback, §65) — each only becomes real once an independently-authorized volunteer acts on it server-side.

## Decision 5 — QR Tokens Are Generic

Dinner tokens are implemented as a reusable entitlement/redemption system (§40); event check-in currently uses the simpler 1-for-1 registration/check-in path rather than routing through the same entitlement engine, since admissions don't need partial redemption.

## Decision 6 — Google Sheets Is an MVP Datastore

It is acceptable for this community-scale festival but the architecture should allow migration to a proper database later.

## Decision 7 — Build for Reuse

Ganesha Chathurthi 2026 is the first festival, not the final purpose of the product.

## Decision 8 — Manual Review Over an Unproven Gateway

Rather than block on a live payment gateway integration, the shipped payment flow for both donations and paid dinner uses the resident-submits-a-reference / volunteer-verifies path from day one, with OCR only as a convenience. The gateway integration exists in the codebase, tested via `TEST_MODE`, ready to be wired back in without changing the transaction/entitlement model, once needed.

## Decision 9 — eHundi Trades Tracking for Simplicity, Deliberately

The at-pandal offering flow (§66) started as a tracked transaction (amount picker → `createHundiDonation` → manual-review-and-verify, same as every other payment in this app) and went through several redesigns before landing on a bare page that's just the bank's own QR image — no amount, no reference step, no record created at all. This is the one place in the app where Decision 4's "never trust a client claim, always verify" principle simply doesn't apply, because there's no claim being made in the first place: the page doesn't ask the payer anything, so there's nothing to verify. The trade-off (money collected this way never appears in any per-transaction report) was made knowingly in exchange for a link that can be printed as a QR or shared as-is with zero interaction — see §66 for the reasoning trail.

## Decision 10 — Reach for an External Tool Before Building Storage

Building an in-app photo album (upload form, Drive storage, a moderation queue, a gallery page) was scoped and ready to build (§67) before a simpler option was considered: a Google Photos shared album already does "anyone can view, anyone can add their own photos" natively, needs zero custom backend or storage quota, and residents already know how to use it. The app links to it rather than reimplementing it — the same instinct as Decision 6 (Google Sheets as an MVP datastore) applied one level further: don't build infrastructure a mature external tool already provides well, especially for a single-festival, non-critical feature.

---

# 61. Future Reuse

The same portal architecture should support:

```text
Brigade Woods Community Portal

2026
├── Ganesha Chathurthi
├── Kannada Rajyotsava
├── Kids Fair
├── Sports Events
└── Community Dinner

Future
├── Independence Day
├── Republic Day
├── Cultural Events
├── Workshops
├── Fundraisers
└── Community Activities
```

Festival configuration should allow a new festival to be created without rebuilding the application.

---

# 62. Final Product Definition

The product should be thought of as:

> **A simple digital operating system for Brigade Woods community festivals.**

Not:

> A donation website with some additional features.

The MVP should nevertheless remain deliberately small:

```text
RESIDENT
   |
   +-- Donate
   +-- Events (incl. Cultural nominations)
   +-- Dinner
   +-- My Stuff
   +-- Volunteer

VOLUNTEER
   |
   +-- Dashboard
   +-- Donations (incl. Expenses)
   +-- Events (incl. Nomination Review)
   +-- Dinner (incl. Payment Review)
   +-- Volunteers
   +-- More (Reports, Announcements, Bugs, Settings, Audit Log)
```

Everything else should support these two experiences.

---

# 63. Implementation Priority

Original build order, kept for reference — largely complete through Priority 5, plus the additions layered on top (nomination review/songs, expense reimbursement, bug reporting, backups, OCR).

### Priority 1 — Foundation

1. Festival configuration
2. Resident identity
3. Block master
4. Volunteer authentication
5. Google Sheets backend
6. Basic resident/volunteer UI

### Priority 2 — Money

7. Donations
8. Payment integration (shipped as manual-review UPI, not a live gateway — §10)
9. Payment verification
10. Receipts
11. Collection dashboard

### Priority 3 — Festival Participation

12. Events
13. Registrations (now review-gated)
14. QR check-in
15. Volunteer registration

### Priority 4 — Food Operations

16. Dinner registration
17. Digital tokens
18. QR scanning
19. Partial redemption
20. Walk-ins
21. Dinner dashboard

### Priority 5 — Operations

22. Volunteer assignments (per-area approval, not shift assignments)
23. Announcements
24. Reports
25. Audit log
26. Configuration

### Priority 6 — Added since (not in the original plan)

27. Cultural nomination review, multi-performance registration, song uploads
28. Dinner payment review
29. Expense reimbursement (record/approve/settle)
30. Bug reporting
31. Automated + manual backups
32. OCR-assisted payment reference entry

---

# 64. Final Coding Instruction

Implement the portal according to this specification with the following priorities:

1. **Extreme simplicity for residents.**
2. **Fast operational workflows for volunteers.**
3. **Secure payment processing** — currently: never trust a resident's payment claim; a volunteer independently verifies every donation and paid dinner registration (§10).
4. **Accurate financial records.**
5. **Reliable QR/token redemption.**
6. **Minimal personal-data exposure.**
7. **Google Sheets compatibility.**
8. **Mobile-first design.**
9. **Clear separation between resident and volunteer privileges.**
10. **Reusable event/festival architecture.**

The implementation should favour a small number of clear screens over feature-heavy navigation.

The complete critical resident journey:

```text
Open Portal
   ↓
Choose Activity
   ↓
Donate / Register / Get Token
   ↓
Pay via UPI + Submit Reference, if Required
   ↓
Await Volunteer Review, if Required
   ↓
Receipt / Confirmed Registration / QR Token
```

The critical volunteer journey:

```text
Login
   ↓
Dashboard
   ↓
Choose Operation
   ↓
Review / Verify / Register / Scan / Manage
   ↓
Complete Action
   ↓
Record Audit Trail
```

Before production release, perform an end-to-end test for:

```text
Donation
→ UPI Reference (OCR-assisted)
→ Volunteer Verification
→ Receipt
→ Dashboard

Event
→ Registration (incl. multi-performance Cultural + song)
→ Nomination Review (approve/reject)
→ Check-in

Dinner
→ Registration (free or paid)
→ Payment Review, if paid
→ Token
→ Scan
→ Partial Redemption
→ Final Meal Count

Volunteer
→ Registration
→ Per-Area Approval/Decline
→ Operational Action

Expense
→ Record
→ Approve/Reject
→ Settlement Summary

Bug Report
→ Submit
→ Triage → In Progress → Ask for Input → Close

Feedback
→ Submit
→ Publish or Keep Private
→ (if published) Appears on Home
```

The final product should be simple enough that a Brigade Woods resident can use it without instructions, while a volunteer can operate the festival from a phone.

---

# 65. Resident Feedback

New module, mirroring Bug Reporting's shape (§31) — public, no-signin submission, admin review before anything is shown to anyone else — but the destination is different: a bug becomes a triage item, feedback becomes an optional public testimonial.

```text
WE'RE LISTENING

Tell us what you loved, and what we could do better.

[ message, required ]
Your name (optional)
Mobile number (optional — so we can reply)

[ SEND FEEDBACK ]
```

Every submission lands `PENDING` in a self-healing `Feedback` sheet (`getFeedbackSheet()`, same self-heal-on-first-use pattern as Bugs) — invisible to anyone but the organizing team until reviewed. A volunteer with the `Content` permission reviews it from a Dashboard quick action (§28) or Volunteer → More → Feedback:

```text
NEEDS REVIEW

"Great arrangement and beautiful murti..."
GWG-FB-0008 · 14 Sep, 6:42 PM · Ishita

[ PUBLISH TO HOME ]   [ KEEP PRIVATE ]
```

- **Publish to Home** (`status: PUBLISHED`) — appears as an anonymous-by-default quote in the Home page's Community Voices section (§7): the resident's name only if they gave one, otherwise "A Brigade Woods resident". Only the single most recent published quote shows on Home, clamped to 4 lines with a Read more / Show less toggle.
- **Keep Private** (`status: DECLINED`) — stays recorded for the organizing team, never goes public.

Either decision is reversible from the "Reviewed" list ("Publish to Home instead" / "Unpublish").

If the resident left a mobile number, publishing or declining pops up an editable, pre-filled WhatsApp reply draft (§45) — a courtesy thank-you, not a requirement; skipping it doesn't undo the publish/decline decision, which is already saved.

There is no resident-facing status check for feedback (unlike donations/registrations/dinner/expenses, it isn't part of My Stuff) — a resident who submits has no way to know whether it was published or declined unless they happen to see their own quote on Home.

---

# 66. eHundi (Ganesha Hundi) — A Deliberately Untracked Offering Page

A public, unlisted page at `/hundi` — not linked from Home, Donate, or any nav menu, reached only by whoever has the direct URL (meant to be shared as a WhatsApp link or printed as a QR at the pandal). The page is intentionally bare: a header and the bank's own UPI QR image (`hdfc-vyapar-qr.png`, the same static-QR asset the Donate flow uses, §10), nothing else — no amount picker, no reference-submission step, no transaction record of any kind.

```text
GANESHA HUNDI

Scan and pay directly — no details needed.

(bank UPI QR image)
```

This is the end state of several redesigns, not the first design — worth recording since the reasoning isn't obvious from the code alone:

1. **V1**: a full tracked flow — amount picker → `createHundiDonation` → the same reference-submission/manual-review path as every other payment.
2. **V2**: rewired as a volunteer-only tool gated behind sign-in, on the (mistaken) assumption "physical workflow near the pandal" meant "operated by a volunteer."
3. **V3**: corrected back to fully public — the actual requirement was a link/QR anyone could scan and pay through directly, which can't require sign-in.
4. **Final**: even the tracked-transaction step was cut. The real ask turned out to be "just show the bank's payment card when this link is opened" — no form, no state, nothing to submit.

The backend route (`donations.createHundi` → `createHundiDonation` in `Donations.js`) and its frontend client method (`api.donations.createHundi`) are now **orphaned** — reachable, harmless, but unused by any page, left in place rather than deleted (see §53). A payment made through this page leaves no record anywhere in the app; reconciling it (if ever needed) would have to happen by comparing the bank statement against everything else that *is* tracked, not through this app. See Decision 9 (§60) for why this trade-off was made on purpose.

---

# 67. Festival Photos — An Externally-Hosted Album, Not In-App Storage

Residents can view and add their own festival photos, but the album itself is a **Google Photos shared album** the organizing team created and manages directly in Google Photos — not a feature built into this codebase. The app only links to it:

- A small "Magic Moments" pill badge (camera icon, gold star accent) in the top-right corner of the Home page.
- A highlighted "Upload & Check Photos" tile on the resident More page.

Both are plain external links (`target="_blank"`) to the same shared-album URL; there is no backend route, no Drive folder, no Sheet row, and no moderation queue for this feature — Google Photos' own sharing model provides all of it. Confirmed behavior: **viewing** the album needs no sign-in at all (anyone with the link sees every photo), but **adding** a photo redirects to a full Google Sign-In — a resident needs their own Google account to contribute, though not to browse. This is a real (if minor) departure from every other resident-facing flow in this app, which needs no account at all — accepted as a reasonable trade-off since most residents already have a Google account on their phone, in exchange for zero backend work and no Drive storage-quota concern (see Decision 10, §60).

The album was soft-launched to a small group of volunteers first, deliberately not surfaced on Home initially, before being enabled more widely — the same "trial before wide rollout" caution applied to other resident-facing changes in this app.

---

# 68. Namma Habba — The Reusable Framework Layer

**Namma Habba** is the platform brand name for this codebase, reused across every Brigade Woods celebration it's deployed for — Ganesha Chathurthi 2026 is the first festival on it, not the product itself (Decision 7, §61). This section documents two passes: the foundational, framework-level extraction (Phase 1 — module registry, centralized config, the mechanism), and the self-service layer built on top of it (Phase 2 — a guided Festival Setup screen so configuring the mechanism doesn't require hand-editing raw Configuration rows or code). Neither pass adds a new *product* feature.

## Deployment model

**One deployment per festival**, not one live site juggling several festivals at once: this codebase, redeployed with a fresh Google Sheet + Configuration + module toggles + branding for each new celebration. There is no `Festivals` registry sheet, no `festival_id` column anywhere, and no per-request tenant scoping — every sheet, cache and config key still describes exactly one festival, the same as before this section existed. A future deployment is a config/branding exercise (below), not a code fork.

## The module registry (`backend/Modules.js`)

Seven toggleable modules — `donations`, `sponsorships`, `events`, `meal`, `guests`, `volunteers`, `expenses` — stored as one JSON object on the `enabled_modules` Configuration key. Announcements, Feedback, Bugs, auth, Configuration, Backup, Audit Log and Reports are never gated; they're always included regardless of which modules are on, matching the "always included, not toggled" framing from the original one-portal-any-event discussion draft.

This Ganesha Chathurthi 2026 deployment's default — everything on except Guests, which has no module built anywhere in this codebase yet:

```json
{"donations":true,"sponsorships":true,"events":true,"meal":true,"guests":false,"volunteers":true,"expenses":true}
```

Gating happens **at the router**, not per-handler: `Code.js`'s `ROUTES` table carries an optional `module` field per route, and `handleRequest` calls `requireModuleEnabled(route.module)` before the handler runs — a disabled module's entire API surface 404s, not just its UI. Volunteers with the `Operations` permission manage this from Volunteer → More → Settings → Modules (`volunteer.modules.list` / `volunteer.modules.update`, backed by `setEnabledModules`, audited like every other Configuration change).

On the frontend, `FestivalConfigProvider`/`useFestivalConfig()` (`frontend/src/lib/FestivalConfigContext.tsx`) fetches `festival.get` once for the whole app — replacing 14 pages that used to each call `api.festival.get()` independently — and exposes the module map alongside the festival data. `ResidentNav` and `VolunteerNav` filter their items by it (the same conditional-array pattern `VolunteerNav` already used for permission-based filtering), and the Home page's Donate/collection-stats block and Community Dinner card are gated the same way.

## Centralized festival/community identity

`getFestivalName()` and `getCommunityName()` (`backend/Config.js`) replace what used to be a `getConfig("festival_name", "Ganesha Chathurthi 2026")` fallback duplicated independently in 8 backend files (Drive root-folder naming, the receipt generator, the audit-log archive). `community_name` is a new Configuration key (default `"Brigade Woods"`) — previously that name was a literal string baked into the receipt generator with no config backing at all. Both are returned from `festival.get` for the frontend.

## Genericized ID prefixes (`backend/Ids.js`)

Every generated ID (`GWG-...`, dinner tokens `GW-...`) used to hardcode that literal prefix in each of 15 generator functions. `id_prefix` (Configuration key, seeded `"GWG"`) now drives it, so a future deployment sets its own prefix instead of forking the file. Purely additive — this deployment's IDs are byte-identical, since the default equals the old literal.

## Festival Setup — the self-service layer (Phase 2)

Volunteer → More → **Festival Setup** (still routed at `/volunteer/settings`, `Operations` permission) replaced what used to be a flat, unlabeled list of every Configuration row with sectioned, described fields — **Festival Identity** (name, community name, tagline, dates, venue, contact, ID prefix), **Hero Image**, **Modules** (Phase 1's checkboxes), and **Money** (Finance-gated, only rendered for keys the admin can actually see). Every Configuration key not covered by a named section — `volunteer_requirements`, `super_admin_email`, the seva guideline text, etc. — remains reachable in a collapsed **Advanced settings** escape hatch, so nothing became unreachable by organizing the common fields.

**Hero image upload** (`uploadHeroImage` in `Config.js`, route `volunteer.branding.uploadHeroImage`) is the one genuinely new piece of infrastructure this added: the same decode → Drive folder → `createFile` → `setSharing(ANYONE_WITH_LINK, VIEW)` pattern every other upload in this app already uses (`Bugs.js:reportBug` is the closest twin), stored under `<festival root>/Branding` in Drive. The one deliberate deviation from that existing pattern: every other upload in this app stores `file.getUrl()` and renders it as a clickable link, because `getUrl()` is a Drive *viewer* page, not raw image bytes — it can't be dropped into an `<img src>`. The hero image needs to render inline, so it stores `https://drive.google.com/thumbnail?id=<fileId>&sz=w1000` instead, which Drive serves as actual image bytes to an unauthenticated `<img>` tag once the file is link-shared. The Home page (`(resident)/page.tsx`) falls back to the bundled `/images/ganesha-hero.png` via a plain `<img>` tag (not `next/image` — no `remotePatterns` exist for the Drive domain, matching the same plain-`<img>` precedent the `/hundi` page already used for the bank's QR code) whenever `hero_image_url` is unset, so this is purely additive for the current deployment.

`festival_name`, `community_name`, and the new `tagline` key now also actually drive the Home page's header text (`(resident)/page.tsx:101-109`) — a real gap Phase 1 left open: those config values already existed and were already returned by `festival.get`, but the Home page's most prominent branding text ignored them and stayed hardcoded regardless.

## Launching the next Brigade Woods celebration on this codebase

1. Create a fresh Google Sheet, bind a copy of this Apps Script project to it (or point `SPREADSHEET_ID` at it), and run `setupSheets()`.
2. Sign in to Volunteer → More → **Festival Setup** (`/volunteer/settings`) and work through it top to bottom — no raw Configuration editing needed for any of this:
   - **Festival Identity** — name, community name, tagline, dates, venue, contact, ID prefix.
   - **Hero Image** — upload a replacement for the resident Home page's hero image directly (stored in this deployment's own Drive `Branding` folder); leave it unset to keep the default Ganesha art.
   - **Modules** — the checkboxes from Phase 1, for what this celebration actually needs.
   - **Money** (Finance permission only) — donation goal, min/max, UPI details.
   - **Advanced settings** — a collapsed escape hatch for any Configuration key not covered above (e.g. `volunteer_requirements`, `super_admin_email`).
3. What's still genuinely hand-edited, not self-service, because it's either bespoke content or carries real deploy-latency tradeoffs: the page `<title>`/metadata in `layout.tsx` (static, not fetched per-request), and the closing/sign-off copy in `DonationsClosed.tsx` and `WrapUpSummary.tsx` ("Ganpati Bappa Morya," 2025 comparison stats) — genuinely this festival's own voice and bespoke analytics, not generic platform text.
4. Deploy (`clasp push` + `clasp deploy -i <deploymentId>` for the backend, the usual Vercel deploy for the frontend) against the new Sheet/Configuration.

## Not yet built

- The **Guests module** — reserved as a module key, no sheet, no routes, no UI anywhere.
- A **meal pricing table** (household-free / guest-paid vs. everyone-pays-the-same, configurable per festival) — Community Dinner's guest pricing is still the two hardcoded constants (`GUEST_ADULT_PRICE`, `GUEST_CHILD_PRICE` in `CommunityDinner.js`) from the original build.
- **Per-festival theme skinning** (the saffron/maroon palette) — still the one hardcoded look from `globals.css`, not yet a configurable per-deployment theme (the hero *image* itself is now self-service — see above — but the color palette isn't).
- Self-service for **volunteer areas** (`frontend/src/lib/volunteerAreas.ts`, still hardcoded to exactly "Decorate Idol/Pooja/Aarti" / "Bhog/Prasadam/Food") and their seva guideline text (`Volunteers.js`) — still hand-edited per festival.
- Any **new Google Sheet / Apps Script deployment / Vercel project provisioning from the UI** — deliberately out of scope (a much larger, separate idea involving new API credentials); the Festival Setup screen configures the *content* of an already-provisioned deployment, not the infrastructure itself.
- An actual **second festival deployment** — this pass only built the mechanism; Ganesha Chathurthi 2026 remains the only festival that has ever run on this codebase.
- Four volunteer-only Community Dinner admin pages (`volunteer/community-dinner/page.tsx`, `.../sheets`, `.../tally`, `.../counters`) still call `api.festival.get()` directly inside a permission-gated `Promise.all`, rather than through `useFestivalConfig()` — left alone deliberately since untangling them from their existing `refreshKey`/`Promise.all` wiring carried more risk than the marginal duplication they represent.
