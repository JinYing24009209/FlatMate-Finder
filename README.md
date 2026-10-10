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

### Administrator dashboard and moderation

- Administrator Dashboard contains live database charts (30-second refresh); Platform management contains reports, users, listing status controls and staff invitations. Date range affects only the daily new-listing chart. Other charts show current/all-time totals as labelled.
- Homes rented out counts current `filled` listings, not demo payments or shortlisted rooms. Matched people counts distinct users in mutually agreed pairs where both participants are active flatmate students. Report outcomes count reports with recorded `close_listing` or `deactivate_user` actions; these are report counts, not unique targets. Reactivation/relisting does not erase the historical report decision.
- All listings → AI safety check calls the same Gemini-first screening service used by students, using server-loaded listing data. Green is lower risk, amber requires review, red is high risk, and grey is unchecked/loading/failed. Scores 34–66 are amber and 67–100 red; any unsafe lower score is also amber. Results are advisory, include provider/fallback and timestamp, and do not change listing status. Checks are sequential and subject to shared AI limits; a failed check is never labelled safe.
- Dashboard badges count unread notifications, separately from Enquiries' unread messages. Clicking an activity marks it read and opens the specific conversation, report, listing detail or advertiser listing card. Deleted targets show retained information instead of an invalid destination.
- Run `npm run migrate` before startup to add `report.resolution_action` through `database/moderation-upgrade.sql` without reclassifying older reviews.

### Mutual matches, payment records and search

- Run `npm run migrate` in `backend` before using these features; it also applies `database/outcomes-upgrade.sql`.
- In flatmate Enquiries, each participant controls only their own agreement button. Both choices initially default to Not agreed. Both agreeing creates a mutual match; either withdrawing removes it from both Matched flatmates pages. The server serializes concurrent updates, and only the two participants can change their choices. This is mutual consent, not the AI compatibility score or a tenancy agreement. Multiple mutual pairs are allowed. A matched partner can still open a hidden profile; inactive accounts are not displayed.
- Housing students have a Successful payments page containing only their own successful demonstration payments, including unavailable listings. If a listing is later deleted, its saved payment snapshot remains visible. This is not a real payment provider, receipt or tenancy contract.
- Both search pages separate the smart-search text from standard filters. Smart search uses its own text, not the previous standard form values. The listing Area dropdown follows City and contains suburbs currently represented by available listings in that city; matching is case-insensitive and exact. Changing city clears area.
- Flatmate smart search sends only the current query to Gemini to extract location, maximum budget, study habits, lifestyle and move-in date boundaries. The server validates and applies these filters, then uses the existing compatibility ranking. The local fallback recognizes a limited set of English keywords and explicit YYYY-MM-DD dates. The page shows interpreted criteria and the actual provider; unrecognized text is not a guarantee of semantic filtering. Saved people and search history are not used.
- Report-target pages reuse the ordinary listing/profile detail layouts but show administrator review information instead of student save, enquiry and payment actions.

### Community update: migration and behaviour

Before running this version, run `npm run migrate` from `backend`. New installations must first run `database/schema.sql`, then the migration. The migration now also applies `database/community-upgrade.sql`: it preserves existing records, backfills managed transport/facility choices and adds report evidence and notification snapshots. Back up the database before upgrading a shared deployment.

- Saving a listing subscribes that user to changes in weekly rent, bond, available date and status. Updates and notifications commit together. Deletion sends a final notification with the old title, rent and date; the original listing is no longer accessible. Unchanged values do not create another notification. Existing flatmate message notifications are unchanged.
- A new listing/user/message report notifies active administrators. Upholding a listing report takes the listing down (Closed); upholding a user/chat report deactivates the reported account. The target change, report decision, saver updates and reporter notification commit together or roll back. Dismiss leaves the target unchanged. Reprocessing returns 409. Administrators cannot deactivate themselves. Deleted targets cannot be actioned; dismiss with an explanation instead. Legacy review-only records are not counted as upheld actions.
- Report a profile from its detail page or a received message from a flatmate conversation. The server checks conversation membership and records the selected message, sender and timestamp itself. Evidence notes and explanations go to administrators, not Gemini. Deleting a target preserves its report snapshot; this is not an indefinite-retention or legal-compliance policy.
- Transport and facilities are landlord-entered text, separated by commas (up to 20 entries, 160 characters each). Category management and its endpoints have been removed. Existing listing text is retained; old category tables remain only for migration compatibility and are not used for publishing or searching. Cities/towns use the fixed list in `shared/nzCities.json` in both publishing and searching; administrators do not manage it. Existing legacy locations remain visible when editing. Room types remain fixed (Single room, Double room, Shared room, Studio).
- Listing search (normal and smart): every comma-separated transport/facility phrase must occur in the corresponding landlord-entered field; facility entries marked false do not match. Every lifestyle phrase must occur in description or house rules. Matching ignores case and treats wildcard characters literally in these text filters. The city dropdown matches the city field, not the suburb. These filters do not verify actual amenities or behaviour. Available-by is inclusive. Explicit filters are enforced in SQL, not only in the browser.
- Administrators can open a reported user or listing in a read-only administrator detail view, including inactive/hidden targets. Deleted targets return a clear message and retain report snapshots. These endpoints remain administrator-only and do not expose passwords.
- Listing enquiry conversations and the inbox refresh every five seconds while the tab is visible and refresh when the window regains focus. Switching conversations unmounts the old chat; stale message responses are ignored. Scrolling back through messages does not force the reader to the bottom on each refresh. This is polling, not a WebSocket guarantee of instant delivery.
- Flatmate search: study routine is a case-insensitive substring; every comma-separated lifestyle tag must match a full tag, case-insensitively. Move-in from/to dates are inclusive and exclude undated profiles when a boundary is supplied. A maximum-budget filter compares the candidate's minimum budget, not their maximum. Inverted date ranges return 400.

### AI data, fallback and limitations

The five feature implementations live in `backend/src/services`:

| Owner | Feature file | Responsibility |
| --- | --- | --- |
| Ying Jin | `aiSmartSearch.js` | Listing and flatmate search parsing, embeddings and local relevance. |
| Xiangxiao Li | `aiListingSummary.js` | Gemini summaries, date formatting and local summaries. |
| Xinrui Gao | `aiSafetySupport.js` | Gemini safety assessment and the original local safety floor. |
| Xinze Gao | `aiListingRecommendation.js` | Gemini listing ranking and local listing scores. |
| Pengrui Su | `aiFlatmateRecommendation.js` | Gemini flatmate ranking, shared cache and local compatibility scores. |

Each feature places external AI orchestration above its local algorithms. `geminiClient.js` is shared request infrastructure (model configuration, quota, retry and timeout), not a sixth feature. `aiService.js` remains a small compatibility export so existing routes and scripts keep the same imports. This organisation does not change prompts, scoring weights, response fields, cache limits or fallback decisions. Safety screening still combines local risk signals with Gemini results rather than discarding the local safety floor after a successful call.

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
