-- Drop the old per-professional insurance codes (#18).
-- Japanese public health insurance is a fact about the clinic: facilities.japanese_insurance
-- (20261102090000_facility_japanese_insurance.sql). The #18 backfill emptied
-- hps.accepted_insurance on production on 2026-11-08, and nothing reads the column.
-- Refuse to drop it if any row still holds a code, so no data is lost on an environment
-- that has not run the backfill.
DO $$
DECLARE
  remaining integer;
BEGIN
  SELECT count(*) INTO remaining FROM hps WHERE accepted_insurance <> '[]'::jsonb;

  IF remaining > 0 THEN
    RAISE EXCEPTION 'hps.accepted_insurance still has % rows with codes. Clear them before dropping it.', remaining;
  END IF;
END
$$;

ALTER TABLE hps DROP COLUMN accepted_insurance;
