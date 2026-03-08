#!/usr/bin/env bash
# Pi Smart Display — Smoke Test
# Run after deploy to verify the API is healthy and returning valid JSON.
#
# Usage:
#   bash tests/smoke.sh                        # test against localhost:8787
#   bash tests/smoke.sh http://192.168.1.42:8787  # test against Pi on LAN
#
set -euo pipefail

BASE=${1:-http://localhost:8787}
PASS=0
FAIL=0

check() {
  local endpoint="$1"
  local response
  response=$(curl -sf --max-time 10 "${BASE}${endpoint}" 2>&1) || {
    echo "FAIL ${endpoint} — curl error: ${response}"
    ((FAIL++))
    return
  }
  echo "${response}" | python3 -c "import sys,json; json.load(sys.stdin)" >/dev/null 2>&1 || {
    echo "FAIL ${endpoint} — response is not valid JSON"
    ((FAIL++))
    return
  }
  echo "PASS ${endpoint}"
  ((PASS++))
}

check_absent() {
  local endpoint="$1"
  local status
  status=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "${BASE}${endpoint}") || true
  if [[ "$status" == "404" || "$status" == "405" || "$status" == "000" ]]; then
    echo "PASS ${endpoint} is correctly absent (${status})"
    ((PASS++))
  else
    echo "FAIL ${endpoint} should not exist (got HTTP ${status})"
    ((FAIL++))
  fi
}

echo "Running smoke tests against ${BASE}"
echo "─────────────────────────────────────────"

check /api/health
check /api/config
check_absent /api/debug-events

echo "─────────────────────────────────────────"
echo "Results: ${PASS} passed, ${FAIL} failed"

if [[ $FAIL -gt 0 ]]; then
  exit 1
fi
