# Production Database

This page is for maintainers who have an AWS sign-in for the Find a Doc account. It covers how to look at production data and how to run a backfill from your own laptop. You do not need to know AWS well. One command, `pnpm db:prod`, does the AWS part.

!!! warning "This is real patient and clinic data"
    Production holds booking requests and health information. Follow the Security rules in [`AGENTS.md`](https://github.com/ourjapanlife/findadoc-monorepo/blob/main/AGENTS.md). Do not copy rows to your laptop, a spreadsheet, an issue, a pull request, or a chat. Count and check. Do not export.

## How it works

The database is not on the internet. `pnpm db:prod`:

1. checks that you are signed in to AWS,
2. starts a small jump server inside our private network if it is stopped (about a minute),
3. opens an encrypted tunnel from `127.0.0.1:15432` on your laptop to the database,
4. signs you in with a password that AWS makes for you and that expires after 15 minutes.

Nobody has a database password to keep or leak. The jump server turns itself off 20 minutes after the last person disconnects.

There are two database roles:

| Role | Can do | When |
| --- | --- | --- |
| `readonly` (the default) | Read directory tables | Checking data, counting, a backfill dry-run |
| `operator` | Read and change rows in directory tables | Running a backfill that someone approved |

Neither role can change the schema, and neither can see booking requests, uploads, appointments, clinic invitations, user profiles, or the audit log. A schema change is always a migration.

## One-time setup

You need:

- the repository set up as in [Running the Code](running-the-code.md),
- the [AWS CLI v2](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html),
- `psql` (on macOS: `brew install libpq` and follow its note to add it to `PATH`),
- an AWS sign-in for Find a Doc. Ask a maintainer for an invitation to the AWS access portal.

Create the AWS profile once:

```bash
aws configure sso --profile findadoc
```

Answer the questions with:

| Question | Answer |
| --- | --- |
| SSO session name | `findadoc` |
| SSO start URL | `https://findadoc.awsapps.com/start` |
| SSO region | `ap-northeast-1` |
| SSO registration scopes | `sso:account:access` |
| Account | `677501681118` |
| Role | `AdministratorAccess` |
| Default client region | `ap-northeast-1` |
| Default output format | `json` |

## Sign in

Each sign-in lasts a working day. When a command says you are not signed in, run:

```bash
aws sso login --profile findadoc
```

A browser opens. Approve the request there.

`pnpm db:prod` uses the `findadoc` profile unless `AWS_PROFILE` names another one.

## Look at data

Run one query. The tunnel opens before it and closes after it:

```bash
pnpm db:prod psql -c "select verification_status, count(*) from facilities group by 1"
```

Open an interactive `psql`:

```bash
pnpm db:prod psql
```

### With a GUI (TablePlus, DBeaver, pgAdmin)

Keep the tunnel open in a terminal:

```bash
pnpm db:prod
```

It prints the settings to enter:

| Field | Value |
| --- | --- |
| Host | `127.0.0.1` |
| Port | `15432` |
| Database | `postgres` |
| User | `findadoc_readonly` |
| Password | the token it prints. Press Enter in that terminal for a new one. |
| SSL | `require` |

A token works for new connections for 15 minutes. A connection that is already open stays open. An Instance Connect tunnel lasts at most one hour. Run `pnpm db:prod` again after that.

## Run a backfill

Backfills are one-off scripts in `apps/server/utils/`. They do nothing unless you ask them to write. `pnpm db:prod` runs the command from `apps/server`, so call the script with `node` (on Windows, `pnpm db:prod pnpm …` cannot start `pnpm`). The steps are always the same:

**1. Dry-run** with the read-only role. Read the counts it prints:

```bash
pnpm db:prod node --loader ts-node/esm utils/<script>.ts
```

The first line names the target: `[dry-run] PRODUCTION database as findadoc_readonly`.

**2. Write** with the operator role. A production write needs `--write` and `--confirm-production`:

```bash
pnpm db:prod --role operator node --loader ts-node/esm utils/<script>.ts --write --confirm-production
```

**3. Dry-run again** and check that nothing is left to change.

A script that calls the Google Places API needs the API key, which `--places-key` reads from AWS for that one command:

```bash
pnpm db:prod --places-key node --loader ts-node/esm utils/<script>.ts
```

The city, place id, Maps link, license, phone, and insurance backfills ran on production in November 2026 and were deleted. A new one is written with `apps/server/utils/scriptDatabase.ts` and deleted after it runs.

One import is waiting to run: the multilingual institutions list (`utils/importInstitutionList.ts`, #21). It stages every row of the spreadsheet, fills empty fields on the facilities that are already listed, and adds the rest as unverified facilities. It needs `--places-key`, an `--input` file, and the `--evidence` file from `utils/checkInstitutionList.py`, which checks each row against the ministry open data, Japan Post, and the clinic's website. The steps are in [`apps/server/docs/institution-import.md`](https://github.com/ourjapanlife/findadoc-monorepo/blob/main/apps/server/docs/institution-import.md).

## With Claude Code or another AI assistant

The repository includes a Claude Code skill, `.claude/skills/production-database/SKILL.md`, and project settings that ask you before every `pnpm db:prod`. Ask in plain words, for example "how many published facilities have no city on production?" or "run the city backfill on production". The assistant:

- uses the read-only role unless a write was asked for,
- runs the dry-run first, shows you the counts, and asks before writing,
- does not print names, emails, or other personal data into the chat.

When it asks you to sign in, type `! aws sso login --profile findadoc` in the Claude Code prompt.

Other assistants can read the same skill file. It is plain Markdown.

## Options

| Option | Meaning |
| --- | --- |
| `--role readonly` / `--role operator` | Database role. `readonly` is the default. |
| `--port <number>` | Local port. The default is `15432`. Use another when two tunnels are open. |
| `--places-key` | Set `GOOGLE_API_KEY` for the command. |
| `--help` | Show the help. |

## Troubleshooting

| Message | Fix |
| --- | --- |
| `You are not signed in to AWS` | `aws sso login --profile findadoc` |
| `Port 15432 is in use` | Another `pnpm db:prod` is open. Close it, or pass `--port 15433`. |
| `Waiting for the jump host to accept SSH` | Normal right after it starts. It retries for about a minute. |
| `permission denied for table ...` | That table is closed to people on purpose. Ask a maintainer. |
| `cannot execute ... in a read-only transaction` | You are using the read-only role. Writes need `--role operator`. |
| `The tunnel closed` | Tunnels last at most an hour. Run the command again. |

The infrastructure behind this is `FindadocOperatorAccess` in [`infra/README.md`](https://github.com/ourjapanlife/findadoc-monorepo/blob/main/infra/README.md).
