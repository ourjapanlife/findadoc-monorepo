# Booking upload retention

Insurance cards, eligibility certificates (資格確認書), and My Number–style
identity photos are high-risk under APPI. They are stored as booking uploads
with `sensitivity = identity_document` and a `retain_until` timestamp.

## Defaults

| Sensitivity | Default keep | Env override |
|---|---|---|
| `identity_document` | 30 days | `BOOKING_IDENTITY_RETENTION_DAYS` |
| `standard` | 365 days | `BOOKING_STANDARD_RETENTION_DAYS` |
| `medical` | 365 days (same as standard for files) | `BOOKING_STANDARD_RETENTION_DAYS` |

Medical free-text answers on the submission row are not auto-purged here.
That needs a separate policy once the CRM export path is decided.

## Purge

On AWS, `findadoc-booking-purge` (`apps/server/src/lambdaPurge.ts`) runs the
write purge at 03:00 JST every day. An EventBridge rule in `FindadocApi`
invokes it. It runs in the VPC as `findadoc_api`, like the API, and may only
`s3:DeleteObject` under `uploads/booking/*`. Each run:

- deletes the object of every upload past `retain_until`, sets `purged_at`,
  replaces `object_key` with the marker `purged/{id}`, which no storage call
  fetches, and clears `file_name`, which can name the patient;
- deletes uploads that were never attached to a submission and are older than
  one day, object and row;
- logs one line of counts (`type = "bookingPurge"`: `scanned`, `purged`,
  `unclaimed`, `unclaimedDeleted`, `failed`, `overdue`). It never logs an
  upload id, object key, file name, or error message. The key holds the
  patient's file name, and an S3 error can repeat it.

A failed upload does not stop the run. If any upload failed, or an upload is
still past `retain_until` when the run ends (`overdue`), the function throws.
That error posts `findadoc-booking-purge-failed` to Slack `#alerts`. The
alarm returns to OK after 25 hours without an error. To run it now:

```bash
aws lambda invoke --function-name findadoc-booking-purge out.json && cat out.json
```

By hand, against the database in your environment. Dry-run (default):

```bash
pnpm --filter @findadoc/server purge:booking-uploads
```

Write:

```bash
pnpm --filter @findadoc/server purge:booking-uploads:write
```

Staff never receive identity file bytes inline in GraphQL list payloads.
They use `bookingUploadDownloadUrl` for a short-lived GET while the object
still exists.

## Dashboard

Booking submissions appear as a read-only table on my-page (same list pattern
as directory submissions). Answers and metadata are visible; files stay behind
the download mutation. There is no edit path for patient answers.

## Auth

The booking form lives on Find a Doc at `/book/{facilityId}`. Open slots,
upload, and submit are public. A signed-out visitor is the anonymous user
role, which includes `create:bookings`.

The my-page booking list, file download, and availability calendar require a
signed-in session with `read:bookings` or `write:clinic_availability`.
