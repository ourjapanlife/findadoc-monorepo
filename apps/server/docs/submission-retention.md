# Submission notes retention (#236)

`submissions.notes` is free text. A signed-out visitor types it on the public
form ("Other notes", up to 300 characters), and a moderator edits the same
column through `updateSubmission`. It is not personal data by design, but
either one can write a name, a phone number, or health details into it. APPI
Art. 22 asks us to delete personal data once it is no longer needed, so one
rule covers every submission and both kinds of writer. Moderator notes are not
kept apart: they go with the visitor's text.

## Rule

`submissions.retain_until` is when the daily purge clears `notes`
(`src/submissions/notesRetention.ts`).

| When | `retain_until` |
|---|---|
| Submitted | 365 days after `created_date` |
| Approved or declined | 180 days after the decision |
| Reopened (back to pending or under review) | 365 days after `created_date` again |

A decision replaces the submit-time cap, so a submission nobody decides is
still covered. An edit that keeps the status does not move the clock. Once
`retain_until` has passed, the purge sets `notes` to null. The status, the
facility and professional fields, and the dates stay.

The visitor's form also tells them not to include their own health
information, and the privacy policy (section 5) states the periods above.

Approval never copies notes into the new professional's public
`additionalInfoForPatients`. The moderator writes that text by hand.

## Audit log

`audit_logs` is never purged, so a submission's audit entries carry no notes.
Every create, update, approve, and delete writes the submission through
`submissionAuditValue` (`src/services/submissionAudit.ts`), which leaves notes
out.

Entries written before #236 still hold notes. The daily purge removes the
`notes` key from `old_value` and `new_value` of every `Submission` entry and
leaves the rest of the entry alone. It runs there, as `findadoc_api`, because
the production operator role from `pnpm db:prod` may not touch `audit_logs`.
After the first run that step finds nothing.

## Purge

`purgeExpiredSubmissionNotes` (`src/submissions/notesPurge.ts`) runs in the
daily `findadoc-booking-purge` Lambda, apart from the booking purge, so one
failing does not skip the other. It logs one line of counts
(`type = "submissionNotesPurge"`: `notesDue`, `notesCleared`,
`auditEntriesDue`, `auditEntriesCleared`) and never a note. A failed run
throws at the end, which raises `findadoc-booking-purge-failed`.

By hand, with the booking purge:

```bash
pnpm --filter @findadoc/server purge:booking-uploads
```

## Logs, error reports, and backups

Purging a row does not reach a copy somewhere else, so free text must not be
copied there in the first place.

- **API logs** (CloudWatch, 30 days): an error is logged with
  `errorLogFields` from `src/logger.ts`, its class name and SQLSTATE or AWS
  code only. Never `${error}` or the message: a database error can repeat the
  value that failed, and an SES or S3 error can repeat an email or a key. A
  search failure logs the filter names, not their values. No row, input, or
  client IP is logged.
- **Sentry**: a server error sends the operation name and the variable names,
  not the variables or the query text. `beforeSend` in `src/instrument.ts`
  drops the request body, query string, and cookies. An exception message can
  still repeat a value; Sentry keeps events for its own retention period.
- **Postgres log** (CloudWatch, 30 days): `log_error_verbosity = terse`
  (`infra/lib/databaseStack.ts`) leaves out the DETAIL line, which repeats the
  failing row on a constraint error.
- **Backups**: automated backups last 7 days and monthly snapshots 180 days. A
  purged value stays in a backup until that backup expires. Restoring one
  brings old notes and answers back, so run the daily purge (`write`) right
  after a restore.

## Existing rows

Rows from before #236 got `retain_until` from a one-time backfill, which ran on
production on November 10, 2026: 180 days after `updated_date` for approved and
rejected rows, and the submit-time cap for the rest. Every submission now has
one, and the script is gone. A new submission gets `retain_until` on submit.
