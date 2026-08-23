# claude.md
## Brigade Woods Community Festival Portal — Consolidated Product & Technical Specification

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
- Register for activities.
- Register for community dinner/prasadam.
- Receive digital tokens where applicable.
- Check their registrations.
- Volunteer.
- Receive important festival information.

## Volunteer Goals

Volunteers should be able to:

- See festival status.
- Manage donations and reconciliation.
- Manage events and registrations.
- Manage dinner/prasadam tokens.
- Scan and redeem tokens.
- Manage volunteers.
- Handle walk-ins.
- View operational reports.
- Export data.
- Update festival configuration where permitted.

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
- View their own receipts/tokens.
- Volunteer.
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
- Manage events.
- Manage registrations.
- Manage dinner/prasadam.
- Scan and redeem tokens.
- Create walk-in registrations.
- Manage volunteers.
- View operational reports.
- Export data.
- Publish/update festival information where permitted.

Certain sensitive actions should require a higher volunteer permission internally, even though the product still presents only one "Volunteer" role.

Example permissions:

```text
VOLUNTEER
├── Operations
├── Events
├── Dinner
├── Finance
└── Content
```

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

"MY STUFF" contains:

- My donations
- My receipts
- My dinner tokens
- My event registrations
- My volunteer registrations

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
- Settings
- Audit log

On mobile, use a bottom navigation bar where practical.

---

# 6. Authentication

## Resident

Do not require traditional username/password registration.

Preferred options:

- Mobile OTP
- Secure magic link
- Google sign-in, if appropriate

The resident identity should be linked to:

- Name
- Mobile
- Block
- Flat

The portal should avoid asking for information repeatedly.

## Volunteer

Volunteer access must be authenticated.

Recommended:

- Google login / Google Workspace authentication, or
- Secure email OTP

Volunteer authorization must be checked server-side.

Simply hiding the Volunteer menu is not security.

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

Content should be configurable by volunteers.

---

# 9. Donations

## Resident Workflow

```text
DONATE
   |
   v
Name
Block
Flat
Amount
   |
   v
PAY
   |
   v
Payment Confirmation
   |
   v
Receipt
```

Mandatory:

- Resident name
- Block
- Flat number
- Donation amount

Optional:

- Mobile
- Email
- Anonymous/public recognition preference

## Block Dropdown

Block must be selected from a fixed master list.

Do not allow free-text block names.

The master list should be maintained in Google Sheets.

## Donation Amount

Provide quick amounts:

```text
₹500
₹1,000
₹2,000
₹5,000
Other
```

Minimum donation should be configurable.

---

# 10. Payment Architecture

## Important Requirement

A static QR code by itself cannot reliably tell the portal whether money was actually received.

Therefore the preferred implementation is:

```text
Resident
   |
   v
Create Donation
   |
   v
Payment Gateway / UPI
   |
   v
Payment
   |
   v
Trusted Gateway Callback
   |
   v
Backend Verification
   |
   v
SUCCESS
   |
   v
Receipt
```

If HDFC static QR must be used:

```text
Resident
   |
   v
Display HDFC QR
   |
   v
Resident Pays
   |
   v
Enter UTR / Reference
   |
   v
MANUAL REVIEW
   |
   v
Volunteer verifies
   |
   v
SUCCESS
   |
   v
Receipt
```

Never mark a donation successful merely because the resident clicks:

> "I have paid."

---

# 11. Payment States

Use:

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

Successful collection totals must include only:

```text
SUCCESS
VERIFIED_SUCCESS
```

---

# 12. Receipts

Generate a receipt only after verified payment.

Receipt:

```text
BRIGADE WOODS
GANESHA CHATHURTHI 2026

DONATION RECEIPT

Receipt No: GWG-R-000123
Transaction: GWG-20260822-000123

Name: John Doe
Block: Block 4
Flat: A-1204

Amount: ₹1,000
Date: 22-Aug-2026
Payment Reference: XXXXX

STATUS: SUCCESS

Thank you for contributing.
```

Receipt should be:

- Viewable online
- Downloadable as PDF
- Shareable
- Stored in Google Drive
- Referenced from Google Sheets

Do not store large PDF files directly inside Sheets.

---

# 13. Public Collection Dashboard

Residents can see aggregate statistics only.

Show:

```text
TOTAL COLLECTION
₹4,25,000

FAMILIES
278

DONATIONS
312

PARTICIPATION
83%
```

Also show block-wise collection:

```text
Block 1   ₹85,000
Block 2   ₹72,000
Block 3   ₹64,000
...
```

Do not show:

- Resident names
- Flat numbers
- Individual donation amounts
- UTRs
- Payment IDs

Optional:

```text
₹4.25L of ₹7.50L goal
```

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
- Category
- Age group
- Capacity
- Registration required
- Registration deadline
- Fee, if applicable
- Contact volunteer
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

Registration form should be minimal.

For children's events:

- Child name
- Age
- Flat
- Parent name
- Parent mobile

The system generates a registration ID.

---

# 16. Event Check-in

Where required, generate a QR check-in token.

Workflow:

```text
Resident Registration
       |
       v
QR generated
       |
       v
Event entrance
       |
       v
Volunteer scans
       |
       v
CHECKED IN
```

Volunteer sees:

```text
VALID REGISTRATION

John Doe
A-1204
Kids Drawing — Age 8

[ CHECK IN ]
```

Duplicate check-in must show:

```text
ALREADY CHECKED IN
```

---

# 17. Community Dinner / Prasadam

Dinner is a core festival module.

It should support:

- One or multiple days
- Free or paid meals
- Advance registration
- Family registration
- Adult/child counts
- Capacity
- Digital QR tokens
- Partial redemption
- Walk-ins
- Multiple serving counters
- Live meals served
- Food planning

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

If paid:

```text
Total: ₹650

[ PAY & REGISTER ]
```

Token is generated only after successful payment.

If free:

```text
[ REGISTER ]
```

Token can be generated immediately.

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

Each token should contain:

- Token ID
- Event/day
- Flat
- Meal entitlement
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

Every redemption records:

- Token
- Meals served
- Date/time
- Volunteer
- Counter

---

# 21. Volunteer Dinner Counter

Create a dedicated high-speed interface.

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

Flat: A-1204
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

Volunteers must be able to create a walk-in registration.

```text
WALK-IN

Block
Flat
Meals
Payment

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

This makes final reconciliation easy.

---

# 23. Dinner Capacity

Each dinner day can have:

- Maximum meals
- Registration cutoff
- Walk-in allowance
- Waitlist

Example:

```text
Capacity: 1,500
Registered: 1,320
Remaining: 180
```

When capacity is reached:

```text
REGISTRATION FULL
```

---

# 24. Dinner Operations Dashboard

Volunteers see:

```text
DAY 1 DINNER

Meals Registered      1,320
Meals Served          1,047
Meals Remaining         273

Advance                1,180
Walk-ins                 140

Utilization             79%
```

Additional views:

- By block
- By hour
- By counter
- Adult/child split
- Advance vs walk-in
- No-show estimate

---

# 25. Volunteer Registration

Residents can volunteer through:

```text
I WANT TO VOLUNTEER
```

Capture:

- Name
- Block
- Flat
- Mobile
- Preferred area
- Availability
- Optional experience

Areas can include:

- Event coordination
- Decorations
- Food/prasadam
- Kids activities
- Cultural programs
- Stage
- Sound/light
- Security coordination
- Parking
- Photography
- First aid
- Clean-up
- Waste management

---

# 26. Volunteer Management

Volunteers can see:

```text
VOLUNTEERS

46 registered
50 required

Food          12 / 12
Events         8 / 10
Parking        6 / 8
Kids           9 / 8
Clean-up       7 / 7
```

Where appropriate, volunteers can be assigned:

- Area
- Event
- Shift
- Timing
- Responsibility

---

# 27. Volunteer Dashboard

The volunteer landing page should be action-oriented.

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

------------------------------------------------

[ REVIEW PAYMENTS ]

[ DINNER COUNTER ]

[ EVENTS ]

[ VOLUNTEERS ]

[ REPORTS ]
```

Show alerts:

```text
8 payments need review
Dinner capacity 88%
3 volunteer gaps
2 events close registration today
```

---

# 28. Finance for Volunteers

Volunteers with finance permission can see:

## Collections

- Total donations
- Successful payments
- Pending payments
- Failed payments
- Manual review
- Block-wise collection
- Daily collection

## Expenses

Optionally track:

- Vendor
- Description
- Budget
- Actual
- Payment status
- Invoice/reference

## Festival Summary

```text
Collections     ₹5.35L
Expenses        ₹2.35L
Balance         ₹3.00L
```

This is optional for MVP but the data model should allow it.

---

# 29. Vendor / Operational Tracking

Keep this lightweight.

Volunteers can record:

- Vendor name
- Service
- Contact
- Amount agreed
- Amount paid
- Payment status
- Notes

Potential vendors:

- Food
- Decoration
- Sound
- Lighting
- Stage
- Photography
- Security
- Waste management

---

# 30. Announcements

Volunteers can publish simple announcements.

Examples:

```text
Community dinner registration is now open.

Drawing competition registrations close tomorrow.

Please report at Central Courtyard by 5:30 PM.
```

Each announcement should have:

- Title
- Message
- Date/time
- Optional expiry
- Optional related event

Residents see active announcements on Home.

WhatsApp sharing should be supported.

---

# 31. Reports

Volunteer reports should include:

## Finance

- Donation report
- Block-wise collection
- Payment reconciliation
- Expense report

## Events

- Registrations
- Attendance
- No-shows

## Dinner

- Meals allocated
- Meals served
- Walk-ins
- Block-wise demand
- Counter-wise usage
- Day-wise usage

## Volunteers

- Registered volunteers
- Assigned volunteers
- Unfilled requirements

Export:

- CSV
- Excel-compatible spreadsheet

---

# 32. Audit Trail

Important volunteer actions must be logged.

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

Audit actions include:

- Payment verification
- Payment rejection
- Event changes
- Capacity changes
- Token redemption correction
- Volunteer changes
- Configuration changes

---

# 33. Privacy

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

Public statistics must be aggregated.

Volunteer access to individual information should be limited to what is operationally necessary.

---

# 34. Google Sheets Backend

For the initial community-scale implementation, Google Sheets is acceptable as the operational datastore.

Recommended sheets:

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
Admins / Permissions
Audit Log
```

Google Sheets should never be exposed directly to residents.

Architecture:

```text
Browser
   |
   v
Backend API
   |
   v
Google Sheets
```

---

# 35. Google Drive

Use Google Drive for generated documents.

Recommended:

```text
Ganesha Chathurthi 2026
|
+-- Receipts
+-- Reports
+-- Event Documents
```

Google Sheet stores URLs/references rather than PDF binaries.

---

# 36. Core Data Model

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
amount
currency
payment_provider
payment_order_id
payment_id
payment_reference
status
receipt_id
receipt_url
created_at
updated_at
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
category
age_group
capacity
registration_required
registration_deadline
fee
status
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
status
check_in_at
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
status
source
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
areas
availability
status
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

---

# 37. Generic Token / Entitlement Engine

Do not hard-code QR tokens only for dinner.

Create a reusable concept:

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

Examples:

```text
Dinner
→ 5 meal entitlement
→ 5 redemptions

Prasadam
→ 4 meal entitlement
→ 4 redemptions

Kids Workshop
→ 1 participation entitlement
→ 1 check-in

Paid Event
→ 2 admission entitlement
→ 2 check-ins
```

This makes the system reusable.

---

# 38. Security

Backend must:

- Validate every request.
- Validate block against master data.
- Validate amount.
- Prevent unauthorized transaction access.
- Verify payment signatures.
- Prevent duplicate webhooks.
- Prevent duplicate redemptions.
- Protect volunteer endpoints.
- Rate-limit sensitive APIs.
- Keep secrets server-side.
- Prevent transaction ID enumeration.

Never put payment secrets in frontend code.

---

# 39. Idempotency

Payment callbacks must be idempotent.

Example:

```text
Webhook 1 → SUCCESS → Receipt generated
Webhook 2 → Already SUCCESS → Ignore
Webhook 3 → Already SUCCESS → Ignore
```

Similarly, token redemption should be protected against accidental double scans.

---

# 40. Resident UX Principles

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

# 41. Volunteer UX Principles

Volunteer workflows should optimize for speed.

Especially:

- QR scanning
- Payment verification
- Walk-in registration
- Event check-in
- Dinner redemption

A volunteer at a dinner counter should be able to process a token in **a few seconds**.

---

# 42. Notifications

Support:

- Donation success
- Receipt availability
- Event registration confirmation
- Dinner token generation
- Event reminder
- Schedule changes
- Volunteer assignment

Delivery channels can initially be:

- In-app
- WhatsApp sharing
- Email where available

Do not make SMS/WhatsApp automation a hard dependency for MVP.

---

# 43. Festival Configuration

Volunteers with configuration permission should be able to update:

- Festival name
- Dates
- Venue
- Donation goal
- Minimum donation
- Blocks
- Payment method
- QR/payment instructions
- Event information
- Dinner pricing
- Dinner capacity
- Contact details

This avoids code changes for operational changes.

---

# 44. Operational Workflow

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
Donations
Events
Registrations
Dinner
Token Scanning
Volunteer Operations
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
Finalize Expenses
      ↓
Export Reports
      ↓
Publish Community Summary
```

---

# 45. Post-Festival Community Report

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

Optional:

- Collections
- Expenses
- Participation
- Volunteer contribution
- Meals served
- Event attendance
- Sustainability metrics

---

# 46. Sustainability / Waste

Keep this optional and simple for the first version.

Possible metrics:

- Waste generated
- Waste segregated
- Food waste
- Plastic avoided
- Reusable materials
- Cleanup volunteers

This can eventually become part of the community impact report.

---

# 47. Recommended MVP

The first version should include only what is necessary to run the festival.

## Resident

- [ ] Home page
- [ ] Festival information
- [ ] Donation
- [ ] Payment
- [ ] Receipt
- [ ] Collection dashboard
- [ ] Event listing
- [ ] Event registration
- [ ] Dinner registration
- [ ] Digital dinner token
- [ ] My registrations
- [ ] Volunteer registration

## Volunteer

- [ ] Login
- [ ] Dashboard
- [ ] Donation management
- [ ] Payment verification
- [ ] Receipt lookup
- [ ] Event management
- [ ] Registration management
- [ ] Event check-in
- [ ] Dinner token scanning
- [ ] Dinner walk-ins
- [ ] Volunteer management
- [ ] Announcements
- [ ] Basic reports
- [ ] CSV export

---

# 48. Phase 2

After the MVP is stable:

- [ ] Paid event registration
- [ ] Expense tracking
- [ ] Vendor tracking
- [ ] Volunteer shifts
- [ ] Multiple dinner counters
- [ ] Advanced dinner analytics
- [ ] WhatsApp notification integration
- [ ] Email receipts
- [ ] Public receipt verification
- [ ] Waitlists
- [ ] Post-event impact report

---

# 49. Technical Architecture

Recommended initial stack:

```text
                    RESIDENT
                       |
                       v
                WEB APPLICATION
                       |
              +--------+--------+
              |                 |
              v                 v
        Resident API       Volunteer API
              |                 |
              +--------+--------+
                       |
                       v
                 BACKEND LAYER
                       |
        +--------------+--------------+
        |              |              |
        v              v              v
    Google Sheets   Google Drive   Payment Gateway
        |              |              |
        |              v              |
        |           Receipts          |
        +--------------+--------------+
                       |
                       v
                  Audit / Logs
```

Recommended frontend:

- React
- TypeScript
- Tailwind CSS
- Vite or Next.js

Recommended backend for MVP:

- Google Apps Script Web App

Alternative production backend:

- Node.js / TypeScript
- Vercel / Cloud Run
- PostgreSQL/Supabase if the system grows beyond festival-scale usage

---

# 50. API Surface

Conceptual endpoints:

```text
GET  /festival
GET  /blocks
GET  /events
GET  /public-stats

POST /donations
GET  /donations/:id
POST /payment/webhook

POST /events/:id/register
GET  /registrations
POST /registrations/:id/checkin

POST /dinner/register
GET  /dinner/token/:id
POST /dinner/redeem
POST /dinner/walkin

POST /volunteers/register

GET  /volunteer/dashboard
GET  /volunteer/transactions
POST /volunteer/payment/verify
POST /volunteer/payment/reject
POST /volunteer/events
POST /volunteer/announcements
GET  /volunteer/reports
```

Exact routing can vary by implementation.

---

# 51. Google Sheets Structure

## Transactions

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
payment_provider
payment_order_id
payment_id
payment_reference
status
verified_at
receipt_id
receipt_url
source
admin_notes
updated_at
```

## Blocks

```text
block_id
block_name
active
```

## Events

```text
event_id
name
description
date
start_time
end_time
location
category
age_group
capacity
fee
status
```

## Event Registrations

```text
registration_id
event_id
resident_id
participant_name
participant_age
block
flat_number
status
check_in_at
```

## Entitlements

```text
entitlement_id
event_id
resident_id
token_id
allocated_quantity
redeemed_quantity
remaining_quantity
source
status
```

## Redemption Log

```text
redemption_id
entitlement_id
quantity
counter_id
volunteer_id
redeemed_at
```

## Volunteers

```text
volunteer_id
resident_id
areas
availability
status
```

## Volunteer Assignments

```text
assignment_id
volunteer_id
event_id
area
shift
status
```

## Announcements

```text
announcement_id
title
message
published_at
expires_at
active
```

## Configuration

```text
key
value
```

## Audit Log

```text
timestamp
volunteer_id
action
entity
entity_id
old_value
new_value
```

---

# 52. Performance

Target:

- Initial load < 3 seconds on normal mobile broadband.
- Donation form response < 2 seconds excluding payment provider.
- Dashboard < 3 seconds.
- Token scan/redeem response ideally < 2 seconds.

Public aggregate statistics may be cached.

Individual information must not be publicly cached.

---

# 53. Error Handling

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

Do not expose backend errors.

---

# 54. Testing

## Resident

Test:

- Donation
- Payment
- Receipt
- Event registration
- Dinner registration
- QR token
- My registrations
- Volunteer registration

## Volunteer

Test:

- Login
- Payment verification
- Event creation
- Registration management
- Check-in
- Dinner scanning
- Partial redemption
- Walk-in
- Volunteer management
- Reports

## Security

Test:

- Unauthorized volunteer access
- Data leakage
- Forged payment callback
- Duplicate webhook
- Duplicate token redemption
- Invalid transaction IDs
- Invalid event registrations

## Devices

Test:

- Android Chrome
- iPhone Safari
- Desktop Chrome
- Desktop Safari

---

# 55. Acceptance Criteria

The MVP is ready when:

- [ ] Resident can access portal without complicated login.
- [ ] Resident can donate.
- [ ] Block is selected from a fixed list.
- [ ] Flat number is mandatory.
- [ ] Payment is securely confirmed.
- [ ] Successful donation generates exactly one receipt.
- [ ] Total collection is accurate.
- [ ] Block-wise collection is accurate.
- [ ] Individual donations are hidden from residents.
- [ ] Volunteer login is protected.
- [ ] Volunteers can view individual transactions.
- [ ] Volunteers can reconcile payments.
- [ ] Residents can view events.
- [ ] Residents can register for events.
- [ ] Volunteers can manage events.
- [ ] Event check-in works where enabled.
- [ ] Residents can register for dinner.
- [ ] Dinner token QR is generated.
- [ ] Volunteers can scan dinner tokens.
- [ ] Partial redemption works.
- [ ] Duplicate redemption is prevented.
- [ ] Walk-in dinner registration works.
- [ ] Meals allocated and served are tracked.
- [ ] Residents can volunteer.
- [ ] Volunteers can manage volunteer participation.
- [ ] Basic reports can be exported.
- [ ] Important volunteer actions are audited.
- [ ] The portal works well on mobile.

---

# 56. Product Design Direction

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

# 57. Critical Design Decisions

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

## Decision 4 — Payment Truth Comes From Backend

Never trust browser-side payment confirmation.

## Decision 5 — QR Tokens Are Generic

Dinner tokens should be implemented as a reusable entitlement/check-in system.

## Decision 6 — Google Sheets Is an MVP Datastore

It is acceptable for this community-scale festival but the architecture should allow migration to a proper database later.

## Decision 7 — Build for Reuse

Ganesha Chathurthi 2026 is the first festival, not the final purpose of the product.

---

# 58. Future Reuse

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

# 59. Final Product Definition

The product should be thought of as:

> **A simple digital operating system for Brigade Woods community festivals.**

Not:

> A donation website with some additional features.

The MVP should nevertheless remain deliberately small:

```text
RESIDENT
   |
   +-- Donate
   +-- Events
   +-- Dinner
   +-- My Stuff
   +-- Volunteer

VOLUNTEER
   |
   +-- Dashboard
   +-- Donations
   +-- Events
   +-- Dinner
   +-- Volunteers
   +-- Reports
```

Everything else should support these two experiences.

---

# 60. Implementation Priority

Build in this order:

### Priority 1 — Foundation

1. Festival configuration
2. Resident identity
3. Block master
4. Volunteer authentication
5. Google Sheets backend
6. Basic resident/volunteer UI

### Priority 2 — Money

7. Donations
8. Payment integration
9. Payment verification
10. Receipts
11. Collection dashboard

### Priority 3 — Festival Participation

12. Events
13. Registrations
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

22. Volunteer assignments
23. Announcements
24. Reports
25. Audit log
26. Configuration

---

# 61. Final Coding Instruction

Implement the portal according to this specification with the following priorities:

1. **Extreme simplicity for residents.**
2. **Fast operational workflows for volunteers.**
3. **Secure payment processing.**
4. **Accurate financial records.**
5. **Reliable QR/token redemption.**
6. **Minimal personal-data exposure.**
7. **Google Sheets compatibility.**
8. **Mobile-first design.**
9. **Clear separation between resident and volunteer privileges.**
10. **Reusable event/festival architecture.**

The implementation should favour a small number of clear screens over feature-heavy navigation.

The complete critical resident journey should be:

```text
Open Portal
   ↓
Choose Activity
   ↓
Donate / Register / Get Token
   ↓
Complete Payment if Required
   ↓
Confirmation
   ↓
Receipt / Registration / QR Token
```

The critical volunteer journey should be:

```text
Login
   ↓
Dashboard
   ↓
Choose Operation
   ↓
Verify / Register / Scan / Manage
   ↓
Complete Action
   ↓
Record Audit Trail
```

Before production release, perform an end-to-end test for:

```text
Donation
→ Payment
→ Verification
→ Receipt
→ Dashboard

Event
→ Registration
→ QR
→ Check-in

Dinner
→ Registration
→ Token
→ Scan
→ Partial Redemption
→ Final Meal Count

Volunteer
→ Registration
→ Approval/Activation
→ Assignment
→ Operational Action
```

The final product should be simple enough that a Brigade Woods resident can use it without instructions, while a volunteer can operate the festival from a phone.
