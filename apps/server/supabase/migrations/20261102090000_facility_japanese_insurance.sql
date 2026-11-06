-- Japanese public health insurance is a property of the clinic (#18).
-- Null is unknown. A moderator may note where an answer came from: a link or a call.
-- Both columns start null, so the CHECK constraints below hold for every existing row.
ALTER TABLE facilities
  ADD COLUMN japanese_insurance text,
  ADD COLUMN japanese_insurance_source text;

ALTER TABLE facilities
  ADD CONSTRAINT facilities_japanese_insurance_value
  CHECK (japanese_insurance IN ('ACCEPTED', 'NOT_ACCEPTED'));

-- A source belongs to an answer.
ALTER TABLE facilities
  ADD CONSTRAINT facilities_japanese_insurance_source_needs_value
  CHECK (japanese_insurance IS NOT NULL OR japanese_insurance_source IS NULL);

-- Every clinic starts unknown. Private-only clinics exist, so nothing is assumed:
-- a moderator marks a clinic ACCEPTED or NOT_ACCEPTED when a source says so.

-- The per-professional codes are no longer written. The insurance backfill reads
-- them in dry-run and clears them on a write run. A later migration drops the column.
ALTER TABLE hps
  ALTER COLUMN accepted_insurance SET DEFAULT '[]'::jsonb;
