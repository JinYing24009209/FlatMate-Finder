# Database setup

The live project uses PostgreSQL on Neon.

- For a new, empty database, run `schema.sql` once, then run `npm run migrate` from `backend`.
- For the existing database, run `npm run migrate` from `backend`.
- `upgrade.sql` is non-destructive and adds student types, saved flatmates, profile portraits,
  private flatmate conversations and coursework demo payment records.

Do not commit a real `DATABASE_URL`. Keep it in `backend/.env` locally and in the hosting
platform's environment settings for deployment.
# Community upgrade

After the existing schema is installed, run `npm run migrate` in `backend` before starting this version. It applies `upgrade.sql` followed by `community-upgrade.sql`. The latter adds managed category IDs and links, backfills existing transport/utilities once, and adds report evidence/outcomes and deletion-safe notification snapshots. It is additive and rerunnable; back up shared databases first. Do not rerun a destructive reset script to install this feature.

The same command then applies `outcomes-upgrade.sql`. It adds separate consent flags (both initially false) and a mutual-match timestamp to flatmate conversations. It also preserves successful demo-payment listing snapshots and changes their listing foreign key to `ON DELETE SET NULL`, so deleting a listing does not delete a payment record. Existing successful payments are backfilled only where the original listing still exists. Already deleted historical records cannot be recovered by this migration. The migration is rerunnable and does not reset existing agreements.

Finally, `moderation-upgrade.sql` adds the nullable `report.resolution_action` field. New upheld decisions record `close_listing` or `deactivate_user`; old reviews remain NULL and are not retrospectively counted as successful moderation actions.

