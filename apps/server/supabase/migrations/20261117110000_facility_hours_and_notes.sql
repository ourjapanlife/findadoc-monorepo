-- Published opening hours and a short visitor note on a facility (#294).
-- opening_hours is a list of { day, opens, closes } blocks in Japan time. An empty
-- list is unknown, so every existing row starts unknown and readers see nothing.
-- A moderator fills hours from the clinic's own site or a call, never from Places.
-- The note is written in English and Japanese by the moderator, both or neither.
ALTER TABLE facilities
  ADD COLUMN opening_hours jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN additional_info_en text,
  ADD COLUMN additional_info_ja text;

-- The same rules as openingHoursProblem in packages/utils/src/openingHours.ts, so a
-- direct write cannot store hours the API would refuse: a list of at most 32 objects,
-- a known day, HH:MM times (24:00 only as a closing time), a block that closes after
-- it opens, at most four blocks a day, and no overlapping blocks on one day.
-- Zero-padded HH:MM strings sort in time order, so text comparison is enough.
CREATE FUNCTION facility_opening_hours_valid(hours jsonb)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT jsonb_typeof(hours) = 'array'
    AND jsonb_array_length(hours) <= 32
    AND NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(hours) AS block
      WHERE jsonb_typeof(block) IS DISTINCT FROM 'object'
        OR (block ->> 'day') IS NULL
        OR (block ->> 'day') NOT IN (
          'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY', 'PUBLIC_HOLIDAY'
        )
        OR (block ->> 'opens') IS NULL
        OR (block ->> 'closes') IS NULL
        OR (block ->> 'opens') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
        OR (block ->> 'closes') !~ '^(([01][0-9]|2[0-3]):[0-5][0-9]|24:00)$'
        OR (block ->> 'closes') <= (block ->> 'opens')
    )
    AND NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(hours) AS block
      GROUP BY block ->> 'day'
      HAVING count(*) > 4
    )
    AND NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(hours) WITH ORDINALITY AS first_block(value, position)
      JOIN jsonb_array_elements(hours) WITH ORDINALITY AS second_block(value, position)
        ON first_block.position < second_block.position
        AND (first_block.value ->> 'day') = (second_block.value ->> 'day')
      WHERE (first_block.value ->> 'opens') < (second_block.value ->> 'closes')
        AND (second_block.value ->> 'opens') < (first_block.value ->> 'closes')
    )
$$;

ALTER TABLE facilities
  ADD CONSTRAINT facilities_opening_hours_valid
  CHECK (facility_opening_hours_valid(opening_hours));

ALTER TABLE facilities
  ADD CONSTRAINT facilities_additional_info_length
  CHECK (char_length(additional_info_en) <= 1000 AND char_length(additional_info_ja) <= 1000);

-- The note is bilingual: a reader in any locale must find one in English or Japanese.
ALTER TABLE facilities
  ADD CONSTRAINT facilities_additional_info_both
  CHECK ((additional_info_en IS NULL) = (additional_info_ja IS NULL));
