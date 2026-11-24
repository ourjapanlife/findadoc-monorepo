-- Professional name search matches every word of the query in any order, and forgives a typo.
-- The API splits the query into words. Each word must appear in search_text, or, for a Latin
-- word, sit within one or two edits of one of its words (levenshtein from fuzzystrmatch).
-- search_text also carries each name run together both ways (YamadaTaro, TaroYamada), so a
-- Japanese name typed with no space (山田太郎) matches in either order.
--
-- fuzzystrmatch goes in public: the API role has USAGE on public and none on extensions.

CREATE EXTENSION IF NOT EXISTS fuzzystrmatch WITH SCHEMA public;

DO $$
BEGIN
    IF (SELECT n.nspname FROM pg_extension e JOIN pg_namespace n ON n.oid = e.extnamespace
        WHERE e.extname = 'fuzzystrmatch') <> 'public' THEN
        ALTER EXTENSION fuzzystrmatch SET SCHEMA public;
    END IF;
END $$;

CREATE OR REPLACE FUNCTION public.hp_search_text(hp_id uuid, names jsonb)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
PARALLEL SAFE
AS $$
DECLARE
  result text := hp_id::text;
  elem jsonb;
  first_name text;
  last_name text;
BEGIN
  IF jsonb_typeof(names) = 'array' THEN
    FOR elem IN SELECT value FROM jsonb_array_elements(names)
    LOOP
      first_name := nullif(btrim(elem->>'firstName'), '');
      last_name := nullif(btrim(elem->>'lastName'), '');
      result := result || ' ' || coalesce(concat_ws(' ',
        first_name,
        nullif(btrim(elem->>'middleName'), ''),
        last_name
      ), '');
      IF first_name IS NOT NULL AND last_name IS NOT NULL THEN
        result := result || ' ' || replace(last_name || first_name, ' ', '')
          || ' ' || replace(first_name || last_name, ' ', '');
      END IF;
    END LOOP;
  END IF;
  RETURN result;
END;
$$;

-- Recompute the stored column with the new function.
ALTER TABLE public.hps
  ALTER COLUMN search_text SET EXPRESSION AS (public.hp_search_text(id, names));
