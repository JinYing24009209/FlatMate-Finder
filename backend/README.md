# FlatMate Finder API

Run `npm install`, copy `.env.example` to `.env`, set PostgreSQL values, then run `npm run dev` (or `npm start`). The API uses PostgreSQL, parameterised queries, bcrypt password hashes, JWT HTTP-only cookies and role middleware.

For a new database, import `../database/schema.sql`, then run `npm run migrate` before starting. Existing databases also need `npm run migrate`: it now includes `community-upgrade.sql` for categories, report evidence/outcomes and notification snapshots. The dump's sample passwords are deliberately not usable bcrypt hashes; create a fresh student/advertiser account through the website. For an admin demo, update a freshly registered account's role in PostgreSQL: `UPDATE users SET role='admin' WHERE email='your@email';` then log out and in again.

Community endpoints: authenticated `POST /api/reports` and `GET /api/reports/mine`; administrator-only `GET /api/admin/users/:id` and `GET /api/admin/listings/:id` for report-target details. Category-management endpoints have been removed: transport and facilities are free text. Report evidence is visible through the administrator report endpoint, not public search. See the root README for exact filter semantics and AI data disclosure.
