-- Booking ownership, appointment lifecycle, and selectable intake forms.
--
-- clinic_memberships is the booking account link, keyed by the directory
-- facility. A moderator invites an email (an owner may invite staff). The first
-- sign-in whose verified email matches claims the row and stores the Auth0 sub.
-- user_id stays for a later profile link and is no longer required.
--
-- An appointment starts as 'requested' and holds its slot. Staff confirm or
-- decline. The patient (through the private link in the confirmation email) or
-- staff may cancel. Only requested and confirmed appointments occupy time.
--
-- booking_settings.form_definition_ids lists the intake forms a clinic offers.
-- The first id is the default. The definitions stay in code (formDefinitions.ts).

ALTER TABLE clinic_memberships
  ADD COLUMN facility_id uuid REFERENCES facilities (id) ON UPDATE CASCADE ON DELETE CASCADE,
  ADD COLUMN invited_email text,
  ADD COLUMN auth0_sub text,
  ADD COLUMN invited_by text,
  ADD COLUMN claimed_at timestamptz,
  ALTER COLUMN clinic_site_id DROP NOT NULL,
  ALTER COLUMN user_id DROP NOT NULL;

UPDATE clinic_memberships AS membership
SET facility_id = site.facility_id
FROM clinic_sites AS site
WHERE membership.clinic_site_id = site.id
  AND membership.facility_id IS NULL
  AND site.facility_id IS NOT NULL;

ALTER TABLE clinic_memberships
  ADD CONSTRAINT clinic_memberships_target_check
    CHECK (facility_id IS NOT NULL OR clinic_site_id IS NOT NULL);

ALTER TABLE clinic_memberships
  ADD CONSTRAINT clinic_memberships_identity_check
    CHECK (user_id IS NOT NULL OR auth0_sub IS NOT NULL OR invited_email IS NOT NULL);

ALTER TABLE clinic_memberships
  ADD CONSTRAINT clinic_memberships_invited_email_check
    CHECK (
      invited_email IS NULL
      OR (invited_email = lower(invited_email)
        AND invited_email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')
    );

CREATE UNIQUE INDEX clinic_memberships_facility_email_key
  ON clinic_memberships (facility_id, invited_email)
  WHERE facility_id IS NOT NULL AND invited_email IS NOT NULL;

CREATE UNIQUE INDEX clinic_memberships_facility_sub_key
  ON clinic_memberships (facility_id, auth0_sub)
  WHERE facility_id IS NOT NULL AND auth0_sub IS NOT NULL;

CREATE INDEX clinic_memberships_auth0_sub_idx
  ON clinic_memberships (auth0_sub)
  WHERE auth0_sub IS NOT NULL;

CREATE INDEX clinic_memberships_pending_email_idx
  ON clinic_memberships (invited_email)
  WHERE auth0_sub IS NULL AND invited_email IS NOT NULL;

ALTER TABLE booking_appointments
  DROP CONSTRAINT booking_appointments_status_check;

UPDATE booking_appointments SET status = 'requested' WHERE status = 'held';

ALTER TABLE booking_appointments
  ALTER COLUMN status SET DEFAULT 'requested',
  ADD COLUMN status_changed_at timestamptz,
  ADD COLUMN status_changed_by text,
  ADD COLUMN cancelled_by text,
  ADD COLUMN status_reason text;

ALTER TABLE booking_appointments
  ADD CONSTRAINT booking_appointments_status_check
    CHECK (status IN ('requested', 'confirmed', 'declined', 'cancelled', 'completed'));

ALTER TABLE booking_appointments
  ADD CONSTRAINT booking_appointments_cancelled_by_check
    CHECK (cancelled_by IS NULL OR cancelled_by IN ('patient', 'clinic'));

ALTER TABLE booking_appointments
  ADD CONSTRAINT booking_appointments_status_reason_check
    CHECK (status_reason IS NULL OR char_length(status_reason) <= 500);

DROP INDEX IF EXISTS booking_appointments_clinic_range_idx;
DROP INDEX IF EXISTS booking_appointments_facility_range_idx;

CREATE INDEX booking_appointments_clinic_range_idx
  ON booking_appointments (clinic_site_id, starts_at, ends_at)
  WHERE status IN ('requested', 'confirmed');

CREATE INDEX booking_appointments_facility_range_idx
  ON booking_appointments (facility_id, starts_at, ends_at)
  WHERE status IN ('requested', 'confirmed');

-- sha256 hex of the patient's private cancel token. The token itself is only in the email.
ALTER TABLE booking_submissions
  ADD COLUMN cancel_token_hash text UNIQUE;

ALTER TABLE booking_submissions
  ADD CONSTRAINT booking_submissions_cancel_token_hash_check
    CHECK (cancel_token_hash IS NULL OR cancel_token_hash ~ '^[0-9a-f]{64}$');

ALTER TABLE booking_settings
  ADD COLUMN form_definition_ids text[];

UPDATE booking_settings SET form_definition_ids = ARRAY[form_definition_id];

ALTER TABLE booking_settings
  ALTER COLUMN form_definition_ids SET NOT NULL,
  ALTER COLUMN form_definition_ids SET DEFAULT '{findadoc-intake-v1}';

ALTER TABLE booking_settings
  ADD CONSTRAINT booking_settings_form_ids_check
    CHECK (
      cardinality(form_definition_ids) >= 1
      AND array_position(form_definition_ids, '') IS NULL
    );

ALTER TABLE booking_settings
  DROP CONSTRAINT booking_settings_form_id_check,
  DROP COLUMN form_definition_id;
