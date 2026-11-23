-- Validate facilities_pin_required now that every in-person facility has a pin (#21).
--
-- 20261122090000_facility_pin_required.sql added the check NOT VALID while the pins backfill
-- filled the 1,249 facilities the #21 import left without coordinates. That backfill has run on
-- production and no row fails the check, so the existing rows are now checked too. Validating
-- takes only a SHARE UPDATE EXCLUSIVE lock: reads and writes keep working while it scans.
alter table facilities validate constraint facilities_pin_required;
