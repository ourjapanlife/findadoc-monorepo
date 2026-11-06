-- Same-reading towns and villages take their kind, not the national code (#228).
-- Tokyo's city filter listed "Toshima 133621" next to Toshima. docs/city-rules.md
-- now puts Town (町) or Village (村) before the code. 枝幸町 keeps Esashi 015148
-- because 江差町 (Esashi) is also a town. Rows are matched on lg_code.
UPDATE cities
SET name_en = renamed.name_en, slug = renamed.slug
FROM (VALUES
  ('016616', 'Kushiro Town', 'kushiro-town'),
  ('016934', 'Shibetsu Town', 'shibetsu-town'),
  ('133621', 'Toshima Village', 'toshima-village'),
  ('204251', 'Kiso Village', 'kiso-village'),
  ('393631', 'Tosa Town', 'tosa-town')
) AS renamed(lg_code, name_en, slug)
WHERE cities.lg_code = renamed.lg_code;
