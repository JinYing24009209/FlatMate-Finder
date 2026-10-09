-- Additive community features. Run after schema.sql / upgrade.sql; safe to rerun.
BEGIN;
CREATE TABLE IF NOT EXISTS app_migration (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE IF NOT EXISTS listing_category (
  category_id SERIAL PRIMARY KEY,
  kind VARCHAR(20) NOT NULL CHECK (kind IN ('transport','utility')),
  name VARCHAR(160) NOT NULL CHECK (length(trim(name)) > 0),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS listing_category_name_idx ON listing_category(kind, lower(name));
CREATE TABLE IF NOT EXISTS listing_category_link (
  listing_id INTEGER REFERENCES listing(listing_id) ON DELETE CASCADE,
  category_id INTEGER REFERENCES listing_category(category_id),
  PRIMARY KEY (listing_id, category_id)
);
CREATE INDEX IF NOT EXISTS listing_category_link_category_idx ON listing_category_link(category_id, listing_id);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM app_migration WHERE name='community-categories-v1') THEN
    INSERT INTO listing_category(kind,name) VALUES
      ('transport','Bus'),('transport','Train'),('transport','Cycle lane'),('transport','Walking distance'),
      ('utility','Power'),('utility','Water'),('utility','Internet'),('utility','Laundry') ON CONFLICT DO NOTHING;
    INSERT INTO listing_category(kind,name)
      SELECT DISTINCT 'transport', trim(value) FROM listing,
        jsonb_array_elements_text(transport_options) WHERE length(trim(value)) BETWEEN 1 AND 160
      ON CONFLICT DO NOTHING;
    INSERT INTO listing_category(kind,name)
      SELECT DISTINCT 'utility', trim(key) FROM listing, jsonb_each(utilities)
        WHERE value='true'::jsonb AND length(trim(key)) BETWEEN 1 AND 160 ON CONFLICT DO NOTHING;
    INSERT INTO listing_category_link(listing_id,category_id)
      SELECT l.listing_id,c.category_id FROM listing l CROSS JOIN listing_category c
      WHERE (c.kind='transport' AND EXISTS(SELECT 1 FROM jsonb_array_elements_text(l.transport_options) t
        WHERE lower(trim(t))=lower(c.name)))
        OR (c.kind='utility' AND EXISTS(SELECT 1 FROM jsonb_each(l.utilities) u
          WHERE u.value='true'::jsonb AND lower(trim(u.key))=lower(c.name))) ON CONFLICT DO NOTHING;
    INSERT INTO app_migration(name) VALUES('community-categories-v1');
  END IF;
END $$;
ALTER TABLE notification ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE report ADD COLUMN IF NOT EXISTS target_type VARCHAR(30) NOT NULL DEFAULT 'listing';
ALTER TABLE report ADD COLUMN IF NOT EXISTS target_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE report ADD COLUMN IF NOT EXISTS evidence JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE report ADD COLUMN IF NOT EXISTS resolution_note VARCHAR(1000);
UPDATE report r SET target_snapshot=jsonb_build_object('listing_id',l.listing_id,'title',l.title)
  FROM listing l WHERE r.listing_id=l.listing_id AND r.target_snapshot='{}'::jsonb;
UPDATE report r SET target_type='user',target_snapshot=jsonb_build_object('user_id',u.user_id,'name',u.full_name)
  FROM users u WHERE r.listing_id IS NULL AND r.reported_user_id=u.user_id AND r.target_snapshot='{}'::jsonb;
ALTER TABLE report DROP CONSTRAINT IF EXISTS report_listing_id_fkey;
ALTER TABLE report ADD CONSTRAINT report_listing_id_fkey FOREIGN KEY(listing_id) REFERENCES listing(listing_id) ON DELETE SET NULL;
ALTER TABLE report DROP CONSTRAINT IF EXISTS report_reported_user_id_fkey;
ALTER TABLE report ADD CONSTRAINT report_reported_user_id_fkey FOREIGN KEY(reported_user_id) REFERENCES users(user_id) ON DELETE SET NULL;
ALTER TABLE report DROP CONSTRAINT IF EXISTS report_has_target;
ALTER TABLE report ADD CONSTRAINT report_has_target CHECK (listing_id IS NOT NULL OR reported_user_id IS NOT NULL OR target_snapshot <> '{}'::jsonb);
COMMIT;
