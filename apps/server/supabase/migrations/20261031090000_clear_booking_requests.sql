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
-- A migration cannot delete stored upload files. If any upload still has a
-- file, this stops and changes nothing (each migration is one transaction), so
-- the upload purge runs first and nothing is left in storage without a row.

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM booking_uploads WHERE purged_at IS NULL) THEN
        RAISE EXCEPTION 'booking_uploads has files that are not purged yet. Purge them, then migrate again.';
    END IF;
END $$;

DELETE FROM booking_uploads;
DELETE FROM booking_appointments;
DELETE FROM booking_submissions;
DELETE FROM clinic_availability_windows;
DELETE FROM clinic_availability_closures;
DELETE FROM clinic_weekly_hours;
DELETE FROM booking_settings;
