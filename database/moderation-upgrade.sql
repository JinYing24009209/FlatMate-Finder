BEGIN;
ALTER TABLE report ADD COLUMN IF NOT EXISTS resolution_action VARCHAR(30);
COMMIT;
-- Add moderation snapshots, evidence, and administrator resolution metadata.
