#!/usr/bin/env bash
set -euo pipefail

TAG="${WOC_VERSION:-andy-automation-usable-r14-2026-07-05}"
PREFIX="${WOC_IMAGE_PREFIX:-ghcr.io/andychakwang}"
PORT="${WOC_TEST_HTTP_PORT:-36081}"
HOSTS="${PANEL_ALLOWED_HOSTS:-nasbot.cloud}"

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "Automation test panel"
echo "  image prefix: $PREFIX"
echo "  image tag:    $TAG"
echo "  host port:    $PORT"
echo "  allowed host: $HOSTS"
echo

export WOC_IMAGE_PREFIX="$PREFIX"
export WOC_VERSION="$TAG"
export WOC_TEST_HTTP_PORT="$PORT"
export PANEL_ALLOWED_HOSTS="$HOSTS"

docker compose -f docker-compose.automation-test.yml pull
docker compose -f docker-compose.automation-test.yml up -d

echo
echo "Started: http://127.0.0.1:${PORT}"
echo "If DNS and port forwarding are ready: http://${HOSTS%%,*}:${PORT}"
