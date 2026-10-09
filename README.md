# FlatMate Finder

React + Tailwind CSS, Node.js + Express REST API and PostgreSQL coursework project.

## Code map

```
frontend/src/
  pages/        One React file per screen (Home, Browse, Chat, Profile, Admin…)
  components/   Reusable UI: sidebar, cards, photo uploader, chat panel
  services/     api.js: every frontend HTTP call
backend/src/
  routes/       REST endpoint groups
  middleware/   Authentication and error handling
  services/     aiService.js and notificationService.js
  config/       PostgreSQL connection
database/       Reproducible schema and non-destructive upgrade scripts
```

## Requirements implemented

- Public homepage, responsive/collapsible sidebar and role-specific workspaces.
- Student / advertiser authentication with bcrypt + HTTP-only JWT cookie.
- Invite-only admin registration: use `FMF-ADMIN-2026` once after running the database upgrade, then create private replacement codes from Platform management.
- Listing CRUD, local photo upload (up to five photos), saving, detailed filtering and listing details.
- Enquiry chat history: both the student and advertiser can write in the same private conversation; advertiser can accept or decline.
- Student-only flatmate search and matching, dynamic compatibility explanations, profile cards,
  favourites and a separate saved-flatmates page. Advertisers deliberately have no matching page.
- Reporting and moderation workflow: any signed-in user can report a listing; automated safety flags create a pending report and every decision remains with an administrator.
- Full listing data: rent, bond, address, room details, availability, rules, JSON utilities, transport access, status and up to five photos.
- Live administrator outcome diagrams for listing publication/status, student needs, enquiry outcomes and flatmate engagement.
- Coursework-safe rental checkout with server-validated availability and auditable demo payment records. It never collects card details or moves real funds.

## Five AI-enhanced functions

1. **Flatmate recommendation** dynamically scores the profile fields both students supplied,
   including location, budget overlap, study routine and lifestyle similarity.
2. **Listing recommendation** ranks rooms against budget, location, lifestyle and the student's
   recent saved-listing patterns.
3. **Smart search** parses natural-language rent, city, room type, quiet/furnished, lifestyle and
   transport intent. Gemini embeddings add semantic ranking when stored vectors are available.
4. **Listing summary** uses Gemini structured output and automatically falls back to a factual,
   deterministic summary if the provider is unavailable.
5. **Safety support** combines Gemini review with explainable scam, pressure, incomplete-address
   and off-platform-contact rules. Flagged listings still require a human administrator decision.

Each AI service has a clearly labelled Gemini-first section followed by a deterministic local
fallback. With a Gemini key configured, search
text and selected public listing fields may be sent to Gemini for embeddings, summaries or safety
support. Passwords, messages, contact details, account identity and precise street address are not
included. Automated outputs are decision support, not housing or moderation decisions.

## Run locally

1. For a fresh database, run `database/schema.sql`. For the existing Neon database, run
   `npm run migrate` from `backend`; this keeps existing data and also adds the demo payment table.
2. In `backend`, copy `.env.example` to `.env`, then set `DB_NAME=flatmate_finder_app` and your PostgreSQL password in `DB_PASSWORD`.
3. Terminal 1:

```powershell
cd backend
npm install
npm run dev
```

4. Terminal 2:

```powershell
cd frontend
npm install
npm run dev
```

5. Visit `http://localhost:5173`. Register the first administrator with the invite code above; do not share it publicly.

To enable Gemini, keep the key on the server only and set:

```text
GEMINI_API_KEY=your-server-side-key
GEMINI_EMBEDDING_MODEL=gemini-embedding-001
GEMINI_TEXT_MODEL=gemini-3.5-flash
```

Provider selection currently follows the presence of `GEMINI_API_KEY`; `AI_MODE` is not a runtime switch. Remove the key to use local-only behaviour. Set model names to ones available to your Google account; unavailable models fall back locally.

Existing listings need embeddings once. This sends only the public listing fields documented above
to Gemini:

```powershell
cd backend
npm run ai:reindex
```

## Verification

```powershell
cd backend
npm test
cd ..\frontend
npm run build
```

## Deployment note

`render.yaml` defines the API health check and static frontend. For Render/Neon, run
`database/schema.sql` for a fresh database. For the existing database, run the database migration
commands through `npm run migrate`. Then set `DATABASE_URL`, `FRONTEND_URL`, `JWT_SECRET`,
the Gemini variables above, and frontend `VITE_API_URL` (including `/api`). Production uses SSL
cloud PostgreSQL and cross-site secure HTTP-only cookies.

Before a real launch, replace the bootstrap admin code, use managed object storage instead of database data-URL photos, add email verification/password reset, configure backups and rate limiting, and complete an accessibility/security review.

## Student journeys

### Community update: migration and behaviour

Before running this version, run `npm run migrate` from `backend`. New installations must first run `database/schema.sql`, then the migration. The migration now also applies `database/community-upgrade.sql`: it preserves existing records, backfills managed transport/facility choices and adds report evidence and notification snapshots. Back up the database before upgrading a shared deployment.

- Saving a listing subscribes that user to changes in weekly rent, bond, available date and status. Updates and notifications commit together. Deletion sends a final notification with the old title, rent and date; the original listing is no longer accessible. Unchanged values do not create another notification. Existing flatmate message notifications are unchanged.
- A new listing/user/message report notifies active administrators. A completed review sends the reporter a result; the full outcome is in Dashboard → My reports & outcomes. Reprocessing an already handled report returns 409. Report processing does not itself deactivate an account or close a listing: those are separate administrator actions.
- Report a profile from its detail page or a received message from a flatmate conversation. The server checks conversation membership and records the selected message, sender and timestamp itself. Evidence notes and explanations go to administrators, not Gemini. Deleting a target preserves its report snapshot; this is not an indefinite-retention or legal-compliance policy.
- Transport and facilities are landlord-entered text, separated by commas (up to 20 entries, 160 characters each). Category management and its endpoints have been removed. Existing listing text is retained; old category tables remain only for migration compatibility and are not used for publishing or searching. Cities/towns use the fixed list in `shared/nzCities.json` in both publishing and searching; administrators do not manage it. Existing legacy locations remain visible when editing. Room types remain fixed (Single room, Double room, Shared room, Studio).
- Listing search (normal and smart): every comma-separated transport/facility phrase must occur in the corresponding landlord-entered field; facility entries marked false do not match. Every lifestyle phrase must occur in description or house rules. Matching ignores case and treats wildcard characters literally in these text filters. The city dropdown matches the city field, not the suburb. These filters do not verify actual amenities or behaviour. Available-by is inclusive. Explicit filters are enforced in SQL, not only in the browser.
- Administrators can open a reported user or listing in a read-only administrator detail view, including inactive/hidden targets. Deleted targets return a clear message and retain report snapshots. These endpoints remain administrator-only and do not expose passwords.
- Listing enquiry conversations and the inbox refresh every five seconds while the tab is visible and refresh when the window regains focus. Switching conversations unmounts the old chat; stale message responses are ignored. Scrolling back through messages does not force the reader to the bottom on each refresh. This is polling, not a WebSocket guarantee of instant delivery.
- Flatmate search: study routine is a case-insensitive substring; every comma-separated lifestyle tag must match a full tag, case-insensitively. Move-in from/to dates are inclusive and exclude undated profiles when a boundary is supplied. A maximum-budget filter compares the candidate's minimum budget, not their maximum. Inverted date ranges return 400.

### AI data, fallback and limitations

| Function | Fields sent to Gemini |
| --- | --- |
| Smart search | Current natural-language search text (up to 1,000 characters); semantic embeddings use search text and public listing content. |
| Listing recommendation | Profile maximum budget, preferred location and lifestyle tags; candidate rent, area, room type, description (500 characters) and rules (300 characters). No favourite-listing context. |
| Listing summary | Listing title, description, weekly rent, suburb/city, availability date, room type, utilities and transport. |
| Safety screening | Title, description, suburb/city, weekly rent and bond. Local safety checks also apply to Gemini results. |
| Flatmate recommendation | Both sides' location, budget range, study habits and lifestyle tags; candidates are indexed rather than named. |

Gemini listing and flatmate recommendation do **not** use saved listings or saved people as ranking inputs. The listing recommendation fallback also ignores saved-listing context. Saving remains a shortlist feature, not a recommendation signal. There is **no stored search-history feature**. Explicit identity/contact fields, passwords, payment details and private chat/report evidence are not included in these AI payloads. Free-text listing/profile/search fields may still contain personal information entered by users; users should avoid placing private information there.

Calls use bounded input, deadlines, application rate/quota controls and validated outputs. Missing credentials, provider errors/timeouts or unusable results trigger local algorithms; unavailable embeddings fall back to local relevance. Actual result labels identify Gemini versus local fallback. A configured API key does not guarantee provider availability. Scores are preference hints, not probabilities, tenancy decisions or safety guarantees; summaries and screening need human verification. Rate/quota accounting is in-process and is not a shared multi-server billing cap.

Both student types now start at Dashboard. Housing students can browse all available rooms without entering search filters. Flatmate students can upload a JPEG/PNG/WebP portrait (below 1 MB) and an introduction in My profile, open profile cards, save people, and start private enquiries. Conversations and unread messages are stored in PostgreSQL and visible only to their two participants. Existing conversations remain available if a profile becomes hidden.

Run `npm run migrate` in backend before starting the updated application. This adds profile fields and flatmate conversation/message tables without deleting existing records. Accounts without a portrait show a labelled placeholder.

Run `npm test` in backend for unit tests. The opt-in database integration test requires the migrated database: in PowerShell set `$env:RUN_DATABASE_TESTS='1'`, then run `npm test`. It creates temporary test accounts and removes their records in cleanup.
