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
- `CONFIRMED`: a moderator saved the names.
- `null`: nothing to check.

Saving names in moderation sets `CONFIRMED`. The dashboard's "Needs name review" filter lists the queue.

## Backfill

The #282 backfill ran on production on 2026-11-16 and has been deleted. Every professional now has exactly one romaji and one Japanese name, and names in other locales are gone. The 11 rows whose Japanese name was a generated katakana guess are `NEEDS_REVIEW`. A new professional gets no generated name: the moderator enters both.

Once the queue is empty, a migration adds a `CHECK` that `names` holds exactly the two locales, and the web pages drop their fallback from one name to the other.
