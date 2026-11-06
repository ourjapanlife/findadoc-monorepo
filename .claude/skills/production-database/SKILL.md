---
name: production-database
description: Connect to the production Find a Doc database from this laptop, inspect it read-only, or run a backfill against it with pnpm db:prod. Use when asked to check, query, count, or inspect production data, or to run a backfill or data fix on production.
---

# Production database

Production is RDS PostgreSQL in a private subnet. `pnpm db:prod` is the only way in from a laptop. It opens an SSH tunnel through an EC2 Instance Connect Endpoint and a jump host that is stopped while unused, then signs in with a 15-minute IAM token. There is no password to look up. The full guide for people is `apps/docs/docs/development/production-database.md`.

Treat every row as a patient's or a clinic's data. The Security rules in `AGENTS.md` apply in full.

## Rules

1. Default to `--role readonly`, which is what `pnpm db:prod` uses when no role is given. Use `--role operator` only to run a write the user asked for.
2. Never read `findadoc/database/master`, and never connect as `postgres`. If a task seems to need it (a schema change, a grant), stop and tell the user. Schema changes are migrations.
3. Never write with ad hoc SQL (`UPDATE`, `DELETE`, `INSERT`) from psql. A data change is a backfill script in `apps/server/utils/`, with dry-run by default and a test, merged first. See "Database migrations" in `AGENTS.md`.
4. Always run the dry-run first. Show the user the counts and a few example ids, then ask before the write. Run the write only after the user says yes in this conversation, even if they asked for the backfill earlier.
5. Do not print personal data. Query with `count(*)`, ids, statuses, and dates. Do not select names, emails, phone numbers, addresses, free text, or tokens into the conversation. Booking, upload, appointment, membership, user, and audit tables are closed to both roles by design. Do not try to get around that.
6. Do not paste the IAM token or a full connection string into chat, a file, an issue, or a PR.

## Steps

### 1. Check the sign-in

```bash
aws sts get-caller-identity --profile findadoc
```

If it fails or says the token expired, ask the user to run `! aws sso login --profile findadoc`. That opens a browser, so you cannot do it for them. If `~/.aws/config` has no `findadoc` profile, point them to "One-time setup" in the docs page.

### 2. Read-only questions

Run each query as its own command. The tunnel opens and closes around it, and the first run may take a minute while the jump host starts.

```bash
pnpm db:prod psql -c "select verification_status, count(*) from facilities group by 1 order by 1"
```

For several queries, use `psql -f <file>` with a file in your scratchpad, or one `-c` with several statements. Do not leave a session open with no command (`pnpm db:prod` alone). That mode is for a person with a GUI.

### 3. Run a backfill

Dry-run as read-only:

```bash
pnpm db:prod pnpm --filter @findadoc/server backfill:cities
```

The script's first line names the target, for example `[dry-run] PRODUCTION database as findadoc_readonly`. If it says `local database`, it did not go through `pnpm db:prod`. Stop.

Summarize the report for the user and ask to write. After they say yes:

```bash
pnpm db:prod --role operator pnpm --filter @findadoc/server backfill:cities:write --confirm-production
```

Then run the dry-run again and show that the counts moved as expected.

A backfill that calls Google Places (`backfill:place-ids`) also needs `--places-key`, which reads `GOOGLE_API_KEY` from the `findadoc/api` secret into that one command's environment.

### 4. Writing a new backfill

Use `scriptDatabaseConfig`, `assertScriptWriteAllowed`, and `describeScriptTarget` from `apps/server/utils/scriptDatabase.ts`, like `backfillProfessionalLicenses.ts`. Dry-run is the default, and `--write` is a separate script entry. A table added after the `rds_operator_roles` migration needs a grant to `findadoc_readonly` and `findadoc_operator` in its own migration before either role can see it.

## When it fails

| Message | What to do |
| --- | --- |
| `You are not signed in to AWS` | The user runs `! aws sso login --profile findadoc`. |
| `Port 15432 is in use` | Another `pnpm db:prod` is open. Close it or pass `--port 15433`. |
| `Waiting for the jump host to accept SSH` repeats | Normal for up to a minute after a stop. If it fails all attempts, tell the user. Do not change infra. |
| `permission denied for table ...` | That table is closed to the role on purpose. Tell the user. Do not switch roles to get around it. |
| `cannot execute ... in a read-only transaction` | You used the read-only role for a write. Re-check rule 4 before using `--role operator`. |
| `The tunnel closed` | An Instance Connect tunnel lasts at most an hour. Run the command again. |
