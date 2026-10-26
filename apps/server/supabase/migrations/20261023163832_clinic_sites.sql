-- A clinic that hosts a page on Find a Doc.
--
-- clinic_sites.id is the id an account and a future CRM (appointments, patients,
-- messages) attach to. facility_id is the directory listing. The showcase seed
-- sets it. This migration does not insert a facility and does not invent an address.
--
-- clinic_memberships is the account link. It is empty until a user is invited.
-- The public page does not read it.
--
-- Spoken languages and doctors are rows because a later CRM selects them.
-- Translated page copy is one jsonb document per site locale.

CREATE TABLE clinic_sites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id uuid UNIQUE REFERENCES facilities (id) ON UPDATE CASCADE ON DELETE SET NULL,
  slug text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'draft',
  share_image_path text NOT NULL,
  hero_path text NOT NULL,
  created_date timestamptz NOT NULL DEFAULT now(),
  updated_date timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT clinic_sites_status_check
    CHECK (status IN ('draft', 'preview', 'published')),
  CONSTRAINT clinic_sites_slug_check
    CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  CONSTRAINT clinic_sites_share_image_path_check
    CHECK (share_image_path ~ '^/[^[:space:]]+$'),
  CONSTRAINT clinic_sites_hero_path_check
    CHECK (hero_path ~ '^/[^[:space:]]+$')
);

CREATE INDEX clinic_sites_status_idx ON clinic_sites (status);

CREATE TABLE clinic_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_site_id uuid NOT NULL REFERENCES clinic_sites (id) ON UPDATE CASCADE ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES "user" (id) ON UPDATE CASCADE ON DELETE CASCADE,
  role text NOT NULL,
  created_date timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT clinic_memberships_role_check
    CHECK (role IN ('owner', 'staff')),
  CONSTRAINT clinic_memberships_site_user_key UNIQUE (clinic_site_id, user_id)
);

CREATE INDEX clinic_memberships_user_id_idx ON clinic_memberships (user_id);

CREATE TABLE clinic_site_languages (
  clinic_site_id uuid NOT NULL REFERENCES clinic_sites (id) ON UPDATE CASCADE ON DELETE CASCADE,
  sort_order integer NOT NULL,
  code text NOT NULL,
  native_name text NOT NULL,
  bcp47 text NOT NULL,
  PRIMARY KEY (clinic_site_id, code),
  CONSTRAINT clinic_site_languages_sort_key UNIQUE (clinic_site_id, sort_order),
  CONSTRAINT clinic_site_languages_sort_order_check CHECK (sort_order >= 0),
  CONSTRAINT clinic_site_languages_code_check CHECK (code ~ '^[a-z]{2,3}$'),
  CONSTRAINT clinic_site_languages_bcp47_check CHECK (bcp47 ~ '^[a-zA-Z0-9-]+$')
);

CREATE TABLE clinic_site_doctors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_site_id uuid NOT NULL REFERENCES clinic_sites (id) ON UPDATE CASCADE ON DELETE CASCADE,
  sort_order integer NOT NULL,
  name_ja text NOT NULL,
  name_en text NOT NULL,
  image_path text NOT NULL,
  object_position text NOT NULL DEFAULT 'center',
  hp_id uuid REFERENCES hps (id) ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT clinic_site_doctors_sort_key UNIQUE (clinic_site_id, sort_order),
  CONSTRAINT clinic_site_doctors_sort_order_check CHECK (sort_order >= 0),
  CONSTRAINT clinic_site_doctors_image_path_check CHECK (image_path ~ '^/[^[:space:]]+$')
);

CREATE INDEX clinic_site_doctors_hp_id_idx ON clinic_site_doctors (hp_id);

CREATE TABLE clinic_site_locales (
  clinic_site_id uuid NOT NULL REFERENCES clinic_sites (id) ON UPDATE CASCADE ON DELETE CASCADE,
  locale text NOT NULL,
  name text NOT NULL,
  description text NOT NULL,
  document jsonb NOT NULL,
  PRIMARY KEY (clinic_site_id, locale),
  CONSTRAINT clinic_site_locales_document_object
    CHECK (jsonb_typeof(document) = 'object'),
  CONSTRAINT clinic_site_locales_locale_check
    CHECK (locale IN (
      'en-US', 'ja-JP', 'zh-CN', 'vi-VN', 'ko-KR', 'tl-PH',
      'pt-BR', 'fr-FR', 'ru-RU', 'de-DE', 'it-IT'
    ))
);

ALTER TABLE clinic_sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinic_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinic_site_languages ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinic_site_doctors ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinic_site_locales ENABLE ROW LEVEL SECURITY;

-- The GraphQL server connects as the database owner and bypasses RLS.
-- The Data API roles get nothing: memberships are not a public table.
REVOKE ALL ON TABLE clinic_sites FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE clinic_memberships FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE clinic_site_languages FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE clinic_site_doctors FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE clinic_site_locales FROM PUBLIC, anon, authenticated;

GRANT ALL ON TABLE clinic_sites TO service_role;
GRANT ALL ON TABLE clinic_memberships TO service_role;
GRANT ALL ON TABLE clinic_site_languages TO service_role;
GRANT ALL ON TABLE clinic_site_doctors TO service_role;
GRANT ALL ON TABLE clinic_site_locales TO service_role;
