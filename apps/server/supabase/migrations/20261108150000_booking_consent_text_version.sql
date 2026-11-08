-- Booking stores which health-data consent wording the patient agreed to (spec §6).
-- The API stamps CURRENT_CONSENT_TEXT_VERSION from src/booking/consentText.ts on every
-- new request. The frozen wording for each version is in docs/consent-text/.
-- Requests sent before this change stay null. They are not backfilled, because
-- health_data_consented_at already places them under the #173 wording (2026-10-30).

ALTER TABLE booking_submissions
  ADD COLUMN consent_text_version text;

ALTER TABLE booking_submissions
  ADD CONSTRAINT booking_submissions_consent_text_version_format
  CHECK (consent_text_version IS NULL OR consent_text_version ~ '^\d{4}-\d{2}-\d{2}$');
