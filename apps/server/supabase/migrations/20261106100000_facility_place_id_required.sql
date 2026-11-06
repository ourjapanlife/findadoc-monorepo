-- A facility with a street address must name its Google place (#228). The "Open in Maps"
-- link opens that one place, and moderation matches clinics by it. Online facilities have
-- no place, so they are exempt. docs/places-storage.md: only the place id is stored.
--
-- 1. Fill missing ids from the Maps URL already stored on the facility. These are the forms
--    src/places/mapsLink.ts reads without a network call. Short links and ftid pairs need
--    utils/backfillFacilityPlaceIds.ts, which opens the link.
-- 2. Add the rule NOT VALID, so new and edited rows must follow it from now on.
-- 3. Validate it here when nothing is left. Otherwise the deploy still succeeds, and
--    `pnpm --filter @findadoc/server backfill:place-ids:write` validates it once the rest
--    are filled.

CREATE FUNCTION facility_place_id_from_maps_url(url text) RETURNS text
LANGUAGE sql IMMUTABLE AS $$
  SELECT COALESCE(
    substring(url FROM '[?&]query_place_id=([A-Za-z0-9_-]{8,})'),
    substring(url FROM '[?&]place_id=([A-Za-z0-9_-]{8,})'),
    substring(url FROM '[?&](?:q|query)=place_id(?::|%3A|%3a)([A-Za-z0-9_-]{8,})'),
    substring(url FROM '!1s((?!0x)[A-Za-z0-9_-]{8,})')
  )
$$;

UPDATE facilities
SET google_place_id = facility_place_id_from_maps_url(contact ->> 'googleMapsUrl')
WHERE online = false
  AND coalesce(btrim(google_place_id), '') = ''
  AND facility_place_id_from_maps_url(contact ->> 'googleMapsUrl') IS NOT NULL;

ALTER TABLE facilities
  ADD CONSTRAINT facilities_place_id_required
    CHECK (online OR coalesce(btrim(google_place_id), '') <> '') NOT VALID;

DO $$
DECLARE
  missing integer;
BEGIN
  SELECT count(*) INTO missing
  FROM facilities
  WHERE online = false AND coalesce(btrim(google_place_id), '') = '';

  IF missing = 0 THEN
    ALTER TABLE facilities VALIDATE CONSTRAINT facilities_place_id_required;
  ELSE
    RAISE NOTICE 'facilities_place_id_required is not validated: % facilities still need a place id', missing;
  END IF;
END
$$;
