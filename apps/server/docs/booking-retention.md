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

Dry-run (default):

```bash
pnpm --filter @findadoc/server exec node --loader ts-node/esm utils/purgeExpiredBookingUploads.ts
```

Write (deletes the object, sets `purged_at`, replaces `object_key` with a
non-fetchable marker):

```bash
pnpm --filter @findadoc/server exec node --loader ts-node/esm utils/purgeExpiredBookingUploads.ts --write
```

Staff never receive identity file bytes inline in GraphQL list payloads.
They use `bookingUploadDownloadUrl` for a short-lived GET while the object
still exists.

## Dashboard

Booking submissions appear as a read-only table on my-page (same list pattern
as directory submissions). Answers and metadata are visible; files stay behind
the download mutation. There is no edit path for patient answers.
