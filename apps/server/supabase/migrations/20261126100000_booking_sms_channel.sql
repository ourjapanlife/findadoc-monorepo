-- Patients may choose SMS instead of email for their booking messages (#206).
--
-- booking_sms: one row per facility that offers SMS. SMS is a paid add-on, so
-- admins turn it on (booking/sms.ts canChangeSms is the one gate; billing hooks
-- in there later). source says who turned it on. It is its own table, not a
-- booking_settings column, for the same reason as booking_interpretation: a
-- booking_settings row opens a clinic to patients (booking/target.ts).
--
-- booking_submissions.contact_channel: how the patient asked to hear back.
-- Every existing request was email, so the default fills them. With sms the
-- request may have no email answer; the phone answer is always required.
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
  ADD COLUMN contact_channel text NOT NULL DEFAULT 'email';

ALTER TABLE booking_submissions
  ADD CONSTRAINT booking_submissions_contact_channel_check
  CHECK (contact_channel IN ('email', 'sms'));

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
