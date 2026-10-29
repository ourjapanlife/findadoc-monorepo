-- Booking asks for explicit consent before the reason for the visit is sent to the
-- clinic (#173). The time of that consent is kept with the request.
-- Requests sent before this change have no recorded time.

ALTER TABLE booking_submissions
  ADD COLUMN health_data_consented_at timestamptz;
