# Database setup

The live project uses PostgreSQL on Neon.

- For a new, empty database, run `schema.sql` once.
- For the existing database, run `npm run migrate` from `backend`.
- `upgrade.sql` is non-destructive and adds student types, saved flatmates, profile portraits and private flatmate conversations.

Do not commit a real `DATABASE_URL`. Keep it in `backend/.env` locally and in the hosting
platform's environment settings for deployment.
