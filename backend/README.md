# FlatMate Finder API

Run `npm install`, copy `.env.example` to `.env`, set PostgreSQL values, then run `npm run dev` (or `npm start`). The API uses PostgreSQL, parameterised queries, bcrypt password hashes, JWT HTTP-only cookies and role middleware.

For a new database, import `../database/schema.sql`, then run `npm run migrate` before starting. Existing databases also need `npm run migrate`: it now includes `community-upgrade.sql` for categories, report evidence/outcomes and notification snapshots. The dump's sample passwords are deliberately not usable bcrypt hashes; create a fresh student/advertiser account through the website. For an admin demo, update a freshly registered account's role in PostgreSQL: `UPDATE users SET role='admin' WHERE email='your@email';` then log out and in again.

Community endpoints: public `GET /api/categories`; administrator `POST /api/categories` and `PATCH /api/categories/:id`; authenticated `POST /api/reports` and `GET /api/reports/mine`. Report evidence is visible through the administrator report endpoint, not the public category or search endpoints. See the root README for exact filter semantics and AI data disclosure.
