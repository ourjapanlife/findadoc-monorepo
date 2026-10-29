-- The owner picks which offered visit length the Book page preselects.
-- Null keeps the old rule: 30 minutes when offered, else the shortest.

ALTER TABLE booking_settings
  ADD COLUMN default_duration integer,
  ADD CONSTRAINT booking_settings_default_duration_check
    CHECK (default_duration IS NULL OR default_duration = ANY (allowed_durations));
