# Infrastructure

AWS CDK app for the Find a Doc AWS account.

- Account: `677501681118`
- Region: `ap-northeast-1` (Tokyo)
- Domain: `findadoc.jp` (existing Route 53 hosted zone)

## Stacks

| Stack         | What it does                                                                                                 |
| ------------- | ------------------------------------------------------------------------------------------------------------ |
| `FindadocDns` | Looks up the existing `findadoc.jp` hosted zone and exposes it as `hostedZone`. It does not create the zone. |

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

Run from the repo root, or use `pnpm <script>` inside `infra/`:

```bash
pnpm --filter @findadoc/infra typecheck
pnpm --filter @findadoc/infra synth
pnpm --filter @findadoc/infra diff
pnpm --filter @findadoc/infra deploy --all
```

## Context lookups

`HostedZone.fromLookup` calls Route 53 on the first synth and caches the zone in `cdk.context.json`. Commit that file. Later synths, including CI, then read the cached zone instead of calling AWS. Delete the entry with `pnpm cdk context --reset <key>` if the zone is ever recreated.
