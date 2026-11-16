# Professional names

A healthcare professional has exactly two names (#282):

- `en_US`: the romaji name, in Latin letters. First and last name are required. A middle name is allowed.
- `ja_JP`: the Japanese name. A Japanese doctor's name is in kanji or kana. A doctor whose name is not Japanese is written in katakana. First and last name are required. There is no middle name.

There are no other locales. A name in another language can be machine-translated, or it is on the clinic's own site.

## Where the rule is checked

- `validateNames` in `src/validation/validationHealthcareProfessional.ts`. Creating or updating a professional needs both names. A submission draft may hold one of the two, because the submitter types one free-text name and a moderator adds the other. Approving the submission needs both.
- Error codes: `NAME_LOCALE_REQUIRED`, `NAME_LOCALE_NOT_ALLOWED`, `MIDDLE_NAME_NOT_ALLOWED`.
- The moderation editor (`ModProfessionalNamesEditor.vue`) shows two fixed rows and offers no other locale.

## Name review

`hps.name_review` is the moderator queue, like `license_review`:

- `NEEDS_REVIEW`: the backfill generated one of the names, could not fill it, or moved a Japanese middle name into the first name.
- `CONFIRMED`: a moderator saved the names. The backfill does not touch the row again.
- `null`: nothing to check.

Saving names in moderation sets `CONFIRMED`. The dashboard's "Needs name review" filter lists the queue.

## Backfill

`pnpm --filter @findadoc/server backfill:professional-names` is a dry run. It reports counts and ids, never a name. `backfill:professional-names:write` applies it. Run it on production through `pnpm db:prod` (`.claude/skills/production-database/SKILL.md`).

For each row that is not `CONFIRMED` (`src/names/professionalNames.ts`):

- Names in other locales are removed.
- A missing romaji name is generated from a kana name with passport-style Hepburn (Satō is Sato).
- A missing Japanese name is a best-guess katakana spelling of the romaji name.
- A name in kanji has no reading without a dictionary. No romaji is guessed: the row is queued with its one name.
- A row with neither name keeps what it has and is queued.

The web pages still fall back from one name to the other while the queue has rows with one name. After the backfill has run on production and the queue is empty, a migration adds a `CHECK` that `names` holds exactly the two locales, the fallbacks go, and the backfill script is deleted.
