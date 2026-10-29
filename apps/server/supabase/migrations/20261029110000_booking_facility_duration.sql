-- Booking is a Find a Doc surface keyed by the directory facility.
-- A hosted clinic page (clinic_sites) is optional branding, not the booking account.
-- Clinics choose visit lengths (15/30/45/60). The intake form stays Find a Doc owned.

CREATE TABLE booking_settings (
  facility_id uuid PRIMARY KEY REFERENCES facilities (id) ON UPDATE CASCADE ON DELETE RESTRICT,
  clinic_site_id uuid UNIQUE REFERENCES clinic_sites (id) ON UPDATE CASCADE ON DELETE SET NULL,
  form_definition_id text NOT NULL DEFAULT 'findadoc-intake-v1',
  allowed_durations integer[] NOT NULL DEFAULT '{15,30,45,60}',
  created_date timestamptz NOT NULL DEFAULT now(),
  updated_date timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT booking_settings_form_id_check
    CHECK (form_definition_id <> ''),
  CONSTRAINT booking_settings_durations_check
    CHECK (
      allowed_durations <@ ARRAY[15, 30, 45, 60]
      AND cardinality(allowed_durations) >= 1
    )
);

ALTER TABLE booking_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE booking_settings FROM PUBLIC, anon, authenticated;

ALTER TABLE booking_submissions
  ADD COLUMN facility_id uuid REFERENCES facilities (id) ON UPDATE CASCADE ON DELETE RESTRICT,
  ADD COLUMN practitioner_id uuid REFERENCES hps (id) ON UPDATE CASCADE ON DELETE SET NULL,
  ADD COLUMN service_key text,
  ALTER COLUMN clinic_site_id DROP NOT NULL;

ALTER TABLE booking_submissions
  DROP CONSTRAINT booking_submissions_clinic_site_id_fkey,
  ADD CONSTRAINT booking_submissions_clinic_site_id_fkey
    FOREIGN KEY (clinic_site_id) REFERENCES clinic_sites (id) ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE booking_submissions
  ADD CONSTRAINT booking_submissions_clinic_check
    CHECK (facility_id IS NOT NULL OR clinic_site_id IS NOT NULL);

ALTER TABLE booking_submissions
  ADD CONSTRAINT booking_submissions_service_key_check
    CHECK (service_key IS NULL OR char_length(service_key) BETWEEN 1 AND 80);

CREATE INDEX booking_submissions_facility_id_idx
  ON booking_submissions (facility_id);

ALTER TABLE booking_uploads
  ADD COLUMN facility_id uuid REFERENCES facilities (id) ON UPDATE CASCADE ON DELETE RESTRICT,
  ALTER COLUMN clinic_site_id DROP NOT NULL;

ALTER TABLE booking_uploads
  DROP CONSTRAINT booking_uploads_clinic_site_id_fkey,
  ADD CONSTRAINT booking_uploads_clinic_site_id_fkey
    FOREIGN KEY (clinic_site_id) REFERENCES clinic_sites (id) ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE clinic_availability_windows
  ADD COLUMN facility_id uuid REFERENCES facilities (id) ON UPDATE CASCADE ON DELETE RESTRICT,
  ALTER COLUMN clinic_site_id DROP NOT NULL;

ALTER TABLE clinic_availability_windows
  DROP CONSTRAINT clinic_availability_windows_clinic_site_id_fkey,
  ADD CONSTRAINT clinic_availability_windows_clinic_site_id_fkey
    FOREIGN KEY (clinic_site_id) REFERENCES clinic_sites (id) ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE clinic_availability_windows
  ADD CONSTRAINT clinic_availability_windows_clinic_check
    CHECK (facility_id IS NOT NULL OR clinic_site_id IS NOT NULL);

CREATE INDEX clinic_availability_windows_facility_range_idx
  ON clinic_availability_windows (facility_id, starts_at, ends_at);

ALTER TABLE booking_appointments
  ADD COLUMN facility_id uuid REFERENCES facilities (id) ON UPDATE CASCADE ON DELETE RESTRICT,
  ADD COLUMN duration_minutes integer NOT NULL DEFAULT 30,
  ALTER COLUMN clinic_site_id DROP NOT NULL;

ALTER TABLE booking_appointments
  DROP CONSTRAINT booking_appointments_clinic_site_id_fkey,
  ADD CONSTRAINT booking_appointments_clinic_site_id_fkey
    FOREIGN KEY (clinic_site_id) REFERENCES clinic_sites (id) ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE booking_appointments
  ADD CONSTRAINT booking_appointments_clinic_check
    CHECK (facility_id IS NOT NULL OR clinic_site_id IS NOT NULL);

ALTER TABLE booking_appointments
  ADD CONSTRAINT booking_appointments_duration_check
    CHECK (duration_minutes IN (15, 30, 45, 60));

CREATE INDEX booking_appointments_facility_range_idx
  ON booking_appointments (facility_id, starts_at, ends_at)
  WHERE status IN ('held', 'confirmed');

UPDATE booking_submissions AS booking
SET facility_id = site.facility_id
FROM clinic_sites AS site
WHERE booking.clinic_site_id = site.id
  AND booking.facility_id IS NULL
  AND site.facility_id IS NOT NULL;

UPDATE booking_uploads AS upload
SET facility_id = site.facility_id
FROM clinic_sites AS site
WHERE upload.clinic_site_id = site.id
  AND upload.facility_id IS NULL
  AND site.facility_id IS NOT NULL;

UPDATE clinic_availability_windows AS avail
SET facility_id = site.facility_id
FROM clinic_sites AS site
WHERE avail.clinic_site_id = site.id
  AND avail.facility_id IS NULL
  AND site.facility_id IS NOT NULL;

UPDATE booking_appointments AS appointment
SET facility_id = site.facility_id,
    duration_minutes = 30
FROM clinic_sites AS site
WHERE appointment.clinic_site_id = site.id
  AND appointment.facility_id IS NULL
  AND site.facility_id IS NOT NULL;

INSERT INTO booking_settings (facility_id, clinic_site_id, form_definition_id, allowed_durations)
SELECT site.facility_id, site.id, 'showcase-intake-v1', ARRAY[15, 30, 45, 60]
FROM clinic_sites AS site
WHERE site.id = 'a303a8ac-31c9-45d8-96d1-cf6630aa11bd'
  AND site.facility_id IS NOT NULL
ON CONFLICT (facility_id) DO NOTHING;

DO $$
DECLARE
  booking_table text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'rds_iam') THEN
    RETURN;
  END IF;

  FOREACH booking_table IN ARRAY ARRAY[
    'booking_settings'
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
