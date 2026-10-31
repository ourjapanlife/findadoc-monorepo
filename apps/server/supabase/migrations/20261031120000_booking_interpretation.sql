-- A clinic that offers interpretation (#205): every language the clinic lists
-- is available with every doctor, so the patient's language choice does not
-- narrow the doctors or schedules on the Book page.
--
-- One row per facility means the clinic offers it. No row means it does not,
-- which is the default. This is its own table, not a booking_settings column,
-- because a booking_settings row is what opens a clinic to patients
-- (booking/target.ts). The pilot below has no settings row since
-- 20261031090000_clear_booking_requests.sql, and turning interpretation on must
-- not open booking before the clinic saves its settings and hours.
--
-- It is meant to become a paid add-on. source says who turned it on: 'pilot'
-- (free during the pilot) or 'admin'. Billing adds its own value later. Clinic
-- members cannot change the row (booking/interpretation.ts).
--
-- Today interpretation covers every listed language at every open time. If a
-- clinic later has interpreters only for some languages or hours, that goes in
-- a child table keyed by this facility, with no rows meaning "all of them".
--
-- The multilingual online clinic (the showcase clinic site) is the pilot and
-- gets it free. On a fresh local database the facility does not exist yet, so
-- that INSERT changes nothing there; the seed writes the same row.

CREATE TABLE booking_interpretation (
  facility_id uuid PRIMARY KEY REFERENCES facilities (id) ON UPDATE CASCADE ON DELETE CASCADE,
  source text NOT NULL,
  created_date timestamptz NOT NULL DEFAULT now(),
  updated_date timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT booking_interpretation_source_check
    CHECK (source IN ('pilot', 'admin'))
);

ALTER TABLE booking_interpretation ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE booking_interpretation FROM PUBLIC, anon, authenticated;

INSERT INTO booking_interpretation (facility_id, source)
SELECT site.facility_id, 'pilot'
FROM clinic_sites AS site
WHERE site.id = 'a303a8ac-31c9-45d8-96d1-cf6630aa11bd'
  AND site.facility_id IS NOT NULL
ON CONFLICT (facility_id) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'rds_iam') THEN
    RETURN;
  END IF;

  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.booking_interpretation TO findadoc_api;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'booking_interpretation'
      AND policyname = 'findadoc_api_all'
  ) THEN
    CREATE POLICY findadoc_api_all ON public.booking_interpretation
      FOR ALL TO findadoc_api USING (true) WITH CHECK (true);
  END IF;
END $$;
