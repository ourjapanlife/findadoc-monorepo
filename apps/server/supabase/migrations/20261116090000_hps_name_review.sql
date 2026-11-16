-- A professional has two names: romaji (en_US) and Japanese script (ja_JP) (#282).
-- name_review is the moderator queue for names the backfill generated or could not fill.
-- The CHECK that names hold exactly those two locales comes in a later migration,
-- after the backfill has run on production and the queue is empty.

ALTER TABLE public.hps
  ADD COLUMN name_review text;

ALTER TABLE public.hps
  ADD CONSTRAINT hps_name_review_check
  CHECK (name_review IS NULL OR name_review IN ('NEEDS_REVIEW', 'CONFIRMED'));

CREATE INDEX hps_name_review_needs_review_idx
  ON public.hps (name_review)
  WHERE name_review = 'NEEDS_REVIEW';

COMMENT ON COLUMN public.hps.name_review IS
  'NEEDS_REVIEW when the romaji or Japanese name was generated or is missing (#282). CONFIRMED once a moderator saved both.';
