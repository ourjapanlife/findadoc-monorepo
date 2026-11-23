# Multilingual institutions import

Issue [#21](https://github.com/ourjapanlife/findadoc-monorepo/issues/21). The source is the Ministry of Health list of medical institutions that accept foreign patients (外国人患者を受け入れる医療機関リスト): one sheet per prefecture, 2,453 rows. Volunteers marked each row with a fill colour.

The import ran on production on November 16, 2026. Its scripts (`exportInstitutionList.py`, `checkInstitutionList.py`, `importInstitutionList.ts`) were deleted afterwards. This page records what they did, so the rows in `institution_import_rows` can be read.

| Colour | Meaning | What the import did |
| --- | --- | --- |
| Green | Already in the directory | Matched the facility and filled only its empty fields |
| Red | Reviewed and not added | Staged the row and skipped it, even when it matched |
| Yellow | Reviewed, not decided | Same as an unmarked row |
| None | Not reviewed | Matched a facility, or created a new `UNVERIFIED` one |

## Result

| Outcome | Rows |
| --- | --- |
| `created` | 1,249 (1,246 with a city, 3 `UNVERIFIED_LOCATION`) |
| `matched` | 317 |
| `needs_review` | 258 |
| `skipped` | 629 |

Matches were by Places id (414), Japanese name with postal code (33), and a phone number only one facility had (9). Fills were 451 `supported_languages` and 24 websites. Review reasons were `conflicts_with_confirmed` (134), `several_places_found` (116), and `green_row_not_in_directory` (8).

## Rules the import followed

- Every row was staged in `institution_import_rows` with its raw columns (keyed by header text), the source file, the sheet, and the row number, whatever happened to it.
- Matching ran in this order: Places id, then the Japanese name with the postal code, then a phone number that only one facility had. A key that two facilities shared was not a match.
- A match filled empty fields only: phone, website, postal code, and `supported_languages`. A value that differed from a `CONFIRMED` facility's sent the row to `needs_review`. Nothing was overwritten.
- A new facility is `UNVERIFIED`, or `UNVERIFIED_LOCATION` when the address does not name one municipality. Its source is `MHLW_MULTILINGUAL_INSTITUTIONS`.
- A new facility has exactly one Places id from an id-only Text Search (field mask `places.id`). No id, two ids, or an id an earlier row already took went to `needs_review`. Only the id is stored, and the Maps URL is built from it (`docs/places-storage.md`).
- The city comes from the Japanese address (`docs/city-rules.md`). The English address only counted when it named a different municipality with a suffix; then the city stayed unresolved.
- Languages come from the departments column (`対応診療科と対応外国語`) as facility-level languages (#19), plus Japanese. Codes off the published list were dropped and noted. No healthcare professional was created.
- Payment, insurance, opening hours, JMIP, JIH, and the interpreter columns were not written. They stay in `raw`. A moderator fills payment and insurance from the clinic (#20, #18). JMIP, JIH, and institution type are #23.
- An `http` website was stored as `https`, and the row notes `website_upgraded_to_https`.

## Evidence

Before the import, each row was checked against public sources, and `institution_import_rows.evidence` holds what was found.

| Source | Check |
| --- | --- |
| Ministry open data (医療情報ネット, e-Gov, CC BY, December 1, 2025) | Is the institution listed, by name and address in the prefecture? A match gives the municipality. |
| Japan Post (`utf_ken_all.csv`, `jigyosyo.csv`) | Does the postal code belong to the address, or is it the institution's own business code? |
| The website, fetched once | Does https work, and does the page name the clinic or its phone? Only a working https link was stored. |

Nothing from these sources replaced the name, address, or phone from the sheet.

The list is public institution data (names, addresses, clinic phone numbers, websites). It holds no patient or personal data. The staging table is open to the `db:prod` roles like the directory tables.

## Map pins

The import stored only a Places id, so the 1,249 facilities it created had no latitude or longitude. The API refuses an in-person facility without a pin, but the import wrote to the table directly, and the search map drew every one of them in central Tokyo. `20261122090000_facility_pin_required.sql` adds `facilities_pin_required` as `NOT VALID`: every new row and every update needs a pin now. A later migration validates it once no row is left without one.

`utils/backfillFacilityPins.ts` fills the pins from the ministry's own coordinates: the 医療情報ネット open data facility CSVs (病院・診療所・歯科診療所の施設票) from https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/kenkou_iryou/iryou/newpage_43373.html, used under 公共データ利用規約 (PDL1.0). Places coordinates are not used, because they may be kept for 30 days at most (`docs/places-storage.md`).

| Match | What the script does |
| --- | --- |
| Same Japanese name in the same municipality, and the same street address, every number alike | Fills the pin |
| The name or the street address agrees, not both | Fills it when the facility is approved in the verification CSV (`--approved`, `check_map_pin_place` = ok), or with `--geocode` when the facility's street address lands within 150 m of the ministry pin |
| A ministry row with 0,0 coordinates, or no match | With `--geocode`, fills the pin from the street address when the lookup finds the block (番 or 号). Otherwise leaves it for a moderator |

`--geocode` looks up each facility's Japanese street address, cut before the building, in the Geospatial Information Authority's address search (国土地理院, `msearch.gsi.go.jp`), one call every 250 ms. It sends only the clinic's public address. A lot number (番地) counts as the block, since rural addresses without 住居表示 stop there. An address found only to the town or 丁目 is never used, and a street address that disagrees with a one-sided ministry pin is left for a person to decide. Facility pages credit GSI next to the ministry (`facility-pin-credit`), and only for imported facilities, so the script reads only rows with `source = MHLW_MULTILINGUAL_INSTITUTIONS`.

Unzip the three CSVs, then dry-run, read the counts, and write (see `.claude/skills/production-database/SKILL.md`):

```bash
pnpm db:prod node --loader ts-node/esm utils/backfillFacilityPins.ts --csv hospital.csv --csv clinic.csv --csv dental.csv --approved verification.csv --geocode
pnpm db:prod --role operator node --loader ts-node/esm utils/backfillFacilityPins.ts --csv hospital.csv --csv clinic.csv --csv dental.csv --approved verification.csv --geocode --write --confirm-production
```

Checked against the 470 facilities that already had a pin, a name-and-address match lands a median of 28 m away, and 4 of 113 more than 1 km away. Facility pages credit the ministry for imported facilities (`facility-source-credit`), with a link to each source page and a note that Find a Doc edited the data.

## Review

Rows with outcome `needs_review` stay in the staging table for a moderator. Keep the table and its rows as the record of where each facility came from. A new edition of the list is a new import, written again with `apps/server/utils/scriptDatabase.ts`.
