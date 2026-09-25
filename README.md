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
- Invite-only admin registration: use `FMF-ADMIN-2026` once after running the database upgrade, then create private replacement codes from the Admin dashboard.
- Listing CRUD, local photo upload (up to five photos), saving, detailed filtering and listing details.
- Enquiry chat history: both the student and advertiser can write in the same private conversation; advertiser can accept or decline.
- Student-only flatmate search and matching, dynamic compatibility explanations, profile cards,
  favourites and a separate saved-flatmates page. Advertisers deliberately have no matching page.
- Reporting and moderation workflow: any signed-in user can report a listing; automated safety flags create a pending report and every decision remains with an administrator.
- Full listing data: rent, bond, address, room details, availability, rules, JSON utilities, transport access, status and up to five photos.

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

Local fallback mode is deterministic and sends no data externally. With `AI_MODE=gemini`, search
text and selected public listing fields may be sent to Gemini for embeddings, summaries or safety
support. Passwords, messages, contact details, account identity and precise street address are not
included. Automated outputs are decision support, not housing or moderation decisions.

## Run locally

1. For a fresh database, run `database/schema.sql`. For the existing Neon database, run
   `npm run migrate` from `backend`; this keeps existing data and adds flatmate favourites.
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
AI_MODE=gemini
GEMINI_API_KEY=your-server-side-key
GEMINI_EMBEDDING_MODEL=gemini-embedding-001
GEMINI_TEXT_MODEL=gemini-3.6-flash
```

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
