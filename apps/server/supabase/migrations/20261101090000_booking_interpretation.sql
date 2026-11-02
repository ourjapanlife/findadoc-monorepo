-- Clinic interpretation (#205). docs/booking-interpretation.md has the model.
--
-- booking_interpretation: one row per facility that may use interpreters. Admins
-- turn it on (a paid add-on later; source says who). It is its own table, not a
-- booking_settings column, because a booking_settings row opens a clinic to
-- patients (booking/target.ts) and the pilot has none since
-- 20261031090000_clear_booking_requests.sql.
--
-- clinic_interpreters: an interpreter, team, or phone service. languages NULL
-- means every language the clinic lists; capacity NULL means no limit.
-- clinic_interpreter_hours: when it works, in JST. No rows means whenever the
-- clinic is open.
-- booking_appointments.interpreter_id: the interpreter a visit holds, counted
-- against capacity.
--
-- The multilingual online clinic (the showcase clinic site) is the pilot: it gets
-- interpretation and one interpreter with every field empty, which is every
-- language at every open time. On a fresh local database that facility does not
-- exist yet, so the INSERTs change nothing there; the seed writes the same rows.

CREATE TABLE booking_interpretation (
  facility_id uuid PRIMARY KEY REFERENCES facilities (id) ON UPDATE CASCADE ON DELETE CASCADE,
  source text NOT NULL,
  created_date timestamptz NOT NULL DEFAULT now(),
  updated_date timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT booking_interpretation_source_check
    CHECK (source IN ('pilot', 'admin'))
);

CREATE TABLE clinic_interpreters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id uuid NOT NULL REFERENCES facilities (id) ON UPDATE CASCADE ON DELETE CASCADE,
  label text NOT NULL,
  languages text[],
  capacity integer,
  created_date timestamptz NOT NULL DEFAULT now(),
  updated_date timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT clinic_interpreters_label_check
    CHECK (char_length(btrim(label)) BETWEEN 1 AND 80),
  CONSTRAINT clinic_interpreters_languages_check
    CHECK (languages IS NULL OR cardinality(languages) BETWEEN 1 AND 20),
  CONSTRAINT clinic_interpreters_capacity_check
    CHECK (capacity IS NULL OR capacity BETWEEN 1 AND 20)
);

CREATE INDEX clinic_interpreters_facility_id_idx ON clinic_interpreters (facility_id);

CREATE TABLE clinic_interpreter_hours (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  interpreter_id uuid NOT NULL REFERENCES clinic_interpreters (id) ON UPDATE CASCADE ON DELETE CASCADE,
  weekday integer NOT NULL,
  start_minute integer NOT NULL,
  end_minute integer NOT NULL,
  created_date timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT clinic_interpreter_hours_weekday_check CHECK (weekday BETWEEN 1 AND 7),
  CONSTRAINT clinic_interpreter_hours_range_check
    CHECK (
      start_minute >= 0 AND end_minute <= 1440 AND end_minute > start_minute
      AND start_minute % 30 = 0 AND end_minute % 30 = 0
    )
);

CREATE INDEX clinic_interpreter_hours_interpreter_id_idx ON clinic_interpreter_hours (interpreter_id);

ALTER TABLE booking_appointments
  ADD COLUMN interpreter_id uuid REFERENCES clinic_interpreters (id) ON UPDATE CASCADE ON DELETE SET NULL;

CREATE INDEX booking_appointments_interpreter_range_idx
  ON booking_appointments (interpreter_id, starts_at, ends_at)
  WHERE interpreter_id IS NOT NULL AND status IN ('requested', 'confirmed');

ALTER TABLE booking_interpretation ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinic_interpreters ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinic_interpreter_hours ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE booking_interpretation FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE clinic_interpreters FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE clinic_interpreter_hours FROM PUBLIC, anon, authenticated;

INSERT INTO booking_interpretation (facility_id, source)
SELECT site.facility_id, 'pilot'
FROM clinic_sites AS site
WHERE site.id = 'a303a8ac-31c9-45d8-96d1-cf6630aa11bd'
  AND site.facility_id IS NOT NULL
ON CONFLICT (facility_id) DO NOTHING;

INSERT INTO clinic_interpreters (facility_id, label, languages, capacity)
SELECT interpretation.facility_id, 'Interpretation', NULL, NULL
FROM booking_interpretation AS interpretation
WHERE NOT EXISTS (
  SELECT 1 FROM clinic_interpreters AS existing WHERE existing.facility_id = interpretation.facility_id
);

DO $$
DECLARE
  booking_table text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'rds_iam') THEN
    RETURN;
  END IF;

  FOREACH booking_table IN ARRAY ARRAY[
    'booking_interpretation',
    'clinic_interpreters',
    'clinic_interpreter_hours'
  ]
  LOOP
    EXECUTE format(
      'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.%I TO findadoc_api',
      booking_table
    );

    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = booking_table
        AND policyname = 'findadoc_api_all'
    ) THEN
      EXECUTE format(
        'CREATE POLICY findadoc_api_all ON public.%I FOR ALL TO findadoc_api USING (true) WITH CHECK (true)',
        booking_table
      );
    END IF;
  END LOOP;
END $$;
