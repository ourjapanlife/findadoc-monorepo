-- Erase a patient's booking answers once the visit no longer needs them (#212).
-- APPI Art. 22: delete personal data once its purpose is met. The daily purge empties
-- booking_submissions.answers 90 days after the visit ends, and a cancel or decline
-- empties it in the same transaction as the status change. answers_purged_at records
-- when. The row stays, with the clinic, form, locale, appointment, and timestamps, for
-- disputes and counts. Existing rows start unpurged; the next daily run takes the ones
-- already past the rule.
ALTER TABLE booking_submissions
  ADD COLUMN answers_purged_at timestamptz;

-- A purged row holds no answers.
ALTER TABLE booking_submissions
  ADD CONSTRAINT booking_submissions_purged_answers_empty
    CHECK (answers_purged_at IS NULL OR answers = '{}'::jsonb);

-- The daily purge scans only rows that still hold answers.
CREATE INDEX booking_submissions_answers_unpurged_idx
  ON booking_submissions (created_date)
  WHERE answers_purged_at IS NULL;
