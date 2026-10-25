# Infrastructure

AWS CDK app for the Find a Doc AWS account.

- Account: `677501681118`
- Region: `ap-northeast-1` (Tokyo)
- Domain: `findadoc.jp` (existing Route 53 hosted zone)

## Stacks

| Stack         | What it does                                                                                                 |
| ------------- | ------------------------------------------------------------------------------------------------------------ |
| `FindadocDns` | Looks up the existing `findadoc.jp` hosted zone and exposes it as `hostedZone`. It does not create the zone. |
| `FindadocWeb` | Amplify Hosting app for the site. Associates `*.findadoc.jp` with the production branch, and lets GitHub Actions publish that branch and pull request previews. |
| `FindadocGithubDeploy` | GitHub OIDC provider and the `findadoc-github-cdk-deploy` role that the Infra workflow assumes. |
| `FindadocNetwork` | VPC with two private dual-stack subnets (`ap-northeast-1a`, `ap-northeast-1c`). No NAT gateway. IPv6 traffic leaves through an egress-only internet gateway. |
| `FindadocDatabase` | RDS PostgreSQL 17 for the API, plus the `DatabaseClients` security group that may connect to it and a monthly AWS Backup plan. |

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

`.github/workflows/infra.yml` runs `cdk synth` on pull requests that touch `infra/`, and `cdk deploy --all` on pushes to `main`. CI has no stored AWS keys. The deploy job gets a GitHub OIDC token and assumes `findadoc-github-cdk-deploy`. That role trusts only `main` of `ourjapanlife/findadoc-monorepo`, and it can only assume the CDK bootstrap roles.

`FindadocGithubDeploy` creates that role, so CI cannot create it. Deploy it once locally with an Identity Center session:

```bash
pnpm --filter @findadoc/infra run deploy FindadocGithubDeploy
```

After that, CI deploys every stack, including later changes to `FindadocGithubDeploy`.

## Subdomains

The site is hosted on Amplify. `FindadocWeb` associates `*.findadoc.jp` with the `main` branch. Amplify provisions the certificate and writes the wildcard record, because `findadoc.jp` is a Route 53 zone in this account.

`www`, `api`, and `docs` already have records, so those names stay where they are. Add a name to the Amplify domain when that name should move. The app has no Git repository connected, and auto-build is off. `.github/workflows/web.yml` builds the site and uploads `apps/web/.output/public`. That build sets `NUXT_SKIP_DIRECTORY_PRERENDER`, so clinic, doctor, hub, and facet HTML is not generated. Marketing pages still are. The Playwright workflow does not set the flag.

## Previews

A pull request that changes the site publishes an Amplify branch named `pr-<number>`. The URL is `https://pr-<number>.<default-domain>`, on `amplifyapp.com`. It is not a `findadoc.jp` name: `*.findadoc.jp` serves the production branch, and a preview hostname there would be the live site. The API allows that preview origin, and `https://main.<app-id>.amplifyapp.com`, so the page can read `https://api.findadoc.jp`.

The preview role can publish and delete only `pr-*` branches. Closing the pull request deletes that branch. Deploy `FindadocWeb` once so `findadoc-github-web-preview` exists; until then the Web workflow cannot assume it.

## Context lookups

`HostedZone.fromLookup` calls Route 53 on the first synth and caches the zone in `cdk.context.json`. Commit that file. Later synths, including CI, then read the cached zone instead of calling AWS. Delete the entry with `pnpm cdk context --reset <key>` if the zone is ever recreated.
