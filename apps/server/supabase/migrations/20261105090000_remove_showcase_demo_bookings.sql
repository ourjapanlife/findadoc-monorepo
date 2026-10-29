-- Removes the temporary demo requests that 20261029170000_showcase_demo_bookings.sql
-- added for the showcase clinic demo, and nothing else: every one of those rows has
-- an id starting with de300000-0000-4000-.

DELETE FROM booking_appointments WHERE id::text LIKE 'de300000-0000-4000-%';
DELETE FROM booking_submissions WHERE id::text LIKE 'de300000-0000-4000-%';
DELETE FROM clinic_availability_windows WHERE id::text LIKE 'de300000-0000-4000-%';
