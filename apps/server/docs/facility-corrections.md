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

Optional: `notes` (up to 1000 characters) and `reporterRelation` (`PATIENT`, `STAFF`, `CALLED`,
`WEBSITE`). There is no name, email, or phone of the visitor. The facility must be published: a
city, and not `UNVERIFIED_LOCATION`.

The changed fields go in `correction_changes`, not `facility_partial`. Listing approval and the
moderation edit form read `facility_partial` as a whole new facility.

The mutation needs `create:submissions`, which signed-out visitors hold, and has its own budget
of 5 calls an hour per address (`booking/rateLimits.ts`). The answer is `isSuccessful` only, with
no id.

## Moderation

- `updateSubmission` refuses listing fields on a correction (`SUBMISSION_KIND_MISMATCH`).
- A `WRONG_CITY` report needs a city from the vocabulary before approval. The moderator sends it
  as `correctionCityId`. Approval without it is `CORRECTION_CITY_REQUIRED`. A visitor never sets
  the city, and free text is never a city (`city-rules.md`).
- Approval writes only the keys in `correction_changes`, through `updateFacilityInTransaction`,
  in the same transaction as the status change. The city rules and the facility audit trail apply.
- `CLOSED` and `DUPLICATE` change nothing on approval. Unpublishing or merging is a separate action.
- A status change is a compare-and-set on the current status (`SUBMISSION_STATUS_CHANGED`).

### Dashboard

The submissions dashboard has five queues. Each tab and each row status has an icon and a word,
so color is never the only signal.

| Tab | What it shows |
| --- | --- |
| New | Listings nobody has opened (`pending`) |
| For Review | Listings a moderator is working on (`under_review`) |
| Approved | Approved listings and corrections |
| Rejected | Rejected listings and corrections (`rejected`) |
| User feedback | Corrections that are `pending` or `under_review` |

A correction in Approved or Rejected carries a Feedback tag. New and For Review show listings
only, so User feedback is the one place to look for open corrections. Bulk approve is off in
User feedback: each correction is approved from its review screen.

A correction opens a review screen, not the listing edit form. It shows the reasons, then the
clinic's current value next to the visitor's value for each field the visitor sent. A `WRONG_CITY`
report shows the city picker, and the screen saves the city before it approves. `CLOSED` and
`DUPLICATE` show what to do by hand. The review screen has no Update button, because a moderator
does not edit what the visitor sent.

## Retention

Notes are free text and can hold personal data.

- Approving or declining a correction sets `retain_until` to 180 days later. Reopening it clears
  `retain_until`.
- The daily `findadoc-booking-purge` Lambda also clears `notes` on corrections past `retain_until`.
  Reasons, changed fields, and status stay.
- Audit log entries for a correction leave the notes out, because `audit_logs` is not purged.
- Logs carry the submission id and error codes only, never the input.

By hand, against the database in your environment. Dry-run (default):

```bash
pnpm --filter @findadoc/server purge:correction-notes
```

Write:

```bash
pnpm --filter @findadoc/server purge:correction-notes:write
```
