-- peerly-backend/supabase/migrations/20260428_post_reports.sql
ALTER TABLE posts ADD COLUMN is_hidden BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE posts ADD COLUMN report_count INT NOT NULL DEFAULT 0;

CREATE TABLE post_reports (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id     UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  reporter_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reason      TEXT NOT NULL CHECK (reason IN ('spam','harassment','misinformation','inappropriate','other')),
  custom_text TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (post_id, reporter_id)
);
