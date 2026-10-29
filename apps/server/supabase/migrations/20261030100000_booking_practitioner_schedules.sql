-- One schedule per doctor at a clinic.
--
-- Weekly hours, painted windows, and closures may name a practitioner. A row
-- with no practitioner is the clinic's own schedule. A clinic-wide closure
-- closes every doctor too (a holiday). A doctor with no rows of their own
-- books on the clinic schedule, and their name on the request is a preference.
--
-- booking_appointments.practitioner_id is the schedule the visit holds time
-- on: two doctors may each see a patient at 10:00. Null holds clinic time.
-- booking_submissions.practitioner_id stays the doctor the patient chose or
-- was given.
--
-- booking_submissions.spoken_languages are the languages the patient asked
-- for, so the clinic can see them on the request.

ALTER TABLE clinic_weekly_hours
  ADD COLUMN practitioner_id uuid REFERENCES hps (id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE clinic_availability_windows
  ADD COLUMN practitioner_id uuid REFERENCES hps (id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE clinic_availability_closures
  ADD COLUMN practitioner_id uuid REFERENCES hps (id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE booking_appointments
  ADD COLUMN practitioner_id uuid REFERENCES hps (id) ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE booking_submissions
  ADD COLUMN spoken_languages text[] NOT NULL DEFAULT '{}';

ALTER TABLE booking_submissions
  ADD CONSTRAINT booking_submissions_spoken_languages_check
    CHECK (cardinality(spoken_languages) <= 10);

DROP INDEX IF EXISTS clinic_weekly_hours_facility_idx;
CREATE INDEX clinic_weekly_hours_facility_idx
  ON clinic_weekly_hours (facility_id, practitioner_id, weekday);

CREATE INDEX booking_appointments_practitioner_range_idx
  ON booking_appointments (practitioner_id, starts_at, ends_at)
  WHERE practitioner_id IS NOT NULL AND status IN ('requested', 'confirmed');
