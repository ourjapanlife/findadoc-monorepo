-- Online facilities have no map pin. Latitude and longitude may be null.
-- Offline facilities still require both columns (enforced in the API, not here).
ALTER TABLE facilities
  ALTER COLUMN map_latitude DROP NOT NULL,
  ALTER COLUMN map_longitude DROP NOT NULL;

-- Clear pins on online rows, including the previous 0/0 sentinel.
UPDATE facilities
SET map_latitude = NULL,
    map_longitude = NULL
WHERE online = true;
