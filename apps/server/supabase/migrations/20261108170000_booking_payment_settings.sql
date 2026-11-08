-- Clinic payment settings for the pending-payment email (online consult v2 spec §3.3, §3.4).
--
-- One row per facility, kept apart from booking_settings so the durations form never
-- overwrites payment fields, and so bank details sit in their own table with their own grants.
-- Card payment is either one fixed https link or a link the staff send by hand. Bank transfer
-- is five fields (bank, branch, account type 普通 or 当座, account number, holder) shown to the
-- patient as a fixed Japanese block in every language. PayPay is a QR image the clinic uploads
-- under uploads/clinic/{facility_id}/paypay/. The fee is whole yen, or null when the
-- clinic does not name one in the email.
--
-- This is clinic data, not patient data, so the patient purge does not apply. The facility
-- delete path removes the row. Like every new table, it is closed to the db:prod roles
-- (findadoc_readonly, findadoc_operator) until a migration grants it; only findadoc_api reads it.

CREATE TABLE booking_payment_settings (
  facility_id uuid PRIMARY KEY REFERENCES facilities (id) ON UPDATE CASCADE ON DELETE RESTRICT,
  card_mode text NOT NULL DEFAULT 'sent_by_staff',
  card_url text,
  bank_name text,
  bank_branch text,
  bank_account_type text,
  bank_account_number text,
  bank_account_holder text,
  paypay_qr_object_key text,
  fee_jpy integer,
  created_date timestamptz NOT NULL DEFAULT now(),
  updated_date timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT booking_payment_settings_card_mode_check
    CHECK (card_mode IN ('fixed_link', 'sent_by_staff')),
  CONSTRAINT booking_payment_settings_card_url_check
    CHECK (card_url IS NULL OR (card_url LIKE 'https://%' AND char_length(card_url) <= 2048)),
  CONSTRAINT booking_payment_settings_fixed_link_check
    CHECK (card_mode <> 'fixed_link' OR card_url IS NOT NULL),
  CONSTRAINT booking_payment_settings_bank_lengths_check
    CHECK (
      (bank_name IS NULL OR char_length(bank_name) BETWEEN 1 AND 100)
      AND (bank_branch IS NULL OR char_length(bank_branch) BETWEEN 1 AND 100)
      AND (bank_account_holder IS NULL OR char_length(bank_account_holder) BETWEEN 1 AND 100)
    ),
  CONSTRAINT booking_payment_settings_account_type_check
    CHECK (bank_account_type IS NULL OR bank_account_type IN ('ordinary', 'checking')),
  CONSTRAINT booking_payment_settings_account_number_check
    CHECK (bank_account_number IS NULL OR bank_account_number ~ '^[0-9]{1,8}$'),
  CONSTRAINT booking_payment_settings_qr_key_check
    CHECK (
      paypay_qr_object_key IS NULL
      OR paypay_qr_object_key LIKE 'uploads/clinic/' || facility_id::text || '/paypay/%'
    ),
  CONSTRAINT booking_payment_settings_fee_check
    CHECK (fee_jpy IS NULL OR fee_jpy >= 0)
);

ALTER TABLE booking_payment_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE booking_payment_settings FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON TABLE booking_payment_settings FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON TABLE booking_payment_settings FROM authenticated;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'rds_iam') THEN
    RETURN;
  END IF;

  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.booking_payment_settings TO findadoc_api;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'booking_payment_settings'
      AND policyname = 'findadoc_api_all'
  ) THEN
    CREATE POLICY findadoc_api_all ON public.booking_payment_settings
      FOR ALL TO findadoc_api USING (true) WITH CHECK (true);
  END IF;
END $$;
