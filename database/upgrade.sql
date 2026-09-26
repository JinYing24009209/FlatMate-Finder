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