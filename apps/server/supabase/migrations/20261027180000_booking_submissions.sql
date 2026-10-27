-- Patient booking intake for hosted clinics.
--
-- clinic_sites.id is the CRM attach point. A form definition is not a row yet:
-- the API serves a code-defined form keyed by clinic site, so a later CRM can
-- swap the loader without changing this table shape.
--
-- Uploads live under uploads/booking/* in S3 (or the local API store when
-- STORAGE_BACKEND is not s3). This table only stores the object key.

CREATE TABLE booking_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_site_id uuid NOT NULL REFERENCES clinic_sites (id) ON UPDATE CASCADE ON DELETE CASCADE,
  form_definition_id text NOT NULL,
  form_version integer NOT NULL,
  locale text NOT NULL,
  answers jsonb NOT NULL,
  status text NOT NULL DEFAULT 'received',
  notify_email_sent_at timestamptz,
  created_date timestamptz NOT NULL DEFAULT now(),
  updated_date timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT booking_submissions_form_version_check CHECK (form_version >= 1),
  CONSTRAINT booking_submissions_answers_object
    CHECK (jsonb_typeof(answers) = 'object'),
  CONSTRAINT booking_submissions_status_check
    CHECK (status IN ('received', 'notified', 'failed_notify')),
  CONSTRAINT booking_submissions_locale_check
    CHECK (locale IN (
      'en-US', 'ja-JP', 'zh-CN', 'vi-VN', 'ko-KR', 'tl-PH',
      'pt-BR', 'fr-FR', 'ru-RU', 'de-DE', 'it-IT'
    ))
);

CREATE INDEX booking_submissions_clinic_site_id_idx
  ON booking_submissions (clinic_site_id);

CREATE INDEX booking_submissions_created_date_idx
  ON booking_submissions (created_date DESC);

CREATE TABLE booking_uploads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_site_id uuid NOT NULL REFERENCES clinic_sites (id) ON UPDATE CASCADE ON DELETE CASCADE,
  booking_submission_id uuid REFERENCES booking_submissions (id) ON UPDATE CASCADE ON DELETE SET NULL,
  field_id text NOT NULL,
  object_key text NOT NULL,
  content_type text NOT NULL,
  file_name text NOT NULL,
  byte_size integer,
  created_date timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT booking_uploads_object_key_check
    CHECK (object_key ~ '^uploads/booking/'),
  CONSTRAINT booking_uploads_byte_size_check
    CHECK (byte_size IS NULL OR byte_size >= 0)
);

CREATE INDEX booking_uploads_clinic_site_id_idx
  ON booking_uploads (clinic_site_id);

CREATE INDEX booking_uploads_submission_id_idx
  ON booking_uploads (booking_submission_id);

ALTER TABLE booking_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_uploads ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE booking_submissions FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE booking_uploads FROM PUBLIC, anon, authenticated;

-- Same findadoc_api policy pattern as other RLS tables on RDS.
DO $$
DECLARE
  booking_table text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'rds_iam') THEN
    RETURN;
  END IF;

  FOREACH booking_table IN ARRAY ARRAY[
    'booking_submissions',
    'booking_uploads'
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
