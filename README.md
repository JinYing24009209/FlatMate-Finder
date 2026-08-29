# FlatMate Finder — Listing (房源发布) Backend Module

Node.js + Express + PostgreSQL (Sequelize) implementation of the **room/flat
listing** feature, matching the team's actual database schema (13-table
design, integer primary keys, normalized amenity/transport tables).

**This module reads/writes an existing database — it does not create or
alter it.** `server.js` intentionally does not call `sequelize.sync()`;
the tables, the `listing_status` enum, the `update_listing_updated_at`
trigger, and all CHECK constraints are owned by the team's own SQL.

## 1. Schema notes that shape this module's behaviour

- **No "draft" status.** `listing_status` is `available | shortlisted | filled | closed`
  only. A listing is live the moment it's created — there is no separate
  publish step. `POST /api/listings` accepts an optional `status` field
  (defaults to `available`).
- **Integer primary keys**, not UUIDs (`listing_id`, `user_id`, etc., all `serial`).
- **Amenities and transport options are normalized**, not array columns:
  `amenity` / `transport_option` are lookup tables, linked to a listing
  through `listing_amenity` / `listing_transport`. This module sends/receives
  them as plain name strings (e.g. `"amenities": ["Wifi", "Parking"]`) and
  find-or-creates the lookup rows behind the scenes.
- `listing_photo` has no timestamp columns.
- `role` on `users` is a `varchar` with a CHECK constraint, not a Postgres enum.

## 2. Setup

```bash
cp .env.example .env        # fill in your local Postgres credentials
npm install
npm run dev                 # connects to the DB but does NOT create tables —
                             # make sure the team's schema is already applied
```

## 3. Try it without the auth module

```bash
node scripts/seedAdvertiser.js
# → prints the new user's id (an integer, e.g. 4)

node scripts/issueTestToken.js <userId> advertiser
# → prints a JWT to use as: Authorization: Bearer <token>
```

## 4. API Reference

Base path: `/api/listings`.

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/` | none | Browse/search listings (hides `closed` by default) |
| GET | `/:id` | none | Listing detail |
| GET | `/mine/list` | advertiser | The logged-in advertiser's own listings |
| POST | `/` | advertiser | Create a listing (live immediately) |
| PUT | `/:id` | advertiser (owner) | Edit a listing's fields |
| PATCH | `/:id/status` | advertiser (owner) | Change status |
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
    "rent": 255,
    "bond": 1020,
    "roomType": "Single",
    "bedrooms": 1,
    "bathrooms": 1,
    "availableFrom": "2026-08-12",
    "address": "14 Sunrise Terrace",
    "suburb": "Albany",
    "city": "Auckland",
    "description": "Fully furnished single room, 8 min walk from Massey Albany.",
    "houseRules": "No smoking indoors, quiet hours after 10pm",
    "utilities": {"power": true, "water": true, "internet": true},
    "amenities": ["Wifi", "Laundry", "Parking"],
    "transportOptions": ["Bus route 991"]
  }'
```

Response `201`:
```json
{
  "listing": {
    "id": 7,
    "advertiserId": 4,
    "title": "Sunny single room, Albany",
    "rent": 255,
    "bond": 1020,
    "address": "14 Sunrise Terrace",
    "suburb": "Albany",
    "city": "Auckland",
    "roomType": "Single",
    "bedrooms": 1,
    "bathrooms": 1,
    "utilities": {"power": true, "water": true, "internet": true},
    "amenities": ["Wifi", "Laundry", "Parking"],
    "transportOptions": ["Bus route 991"],
    "status": "available",
    "photos": [],
    "createdAt": "…", "updatedAt": "…"
  }
}
```

### Change status — `PATCH /api/listings/:id/status`

```bash
curl -X PATCH http://localhost:4000/api/listings/7/status \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status": "shortlisted"}'
```

Invalid transitions return `409` with the allowed next statuses.

### Upload photos — `POST /api/listings/:id/photos`

```bash
curl -X POST http://localhost:4000/api/listings/7/photos \
  -H "Authorization: Bearer $TOKEN" \
  -F "photos=@room1.jpg" \
  -F "photos=@room2.jpg"
```

### Search/browse — `GET /api/listings`

Query params: `keyword`, `city`, `suburb`, `roomType`, `minRent`, `maxRent`,
`status`, `page`, `pageSize`.

```bash
curl "http://localhost:4000/api/listings?city=Auckland&maxRent=280&page=1"
```

## 5. Validation & error format

`422` for bad input, `403` for ownership/role failures, `404` for missing
resources, `409` for illegal status transitions:
```json
{
  "error": "Validation failed.",
  "details": [{ "field": "rent", "message": "Rent must be a positive number." }]
}
```

## 6. Notes for the project report

- **Security**: `users.password_hash` never stores plain text (bcrypt).
  JWT auth + role checks enforce that only advertisers publish listings,
  and only the owning advertiser can edit/delete their own listing.
- **Validation**: `express-validator` checks required fields, numeric
  ranges, string lengths, and date format before anything reaches the DB.
- **Database design**: see `migrations/schema.sql` for the team's actual
  DDL — `users (1)—(many) listing`, `listing (1)—(many) listing_photo`,
  and `listing (many)—(many) amenity` / `transport_option` via join tables.
- **File uploads**: MIME-type allow-list, per-file size cap, random
  filenames.
- **No auto-migration**: this module never runs `sequelize.sync()` against
  the real database, to avoid touching the team's hand-written enum type,
  trigger, and CHECK constraints.
