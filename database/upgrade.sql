BEGIN;

CREATE TABLE IF NOT EXISTS saved_flatmate (
  saved_flatmate_id SERIAL PRIMARY KEY,
  student_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  saved_user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  saved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT saved_flatmate_unique UNIQUE (student_id, saved_user_id),
  CONSTRAINT saved_flatmate_not_self CHECK (student_id <> saved_user_id)
);

CREATE INDEX IF NOT EXISTS saved_flatmate_student_idx
  ON saved_flatmate(student_id, saved_at DESC);

COMMIT;

-- Coursework-safe rental payment workflow (no card data is stored).
BEGIN;
CREATE TABLE IF NOT EXISTS rental_payment (
  payment_id SERIAL PRIMARY KEY,
  listing_id INTEGER NOT NULL REFERENCES listing(listing_id) ON DELETE CASCADE,
  student_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  amount NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  currency VARCHAR(3) NOT NULL DEFAULT 'NZD',
  purpose VARCHAR(40) NOT NULL DEFAULT 'holding_deposit'
    CHECK (purpose IN ('holding_deposit', 'bond')),
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'succeeded', 'failed', 'cancelled')),
  provider VARCHAR(40) NOT NULL DEFAULT 'coursework-demo',
  provider_reference VARCHAR(160),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS rental_payment_student_idx
  ON rental_payment(student_id, created_at DESC);
CREATE INDEX IF NOT EXISTS rental_payment_listing_idx
  ON rental_payment(listing_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS rental_payment_one_pending_idx
  ON rental_payment(student_id, listing_id) WHERE status='pending';
COMMIT;


BEGIN;

ALTER TABLE users
ADD COLUMN IF NOT EXISTS student_type VARCHAR(20);

-- Existing students use the housing journey by default.
UPDATE users
SET student_type = 'housing'
WHERE role = 'student'
  AND student_type IS NULL;

-- Other roles do not use student_type.
UPDATE users
SET student_type = NULL
WHERE role <> 'student';

ALTER TABLE users
DROP CONSTRAINT IF EXISTS users_student_type_check;

ALTER TABLE users
ADD CONSTRAINT users_student_type_check
CHECK (
  (
    role = 'student'
    AND student_type IS NOT NULL
    AND student_type IN ('housing', 'flatmate')
  )
  OR
  (
    role <> 'student'
    AND student_type IS NULL
  )
);

COMMIT;

-- Profile portraits and private student-to-student enquiries.
BEGIN;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS profile_photo TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS about_me VARCHAR(1000);
CREATE TABLE IF NOT EXISTS flatmate_conversation (
  conversation_id SERIAL PRIMARY KEY,
  member_low INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  member_high INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(member_low, member_high),
  CHECK(member_low < member_high)
);
CREATE TABLE IF NOT EXISTS flatmate_message (
  message_id SERIAL PRIMARY KEY,
  conversation_id INTEGER NOT NULL REFERENCES flatmate_conversation(conversation_id) ON DELETE CASCADE,
  sender_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  body TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 3000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  read_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS flatmate_message_conversation_idx
  ON flatmate_message(conversation_id, created_at, message_id);
CREATE INDEX IF NOT EXISTS flatmate_conversation_high_idx ON flatmate_conversation(member_high);
COMMIT;
