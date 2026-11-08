-- Clinic branding for the booking pages and the clinic dashboard (online consult v2 spec §4).
--
-- Branding lives in the existing clinic_sites.theme jsonb, next to primary:
--   displayName  text the logo alt and the header fall back to (default: the clinic name)
--   wordmark     {"ja": ..., "en": ...}; Japanese pages show ja, every other locale shows en
--   logoPath     a static same-origin path, like hero_path. There is no logo upload yet.
-- Every key is optional, so no other row changes. The API ignores a value of the wrong shape.
--
-- The showcase clinic gets its bilingual wordmark. The theme is written whole so it matches
-- clinicSiteSeeds in scripts/seed/clinicSiteContent.ts (migrations.test.ts checks this).
-- The checks reject a logo path that could load from another origin (//host) and a wordmark
-- that is not an object.

UPDATE clinic_sites
SET
    theme = $showcase${"primary":"#177A80","wordmark":{"ja":"多言語オンラインクリニック","en":"Multilingual Online Clinic"}}$showcase$::jsonb,
    updated_date = now()
WHERE id = 'a303a8ac-31c9-45d8-96d1-cf6630aa11bd'::uuid;

ALTER TABLE clinic_sites
  ADD CONSTRAINT clinic_sites_theme_logo_path
    CHECK (
      NOT (theme ? 'logoPath')
      OR (
        jsonb_typeof(theme -> 'logoPath') = 'string'
        AND (theme ->> 'logoPath') ~ '^/[^/\\[:space:]][^\\[:space:]]*$'
      )
    ),
  ADD CONSTRAINT clinic_sites_theme_wordmark
    CHECK (NOT (theme ? 'wordmark') OR jsonb_typeof(theme -> 'wordmark') = 'object');
