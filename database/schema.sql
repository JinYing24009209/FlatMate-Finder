-- FlatMate Finder v6 - reproducible PostgreSQL / Neon schema
-- Safe for a fresh empty database. Existing databases should use upgrade_v6.sql.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'listing_status') THEN
    CREATE TYPE listing_status AS ENUM ('available', 'shortlisted', 'filled', 'closed');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enquiry_status') THEN
    CREATE TYPE enquiry_status AS ENUM ('pending', 'accepted', 'declined');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS users (
  user_id SERIAL PRIMARY KEY,
  full_name VARCHAR(120) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('student', 'advertiser', 'admin')),
  phone VARCHAR(40),
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  is_active BOOLEAN DEFAULT true
);

CREATE TABLE IF NOT EXISTS profiles (
  profile_id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL UNIQUE REFERENCES users(user_id) ON DELETE CASCADE,
  budget_min NUMERIC CHECK (budget_min >= 0),
  budget_max NUMERIC CHECK (budget_max >= 0),
  preferred_location VARCHAR(160),
  lifestyle_tags JSONB DEFAULT '[]'::jsonb,
  study_habits VARCHAR(160),
  contact_preference VARCHAR(80),
  move_in_date DATE,
  visible_for_matching BOOLEAN DEFAULT true,
  advertiser_bio TEXT,
  display_phone BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS listing (
  listing_id SERIAL PRIMARY KEY,
  advertiser_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  title VARCHAR(180) NOT NULL,
  description TEXT,
  rent NUMERIC NOT NULL CHECK (rent > 0),
  bond NUMERIC DEFAULT 0 CHECK (bond >= 0),
  address VARCHAR(255) NOT NULL,
  suburb VARCHAR(120),
  city VARCHAR(120) NOT NULL,
  room_type VARCHAR(80) NOT NULL,
  bedrooms INTEGER NOT NULL DEFAULT 1 CHECK (bedrooms = 1),
  bathrooms NUMERIC DEFAULT 1 CHECK (bathrooms > 0),
  house_rules TEXT,
  utilities JSONB DEFAULT '{}'::jsonb,
  transport_options JSONB NOT NULL DEFAULT '[]'::jsonb,
  available_from DATE NOT NULL,
  status listing_status DEFAULT 'available',
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS listing_photo (
  photo_id SERIAL PRIMARY KEY,
  listing_id INTEGER NOT NULL REFERENCES listing(listing_id) ON DELETE CASCADE,
  photo_url TEXT NOT NULL,
  display_order INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS saved_listing (
  saved_id SERIAL PRIMARY KEY,
  student_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  listing_id INTEGER NOT NULL REFERENCES listing(listing_id) ON DELETE CASCADE,
  saved_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (student_id, listing_id)
);

CREATE TABLE IF NOT EXISTS saved_flatmate (
  saved_flatmate_id SERIAL PRIMARY KEY,
  student_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  saved_user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  saved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT saved_flatmate_unique UNIQUE (student_id, saved_user_id),
  CONSTRAINT saved_flatmate_not_self CHECK (student_id <> saved_user_id)
);

CREATE TABLE IF NOT EXISTS enquiry (
  enquiry_id SERIAL PRIMARY KEY,
  listing_id INTEGER NOT NULL REFERENCES listing(listing_id) ON DELETE CASCADE,
  student_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  status enquiry_status DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS enquiry_message (
  message_id SERIAL PRIMARY KEY,
  enquiry_id INTEGER NOT NULL REFERENCES enquiry(enquiry_id) ON DELETE CASCADE,
  sender_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  body TEXT NOT NULL CHECK (length(trim(body)) > 0),
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  read_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS notification (
  notification_id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  type VARCHAR(80) NOT NULL,
  message VARCHAR(500) NOT NULL,
  related_entity_type VARCHAR(80),
  related_entity_id INTEGER,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS report (
  report_id SERIAL PRIMARY KEY,
  reporter_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  listing_id INTEGER REFERENCES listing(listing_id) ON DELETE CASCADE,
  reported_user_id INTEGER REFERENCES users(user_id) ON DELETE CASCADE,
  reason VARCHAR(160) NOT NULL,
  description TEXT,
  status VARCHAR(30) DEFAULT 'pending'
    CHECK (status IN ('pending', 'reviewed', 'dismissed')),
  reviewed_by INTEGER REFERENCES users(user_id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  reviewed_at TIMESTAMPTZ,
  CONSTRAINT report_has_target CHECK (listing_id IS NOT NULL OR reported_user_id IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS admin_invite (
  invite_id SERIAL PRIMARY KEY,
  code VARCHAR(160) NOT NULL UNIQUE,
  max_uses INTEGER NOT NULL DEFAULT 1 CHECK (max_uses > 0),
  used_count INTEGER NOT NULL DEFAULT 0 CHECK (used_count >= 0),
  is_active BOOLEAN NOT NULL DEFAULT true,
  expires_at TIMESTAMPTZ,
  created_by INTEGER REFERENCES users(user_id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS listing_embedding (
  listing_id INTEGER PRIMARY KEY REFERENCES listing(listing_id) ON DELETE CASCADE,
  embedding JSONB NOT NULL,
  model VARCHAR(120) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS flatmate_match (
  match_id SERIAL PRIMARY KEY,
  user_id_1 INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  user_id_2 INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  compatibility_score NUMERIC CHECK (compatibility_score BETWEEN 0 AND 100),
  generated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  CHECK (user_id_1 <> user_id_2)
);

CREATE TABLE IF NOT EXISTS amenity (
  amenity_id SERIAL PRIMARY KEY,
  name VARCHAR(120) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS listing_amenity (
  listing_id INTEGER NOT NULL REFERENCES listing(listing_id) ON DELETE CASCADE,
  amenity_id INTEGER NOT NULL REFERENCES amenity(amenity_id) ON DELETE CASCADE,
  PRIMARY KEY (listing_id, amenity_id)
);

CREATE TABLE IF NOT EXISTS transport_option (
  transport_id SERIAL PRIMARY KEY,
  name VARCHAR(120) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS listing_transport (
  listing_id INTEGER NOT NULL REFERENCES listing(listing_id) ON DELETE CASCADE,
  transport_id INTEGER NOT NULL REFERENCES transport_option(transport_id) ON DELETE CASCADE,
  PRIMARY KEY (listing_id, transport_id)
);

CREATE INDEX IF NOT EXISTS listing_status_city_rent_idx
  ON listing(status, city, rent);
CREATE INDEX IF NOT EXISTS listing_owner_idx
  ON listing(advertiser_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS saved_listing_student_idx
  ON saved_listing(student_id, saved_at DESC);
CREATE INDEX IF NOT EXISTS saved_flatmate_student_idx
  ON saved_flatmate(student_id, saved_at DESC);
CREATE INDEX IF NOT EXISTS enquiry_student_idx
  ON enquiry(student_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS notification_user_idx
  ON notification(user_id, is_read, created_at DESC);
