# FlatMate Finder — Listing (房源发布) Backend Module

Node.js + Express + PostgreSQL (Sequelize) implementation of the **room/flat
listing creation & management** feature from the FlatMate Finder project
brief (section 3, "Room and flat listings").

This module covers:
- Advertisers create, edit, save-as-draft, and publish listings
- Photo upload per listing
- Status lifecycle: `draft → available → shortlisted → filled → closed`
- Public search/browse of published listings
- Ownership checks (an advertiser can only edit/delete their own listings)
- Input validation and centralised error handling

It assumes a separate **accounts/auth module** issues JWTs on login
(`{ sub: userId, role }`, signed with `JWT_SECRET`). `scripts/` includes
throwaway helpers to test this module standalone before that module is wired
in.

## 1. Setup

```bash
cp .env.example .env        # fill in your local Postgres credentials
npm install
createdb flatmate_finder    # or create the DB in pgAdmin / psql

# Option A: let Sequelize create the tables (dev only)
npm run dev

# Option B: run the raw schema yourself (matches the ERD 1:1)
psql -d flatmate_finder -f migrations/schema.sql
```

## 2. Try it without the auth module

```bash
node scripts/seedAdvertiser.js
# → prints the new user's id

node scripts/issueTestToken.js <userId> advertiser
# → prints a JWT to use as: Authorization: Bearer <token>
```

## 3. API Reference

Base path: `/api/listings`. All bodies are JSON unless noted.

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/` | none | Browse/search published listings (paginated) |
| GET | `/:id` | optional | Listing detail (drafts only visible to the owner/admin) |
| GET | `/mine/list` | advertiser | The logged-in advertiser's own listings |
| POST | `/` | advertiser | Create a listing (draft or publish immediately) |
| PUT | `/:id` | advertiser (owner) | Edit a listing's fields |
| PATCH | `/:id/status` | advertiser (owner) | Change status (publish / shortlist / fill / close) |
| POST | `/:id/photos` | advertiser (owner) | Upload up to 8 photos (`multipart/form-data`, field `photos`) |
| DELETE | `/:id/photos/:photoId` | advertiser (owner) | Remove one photo |
| DELETE | `/:id` | advertiser (owner) | Delete a listing |

### Create a listing — `POST /api/listings`

```bash
curl -X POST http://localhost:4000/api/listings \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Sunny single room, Albany",
    "weeklyRent": 255,
    "bond": 1020,
    "roomType": "Single",
    "availableFrom": "2026-08-12",
    "address": "14 Sunrise Terrace",
    "suburb": "Albany",
    "description": "Fully furnished single room, 8 min walk from Massey Albany.",
    "houseRules": "No smoking indoors, quiet hours after 10pm",
    "amenities": ["Wifi", "Laundry", "Parking"],
    "transportOptions": ["Bus route 991"],
    "publish": false
  }'
```

Response `201`:
```json
{
  "listing": {
    "id": "…",
    "advertiserId": "…",
    "title": "Sunny single room, Albany",
    "weeklyRent": 255,
    "bond": 1020,
    "roomType": "Single",
    "availableFrom": "2026-08-12",
    "address": "14 Sunrise Terrace",
    "suburb": "Albany",
    "amenities": ["Wifi", "Laundry", "Parking"],
    "transportOptions": ["Bus route 991"],
    "status": "draft",
    "publishedAt": null,
    "photos": [],
    "createdAt": "…", "updatedAt": "…"
  }
}
```

Set `"publish": true` to skip the draft stage and go straight to
`status: "available"` (matches the "Publish listing" button in the UI).

### Publish a draft / change status — `PATCH /api/listings/:id/status`

```bash
curl -X PATCH http://localhost:4000/api/listings/$LISTING_ID/status \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status": "available"}'
```

Invalid transitions (e.g. `closed → shortlisted`) return `409` with the
allowed next statuses.

### Upload photos — `POST /api/listings/:id/photos`

```bash
curl -X POST http://localhost:4000/api/listings/$LISTING_ID/photos \
  -H "Authorization: Bearer $TOKEN" \
  -F "photos=@room1.jpg" \
  -F "photos=@room2.jpg"
```

Images are stored under `uploads/listings/` and served at
`GET /uploads/listings/<filename>`. JPEG/PNG/WEBP only, 5 MB per file by
default (`MAX_UPLOAD_MB` in `.env`).

### Search/browse — `GET /api/listings`

Query params: `keyword`, `suburb`, `roomType`, `minRent`, `maxRent`,
`status`, `page`, `pageSize`. Drafts are never returned here.

```bash
curl "http://localhost:4000/api/listings?suburb=Albany&maxRent=280&page=1"
```

## 4. Validation & error format

All validation errors return `422`:
```json
{
  "error": "Validation failed.",
  "details": [{ "field": "weeklyRent", "message": "Weekly rent must be a positive number." }]
}
```
Ownership/role failures return `403`; missing resources `404`; bad status
transitions `409`.

## 5. Notes for the project report

- **Security**: passwords are never handled by this module directly, but
  the `User` model only ever stores `passwordHash` (bcrypt) — never plain
  text, satisfying the brief's requirement. JWT auth + role checks enforce
  that students can't publish listings and advertisers can't edit each
  other's listings.
- **Validation**: `express-validator` rejects malformed input before it
  reaches the database (required fields, numeric ranges, enum values,
  date format, string length limits).
- **File uploads**: MIME-type allow-list, per-file size cap, and random
  filenames (prevents path traversal / overwrite attacks).
- **Database design**: see `migrations/schema.sql` for the exact DDL to
  include in the ERD — `users (1) — (many) listings (1) — (many) listing_photos`.
- **Scalability**: indexes on `advertiser_id`, `status`, and `suburb`
  support the search/filter and dashboard queries described in the brief.
