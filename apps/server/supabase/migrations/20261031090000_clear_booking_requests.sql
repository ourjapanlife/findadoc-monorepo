-- Resets booking to an empty slate after the showcase clinic demo.
--
-- Everything in these tables came from the demo: the demo requests from
-- 20261029170000_showcase_demo_bookings.sql, rehearsal bookings, painted demo
-- hours, and the showcase weekly hours from 20261030090000_booking_weekly_hours.sql.
-- There are no live requests yet. The demo requests also still carry the old
-- intake answers (an age instead of a date of birth and gender, #211).
--
-- After this, no clinic has open times. A clinic with no booking_settings row
-- gets the default visit lengths and intake form (booking/target.ts) and takes
-- bookings once it saves its settings and hours on the dashboard.
--
-- Kept: clinic memberships, clinic sites and their languages, doctors, and
-- locale pages, facilities, and everything outside booking.
--
-- A migration cannot delete stored upload files. An upload whose file is not
-- purged yet keeps its row and is marked due now (retain_until = now()), so the
-- daily findadoc-booking-purge deletes the file and records purged_at. Upload rows
-- whose file is already purged are deleted. None of the demo files are needed.
-- This changes only rows that exist now; retention for new uploads is unchanged.
--
-- This file never applied on production: the first deploy stopped here on
-- unpurged uploads and rolled back, so it is changed in place rather than
-- followed by another migration.

UPDATE booking_uploads
SET retain_until = LEAST(COALESCE(retain_until, now()), now())
WHERE purged_at IS NULL;

DELETE FROM booking_uploads WHERE purged_at IS NOT NULL;
DELETE FROM booking_appointments;
DELETE FROM booking_submissions;
DELETE FROM clinic_availability_windows;
DELETE FROM clinic_availability_closures;
DELETE FROM clinic_weekly_hours;
DELETE FROM booking_settings;
