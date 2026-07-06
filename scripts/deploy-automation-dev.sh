#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${ENV_FILE:-$ROOT/.env.automation-dev}"
COMPOSE_FILE="${COMPOSE_FILE:-$ROOT/docker-compose.automation-dev.yml}"
BUILD_WECHAT_IMAGE="${BUILD_WECHAT_IMAGE:-1}"

if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
else
  echo "WARN: $ENV_FILE not found; using compose defaults." >&2
fi

PREFIX="${WOC_DEV_IMAGE_PREFIX:-woc-dev}"
TAG="${WOC_DEV_VERSION:-automation-dev}"
PORT="${WOC_DEV_HTTP_PORT:-36082}"
HOSTS="${PANEL_ALLOWED_HOSTS:-localhost,127.0.0.1,nasbot.cloud}"

echo "Automation development panel"
echo "  compose:      $COMPOSE_FILE"
echo "  env file:     $ENV_FILE"
echo "  image prefix: $PREFIX"
echo "  image tag:    $TAG"
echo "  host port:    $PORT"
echo "  allowed host: $HOSTS"
echo

compose_args=(-f "$COMPOSE_FILE")
if [[ -f "$ENV_FILE" ]]; then
  compose_args=(--env-file "$ENV_FILE" -f "$COMPOSE_FILE")
fi

if [[ "$BUILD_WECHAT_IMAGE" == "1" ]]; then
  docker compose "${compose_args[@]}" --profile image-build build wechat-image-dev panel-automation-dev
else
  docker compose "${compose_args[@]}" build panel-automation-dev
fi

docker compose "${compose_args[@]}" up -d panel-automation-dev

echo
echo "Started source-built automation dev panel:"
echo "  http://127.0.0.1:${PORT}"
echo "  http://${HOSTS%%,*}:${PORT}"
