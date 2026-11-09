-- Retention for visitor free text (#236). APPI Art. 22: delete personal data once its
-- purpose is met.
--
-- submissions.notes is free text. A signed-out visitor types it on the public form, and a
-- moderator edits the same column. It can hold a name, a phone number, or health details.
-- retain_until is when the daily purge clears it: 365 days after submit while the
-- submission is undecided, and 180 days after an approve or decline. Existing rows start
-- null; utils/backfillSubmissionRetention.ts sets them in a separate step.
ALTER TABLE submissions
  ADD COLUMN retain_until timestamptz;

-- The purge reads rows whose retain_until has passed.
CREATE INDEX submissions_retain_until_idx
  ON submissions (retain_until)
  WHERE retain_until IS NOT NULL;

-- booking_appointments.status_reason is a decline or cancel note, and a patient's cancel
-- note is their own words. The daily purge clears it 90 days after the visit, or 90 days
-- after the cancel or decline. status_reason_purged_at records when, so staff see that a
-- reason was removed instead of no reason.
ALTER TABLE booking_appointments
  ADD COLUMN status_reason_purged_at timestamptz;

-- A cleared reason stays empty.
ALTER TABLE booking_appointments
  ADD CONSTRAINT booking_appointments_purged_reason_empty
    CHECK (status_reason_purged_at IS NULL OR status_reason IS NULL);
