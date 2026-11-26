-- Patients may ask for SMS as well as email for their booking messages (#206).
--
-- booking_sms: one row per facility that offers SMS. SMS is a paid add-on, so
-- admins turn it on (booking/sms.ts canChangeSms is the one gate; billing hooks
-- in there later). source says who turned it on. It is its own table, not a
-- booking_settings column, for the same reason as booking_interpretation: a
-- booking_settings row opens a clinic to patients (booking/target.ts).
--
-- booking_submissions.sms_opt_in: the patient asked for SMS too. Messages go
-- to every channel the patient gave. With sms_opt_in the email answer may be
-- empty, for a patient with no email; the phone answer is always required.
-- Every existing request was email only, so the default fills them.
--
-- No clinic gets SMS here. The pilot is turned on once messages are actually sent.

CREATE TABLE booking_sms (
  facility_id uuid PRIMARY KEY REFERENCES facilities (id) ON UPDATE CASCADE ON DELETE CASCADE,
  source text NOT NULL,
  created_date timestamptz NOT NULL DEFAULT now(),
  updated_date timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT booking_sms_source_check
    CHECK (source IN ('pilot', 'admin'))
);

ALTER TABLE booking_sms ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE booking_sms FROM PUBLIC, anon, authenticated;

ALTER TABLE booking_submissions
  ADD COLUMN sms_opt_in boolean NOT NULL DEFAULT false;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'rds_iam') THEN
    RETURN;
  END IF;

  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.booking_sms TO findadoc_api;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'booking_sms'
      AND policyname = 'findadoc_api_all'
  ) THEN
    CREATE POLICY findadoc_api_all ON public.booking_sms FOR ALL TO findadoc_api USING (true) WITH CHECK (true);
  END IF;
END $$;
