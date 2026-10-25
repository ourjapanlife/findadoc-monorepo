# Infrastructure

AWS CDK app for the Find a Doc AWS account.

- Account: `677501681118`
- Region: `ap-northeast-1` (Tokyo)
- Domain: `findadoc.jp` (existing Route 53 hosted zone)

## Stacks

| Stack         | What it does                                                                                                 |
| ------------- | ------------------------------------------------------------------------------------------------------------ |
| `FindadocDns` | Looks up the existing `findadoc.jp` hosted zone and exposes it as `hostedZone`. It does not create the zone. |
| `FindadocWeb` | Amplify Hosting app for the site. Associates `findadoc.jp` and `*.findadoc.jp` with the production branch, and lets GitHub Actions publish that branch and pull request previews. |
| `FindadocGithubDeploy` | GitHub OIDC provider and the `findadoc-github-cdk-deploy` role that the Infra workflow assumes. |
| `FindadocNetwork` | VPC with two private dual-stack subnets (`ap-northeast-1a`, `ap-northeast-1c`). No NAT gateway. IPv6 traffic leaves through an egress-only internet gateway. |
| `FindadocDatabase` | RDS PostgreSQL 17 for the API, plus the `DatabaseClients` security group that may connect to it and a monthly AWS Backup plan. |
| `FindadocAlerts` | SNS topic `findadoc-alarms`, the AWS Chatbot link that posts it to `#alerts` in Slack, and the database alarms. |
| `FindadocEdgeCertificates` | **us-east-1.** The ACM certificates for `api-staging`/`api.findadoc.jp` and `mcp-staging`/`mcp.findadoc.jp`. CloudFront only accepts certificates from us-east-1. |
| `FindadocApiSecrets` | The `findadoc/api` secret: `GOOGLE_API_KEY`, `SENTRY_DSN`, and a generated `EDGE_SHARED_SECRET`. |
| `FindadocApi` | The API Lambda (`findadoc-api`) and its Function URL, the CloudFront distribution and DNS for `api-staging.findadoc.jp`, the migration Lambda that runs on every deploy, API alarms, and saved log queries. |
| `FindadocMcp` | The MCP Lambda (`findadoc-mcp`, outside the VPC) behind CloudFront at `mcp-staging.findadoc.jp`, with an error alarm. Its tools call `https://api.findadoc.jp`. |
| `FindadocDataCopy` | **Temporary (#81).** `findadoc-db-copy`, the one-off function that copies the Supabase database into RDS. Remove after the cutover (#13). |

## Monthly cost

Prices are Tokyo on-demand list prices. Nothing in these stacks bills by the hour except the database instance.

| Item | Cost / month |
| --- | --- |
| RDS `db.t4g.micro`, single-AZ | $18.25 ($0.025/hour) |
| RDS 20 GB gp3 storage | $2.76 |
| Automated backups (7 days) | $0 up to the 20 GB provisioned, then $0.095/GB |
| Monthly AWS Backup snapshot, kept 6 months | Cents at this size |
| Secrets Manager secret for the master password | $0.40 |
| VPC, subnets, route tables, egress-only and internet gateways, security groups | $0 |
| PostgreSQL logs in CloudWatch, kept 30 days | Inside the 5 GB free allowance |
| SNS topic, AWS Chatbot, and alarms (the first 10 are free) | $0 |
| API, migration and MCP Lambdas | $0 inside the always-free 1M requests and 400k GB-seconds |
| CloudFront distribution and the viewer-IP CloudFront Function | $0 inside the free 1 TB, 10M requests and 2M function invocations |
| ACM certificate, Route 53 alias records | $0 |
| Secrets Manager secret `findadoc/api` | $0.40 |

Not used, on purpose: NAT gateways (about $45/month each), Elastic IPs and public IPv4 addresses ($3.65/month each), VPC interface endpoints (about $7/month each), load balancers, Multi-AZ, Performance Insights, Enhanced Monitoring, and customer-managed KMS keys. Check `cdk diff` for any of these before merging an infra change.

## Database

- The instance is not publicly accessible, and TLS is required (`rds.force_ssl=1`). Only the `DatabaseClients` security group can reach port 5432.
- The master user is `postgres`. Its password is the `findadoc/database/master` secret. Migrations run as this user.
- The API connects as `findadoc_api` with an IAM auth token, never a password. The migration `20261025010000_rds_api_login_role.sql` creates that role, but only on RDS.
- Recovery: point-in-time restore to any second in the last 7 days, plus monthly snapshots kept for 180 days in the `findadoc-database` backup vault. Single-AZ, so a failed host is a restore of roughly 15-30 minutes.
- Deletion protection is on, and deleting the stack leaves a final snapshot.
- Before a migration that changes the schema, take a manual snapshot in the RDS console.
- `availabilityZones` in `NetworkStack` comes from the cached `availability-zones` entry in `cdk.context.json`, so synth needs no credentials.

## Credentials (IAM Identity Center)

The account uses IAM Identity Center. Do not create IAM users or access keys.

Create a profile once:

```bash
aws configure sso --profile findadoc
```

Use the Identity Center start URL and region for the organization, choose account `677501681118`, pick the `AdministratorAccess` permission set, and set the default region to `ap-northeast-1`. The resulting `~/.aws/config` looks like this:

```ini
[profile findadoc]
sso_session = findadoc
sso_account_id = 677501681118
sso_role_name = AdministratorAccess
region = ap-northeast-1

[sso-session findadoc]
sso_start_url = https://findadoc.awsapps.com/start
sso_region = ap-northeast-1
sso_registration_scopes = sso:account:access
```

Sign in when the session expires:

```bash
aws sso login --profile findadoc
export AWS_PROFILE=findadoc
aws sts get-caller-identity
```

The CDK CLI reads `AWS_PROFILE` (or `--profile findadoc`) and uses the Identity Center session directly.

## Bootstrap

Run once per account and region, with a permission set that can create IAM roles:

```bash
pnpm --filter @findadoc/infra cdk bootstrap aws://677501681118/ap-northeast-1
```

## Commands

Run from the repo root, or use `pnpm run <script>` inside `infra/`. Keep `run` before `deploy`: `pnpm deploy` is a built-in pnpm command, not this package's script.

```bash
pnpm --filter @findadoc/infra typecheck
pnpm --filter @findadoc/infra synth
pnpm --filter @findadoc/infra diff
pnpm --filter @findadoc/infra run deploy --all
```

## CI deploys

`.github/workflows/infra.yml` runs `cdk synth` on pull requests, and on pushes to `main` it deploys `FindadocGithubDeploy` first, then `cdk deploy --all`. It runs when `infra/`, `apps/server/`, `packages/graphql/` or `packages/utils/` change. The CI role goes first because it decides which regions' bootstrap roles CI may assume, and `deploy --all` publishes every stack's assets before deploying any stack. CI has no stored AWS keys. The deploy job gets a GitHub OIDC token and assumes `findadoc-github-cdk-deploy`. That role trusts only `main` of `ourjapanlife/findadoc-monorepo`, and it can only assume the CDK bootstrap roles.

`FindadocGithubDeploy` creates that role, so CI cannot create it. Deploy it once locally with an Identity Center session:

```bash
pnpm --filter @findadoc/infra run deploy FindadocGithubDeploy
```

After that, CI deploys every stack, including later changes to `FindadocGithubDeploy`.

## Subdomains

The site is hosted on Amplify. `FindadocWeb` associates `findadoc.jp` and `*.findadoc.jp` with the `main` branch. Amplify provisions the certificate and writes both records, because `findadoc.jp` is a Route 53 zone in this account. The apex record is an alias A record. Deploying this stack replaces the A record that is already on `findadoc.jp`.

`www`, `api`, and `docs` already have records, so those names stay where they are. The wildcard does not override them. Add a name to the Amplify domain when that name should move. `https://*.findadoc.jp` is not a page: a browser cannot open the asterisk. The app has no Git repository connected, and auto-build is off. `.github/workflows/web.yml` builds the site and uploads `apps/web/.output/public`. Sentry, Umami, and the Maps key are Actions secrets on that build (`NUXT_PUBLIC_SENTRY_DSN`, `NUXT_PUBLIC_SENTRY_ENVIRONMENT`, `NUXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE`, `NUXT_PUBLIC_UMAMI_URL`, `NUXT_PUBLIC_UMAMI_SITE_ID`, `GOOGLE_MAPS_API_KEY`). `nuxi generate` writes them into the static files, so an Amplify environment variable is not read. A pull request sets `NUXT_SKIP_DIRECTORY_PRERENDER`, so that preview does not generate clinic, doctor, hub, and facet HTML. The `main` publish does not set it. Marketing pages are generated either way. The Playwright workflow does not set the flag.

## Previews

A pull request that changes the site publishes an Amplify branch named `pr-<number>`. The URL is `https://pr-<number>.<default-domain>`, on `amplifyapp.com`. It is not a `findadoc.jp` name: `*.findadoc.jp` serves the production branch, and a preview hostname there would be the live site. The API allows that preview origin, and `https://main.<app-id>.amplifyapp.com`, so the page can read `https://api.findadoc.jp`.

The preview role can publish and delete only `pr-*` branches. Closing the pull request deletes that branch. Deploy `FindadocWeb` once so `findadoc-github-web-preview` exists; until then the Web workflow cannot assume it.

The pull request comment is replaced on each publish. It shows the preview URL, then mobile Lighthouse scores for the homepage: performance, accessibility, best practices, and SEO. Under those it shows first contentful paint, largest contentful paint, total blocking time, cumulative layout shift, and speed index, each beside the same run of `https://www.findadoc.jp`. A lower timing is the faster one. The three largest savings opportunities are listed, and the HTML reports are attached to the workflow run.

## Context lookups

`HostedZone.fromLookup` calls Route 53 on the first synth and caches the zone in `cdk.context.json`. Commit that file. Later synths, including CI, then read the cached zone instead of calling AWS. Delete the entry with `pnpm cdk context --reset <key>` if the zone is ever recreated.

## Alarms in Slack

Alarms go to the `findadoc-alarms` SNS topic. AWS Chatbot (now called Amazon Q Developer in chat applications) posts that topic to `#alerts` in the findadoc Slack workspace. The workspace and channel IDs are in `lib/environment.ts`. Each alarm posts when it fires and again when it recovers. The channel is read-only: it can show alarm details, but nobody can change AWS from Slack.

Once per workspace, before the first deploy of `FindadocAlerts`, a Slack workspace admin must authorize Chatbot. CloudFormation cannot do this step.

1. In the AWS console for account `677501681118`, open **Amazon Q Developer in chat applications**.
2. Choose **Configure new client**, then **Slack**, and approve the findadoc workspace.
3. In Slack, invite the app to the channel: `/invite @Amazon Q` in `#alerts`.

| Alarm | Fires when |
| --- | --- |
| `findadoc-database-free-storage-low` | RDS has less than 2 GB free |
| `findadoc-database-cpu-high` | RDS CPU is above 80% for 15 minutes |
| `findadoc-database-surplus-credits-charged` | RDS is billed for CPU surplus credits (the t4g burst baseline was exceeded) |

To check the Slack link after a deploy, force an alarm into ALARM. It returns to OK on the next evaluation:

```bash
aws cloudwatch set-alarm-state --alarm-name findadoc-database-cpu-high --state-value ALARM --state-reason "Testing the Slack link"
```

## API

`FindadocApi` runs `apps/server/src/lambda.ts`, bundled with esbuild, as `findadoc-api`. The function is arm64 with Node 24 and 1 GB. It sits in the private subnets and reaches Auth0, Google Places and Sentry over IPv6. It connects to RDS as `findadoc_api` with an IAM token. CloudFront serves it at `api-staging.findadoc.jp`, with caching off. A CloudFront Function adds the viewer IP, and the origin adds `x-findadoc-edge`, so rate limits and Places quotas count people, not CloudFront edges. `api.findadoc.jp` moves at the cutover (#13).

There is no reserved concurrency. A new account can have a total Lambda concurrency of 10, and reserving any of it can fail the deploy. `findadoc-api-throttles` reports when the account limit is reached.

Every deploy of `FindadocApi` first runs `findadoc-db-migrate` (`apps/server/src/lambdaMigrate.ts`), a CDK trigger in the VPC. It applies pending migrations as the master user. If a migration fails, the deploy fails and the API function does not change.

### One-time setup before the first deploy

1. An admin bootstraps us-east-1 once with an Identity Center session:

   ```bash
   pnpm --filter @findadoc/infra cdk bootstrap aws://677501681118/us-east-1
   ```

   CI can then deploy there. `FindadocGithubDeploy` lets the deploy role assume the us-east-1 bootstrap roles, and `FindadocEdgeCertificates` waits for that change.
2. After the first deploy, open the `findadoc/api` secret in Secrets Manager. Fill in `GOOGLE_API_KEY` and `SENTRY_DSN`, and leave `EDGE_SHARED_SECRET` as generated. Then bump `API_SECRETS_REVISION` in `lib/environment.ts` and merge, so the function reads the new values.

### API alarms (Slack `#alerts`)

| Alarm | Fires when |
| --- | --- |
| `findadoc-api-errors` | more than 5 Lambda errors in 5 minutes |
| `findadoc-api-p95-duration` | p95 duration above 3 s for 15 minutes |
| `findadoc-api-throttles` | any throttled request |
| `findadoc-api-search-failures` | a facility or professional search fails on the server (metric filter on `searchFailed` in the request log) |

Saved Logs Insights queries for `/aws/lambda/findadoc-api`: `findadoc/api/slow-operations`, `findadoc/api/errors-by-operation`, `findadoc/api/failed-searches`.

## Hostnames on CloudFront

Every `*.findadoc.jp` name without its own Route 53 record resolves to the Amplify wildcard (`FindadocWeb`). CloudFront refuses to add a hostname whose DNS points at another distribution ("One or more aliases specified for the distribution includes an incorrectly configured DNS record that points to another CloudFront distribution"). So, as AWS documents for this error, a new hostname goes on in two deploys. Its state in `API_HOSTNAMES` or `MCP_HOSTNAMES` (`lib/environment.ts`) says which step it is at:

1. `dns`: only its A and AAAA records, pointing at our distribution. Merge, and let it deploy.
2. `live`: the records, plus the hostname and certificate on the distribution.

`alias` puts a hostname on the distribution without records. It is for `api.findadoc.jp`, whose records predate CDK and move by hand at the cutover.

## MCP

`FindadocMcp` runs `apps/mcp/src/lambda.ts` as `findadoc-mcp`, an arm64 Node 24 function with 512 MB, behind CloudFront at `mcp-staging.findadoc.jp`. It uses the same CloudFront setup as the API (`lib/functionUrlEdge.ts`). MCP is on `/mcp`, the REST routes for ChatGPT Actions are under `/api`, and the spec is at `/openapi.yaml`. The function has no database and runs outside the VPC. `findadoc-mcp-errors` posts to Slack `#alerts`. `mcp.findadoc.jp` moves at the cutover (#13).

## Copying the data from Supabase (#81)

`findadoc-db-copy` (`apps/server/src/lambdaCopy.ts`) runs in the VPC. It reads Supabase over IPv6 and writes to RDS as the master user. It only runs when invoked, so it costs nothing.

- **What it copies:** every public table except `schema_migrations`, including the city vocabulary, so `city_id` references stay valid. Parents load before the tables that reference them.
- **How:** it reads the source from one read-only snapshot. On the target, it truncates the tables and loads everything with `COPY` in one transaction, leaving generated columns (`search_text`) for RDS to compute.
- **Checks:** before committing, it compares every table by row count and an MD5 over all rows. Any difference rolls the whole copy back.
- **Dry run:** compares only, and changes nothing.
- **Requirement:** both databases need the same tables and columns, so apply the migrations to Supabase first (`db:push`).

The event carries the Supabase connection string, so the password is never stored in AWS, and the function never logs it. Use the **direct** connection string from the Supabase dashboard (Connect → Direct connection, `db.<ref>.supabase.co:5432`, IPv6). The pooler hostnames are IPv4-only and cannot be reached from the VPC. Put it in a file outside the repo, not on the command line:

```json
{ "sourceDatabaseUrl": "postgresql://postgres:<password>@db.<ref>.supabase.co:5432/postgres", "dryRun": true }
```

To verify Supabase's certificate, add `"sourceCaCert"` with the PEM from Dashboard → Database → SSL. Without it, the connection is encrypted but the certificate is not checked.

```bash
aws lambda invoke --function-name findadoc-db-copy --cli-binary-format raw-in-base64-out \
  --cli-read-timeout 900 --payload file://copy.json out.json && cat out.json
```

1. **Dry run** (`"dryRun": true`). Before the first copy, `allMatch` is false and `sourceRows` shows what will come over.
2. **Rehearsal** (`"dryRun": false`). It should finish with `allMatch: true`, and `api-staging.findadoc.jp` then serves the copied directory. Run it twice, then compare a deploy preview against production.
3. **Restore drill.** In the RDS console, restore `findadoc` to a point in time as a new instance, connect, check it, then delete it. Write down how long it took on #81.
4. **Cutover (#13).** Pause moderation writes, run the copy once more, and switch DNS.

Delete `copy.json` afterwards.

## Cutover (#13)

The API moves from DigitalOcean and Supabase to AWS. After #81's rehearsals and a soak on `api-staging.findadoc.jp`, the cutover is one data copy and one DNS change. `api.findadoc.jp` has A and AAAA records with a 5-minute TTL that predate CDK. One Route 53 change batch moves them, so no deploy runs during the switch. Each batch deletes the current records and creates the new ones. Route 53 applies a batch whole or not at all, and refuses it when a `DELETE` does not match the live record exactly, so a stale file cannot half-apply.

### Before the day

1. Merge a PR that adds `[API_DOMAIN]: 'alias'` to `API_HOSTNAMES` and `[MCP_DOMAIN]: 'dns'` to `MCP_HOSTNAMES` in `lib/environment.ts` (see "Hostnames on CloudFront"). After it deploys:
   - the API distribution also answers `api.findadoc.jp`, but its DNS still points at DigitalOcean;
   - the API reports to Sentry as `production`;
   - `mcp.findadoc.jp` has records pointing at the MCP distribution.
2. Merge a PR that changes `[MCP_DOMAIN]` to `'live'`. `mcp.findadoc.jp` then serves MCP.
3. Check that CloudFront serves the production name before DNS moves:

   ```bash
   DIST=$(aws cloudformation describe-stacks --stack-name FindadocApi --region ap-northeast-1 \
     --query "Stacks[0].Outputs[?OutputKey=='DistributionDomain'].OutputValue" --output text)
   curl --connect-to api.findadoc.jp:443:$DIST:443 https://api.findadoc.jp/health
   ```

4. Write `to-aws.json`, with `$DIST` replaced by its value. `Z2FDTNDATAQYW2` is CloudFront's fixed alias zone:

   ```json
   {
     "Comment": "api.findadoc.jp to AWS (#13)",
     "Changes": [
       { "Action": "DELETE", "ResourceRecordSet": { "Name": "api.findadoc.jp", "Type": "A", "TTL": 300,
         "ResourceRecords": [{ "Value": "172.66.0.96" }] } },
       { "Action": "DELETE", "ResourceRecordSet": { "Name": "api.findadoc.jp", "Type": "AAAA", "TTL": 300,
         "ResourceRecords": [{ "Value": "2a06:98c1:58::60" }] } },
       { "Action": "CREATE", "ResourceRecordSet": { "Name": "api.findadoc.jp", "Type": "A",
         "AliasTarget": { "HostedZoneId": "Z2FDTNDATAQYW2", "DNSName": "$DIST", "EvaluateTargetHealth": false } } },
       { "Action": "CREATE", "ResourceRecordSet": { "Name": "api.findadoc.jp", "Type": "AAAA",
         "AliasTarget": { "HostedZoneId": "Z2FDTNDATAQYW2", "DNSName": "$DIST", "EvaluateTargetHealth": false } } }
     ]
   }
   ```

5. Write `to-digitalocean.json` for rollback. These are DigitalOcean's addresses as of 26 Oct 2026, so confirm them in the DigitalOcean console first:

   ```json
   {
     "Comment": "api.findadoc.jp back to DigitalOcean (#13 rollback)",
     "Changes": [
       { "Action": "DELETE", "ResourceRecordSet": { "Name": "api.findadoc.jp", "Type": "A",
         "AliasTarget": { "HostedZoneId": "Z2FDTNDATAQYW2", "DNSName": "$DIST", "EvaluateTargetHealth": false } } },
       { "Action": "DELETE", "ResourceRecordSet": { "Name": "api.findadoc.jp", "Type": "AAAA",
         "AliasTarget": { "HostedZoneId": "Z2FDTNDATAQYW2", "DNSName": "$DIST", "EvaluateTargetHealth": false } } },
       { "Action": "CREATE", "ResourceRecordSet": { "Name": "api.findadoc.jp", "Type": "A", "TTL": 300,
         "ResourceRecords": [{ "Value": "172.66.0.96" }] } },
       { "Action": "CREATE", "ResourceRecordSet": { "Name": "api.findadoc.jp", "Type": "AAAA", "TTL": 300,
         "ResourceRecords": [{ "Value": "2a06:98c1:58::60" }] } }
     ]
   }
   ```

### On the day (about 30 minutes)

1. Announce the pause, and stop moderation writes.
2. Run the final copy (`"dryRun": false`, see "Copying the data from Supabase"). Go on only with `allMatch: true`.
3. Switch DNS:

   ```bash
   aws route53 change-resource-record-sets --hosted-zone-id Z02936621Z4BCXTP4RWL0 --change-batch file://to-aws.json
   ```

4. Within 5 minutes, traffic reaches AWS. Check `https://api.findadoc.jp/health`, a search on the site, and a moderator sign-in. Watch `#alerts`, Sentry and the saved log queries.
5. End the pause.

To roll back, run the same command with `to-digitalocean.json`. Writes made on AWS after the cutover must then be replayed on Supabase from `audit_logs`.

### After two quiet weeks

Stop the DigitalOcean app and cancel Grafana Cloud. Keep a final Supabase dump in S3, delete the Supabase project after 30 days, remove `FindadocDataCopy`, and update the docs (#13).
