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

The import stored only a Places id, so the 1,249 facilities it created had no latitude or longitude, and the search map drew every one of them in central Tokyo. `20261122090000_facility_pin_required.sql` added `facilities_pin_required` as `NOT VALID`, and `20261123120000_validate_facility_pin_required.sql` validates it: every in-person facility has a usable pin, in the database as well as the API.

The pins backfill has run on production (#306, #308, #309, #310), and its script is deleted. Do not bring it back to re-run it. It wrote only empty pins, from these sources, and never Places coordinates, which may be kept for 30 days at most (`docs/places-storage.md`):

| Source | Facilities | Rule |
| --- | --- | --- |
| Ministry of Health open data (医療情報ネット, 2026-06-01 施設票, 公共データ利用規約 PDL1.0) | 566 | Same Japanese name in the same municipality and the same street address |
| Ministry pin, confirmed by the street address | 293 | Name or street agreed, and GSI's address search (国土地理院) put the facility's own street within 150 m of the ministry pin |
| GSI street address, block or lot (番, 番地, 号) | 274 | No ministry row, or a ministry row at 0,0 |
| Best guess | 116 | 47 block-level street addresses that disagreed with the ministry pin, 35 ministry pins the address could not confirm, 33 丁目 or town centers, 1 city center |

The 116 best guesses may be off, the town and city centers most of all. Their ids were kept outside the repository for a moderator to check on the edit form. Checked against the 470 facilities that already had a pin, a name-and-address ministry match landed a median of 28 m away.

Imported facilities credit both sources: the ministry (`facility-source-credit`), with a link to each source page and a note that Find a Doc edited the data, and GSI's address search (`facility-pin-credit`).

## Review

Rows with outcome `needs_review` stay in the staging table for a moderator. Keep the table and its rows as the record of where each facility came from. A new edition of the list is a new import, written again with `apps/server/utils/scriptDatabase.ts`.
