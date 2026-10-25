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

`www`, `api`, and `docs` already have records, so those names stay where they are. Add a name to the Amplify domain when that name should move. The app has no Git repository connected, and auto-build is off. `.github/workflows/web.yml` builds the site and uploads `apps/web/.output/public`.

## Previews

A pull request that changes the site publishes an Amplify branch named `pr-<number>`. The URL is `https://pr-<number>.<default-domain>`, on `amplifyapp.com`. It is not a `findadoc.jp` name: `*.findadoc.jp` serves the production branch, and a preview hostname there would be the live site.

The preview role can publish and delete only `pr-*` branches. Closing the pull request deletes that branch. Deploy `FindadocWeb` once so `findadoc-github-web-preview` exists; until then the Web workflow cannot assume it.

## Context lookups

`HostedZone.fromLookup` calls Route 53 on the first synth and caches the zone in `cdk.context.json`. Commit that file. Later synths, including CI, then read the cached zone instead of calling AWS. Delete the entry with `pnpm cdk context --reset <key>` if the zone is ever recreated.
