-- Mutual agreement starts false for both existing and new conversations.
BEGIN;
ALTER TABLE flatmate_conversation ADD COLUMN IF NOT EXISTS low_agreed BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE flatmate_conversation ADD COLUMN IF NOT EXISTS high_agreed BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE flatmate_conversation ADD COLUMN IF NOT EXISTS matched_at TIMESTAMPTZ;
ALTER TABLE flatmate_conversation DROP CONSTRAINT IF EXISTS flatmate_mutual_state;
ALTER TABLE flatmate_conversation ADD CONSTRAINT flatmate_mutual_state CHECK ((low_agreed AND high_agreed) = (matched_at IS NOT NULL));
-- Keep successful payment records even if the associated home is removed later.
ALTER TABLE rental_payment ADD COLUMN IF NOT EXISTS listing_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb;
UPDATE rental_payment p SET listing_snapshot=to_jsonb(l)||jsonb_build_object('advertiser_name',u.full_name,
  'photos',COALESCE((SELECT jsonb_agg(photo_url ORDER BY display_order,photo_id) FROM listing_photo WHERE listing_id=l.listing_id),'[]'::jsonb))
  FROM listing l JOIN users u ON u.user_id=l.advertiser_id
  WHERE p.listing_id=l.listing_id AND p.status='succeeded' AND p.listing_snapshot='{}'::jsonb;
ALTER TABLE rental_payment ALTER COLUMN listing_id DROP NOT NULL;
ALTER TABLE rental_payment DROP CONSTRAINT IF EXISTS rental_payment_listing_id_fkey;
ALTER TABLE rental_payment ADD CONSTRAINT rental_payment_listing_id_fkey FOREIGN KEY(listing_id) REFERENCES listing(listing_id) ON DELETE SET NULL;
COMMIT;
