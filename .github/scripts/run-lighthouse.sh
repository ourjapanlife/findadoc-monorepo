#!/usr/bin/env bash
# Measure one URL with mobile Lighthouse.
# Writes <output>.report.json and <output>.report.html.
# Usage: run-lighthouse.sh <url> <output-path-without-extension>
set -euo pipefail

URL="${1:?url}"
OUTPUT="${2:?output path}"
ATTEMPTS="${LIGHTHOUSE_ATTEMPTS:-3}"

mkdir -p "$(dirname "$OUTPUT")"

for attempt in $(seq 1 "$ATTEMPTS"); do
    if timeout 180 pnpm dlx lighthouse@13.5.0 "$URL" \
        --chrome-flags="--headless=new --no-sandbox --disable-dev-shm-usage" \
        --only-categories=performance,accessibility,best-practices,seo \
        --output=json \
        --output=html \
        --output-path="$OUTPUT" \
        --quiet
    then
        exit 0
    fi
    echo "lighthouse attempt ${attempt} failed for ${URL}" >&2
    if [[ "$attempt" != "$ATTEMPTS" ]]; then
        sleep 20
    fi
done

exit 1
