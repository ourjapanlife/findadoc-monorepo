-- Adds the pending_payment appointment status (online consult v2 spec §3.2).
-- A request on a form that asks for a payment method starts as pending_payment
-- and holds its slot, like requested and confirmed. Staff move it to confirmed
-- once the clinic has the payment, and may move a confirmed visit back.
-- The CHECK and the four partial range indexes that list the slot-holding
-- statuses are redone so the availability and overlap queries keep using them.
-- Existing rows keep their status. The column default stays 'requested'; the API
-- always writes the start status itself.

ALTER TABLE booking_appointments
  DROP CONSTRAINT booking_appointments_status_check;

ALTER TABLE booking_appointments
  ADD CONSTRAINT booking_appointments_status_check
    CHECK (status IN ('requested', 'pending_payment', 'confirmed', 'declined', 'cancelled', 'completed'));

DROP INDEX IF EXISTS booking_appointments_clinic_range_idx;
DROP INDEX IF EXISTS booking_appointments_facility_range_idx;
DROP INDEX IF EXISTS booking_appointments_practitioner_range_idx;
DROP INDEX IF EXISTS booking_appointments_interpreter_range_idx;

CREATE INDEX booking_appointments_clinic_range_idx
  ON booking_appointments (clinic_site_id, starts_at, ends_at)
  WHERE status IN ('requested', 'pending_payment', 'confirmed');

CREATE INDEX booking_appointments_facility_range_idx
  ON booking_appointments (facility_id, starts_at, ends_at)
  WHERE status IN ('requested', 'pending_payment', 'confirmed');

CREATE INDEX booking_appointments_practitioner_range_idx
  ON booking_appointments (practitioner_id, starts_at, ends_at)
  WHERE practitioner_id IS NOT NULL AND status IN ('requested', 'pending_payment', 'confirmed');

CREATE INDEX booking_appointments_interpreter_range_idx
  ON booking_appointments (interpreter_id, starts_at, ends_at)
  WHERE interpreter_id IS NOT NULL AND status IN ('requested', 'pending_payment', 'confirmed');
