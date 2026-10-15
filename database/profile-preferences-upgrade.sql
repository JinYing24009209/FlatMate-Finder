BEGIN;
-- Distinguish an omitted date from an explicit Flexible choice without changing legacy intent.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS move_in_flexible BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS preferred_city VARCHAR(120);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS preferred_suburb VARCHAR(120);
COMMIT;
