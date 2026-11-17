-- A professional has exactly two names: romaji (en_US) and Japanese (ja_JP) (#282).
-- The names backfill has run on production and the moderator name queue is empty, so the
-- database now holds the rule the API already validates: one name per locale, a first and a
-- last name on each, and no middle name on the Japanese name.
--
-- A CHECK cannot hold a subquery, so the rule is an IMMUTABLE function. The constraint is added
-- NOT VALID first, so new and edited rows follow it at once, and then validated. A row that breaks
-- the rule fails the validation, and the migration stops before it is recorded.

CREATE FUNCTION public.hp_names_are_two_locales(names jsonb) RETURNS boolean
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN jsonb_typeof(names) <> 'array' OR jsonb_array_length(names) <> 2 THEN false
    ELSE (
      -- A CHECK passes on null, so every step is coalesced to false.
      SELECT count(DISTINCT name ->> 'locale') = 2
        AND coalesce(bool_and(coalesce(
          jsonb_typeof(name) = 'object'
          AND name ->> 'locale' IN ('en_US', 'ja_JP')
          AND coalesce(btrim(name ->> 'firstName'), '') <> ''
          AND coalesce(btrim(name ->> 'lastName'), '') <> ''
          AND (name ->> 'locale' = 'en_US' OR coalesce(btrim(name ->> 'middleName'), '') = ''),
          false
        )), false)
      FROM jsonb_array_elements(names) AS name
    )
  END
$$;

ALTER TABLE public.hps
  ADD CONSTRAINT hps_names_two_locales
  CHECK (public.hp_names_are_two_locales(names)) NOT VALID;

ALTER TABLE public.hps VALIDATE CONSTRAINT hps_names_two_locales;
