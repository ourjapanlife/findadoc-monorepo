-- Japanese public health insurance is a property of the clinic (#18).
-- Null is unknown. A moderator may note where an answer came from: a link or a call.
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

-- Every clinic in the directory today starts as taking Japanese public insurance.
-- A moderator marks a self-pay-only clinic NOT_ACCEPTED.
-- Clinics added after this migration start unknown.
UPDATE facilities
SET japanese_insurance = 'ACCEPTED'
WHERE japanese_insurance IS NULL;

-- The per-professional codes are no longer written. The insurance backfill reads
-- them in dry-run and clears them on a write run. A later migration drops the column.
ALTER TABLE hps
  ALTER COLUMN accepted_insurance SET DEFAULT '[]'::jsonb;
