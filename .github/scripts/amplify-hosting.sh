#!/usr/bin/env bash
# Publish apps/web/.output/public to the findadoc-web Amplify app, or delete a preview branch.
# Usage: amplify-hosting.sh deploy <branch>
#        amplify-hosting.sh delete <branch>
set -euo pipefail

APP_NAME="findadoc-web"
REGION="${AWS_REGION:-ap-northeast-1}"
ACTION="${1:-}"
BRANCH="${2:-}"

if [[ "$ACTION" != "deploy" && "$ACTION" != "delete" ]]; then
    echo "usage: amplify-hosting.sh deploy|delete <branch>" >&2
    exit 1
fi
if [[ -z "$BRANCH" ]]; then
    echo "branch name is required" >&2
    exit 1
fi

APP_ID="$(aws amplify list-apps --region "$REGION" --query "apps[?name=='${APP_NAME}'].appId | [0]" --output text)"
if [[ -z "$APP_ID" || "$APP_ID" == "None" ]]; then
    if [[ "$ACTION" == "delete" ]]; then
        echo "${APP_NAME} is not deployed; nothing to delete"
        exit 0
    fi
    echo "${APP_NAME} is not deployed. Deploy the FindadocWeb stack first." >&2
    exit 1
fi

if [[ "$ACTION" == "delete" ]]; then
    aws amplify delete-branch --region "$REGION" --app-id "$APP_ID" --branch-name "$BRANCH" \
        || echo "no Amplify branch ${BRANCH}"
    exit 0
fi

PUBLISH_DIR="apps/web/.output/public"
if [[ ! -f "${PUBLISH_DIR}/index.html" ]]; then
    echo "missing ${PUBLISH_DIR}/index.html. Run pnpm --filter @findadoc/web build first." >&2
    exit 1
fi

if ! aws amplify get-branch --region "$REGION" --app-id "$APP_ID" --branch-name "$BRANCH" >/dev/null 2>&1; then
    aws amplify create-branch \
        --region "$REGION" \
        --app-id "$APP_ID" \
        --branch-name "$BRANCH" \
        --stage DEVELOPMENT \
        --no-enable-auto-build
fi

ZIP_PATH="${RUNNER_TEMP:-/tmp}/site.zip"
rm -f "$ZIP_PATH"
( cd "$PUBLISH_DIR" && zip -qr "$ZIP_PATH" . )

DEPLOYMENT="$(aws amplify create-deployment --region "$REGION" --app-id "$APP_ID" --branch-name "$BRANCH" --output json)"
JOB_ID="$(echo "$DEPLOYMENT" | jq -r .jobId)"
UPLOAD_URL="$(echo "$DEPLOYMENT" | jq -r .zipUploadUrl)"
curl --fail --silent --show-error --retry 3 -H "Content-Type: application/zip" --upload-file "$ZIP_PATH" "$UPLOAD_URL"
aws amplify start-deployment --region "$REGION" --app-id "$APP_ID" --branch-name "$BRANCH" --job-id "$JOB_ID"

for _ in $(seq 1 90); do
    STATUS="$(aws amplify get-job --region "$REGION" --app-id "$APP_ID" --branch-name "$BRANCH" --job-id "$JOB_ID" --query 'job.summary.status' --output text)"
    echo "job ${JOB_ID}: ${STATUS}"
    case "$STATUS" in
        SUCCEED)
            DOMAIN="$(aws amplify get-app --region "$REGION" --app-id "$APP_ID" --query 'app.defaultDomain' --output text)"
            URL="https://${BRANCH}.${DOMAIN}"
            echo "url=${URL}"
            if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
                echo "url=${URL}" >> "$GITHUB_OUTPUT"
            fi
            if [[ -n "${GITHUB_STEP_SUMMARY:-}" ]]; then
                echo "Site: ${URL}" >> "$GITHUB_STEP_SUMMARY"
            fi
            exit 0
            ;;
        FAILED|CANCELLED)
            echo "Amplify job ${JOB_ID} ${STATUS}" >&2
            exit 1
            ;;
    esac
    sleep 10
done

echo "Amplify job ${JOB_ID} did not finish" >&2
exit 1
