-- Weekly opening hours and closures (#162).
--
-- A clinic sets its usual week once, in Japan time, instead of painting every
-- week. Open starts are weekly hours plus painted extra windows
-- (clinic_availability_windows), minus closures, minus held appointments.
--
-- weekday is ISO: 1 is Monday, 7 is Sunday. start_minute and end_minute are
-- minutes after midnight JST on 30-minute boundaries. A block ends by midnight.
--
-- A closure is a dated range with no open time: a holiday, a day off, or one
-- weekly block staff closed on the calendar.

CREATE TABLE clinic_weekly_hours (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id uuid NOT NULL REFERENCES facilities (id) ON UPDATE CASCADE ON DELETE CASCADE,
  weekday smallint NOT NULL,
  start_minute smallint NOT NULL,
  end_minute smallint NOT NULL,
  created_by text,
  created_date timestamptz NOT NULL DEFAULT now(),
  updated_date timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT clinic_weekly_hours_weekday_check CHECK (weekday BETWEEN 1 AND 7),
  CONSTRAINT clinic_weekly_hours_range_check
    CHECK (start_minute >= 0 AND end_minute <= 1440 AND end_minute > start_minute),
  CONSTRAINT clinic_weekly_hours_aligned_check
    CHECK (start_minute % 30 = 0 AND end_minute % 30 = 0)
);

CREATE INDEX clinic_weekly_hours_facility_idx
  ON clinic_weekly_hours (facility_id, weekday);

CREATE TABLE clinic_availability_closures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id uuid NOT NULL REFERENCES facilities (id) ON UPDATE CASCADE ON DELETE CASCADE,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  reason text,
  created_by text,
  created_date timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT clinic_availability_closures_range_check CHECK (ends_at > starts_at),
  CONSTRAINT clinic_availability_closures_reason_check
    CHECK (reason IS NULL OR char_length(reason) <= 200)
);

CREATE INDEX clinic_availability_closures_facility_range_idx
  ON clinic_availability_closures (facility_id, starts_at, ends_at);

ALTER TABLE clinic_weekly_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinic_availability_closures ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE clinic_weekly_hours FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE clinic_availability_closures FROM PUBLIC, anon, authenticated;

DO $$
DECLARE
  booking_table text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'rds_iam') THEN
    RETURN;
  END IF;

  FOREACH booking_table IN ARRAY ARRAY[
    'clinic_weekly_hours',
    'clinic_availability_closures'
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

-- The showcase clinic opens Monday to Friday, 09:00-12:00 and 13:00-17:00 JST,
-- so production has open times without a moderator painting them.
INSERT INTO clinic_weekly_hours (facility_id, weekday, start_minute, end_minute, created_by)
SELECT facility.id, weekday, hours.start_minute, hours.end_minute, 'migration'
FROM facilities AS facility
CROSS JOIN generate_series(1, 5) AS weekday
CROSS JOIN (VALUES (540, 720), (780, 1020)) AS hours (start_minute, end_minute)
WHERE facility.id = 'c32c316a-a368-499b-abaf-c5c973cb67e5'
  AND NOT EXISTS (
    SELECT 1 FROM clinic_weekly_hours AS existing WHERE existing.facility_id = facility.id
  );
