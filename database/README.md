# Database setup

The live project uses PostgreSQL on Neon.

- For a new, empty database, run `schema.sql` once.
- For the existing v5 database, run `npm run migrate:v6` from `backend`.
- `upgrade_v6.sql` is non-destructive and only adds the saved-flatmate feature.

Do not commit a real `DATABASE_URL`. Keep it in `backend/.env` locally and in the hosting
platform's environment settings for deployment.
