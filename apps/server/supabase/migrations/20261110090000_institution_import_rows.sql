-- Staging table for the multilingual institutions spreadsheet (#21).
--
-- One row per spreadsheet row, so every import can be traced back to the source file, the sheet,
-- and the row number. `raw` keeps every column as the sheet wrote it, keyed by header text.
-- `colour` is the volunteer progress mark: green (already listed), red (reviewed, not added),
-- yellow (reviewed, undecided), or none (not reviewed).
--
-- The importer (apps/server/utils/importInstitutionList.ts) fills `outcome`:
--   staged        read, nothing decided yet
--   matched       points at an existing facility; only that facility's empty fields were filled
--   created       a new UNVERIFIED facility was made from this row
--   needs_review  a person has to decide (no place id, two places, a conflict with a confirmed value)
--   skipped       left out on purpose (red rows)
--
-- The rows hold a public institution list: names, addresses, phone numbers, and websites of
-- clinics. There is no patient or personal data, so the db:prod roles may read it, and the operator
-- role writes it, like the directory tables. Only a Places id is stored, never a Places payload.
CREATE TABLE IF NOT EXISTS institution_import_rows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_file text NOT NULL CHECK (btrim(source_file) <> ''),
  sheet_name text NOT NULL CHECK (btrim(sheet_name) <> ''),
  row_number integer NOT NULL CHECK (row_number > 0),
  colour text NOT NULL CHECK (colour IN ('green', 'red', 'yellow', 'none')),
  raw jsonb NOT NULL CHECK (jsonb_typeof(raw) = 'object'),
  outcome text NOT NULL DEFAULT 'staged'
    CHECK (outcome IN ('staged', 'matched', 'created', 'needs_review', 'skipped')),
  reason text,
  match_method text CHECK (match_method IN ('place_id', 'maps_url', 'name_postal_code', 'phone')),
  facility_id uuid REFERENCES facilities (id) ON DELETE SET NULL,
  google_place_id text,
  warnings jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(warnings) = 'array'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT institution_import_rows_source_row UNIQUE (source_file, sheet_name, row_number),
  CONSTRAINT institution_import_rows_facility_outcome
    CHECK (outcome NOT IN ('matched', 'created') OR facility_id IS NOT NULL),
  CONSTRAINT institution_import_rows_review_reason
    CHECK (outcome NOT IN ('needs_review', 'skipped') OR reason IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS institution_import_rows_facility_idx ON institution_import_rows (facility_id);
CREATE INDEX IF NOT EXISTS institution_import_rows_outcome_idx ON institution_import_rows (outcome);

ALTER TABLE institution_import_rows ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON TABLE institution_import_rows FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON TABLE institution_import_rows FROM authenticated;
  END IF;

  -- The roles below exist only on RDS. The API does not read this table.
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'rds_iam') THEN
    RETURN;
  END IF;

  GRANT SELECT ON TABLE public.institution_import_rows TO findadoc_readonly;
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.institution_import_rows TO findadoc_operator;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'institution_import_rows' AND policyname = 'findadoc_readonly_select'
  ) THEN
    CREATE POLICY findadoc_readonly_select ON public.institution_import_rows
      FOR SELECT TO findadoc_readonly USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'institution_import_rows' AND policyname = 'findadoc_operator_all'
  ) THEN
    CREATE POLICY findadoc_operator_all ON public.institution_import_rows
      FOR ALL TO findadoc_operator USING (true) WITH CHECK (true);
  END IF;
END $$;
