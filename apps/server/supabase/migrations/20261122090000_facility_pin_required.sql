-- An in-person facility needs a map pin (#21).
--
-- The API already refuses to create or update an in-person facility without a usable pin
-- (hasUsableMapPin), but the database did not, so the #21 import inserted 1,249 facilities with
-- no coordinates, and the search map drew them all in central Tokyo. This makes the database
-- the last check, as AGENTS.md asks.
--
-- NOT VALID: new rows and every update are checked now, while the rows the import left empty are
-- filled by utils/backfillFacilityPins.ts. A later migration runs
-- `alter table facilities validate constraint facilities_pin_required` once none are left.
-- 0 is the old empty-pin value, not a clinic in Japan, so it does not count as a pin. The ranges
-- also refuse NaN and infinity: in Postgres NaN sorts above every number, so `between` is false.
alter table facilities
    add constraint facilities_pin_required check (
        online
        or (
            map_latitude is not null
            and map_longitude is not null
            and map_latitude <> 0
            and map_longitude <> 0
            and map_latitude between -90 and 90
            and map_longitude between -180 and 180
        )
    ) not valid;
