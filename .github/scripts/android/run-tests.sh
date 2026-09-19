#!/usr/bin/env bash
set -uo pipefail

npm run test:integration:android -- -o test-results.json > test-output-android.log 2>&1
status=$?

cat test-output-android.log

{
  echo "### Test host Android"
  echo '```'
  cat test-output-android.log
  echo '```'
} >> "$GITHUB_STEP_SUMMARY"

exit $status
