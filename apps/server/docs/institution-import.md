# Multilingual institutions import

Issue [#21](https://github.com/ourjapanlife/findadoc-monorepo/issues/21). The source is the Ministry of Health list of medical institutions that accept foreign patients (外国人患者を受け入れる医療機関リスト): one sheet per prefecture, about 2,450 rows. Volunteers marked each row with a fill colour.

| Colour | Meaning | What the import does |
| --- | --- | --- |
| Green | Already in the directory | Matches the facility and fills only its empty fields |
| Red | Reviewed and not added | Stages the row and skips it, even when it matches |
| Yellow | Reviewed, not decided | Same as an unmarked row |
| None | Not reviewed | Matches a facility, or creates a new `UNVERIFIED` one |

Each prefecture used its own shade of green, red, and yellow. `utils/exportInstitutionList.py` lists them all.

## Rules

- Every row is staged in `institution_import_rows` with its raw columns (keyed by header text), the source file, the sheet, and the row number, whatever happens to it.
- Matching runs in this order: Places id, the place in a stored Maps URL, then the Japanese name with the postal code, then a phone number that only one facility has. A key that two facilities share is not a match. The sheet has no place id or Maps URL, so the first two steps use the id that the Places lookup finds.
- A match fills empty fields only: phone, website, postal code, and `supported_languages`. A value that differs from a `CONFIRMED` facility's sends the row to `needs_review`. Nothing is overwritten.
- A new facility is `UNVERIFIED`, or `UNVERIFIED_LOCATION` when the address does not name one municipality. Its source is `MHLW_MULTILINGUAL_INSTITUTIONS`.
- A new facility needs exactly one Places id from an id-only Text Search (field mask `places.id`). No id, two ids, or an id that an earlier row already took goes to `needs_review`. Only the id is stored, and the Maps URL is built from it (`docs/places-storage.md`).
- The city comes from the Japanese address (`docs/city-rules.md`). The English address only counts when it names a different municipality with a suffix (`Chiyoda-ku`, `Hanamaki-shi`); then the city stays unresolved.
- Languages come from the departments column (`対応診療科と対応外国語`) as facility-level languages (#19), plus Japanese. Codes off the published list are dropped and noted. No healthcare professional is created.
- Payment, insurance, opening hours, JMIP, JIH, and the interpreter columns are not written. They stay in `raw`. A moderator fills payment and insurance from the clinic (#20, #18). JMIP, JIH, and institution type are #23.
- An `http` website is stored as `https`, because a stored link must be `https`. The row notes `website_upgraded_to_https`.
- A run-together English name such as `IdeEyeHospital` gets spaces, and the row notes it.
- A row an earlier write already matched or created is left alone, so the import can run again after the Places step or after a fix.

The list is public institution data (names, addresses, clinic phone numbers, websites). It holds no patient or personal data. The staging table is open to the `db:prod` roles like the directory tables.

## Run

1. Download the workbook as `.xlsx` and export it. Only the Python standard library is used.

    ```bash
    python3 utils/exportInstitutionList.py ~/Downloads/list.xlsx /tmp/institutions.json
    ```

2. Dry-run. `--places` looks up ids and needs `GOOGLE_API_KEY`; `--place-cache` keeps them for the next run; `--report` writes one line per row.

    ```bash
    node --loader ts-node/esm utils/importInstitutionList.ts --input /tmp/institutions.json --places \
      --place-cache /tmp/institution-place-ids.json --report /tmp/institution-report.json
    ```

    On production, run it through `pnpm db:prod --places-key` (see `apps/docs/docs/development/production-database.md`).

3. Read the counts by colour and outcome, the match methods, the fills, the review reasons, and the warnings. Check a few rows in the report.

4. Write. A production write also needs `--confirm-production` and the operator role.

    ```bash
    node --loader ts-node/esm utils/importInstitutionList.ts --input /tmp/institutions.json \
      --place-cache /tmp/institution-place-ids.json --write
    ```

5. Dry-run again. `alreadyImported` should be every matched and created row.

Rows in `needs_review` stay in the staging table for a moderator. Delete the scripts once the import has run on production; keep the table and its rows as the record of where each facility came from.
