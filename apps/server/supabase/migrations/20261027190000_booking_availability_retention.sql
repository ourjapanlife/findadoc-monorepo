-- Booking availability windows (staff paints 30-minute blocks) and appointments
-- (patients book on 15-minute starts inside those windows).
--
-- Sensitive uploads (insurance / My Number style identity documents) get a
-- retain_until timestamp. After that, a purge run deletes the object and marks
-- the row purged. Answers stay; the file does not.

ALTER TABLE booking_uploads
  ADD COLUMN sensitivity text NOT NULL DEFAULT 'standard',
  ADD COLUMN retain_until timestamptz,
  ADD COLUMN purged_at timestamptz;

ALTER TABLE booking_uploads
  ADD CONSTRAINT booking_uploads_sensitivity_check
    CHECK (sensitivity IN ('standard', 'identity_document', 'medical'));

CREATE INDEX booking_uploads_retain_until_idx
  ON booking_uploads (retain_until)
  WHERE purged_at IS NULL AND retain_until IS NOT NULL;

CREATE TABLE clinic_availability_windows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_site_id uuid NOT NULL REFERENCES clinic_sites (id) ON UPDATE CASCADE ON DELETE CASCADE,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  created_by text,
  created_date timestamptz NOT NULL DEFAULT now(),
  updated_date timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT clinic_availability_windows_range_check CHECK (ends_at > starts_at),
  -- Staff availability snaps to 30-minute boundaries (stored as UTC).
  CONSTRAINT clinic_availability_windows_start_30min_check
    CHECK ((EXTRACT(EPOCH FROM starts_at)::bigint % 1800) = 0),
  CONSTRAINT clinic_availability_windows_end_30min_check
    CHECK ((EXTRACT(EPOCH FROM ends_at)::bigint % 1800) = 0),
  CONSTRAINT clinic_availability_windows_min_30min_check
    CHECK ((EXTRACT(EPOCH FROM (ends_at - starts_at))::bigint % 1800) = 0)
);

CREATE INDEX clinic_availability_windows_clinic_range_idx
  ON clinic_availability_windows (clinic_site_id, starts_at, ends_at);

CREATE TABLE booking_appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_site_id uuid NOT NULL REFERENCES clinic_sites (id) ON UPDATE CASCADE ON DELETE CASCADE,
  booking_submission_id uuid UNIQUE REFERENCES booking_submissions (id) ON UPDATE CASCADE ON DELETE SET NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'held',
  created_date timestamptz NOT NULL DEFAULT now(),
  updated_date timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT booking_appointments_range_check CHECK (ends_at > starts_at),
  -- Patient starts snap to 15-minute boundaries.
  CONSTRAINT booking_appointments_start_15min_check
    CHECK ((EXTRACT(EPOCH FROM starts_at)::bigint % 900) = 0),
  CONSTRAINT booking_appointments_status_check
    CHECK (status IN ('held', 'confirmed', 'cancelled', 'completed'))
);

CREATE INDEX booking_appointments_clinic_range_idx
  ON booking_appointments (clinic_site_id, starts_at, ends_at)
  WHERE status IN ('held', 'confirmed');

ALTER TABLE clinic_availability_windows ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_appointments ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE clinic_availability_windows FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE booking_appointments FROM PUBLIC, anon, authenticated;

DO $$
DECLARE
  booking_table text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'rds_iam') THEN
    RETURN;
  END IF;

  FOREACH booking_table IN ARRAY ARRAY[
    'clinic_availability_windows',
    'booking_appointments'
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
