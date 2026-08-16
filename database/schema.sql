--
-- PostgreSQL database dump
--

\restrict AKKAZzXD3sKWVwBUch9M81pk7qiKCRuVXY9Nyt41tNI5clwYG26zioLHvDovMbU

-- Dumped from database version 18.6
-- Dumped by pg_dump version 18.6

-- Started on 2026-08-16 21:50:44

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- TOC entry 879 (class 1247 OID 24626)
-- Name: enquiry_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.enquiry_status AS ENUM (
    'pending',
    'accepted',
    'declined',
    'cancelled'
);


ALTER TYPE public.enquiry_status OWNER TO postgres;

--
-- TOC entry 876 (class 1247 OID 24616)
-- Name: listing_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.listing_status AS ENUM (
    'available',
    'shortlisted',
    'filled',
    'closed'
);


ALTER TYPE public.listing_status OWNER TO postgres;

--
-- TOC entry 243 (class 1255 OID 24920)
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_updated_at_column() OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- TOC entry 224 (class 1259 OID 24676)
-- Name: amenity; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.amenity (
    amenity_id integer NOT NULL,
    name character varying(100) NOT NULL
);


ALTER TABLE public.amenity OWNER TO postgres;

--
-- TOC entry 223 (class 1259 OID 24675)
-- Name: amenity_amenity_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.amenity_amenity_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.amenity_amenity_id_seq OWNER TO postgres;

--
-- TOC entry 5205 (class 0 OID 0)
-- Dependencies: 223
-- Name: amenity_amenity_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.amenity_amenity_id_seq OWNED BY public.amenity.amenity_id;


--
-- TOC entry 234 (class 1259 OID 24780)
-- Name: enquiry; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.enquiry (
    enquiry_id integer NOT NULL,
    listing_id integer NOT NULL,
    student_id integer NOT NULL,
    message text NOT NULL,
    status public.enquiry_status DEFAULT 'pending'::public.enquiry_status,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.enquiry OWNER TO postgres;

--
-- TOC entry 233 (class 1259 OID 24779)
-- Name: enquiry_enquiry_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.enquiry_enquiry_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.enquiry_enquiry_id_seq OWNER TO postgres;

--
-- TOC entry 5206 (class 0 OID 0)
-- Dependencies: 233
-- Name: enquiry_enquiry_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.enquiry_enquiry_id_seq OWNED BY public.enquiry.enquiry_id;


--
-- TOC entry 242 (class 1259 OID 24885)
-- Name: flatmate_match; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.flatmate_match (
    match_id integer NOT NULL,
    user_id_1 integer NOT NULL,
    user_id_2 integer NOT NULL,
    compatibility_score numeric(5,2),
    generated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_different_users CHECK ((user_id_1 <> user_id_2)),
    CONSTRAINT flatmate_match_compatibility_score_check CHECK (((compatibility_score >= (0)::numeric) AND (compatibility_score <= (100)::numeric)))
);


ALTER TABLE public.flatmate_match OWNER TO postgres;

--
-- TOC entry 241 (class 1259 OID 24884)
-- Name: flatmate_match_match_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.flatmate_match_match_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.flatmate_match_match_id_seq OWNER TO postgres;

--
-- TOC entry 5207 (class 0 OID 0)
-- Dependencies: 241
-- Name: flatmate_match_match_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.flatmate_match_match_id_seq OWNED BY public.flatmate_match.match_id;


--
-- TOC entry 228 (class 1259 OID 24698)
-- Name: listing; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.listing (
    listing_id integer NOT NULL,
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
    status public.listing_status DEFAULT 'available'::public.listing_status,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT listing_bathrooms_check CHECK ((bathrooms > (0)::numeric)),
    CONSTRAINT listing_bedrooms_check CHECK ((bedrooms > 0)),
    CONSTRAINT listing_bond_check CHECK ((bond >= (0)::numeric)),
    CONSTRAINT listing_rent_check CHECK ((rent > (0)::numeric))
);


ALTER TABLE public.listing OWNER TO postgres;

--
-- TOC entry 231 (class 1259 OID 24745)
-- Name: listing_amenity; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.listing_amenity (
    listing_id integer NOT NULL,
    amenity_id integer NOT NULL
);


ALTER TABLE public.listing_amenity OWNER TO postgres;

--
-- TOC entry 227 (class 1259 OID 24697)
-- Name: listing_listing_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.listing_listing_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.listing_listing_id_seq OWNER TO postgres;

--
-- TOC entry 5208 (class 0 OID 0)
-- Dependencies: 227
-- Name: listing_listing_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.listing_listing_id_seq OWNED BY public.listing.listing_id;


--
-- TOC entry 230 (class 1259 OID 24728)
-- Name: listing_photo; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.listing_photo (
    photo_id integer NOT NULL,
    listing_id integer NOT NULL,
    photo_url character varying(500) NOT NULL,
    display_order integer DEFAULT 0
);


ALTER TABLE public.listing_photo OWNER TO postgres;

--
-- TOC entry 229 (class 1259 OID 24727)
-- Name: listing_photo_photo_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.listing_photo_photo_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.listing_photo_photo_id_seq OWNER TO postgres;

--
-- TOC entry 5209 (class 0 OID 0)
-- Dependencies: 229
-- Name: listing_photo_photo_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.listing_photo_photo_id_seq OWNED BY public.listing_photo.photo_id;


--
-- TOC entry 232 (class 1259 OID 24762)
-- Name: listing_transport; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.listing_transport (
    listing_id integer NOT NULL,
    transport_id integer NOT NULL
);


ALTER TABLE public.listing_transport OWNER TO postgres;

--
-- TOC entry 238 (class 1259 OID 24829)
-- Name: notification; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.notification (
    notification_id integer NOT NULL,
    user_id integer NOT NULL,
    type character varying(50) NOT NULL,
    message character varying(500) NOT NULL,
    related_entity_type character varying(50),
    related_entity_id integer,
    is_read boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.notification OWNER TO postgres;

--
-- TOC entry 237 (class 1259 OID 24828)
-- Name: notification_notification_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.notification_notification_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.notification_notification_id_seq OWNER TO postgres;

--
-- TOC entry 5210 (class 0 OID 0)
-- Dependencies: 237
-- Name: notification_notification_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.notification_notification_id_seq OWNED BY public.notification.notification_id;


--
-- TOC entry 222 (class 1259 OID 24655)
-- Name: profiles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.profiles (
    profile_id integer NOT NULL,
    user_id integer NOT NULL,
    budget_min numeric(10,2),
    budget_max numeric(10,2),
    preferred_location character varying(200),
    lifestyle_tags jsonb,
    study_habits character varying(100),
    contact_preference character varying(50),
    move_in_date date,
    visible_for_matching boolean DEFAULT true,
    CONSTRAINT profiles_budget_max_check CHECK ((budget_max >= (0)::numeric)),
    CONSTRAINT profiles_budget_min_check CHECK ((budget_min >= (0)::numeric))
);


ALTER TABLE public.profiles OWNER TO postgres;

--
-- TOC entry 221 (class 1259 OID 24654)
-- Name: profiles_profile_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.profiles_profile_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.profiles_profile_id_seq OWNER TO postgres;

--
-- TOC entry 5211 (class 0 OID 0)
-- Dependencies: 221
-- Name: profiles_profile_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.profiles_profile_id_seq OWNED BY public.profiles.profile_id;


--
-- TOC entry 240 (class 1259 OID 24849)
-- Name: report; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.report (
    report_id integer NOT NULL,
    reporter_id integer NOT NULL,
    listing_id integer,
    reported_user_id integer,
    reason character varying(100) NOT NULL,
    description text,
    status character varying(20) DEFAULT 'pending'::character varying,
    reviewed_by integer,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    reviewed_at timestamp with time zone,
    CONSTRAINT chk_report_target CHECK (((listing_id IS NOT NULL) OR (reported_user_id IS NOT NULL))),
    CONSTRAINT report_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'reviewed'::character varying, 'dismissed'::character varying])::text[])))
);


ALTER TABLE public.report OWNER TO postgres;

--
-- TOC entry 239 (class 1259 OID 24848)
-- Name: report_report_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.report_report_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.report_report_id_seq OWNER TO postgres;

--
-- TOC entry 5212 (class 0 OID 0)
-- Dependencies: 239
-- Name: report_report_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.report_report_id_seq OWNED BY public.report.report_id;


--
-- TOC entry 236 (class 1259 OID 24806)
-- Name: saved_listing; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.saved_listing (
    saved_id integer NOT NULL,
    student_id integer NOT NULL,
    listing_id integer NOT NULL,
    saved_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.saved_listing OWNER TO postgres;

--
-- TOC entry 235 (class 1259 OID 24805)
-- Name: saved_listing_saved_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.saved_listing_saved_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.saved_listing_saved_id_seq OWNER TO postgres;

--
-- TOC entry 5213 (class 0 OID 0)
-- Dependencies: 235
-- Name: saved_listing_saved_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.saved_listing_saved_id_seq OWNED BY public.saved_listing.saved_id;


--
-- TOC entry 226 (class 1259 OID 24687)
-- Name: transport_option; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.transport_option (
    transport_id integer NOT NULL,
    name character varying(100) NOT NULL
);


ALTER TABLE public.transport_option OWNER TO postgres;

--
-- TOC entry 225 (class 1259 OID 24686)
-- Name: transport_option_transport_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.transport_option_transport_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.transport_option_transport_id_seq OWNER TO postgres;

--
-- TOC entry 5214 (class 0 OID 0)
-- Dependencies: 225
-- Name: transport_option_transport_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.transport_option_transport_id_seq OWNED BY public.transport_option.transport_id;


--
-- TOC entry 220 (class 1259 OID 24636)
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    user_id integer NOT NULL,
    full_name character varying(100) NOT NULL,
    email character varying(100) NOT NULL,
    password_hash character varying(255) NOT NULL,
    role character varying(20) NOT NULL,
    phone character varying(20),
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    is_active boolean DEFAULT true,
    CONSTRAINT users_role_check CHECK (((role)::text = ANY ((ARRAY['student'::character varying, 'advertiser'::character varying, 'admin'::character varying])::text[])))
);


ALTER TABLE public.users OWNER TO postgres;

--
-- TOC entry 219 (class 1259 OID 24635)
-- Name: users_user_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.users_user_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.users_user_id_seq OWNER TO postgres;

--
-- TOC entry 5215 (class 0 OID 0)
-- Dependencies: 219
-- Name: users_user_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.users_user_id_seq OWNED BY public.users.user_id;


--
-- TOC entry 4926 (class 2604 OID 24679)
-- Name: amenity amenity_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.amenity ALTER COLUMN amenity_id SET DEFAULT nextval('public.amenity_amenity_id_seq'::regclass);


--
-- TOC entry 4935 (class 2604 OID 24783)
-- Name: enquiry enquiry_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.enquiry ALTER COLUMN enquiry_id SET DEFAULT nextval('public.enquiry_enquiry_id_seq'::regclass);


--
-- TOC entry 4947 (class 2604 OID 24888)
-- Name: flatmate_match match_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.flatmate_match ALTER COLUMN match_id SET DEFAULT nextval('public.flatmate_match_match_id_seq'::regclass);


--
-- TOC entry 4928 (class 2604 OID 24701)
-- Name: listing listing_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.listing ALTER COLUMN listing_id SET DEFAULT nextval('public.listing_listing_id_seq'::regclass);


--
-- TOC entry 4933 (class 2604 OID 24731)
-- Name: listing_photo photo_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.listing_photo ALTER COLUMN photo_id SET DEFAULT nextval('public.listing_photo_photo_id_seq'::regclass);


--
-- TOC entry 4941 (class 2604 OID 24832)
-- Name: notification notification_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notification ALTER COLUMN notification_id SET DEFAULT nextval('public.notification_notification_id_seq'::regclass);


--
-- TOC entry 4924 (class 2604 OID 24658)
-- Name: profiles profile_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.profiles ALTER COLUMN profile_id SET DEFAULT nextval('public.profiles_profile_id_seq'::regclass);


--
-- TOC entry 4944 (class 2604 OID 24852)
-- Name: report report_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.report ALTER COLUMN report_id SET DEFAULT nextval('public.report_report_id_seq'::regclass);


--
-- TOC entry 4939 (class 2604 OID 24809)
-- Name: saved_listing saved_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.saved_listing ALTER COLUMN saved_id SET DEFAULT nextval('public.saved_listing_saved_id_seq'::regclass);


--
-- TOC entry 4927 (class 2604 OID 24690)
-- Name: transport_option transport_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.transport_option ALTER COLUMN transport_id SET DEFAULT nextval('public.transport_option_transport_id_seq'::regclass);


--
-- TOC entry 4921 (class 2604 OID 24639)
-- Name: users user_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users ALTER COLUMN user_id SET DEFAULT nextval('public.users_user_id_seq'::regclass);


--
-- TOC entry 5181 (class 0 OID 24676)
-- Dependencies: 224
-- Data for Name: amenity; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.amenity (amenity_id, name) FROM stdin;
1	Washing Machine
2	Air Conditioning
3	Heater
4	Wi-Fi
5	Parking
\.


--
-- TOC entry 5191 (class 0 OID 24780)
-- Dependencies: 234
-- Data for Name: enquiry; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.enquiry (enquiry_id, listing_id, student_id, message, status, created_at, updated_at) FROM stdin;
1	1	1	Hi Carol, I am very interested. Can I view it tomorrow?	pending	2026-08-16 18:59:36.77981+12	2026-08-16 18:59:36.77981+12
\.


--
-- TOC entry 5199 (class 0 OID 24885)
-- Dependencies: 242
-- Data for Name: flatmate_match; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.flatmate_match (match_id, user_id_1, user_id_2, compatibility_score, generated_at) FROM stdin;
\.


--
-- TOC entry 5185 (class 0 OID 24698)
-- Dependencies: 228
-- Data for Name: listing; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.listing (listing_id, advertiser_id, title, description, rent, bond, address, suburb, city, room_type, bedrooms, bathrooms, house_rules, utilities, available_from, status, created_at, updated_at) FROM stdin;
1	3	Cozy Room Near Uni	Sunny room with desk, close to library	220.00	440.00	123 Uni Street	North Shore	Auckland	Single	3	1.0	No smoking, no parties	{"water": true, "electric": true, "internet": true}	2026-09-01	available	2026-08-16 18:59:36.77981+12	2026-08-16 18:59:36.77981+12
2	3	Modern Studio Downtown	Self-contained studio, gym access	350.00	700.00	45 Queen Street	CBD	Auckland	Studio	1	1.0	Quiet hours after 10pm	{"water": false, "electric": true, "internet": true}	2026-08-15	available	2026-08-16 18:59:36.77981+12	2026-08-16 18:59:36.77981+12
\.


--
-- TOC entry 5188 (class 0 OID 24745)
-- Dependencies: 231
-- Data for Name: listing_amenity; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.listing_amenity (listing_id, amenity_id) FROM stdin;
1	1
1	2
2	3
2	5
\.


--
-- TOC entry 5187 (class 0 OID 24728)
-- Dependencies: 230
-- Data for Name: listing_photo; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.listing_photo (photo_id, listing_id, photo_url, display_order) FROM stdin;
\.


--
-- TOC entry 5189 (class 0 OID 24762)
-- Dependencies: 232
-- Data for Name: listing_transport; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.listing_transport (listing_id, transport_id) FROM stdin;
1	1
2	2
\.


--
-- TOC entry 5195 (class 0 OID 24829)
-- Dependencies: 238
-- Data for Name: notification; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.notification (notification_id, user_id, type, message, related_entity_type, related_entity_id, is_read, created_at) FROM stdin;
\.


--
-- TOC entry 5179 (class 0 OID 24655)
-- Dependencies: 222
-- Data for Name: profiles; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.profiles (profile_id, user_id, budget_min, budget_max, preferred_location, lifestyle_tags, study_habits, contact_preference, move_in_date, visible_for_matching) FROM stdin;
1	1	150.00	250.00	North Shore	["quiet", "non-smoker", "early_bird"]	Morning study	Email	2026-09-01	t
2	2	180.00	300.00	City Center	["social", "pet-friendly"]	Night owl	Phone	2026-08-20	t
\.


--
-- TOC entry 5197 (class 0 OID 24849)
-- Dependencies: 240
-- Data for Name: report; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.report (report_id, reporter_id, listing_id, reported_user_id, reason, description, status, reviewed_by, created_at, reviewed_at) FROM stdin;
\.


--
-- TOC entry 5193 (class 0 OID 24806)
-- Dependencies: 236
-- Data for Name: saved_listing; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.saved_listing (saved_id, student_id, listing_id, saved_at) FROM stdin;
1	1	2	2026-08-16 18:59:36.77981+12
\.


--
-- TOC entry 5183 (class 0 OID 24687)
-- Dependencies: 226
-- Data for Name: transport_option; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.transport_option (transport_id, name) FROM stdin;
1	Bus Stop (5 min walk)
2	Train Station (10 min walk)
3	University Shuttle
\.


--
-- TOC entry 5177 (class 0 OID 24636)
-- Dependencies: 220
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.users (user_id, full_name, email, password_hash, role, phone, created_at, is_active) FROM stdin;
1	Alice Student	alice@student.com	hashed_123	student	0211111111	2026-08-16 18:59:36.77981+12	t
2	Bob Student	bob@student.com	hashed_456	student	0212222222	2026-08-16 18:59:36.77981+12	t
3	Carol Advertiser	carol@landlord.com	hashed_789	advertiser	0213333333	2026-08-16 18:59:36.77981+12	t
4	Admin User	admin@flatmate.com	hashed_admin	admin	0219999999	2026-08-16 18:59:36.77981+12	t
\.


--
-- TOC entry 5216 (class 0 OID 0)
-- Dependencies: 223
-- Name: amenity_amenity_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.amenity_amenity_id_seq', 5, true);


--
-- TOC entry 5217 (class 0 OID 0)
-- Dependencies: 233
-- Name: enquiry_enquiry_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.enquiry_enquiry_id_seq', 1, true);


--
-- TOC entry 5218 (class 0 OID 0)
-- Dependencies: 241
-- Name: flatmate_match_match_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.flatmate_match_match_id_seq', 1, false);


--
-- TOC entry 5219 (class 0 OID 0)
-- Dependencies: 227
-- Name: listing_listing_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.listing_listing_id_seq', 2, true);


--
-- TOC entry 5220 (class 0 OID 0)
-- Dependencies: 229
-- Name: listing_photo_photo_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.listing_photo_photo_id_seq', 1, false);


--
-- TOC entry 5221 (class 0 OID 0)
-- Dependencies: 237
-- Name: notification_notification_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.notification_notification_id_seq', 1, false);


--
-- TOC entry 5222 (class 0 OID 0)
-- Dependencies: 221
-- Name: profiles_profile_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.profiles_profile_id_seq', 2, true);


--
-- TOC entry 5223 (class 0 OID 0)
-- Dependencies: 239
-- Name: report_report_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.report_report_id_seq', 1, false);


--
-- TOC entry 5224 (class 0 OID 0)
-- Dependencies: 235
-- Name: saved_listing_saved_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.saved_listing_saved_id_seq', 1, true);


--
-- TOC entry 5225 (class 0 OID 0)
-- Dependencies: 225
-- Name: transport_option_transport_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.transport_option_transport_id_seq', 3, true);


--
-- TOC entry 5226 (class 0 OID 0)
-- Dependencies: 219
-- Name: users_user_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.users_user_id_seq', 4, true);


--
-- TOC entry 4970 (class 2606 OID 24685)
-- Name: amenity amenity_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.amenity
    ADD CONSTRAINT amenity_name_key UNIQUE (name);


--
-- TOC entry 4972 (class 2606 OID 24683)
-- Name: amenity amenity_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.amenity
    ADD CONSTRAINT amenity_pkey PRIMARY KEY (amenity_id);


--
-- TOC entry 4990 (class 2606 OID 24794)
-- Name: enquiry enquiry_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.enquiry
    ADD CONSTRAINT enquiry_pkey PRIMARY KEY (enquiry_id);


--
-- TOC entry 5008 (class 2606 OID 24896)
-- Name: flatmate_match flatmate_match_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.flatmate_match
    ADD CONSTRAINT flatmate_match_pkey PRIMARY KEY (match_id);


--
-- TOC entry 4986 (class 2606 OID 24751)
-- Name: listing_amenity listing_amenity_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.listing_amenity
    ADD CONSTRAINT listing_amenity_pkey PRIMARY KEY (listing_id, amenity_id);


--
-- TOC entry 4984 (class 2606 OID 24739)
-- Name: listing_photo listing_photo_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.listing_photo
    ADD CONSTRAINT listing_photo_pkey PRIMARY KEY (photo_id);


--
-- TOC entry 4982 (class 2606 OID 24721)
-- Name: listing listing_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.listing
    ADD CONSTRAINT listing_pkey PRIMARY KEY (listing_id);


--
-- TOC entry 4988 (class 2606 OID 24768)
-- Name: listing_transport listing_transport_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.listing_transport
    ADD CONSTRAINT listing_transport_pkey PRIMARY KEY (listing_id, transport_id);


--
-- TOC entry 5001 (class 2606 OID 24842)
-- Name: notification notification_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notification
    ADD CONSTRAINT notification_pkey PRIMARY KEY (notification_id);


--
-- TOC entry 4966 (class 2606 OID 24667)
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (profile_id);


--
-- TOC entry 4968 (class 2606 OID 24669)
-- Name: profiles profiles_user_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_user_id_key UNIQUE (user_id);


--
-- TOC entry 5006 (class 2606 OID 24863)
-- Name: report report_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.report
    ADD CONSTRAINT report_pkey PRIMARY KEY (report_id);


--
-- TOC entry 4996 (class 2606 OID 24815)
-- Name: saved_listing saved_listing_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.saved_listing
    ADD CONSTRAINT saved_listing_pkey PRIMARY KEY (saved_id);


--
-- TOC entry 4998 (class 2606 OID 24817)
-- Name: saved_listing saved_listing_student_id_listing_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.saved_listing
    ADD CONSTRAINT saved_listing_student_id_listing_id_key UNIQUE (student_id, listing_id);


--
-- TOC entry 4974 (class 2606 OID 24696)
-- Name: transport_option transport_option_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.transport_option
    ADD CONSTRAINT transport_option_name_key UNIQUE (name);


--
-- TOC entry 4976 (class 2606 OID 24694)
-- Name: transport_option transport_option_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.transport_option
    ADD CONSTRAINT transport_option_pkey PRIMARY KEY (transport_id);


--
-- TOC entry 4961 (class 2606 OID 24653)
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- TOC entry 4963 (class 2606 OID 24651)
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (user_id);


--
-- TOC entry 4991 (class 1259 OID 24910)
-- Name: idx_enquiry_listing_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_enquiry_listing_id ON public.enquiry USING btree (listing_id);


--
-- TOC entry 4992 (class 1259 OID 24911)
-- Name: idx_enquiry_student_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_enquiry_student_id ON public.enquiry USING btree (student_id);


--
-- TOC entry 4977 (class 1259 OID 24909)
-- Name: idx_listing_available_from; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_listing_available_from ON public.listing USING btree (available_from);


--
-- TOC entry 4978 (class 1259 OID 24907)
-- Name: idx_listing_city_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_listing_city_status ON public.listing USING btree (city, status);


--
-- TOC entry 4979 (class 1259 OID 24908)
-- Name: idx_listing_rent; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_listing_rent ON public.listing USING btree (rent);


--
-- TOC entry 4980 (class 1259 OID 24919)
-- Name: idx_listing_utilities; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_listing_utilities ON public.listing USING gin (utilities);


--
-- TOC entry 4999 (class 1259 OID 24914)
-- Name: idx_notification_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_notification_user_id ON public.notification USING btree (user_id);


--
-- TOC entry 4964 (class 1259 OID 24918)
-- Name: idx_profiles_lifestyle_tags; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_profiles_lifestyle_tags ON public.profiles USING gin (lifestyle_tags);


--
-- TOC entry 5002 (class 1259 OID 24916)
-- Name: idx_report_listing_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_report_listing_id ON public.report USING btree (listing_id);


--
-- TOC entry 5003 (class 1259 OID 24915)
-- Name: idx_report_reporter_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_report_reporter_id ON public.report USING btree (reporter_id);


--
-- TOC entry 5004 (class 1259 OID 24917)
-- Name: idx_report_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_report_status ON public.report USING btree (status);


--
-- TOC entry 4993 (class 1259 OID 24913)
-- Name: idx_saved_listing_listing_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_saved_listing_listing_id ON public.saved_listing USING btree (listing_id);


--
-- TOC entry 4994 (class 1259 OID 24912)
-- Name: idx_saved_listing_student_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_saved_listing_student_id ON public.saved_listing USING btree (student_id);


--
-- TOC entry 5028 (class 2620 OID 24922)
-- Name: enquiry update_enquiry_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_enquiry_updated_at BEFORE UPDATE ON public.enquiry FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 5027 (class 2620 OID 24921)
-- Name: listing update_listing_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_listing_updated_at BEFORE UPDATE ON public.listing FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 5016 (class 2606 OID 24795)
-- Name: enquiry enquiry_listing_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.enquiry
    ADD CONSTRAINT enquiry_listing_id_fkey FOREIGN KEY (listing_id) REFERENCES public.listing(listing_id) ON DELETE CASCADE;


--
-- TOC entry 5017 (class 2606 OID 24800)
-- Name: enquiry enquiry_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.enquiry
    ADD CONSTRAINT enquiry_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.users(user_id) ON DELETE CASCADE;


--
-- TOC entry 5025 (class 2606 OID 24897)
-- Name: flatmate_match flatmate_match_user_id_1_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.flatmate_match
    ADD CONSTRAINT flatmate_match_user_id_1_fkey FOREIGN KEY (user_id_1) REFERENCES public.users(user_id) ON DELETE CASCADE;


--
-- TOC entry 5026 (class 2606 OID 24902)
-- Name: flatmate_match flatmate_match_user_id_2_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.flatmate_match
    ADD CONSTRAINT flatmate_match_user_id_2_fkey FOREIGN KEY (user_id_2) REFERENCES public.users(user_id) ON DELETE CASCADE;


--
-- TOC entry 5010 (class 2606 OID 24722)
-- Name: listing listing_advertiser_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.listing
    ADD CONSTRAINT listing_advertiser_id_fkey FOREIGN KEY (advertiser_id) REFERENCES public.users(user_id) ON DELETE CASCADE;


--
-- TOC entry 5012 (class 2606 OID 24757)
-- Name: listing_amenity listing_amenity_amenity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.listing_amenity
    ADD CONSTRAINT listing_amenity_amenity_id_fkey FOREIGN KEY (amenity_id) REFERENCES public.amenity(amenity_id) ON DELETE CASCADE;


--
-- TOC entry 5013 (class 2606 OID 24752)
-- Name: listing_amenity listing_amenity_listing_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.listing_amenity
    ADD CONSTRAINT listing_amenity_listing_id_fkey FOREIGN KEY (listing_id) REFERENCES public.listing(listing_id) ON DELETE CASCADE;


--
-- TOC entry 5011 (class 2606 OID 24740)
-- Name: listing_photo listing_photo_listing_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.listing_photo
    ADD CONSTRAINT listing_photo_listing_id_fkey FOREIGN KEY (listing_id) REFERENCES public.listing(listing_id) ON DELETE CASCADE;


--
-- TOC entry 5014 (class 2606 OID 24769)
-- Name: listing_transport listing_transport_listing_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.listing_transport
    ADD CONSTRAINT listing_transport_listing_id_fkey FOREIGN KEY (listing_id) REFERENCES public.listing(listing_id) ON DELETE CASCADE;


--
-- TOC entry 5015 (class 2606 OID 24774)
-- Name: listing_transport listing_transport_transport_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.listing_transport
    ADD CONSTRAINT listing_transport_transport_id_fkey FOREIGN KEY (transport_id) REFERENCES public.transport_option(transport_id) ON DELETE CASCADE;


--
-- TOC entry 5020 (class 2606 OID 24843)
-- Name: notification notification_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notification
    ADD CONSTRAINT notification_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE CASCADE;


--
-- TOC entry 5009 (class 2606 OID 24670)
-- Name: profiles profiles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE CASCADE;


--
-- TOC entry 5021 (class 2606 OID 24869)
-- Name: report report_listing_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.report
    ADD CONSTRAINT report_listing_id_fkey FOREIGN KEY (listing_id) REFERENCES public.listing(listing_id) ON DELETE CASCADE;


--
-- TOC entry 5022 (class 2606 OID 24874)
-- Name: report report_reported_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.report
    ADD CONSTRAINT report_reported_user_id_fkey FOREIGN KEY (reported_user_id) REFERENCES public.users(user_id) ON DELETE CASCADE;


--
-- TOC entry 5023 (class 2606 OID 24864)
-- Name: report report_reporter_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.report
    ADD CONSTRAINT report_reporter_id_fkey FOREIGN KEY (reporter_id) REFERENCES public.users(user_id) ON DELETE CASCADE;


--
-- TOC entry 5024 (class 2606 OID 24879)
-- Name: report report_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.report
    ADD CONSTRAINT report_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.users(user_id) ON DELETE SET NULL;


--
-- TOC entry 5018 (class 2606 OID 24823)
-- Name: saved_listing saved_listing_listing_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.saved_listing
    ADD CONSTRAINT saved_listing_listing_id_fkey FOREIGN KEY (listing_id) REFERENCES public.listing(listing_id) ON DELETE CASCADE;


--
-- TOC entry 5019 (class 2606 OID 24818)
-- Name: saved_listing saved_listing_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.saved_listing
    ADD CONSTRAINT saved_listing_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.users(user_id) ON DELETE CASCADE;


-- Completed on 2026-08-16 21:50:44

--
-- PostgreSQL database dump complete
--

\unrestrict AKKAZzXD3sKWVwBUch9M81pk7qiKCRuVXY9Nyt41tNI5clwYG26zioLHvDovMbU

