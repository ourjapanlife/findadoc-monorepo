# Clinic corrections

A visitor can report an error on a published clinic page (#22). The report is a row in
`submissions` with `kind = 'correction'` and `facilities_id` set to that clinic. Every other
submission is `kind = 'listing'`.

## What the visitor sends

`submitFacilityCorrection` takes the facility id, at least one reason, and only the fields the
visitor changed. Each field belongs to one reason, and the API refuses a field sent without it
(`CORRECTION_FIELD_WITHOUT_REASON`):

| Reason | Field |
| --- | --- |
| `WRONG_CITY` | `address` |
| `WRONG_CONTACT` | `phone`, `website` |
| `WRONG_LANGUAGES` | `supportedLanguages` (the facility list only, never a professional) |
| `WRONG_PAYMENT` | `paymentOptions` |
| `DUPLICATE` | `duplicateListingUrl` (`https://findadoc.jp` or `https://www.findadoc.jp`) |
| `CLOSED`, `OTHER` | none |

Optional: `notes` (up to `FIELD_LIMITS.correctionNotes` characters, from `@findadoc/utils`) and `reporterRelation` (`PATIENT`, `STAFF`, `CALLED`,
`WEBSITE`). There is no name, email, or phone of the visitor. Lengths come from `FIELD_LIMITS`,
the same numbers the form uses. Payment options follow the controlled list in
`@findadoc/utils` (`paymentOptionsProblem`). The facility must be published: a city, and not
`UNVERIFIED_LOCATION`. The check reads the row `FOR SHARE` in the insert's transaction.

The changed fields go in `correction_changes`, not `facility_partial`. Listing approval and the
moderation edit form read `facility_partial` as a whole new facility.

The mutation needs `create:submissions`, which signed-out visitors hold, and has its own budget
of 5 calls an hour per address (`booking/rateLimits.ts`). The answer is `isSuccessful` only, with
no id.

## Moderation

- `updateSubmission` refuses listing fields on a correction (`SUBMISSION_KIND_MISMATCH`). It
  refuses `notes` too, including `null`: the note is the visitor's text.
- A `WRONG_CITY` report needs a city from the vocabulary before approval. The moderator sends it
  as `correctionCityId`. Approval without it is `CORRECTION_CITY_REQUIRED`. A visitor never sets
  the city, and free text is never a city (`city-rules.md`).
- Approval writes only the keys in `correction_changes`, through `updateFacilityInTransaction`,
  in the same transaction as the status change. The city rules and the facility audit trail apply.
- `CLOSED` and `DUPLICATE` change nothing on approval. Unpublishing or merging is a separate action.
- A correction that changes fields is refused when the facility is no longer published
  (`FACILITY_NOT_PUBLISHED`). One that changes nothing, such as `CLOSED`, is still approved, so a
  moderator can unpublish the clinic first.
- A status change is a compare-and-set on the current status (`SUBMISSION_STATUS_CHANGED`).

## Retention

Notes are free text and can hold personal data. A correction follows the same notes rule as
every submission (`src/submissions/notesRetention.ts`).

- Submitting sets `retain_until` to 365 days after the submit. Approving or declining moves it to
  180 days after the decision. Reopening puts the 365-day submit cap back.
- The daily `findadoc-booking-purge` Lambda clears `notes` past `retain_until`
  (`src/submissions/notesPurge.ts`). Reasons, changed fields, and status stay.
- Audit log entries leave the notes out (`src/services/submissionAudit.ts`).
- Logs carry the submission id and `errorLogFields(error)`, never the input.
