# FlatMate Finder API

Run `npm install`, copy `.env.example` to `.env`, set PostgreSQL values, then run `npm run dev` (or `npm start`). The API uses PostgreSQL, parameterised queries, bcrypt password hashes, JWT HTTP-only cookies and role middleware.

Import `../database/schema.sql` before starting. The dump's sample passwords are deliberately not usable bcrypt hashes; create a fresh student/advertiser account through the website. For an admin demo, update a freshly registered account's role in PostgreSQL: `UPDATE users SET role='admin' WHERE email='your@email';` then log out and in again.
