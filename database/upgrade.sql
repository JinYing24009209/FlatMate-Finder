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
