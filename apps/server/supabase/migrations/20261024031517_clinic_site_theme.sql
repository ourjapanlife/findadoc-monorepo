-- One brand color for a hosted clinic. The page turns it into the theme primary
-- (and a darker or lighter partner) so the header, buttons, and links stay on
-- the same tokens as the rest of the site. Empty object means the Find a Doc primary.

ALTER TABLE clinic_sites
  ADD COLUMN theme jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE clinic_sites
  ADD CONSTRAINT clinic_sites_theme_object
    CHECK (jsonb_typeof(theme) = 'object');
