-- Clinic-authored intake forms (#166).
--
-- A clinic writes its own questions in Dashboard → Settings. One row in
-- booking_form_definitions is one form, owned by one facility. Its id is
-- 'clinic-' plus a uuid, so it never collides with a Find a Doc form id in
-- booking_settings.form_definition_ids.
--
-- Every save that changes the questions adds a booking_form_versions row and
-- moves current_version. A version is never changed or deleted, so a request
-- (booking_submissions.form_definition_id, form_version) still reads with the
-- questions the patient saw.
--
-- fields is the clinic's own questions as a JSON array. The email, phone, and
-- name questions are Find a Doc's and are not stored here.

CREATE TABLE booking_form_definitions (
  id text PRIMARY KEY,
  facility_id uuid NOT NULL REFERENCES facilities (id) ON UPDATE CASCADE ON DELETE CASCADE,
  name text NOT NULL,
  current_version integer NOT NULL DEFAULT 1,
  created_by text,
  created_date timestamptz NOT NULL DEFAULT now(),
  updated_date timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT booking_form_definitions_id_check CHECK (id LIKE 'clinic-%'),
  CONSTRAINT booking_form_definitions_name_check CHECK (char_length(name) BETWEEN 1 AND 80),
  CONSTRAINT booking_form_definitions_version_check CHECK (current_version >= 1)
);

CREATE INDEX booking_form_definitions_facility_idx
  ON booking_form_definitions (facility_id);

CREATE TABLE booking_form_versions (
  form_definition_id text NOT NULL
    REFERENCES booking_form_definitions (id) ON UPDATE CASCADE ON DELETE CASCADE,
  version integer NOT NULL,
  fields jsonb NOT NULL,
  created_by text,
  created_date timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (form_definition_id, version),
  CONSTRAINT booking_form_versions_version_check CHECK (version >= 1),
  CONSTRAINT booking_form_versions_fields_check CHECK (jsonb_typeof(fields) = 'array')
);

ALTER TABLE booking_form_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_form_versions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE booking_form_definitions FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE booking_form_versions FROM PUBLIC, anon, authenticated;

DO $$
DECLARE
  booking_table text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'rds_iam') THEN
    RETURN;
  END IF;

  FOREACH booking_table IN ARRAY ARRAY[
    'booking_form_definitions',
    'booking_form_versions'
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
