-- FlatMate Finder — Listing module schema (PostgreSQL)
-- Run this manually if you are not using Sequelize's sync().
-- This mirrors src/models exactly, for the project's ERD documentation.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TYPE user_role AS ENUM ('student', 'advertiser', 'admin');
CREATE TYPE room_type AS ENUM ('Single', 'Double', 'Studio');
CREATE TYPE listing_status AS ENUM ('draft', 'available', 'shortlisted', 'filled', 'closed');

CREATE TABLE users (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  full_name      VARCHAR(120) NOT NULL,
  email          VARCHAR(160) NOT NULL UNIQUE,
  password_hash  VARCHAR NOT NULL,
  role           user_role NOT NULL DEFAULT 'student',
  phone          VARCHAR(30),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE listings (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  advertiser_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  title              VARCHAR(150) NOT NULL,
  weekly_rent        NUMERIC(8,2) NOT NULL CHECK (weekly_rent >= 0),
  bond               NUMERIC(8,2) CHECK (bond >= 0),
  room_type          room_type NOT NULL,
  available_from     DATE NOT NULL,

  address            VARCHAR(200) NOT NULL,
  suburb             VARCHAR(100) NOT NULL,
  latitude           NUMERIC(9,6),
  longitude          NUMERIC(9,6),

  description        TEXT,
  house_rules        TEXT,
  amenities          TEXT[] NOT NULL DEFAULT '{}',
  transport_options  TEXT[] NOT NULL DEFAULT '{}',

  status             listing_status NOT NULL DEFAULT 'draft',
  published_at       TIMESTAMPTZ,

  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_listings_advertiser_id ON listings(advertiser_id);
CREATE INDEX idx_listings_status        ON listings(status);
CREATE INDEX idx_listings_suburb        ON listings(suburb);

CREATE TABLE listing_photos (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  listing_id   UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  url          VARCHAR(500) NOT NULL,
  sort_order   INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_listing_photos_listing_id ON listing_photos(listing_id);
