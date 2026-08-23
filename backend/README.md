# Backend — Google Apps Script Web App

Implements the API surface from `claude.md` §50 on top of Google Sheets
(§34, §51). This is a single Apps Script **Web App** — there's no real URL
routing, so every request is `POST/GET <web-app-url>?action=<name>`.

## One-time setup

1. Create a new Google Sheet — this is the datastore. Copy its ID from the
   URL (`https://docs.google.com/spreadsheets/d/<THIS_PART>/edit`).
2. Open **Extensions → Apps Script** from that Sheet. This gives you a
   *container-bound* script, which is the simplest path (no `clasp login`
   needed). Either:
   - Copy each `.js` file in this folder into a matching file in the Apps
     Script editor, and paste `appsscript.json`'s contents into
     **Project Settings → Show "appsscript.json"**, or
   - Install `@google/clasp` (`npm i -g @google/clasp`), run `clasp login`
     (opens a browser for you to authorize), then `clasp clone <scriptId>`
     into this folder and `clasp push`.
3. **Project Settings → Script Properties**, add:
   - `SPREADSHEET_ID` — the Sheet ID from step 1
   - `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` — from the Razorpay dashboard
   - `GOOGLE_OAUTH_CLIENT_ID` — an OAuth 2.0 Web Client ID from
     [Google Cloud Console](https://console.cloud.google.com/apis/credentials),
     used by the frontend's Google Sign-In button for volunteers
4. In the Apps Script editor, select the `setupSheets` function and click
   **Run** once. This creates all 14 sheets with header rows and seeds
   `Configuration`/`Blocks` with sensible defaults — check the execution
   log for confirmation. Safe to re-run.
5. Add yourself as the first volunteer: open the **Admins** sheet and add a
   row — `email` (your Google account), `name`, `permissions`
   (`Operations,Events,Dinner,Finance,Content`), `active` = `TRUE`.
6. **Deploy → New deployment → Web app**. Execute as **Me**, access
   **Anyone**. Copy the deployment URL — that's `NEXT_PUBLIC_API_URL` for
   the frontend.

## Known Apps Script constraints (by design, not oversights)

- **No custom response status codes.** Every response is HTTP 200; success
  or failure is in the JSON body (`{ ok: true/false }`).
- **No custom request headers.** `doPost` can't read a
  `X-Razorpay-Signature` header, so a classic server-to-server payment
  webhook can't be verified here. Instead, `Payments.js` verifies
  Razorpay's client-checkout signature (order id + payment id, HMAC'd with
  the key secret) — see the comment at the top of that file for the
  tradeoff and how to harden it later with a tiny relay function.
- **POST bodies must be sent as `Content-Type: text/plain`** from the
  frontend. A JSON content type triggers a CORS preflight (`OPTIONS`
  request), which Apps Script Web Apps don't handle. The body is still
  JSON-encoded — `parseBody()` in `Http.js` just parses it regardless of
  the declared content type.

## API surface (spec §50 → implementation)

| Spec endpoint | `action` value | Auth |
|---|---|---|
| `GET /festival` | `festival.get` | — |
| `GET /blocks` | `blocks.list` | — |
| `GET /events` | `events.list` | — |
| `GET /public-stats` | `stats.public` | — |
| — | `announcements.list` | — |
| `POST /donations` | `donations.create` | — |
| — | `donations.confirm` (Razorpay checkout callback) | — |
| `GET /donations/:id` | `donations.get` | — |
| — | `donations.mine` (by mobile) | — |
| `POST /events/:id/register` | `events.register` | — |
| — | `registrations.mine` (by mobile) | — |
| `POST /dinner/register` | `dinner.register` | — |
| — | `dinner.confirm` (Razorpay checkout callback) | — |
| `GET /dinner/token/:id` | `dinner.token` | — |
| — | `dinner.mine` (by mobile) | — |
| `POST /volunteers/register` | `volunteers.register` | — |
| — | `volunteers.mine` (by mobile) | — |
| — | `auth.check` | Google ID token |
| `GET /volunteer/dashboard` | `volunteer.dashboard` | ✓ |
| `GET /volunteer/transactions` | `volunteer.transactions` | ✓ Finance |
| `POST /volunteer/payment/verify` | `volunteer.payment.verify` | ✓ Finance |
| `POST /volunteer/payment/reject` | `volunteer.payment.reject` | ✓ Finance |
| `POST /volunteer/events` | `volunteer.events.create` | ✓ Events |
| — | `volunteer.events.registrations` | ✓ Events |
| `POST /registrations/:id/checkin` | `volunteer.events.checkin` | ✓ Events |
| — | `volunteer.dinner.dashboard` | ✓ |
| `POST /dinner/redeem` | `volunteer.dinner.redeem` | ✓ Dinner |
| `POST /dinner/walkin` | `volunteer.dinner.walkin` | ✓ Dinner |
| — | `volunteer.volunteers.list` | ✓ Operations |
| — | `volunteer.volunteers.activate` | ✓ Operations |
| `POST /volunteer/announcements` | `volunteer.announcements.create` | ✓ Content |
| — | `volunteer.announcements.deactivate` | ✓ Content |
| `GET /volunteer/reports` | `volunteer.reports.export` | ✓ Finance |
| — | `volunteer.config.list` | ✓ Operations |
| — | `volunteer.config.update` | ✓ Operations |
| — | `volunteer.auditLog.list` | ✓ Operations |

Permission areas (spec §4.2): `Operations`, `Events`, `Dinner`, `Finance`,
`Content` — stored comma-separated in the `Admins` sheet's `permissions`
column.

## Not yet implemented

- Paid event registration (spec explicitly phases this to §48 Phase 2) —
  `registerForEvent` rejects events with a `fee > 0`.
- Resident phone-OTP identity verification (spec §6) — resident endpoints
  currently trust whatever `mobile` the client sends. Fine while there's no
  frontend auth calling them yet; must be closed before this goes further
  than a local mock.
- Expense/vendor tracking (§28–§29) — the `Expenses` sheet exists but has
  no endpoints yet (optional for MVP per spec).
