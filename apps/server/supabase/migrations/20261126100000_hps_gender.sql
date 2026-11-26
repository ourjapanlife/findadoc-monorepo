-- A professional's gender, so patients can choose a doctor's gender (#224).
-- MALE and FEMALE come from a source. UNSPECIFIED means the professional or clinic chose not to say.
-- UNKNOWN means nobody has checked yet. The default fills every existing row with UNKNOWN,
-- so no backfill script is needed. Nobody guesses a gender from a name or a photo.

ALTER TABLE public.hps
  ADD COLUMN gender text NOT NULL DEFAULT 'UNKNOWN';

ALTER TABLE public.hps
  ADD CONSTRAINT hps_gender_check
  CHECK (gender IN ('MALE', 'FEMALE', 'UNSPECIFIED', 'UNKNOWN'));

COMMENT ON COLUMN public.hps.gender IS
  'MALE or FEMALE from a source, UNSPECIFIED when the professional or clinic chose not to say, UNKNOWN until a moderator checks (#224).';
