BEGIN;
-- 明确区分未填写日期与用户主动选择 Flexible，不修改旧资料的意愿。
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS move_in_flexible BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS preferred_city VARCHAR(120);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS preferred_suburb VARCHAR(120);
COMMIT;
