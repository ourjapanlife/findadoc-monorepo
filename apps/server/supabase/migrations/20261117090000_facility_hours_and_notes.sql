-- Published opening hours and a short visitor note on a facility (#294).
-- opening_hours is a list of { day, opens, closes } blocks in Japan time. An empty
-- list is unknown, so every existing row starts unknown and readers see nothing.
-- A moderator fills hours from the clinic's own site or a call, never from Places.
-- The note is written in English and Japanese by the moderator, both or neither.
ALTER TABLE facilities
  ADD COLUMN opening_hours jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN additional_info_en text,
  ADD COLUMN additional_info_ja text;

ALTER TABLE facilities
  ADD CONSTRAINT facilities_opening_hours_array
  CHECK (jsonb_typeof(opening_hours) = 'array' AND jsonb_array_length(opening_hours) <= 32);

ALTER TABLE facilities
  ADD CONSTRAINT facilities_additional_info_length
  CHECK (char_length(additional_info_en) <= 1000 AND char_length(additional_info_ja) <= 1000);

-- The note is bilingual: a reader in any locale must find one in English or Japanese.
ALTER TABLE facilities
  ADD CONSTRAINT facilities_additional_info_both
  CHECK ((additional_info_en IS NULL) = (additional_info_ja IS NULL));
