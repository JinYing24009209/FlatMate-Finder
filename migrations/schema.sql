-- FlatMate Finder — actual team schema (as exported from pgAdmin).
-- This file is kept for reference / ERD documentation only.
-- The Sequelize models in src/models/ are written to match this exactly;
-- server.js does NOT run sync() against it — see the comment there.

CREATE TABLE IF NOT EXISTS public.users
(
    user_id serial NOT NULL,
    full_name character varying(100) NOT NULL,
    email character varying(100) NOT NULL,
    password_hash character varying(255) NOT NULL,
    role character varying(20) NOT NULL,
    phone character varying(20),
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    is_active boolean DEFAULT true,
    CONSTRAINT users_pkey PRIMARY KEY (user_id),
    CONSTRAINT users_email_key UNIQUE (email),
    CONSTRAINT users_role_check CHECK (role::text = ANY (ARRAY['student','advertiser','admin']))
);

CREATE TABLE IF NOT EXISTS public.profiles
(
    profile_id serial NOT NULL,
    user_id integer NOT NULL,
    budget_min numeric(10,2),
    budget_max numeric(10,2),
    preferred_location character varying(200),
    lifestyle_tags jsonb,
    study_habits character varying(100),
    contact_preference character varying(50),
    move_in_date date,
    visible_for_matching boolean DEFAULT true,
    CONSTRAINT profiles_pkey PRIMARY KEY (profile_id),
    CONSTRAINT profiles_user_id_key UNIQUE (user_id),
    CONSTRAINT profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users (user_id) ON DELETE CASCADE
);

CREATE TYPE listing_status AS ENUM ('available', 'shortlisted', 'filled', 'closed');

CREATE TABLE IF NOT EXISTS public.listing
(
    listing_id serial NOT NULL,
    advertiser_id integer NOT NULL,
    title character varying(200) NOT NULL,
    description text,
    rent numeric(10,2) NOT NULL,
    bond numeric(10,2) DEFAULT 0,
    address character varying(200) NOT NULL,
    suburb character varying(100),
    city character varying(100) NOT NULL,
    room_type character varying(50) NOT NULL,
    bedrooms integer,
    bathrooms numeric(3,1),
    house_rules text,
    utilities jsonb,
    available_from date NOT NULL,
    status listing_status DEFAULT 'available',
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT listing_pkey PRIMARY KEY (listing_id),
    CONSTRAINT listing_advertiser_id_fkey FOREIGN KEY (advertiser_id) REFERENCES public.users (user_id) ON DELETE CASCADE,
    CONSTRAINT listing_bathrooms_check CHECK (bathrooms > 0::numeric),
    CONSTRAINT listing_bedrooms_check CHECK (bedrooms > 0),
    CONSTRAINT listing_bond_check CHECK (bond >= 0::numeric),
    CONSTRAINT listing_rent_check CHECK (rent > 0::numeric)
);

CREATE TABLE IF NOT EXISTS public.listing_photo
(
    photo_id serial NOT NULL,
    listing_id integer NOT NULL,
    photo_url character varying(500) NOT NULL,
    display_order integer DEFAULT 0,
    CONSTRAINT listing_photo_pkey PRIMARY KEY (photo_id),
    CONSTRAINT listing_photo_listing_id_fkey FOREIGN KEY (listing_id) REFERENCES public.listing (listing_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.amenity
(
    amenity_id serial NOT NULL,
    name character varying(100) NOT NULL,
    CONSTRAINT amenity_pkey PRIMARY KEY (amenity_id),
    CONSTRAINT amenity_name_key UNIQUE (name)
);

CREATE TABLE IF NOT EXISTS public.listing_amenity
(
    listing_id integer NOT NULL,
    amenity_id integer NOT NULL,
    CONSTRAINT listing_amenity_pkey PRIMARY KEY (listing_id, amenity_id),
    CONSTRAINT listing_amenity_amenity_id_fkey FOREIGN KEY (amenity_id) REFERENCES public.amenity (amenity_id) ON DELETE CASCADE,
    CONSTRAINT listing_amenity_listing_id_fkey FOREIGN KEY (listing_id) REFERENCES public.listing (listing_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.transport_option
(
    transport_id serial NOT NULL,
    name character varying(100) NOT NULL,
    CONSTRAINT transport_option_pkey PRIMARY KEY (transport_id),
    CONSTRAINT transport_option_name_key UNIQUE (name)
);

CREATE TABLE IF NOT EXISTS public.listing_transport
(
    listing_id integer NOT NULL,
    transport_id integer NOT NULL,
    CONSTRAINT listing_transport_pkey PRIMARY KEY (listing_id, transport_id),
    CONSTRAINT listing_transport_listing_id_fkey FOREIGN KEY (listing_id) REFERENCES public.listing (listing_id) ON DELETE CASCADE,
    CONSTRAINT listing_transport_transport_id_fkey FOREIGN KEY (transport_id) REFERENCES public.transport_option (transport_id) ON DELETE CASCADE
);
