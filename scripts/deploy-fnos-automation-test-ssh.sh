#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

SSH_TARGET="${SSH_TARGET:-admin@192.168.8.152}"
REMOTE_DIR="${REMOTE_DIR:-~/woc-automation-test}"
COMPOSE_LOCAL="${COMPOSE_LOCAL:-$ROOT/fnos/woc-automation-test/docker-compose.yaml}"

if [[ -z "${PANEL_ADMIN_PASSWORD:-}" ]]; then
  echo "ERROR: set PANEL_ADMIN_PASSWORD before running." >&2
  echo "Example:" >&2
  echo "  PANEL_ADMIN_PASSWORD='replace-me' SSH_TARGET='admin@192.168.8.152' $0" >&2
  exit 2
fi

tmp_compose="$(mktemp "${TMPDIR:-/tmp}/woc-automation-test.XXXXXX.yml")"
cleanup() {
  rm -f "$tmp_compose"
}
trap cleanup EXIT

python3 - "$COMPOSE_LOCAL" "$tmp_compose" <<'PY'
import os
import sys

src, dst = sys.argv[1], sys.argv[2]
with open(src, "r", encoding="utf-8") as fh:
    text = fh.read()

replacements = {
    "PANEL_ADMIN_PASSWORD=REPLACE_WITH_A_STRONG_PASSWORD_BEFORE_START": (
        "PANEL_ADMIN_PASSWORD=" + os.environ["PANEL_ADMIN_PASSWORD"]
    ),
}

optional_envs = [
    "AUTOMATION_AI_API_KEY",
    "AUTOMATION_AI_BASE_URL",
    "AUTOMATION_AI_MODEL",
]
for key in optional_envs:
    if os.environ.get(key):
        replacements[f"{key}="] = f"{key}={os.environ[key]}"

for old, new in replacements.items():
    text = text.replace(old, new)

with open(dst, "w", encoding="utf-8") as fh:
    fh.write(text)
PY

echo "Deploying WOC automation test panel"
echo "  target:     $SSH_TARGET"
echo "  remote dir: $REMOTE_DIR"
echo "  compose:    $COMPOSE_LOCAL"
echo

ssh "$SSH_TARGET" "mkdir -p $REMOTE_DIR"
scp "$tmp_compose" "$SSH_TARGET:$REMOTE_DIR/docker-compose.yaml"
ssh "$SSH_TARGET" "cd $REMOTE_DIR && docker compose -f docker-compose.yaml pull && docker compose -f docker-compose.yaml up -d"
ssh "$SSH_TARGET" "cd $REMOTE_DIR && docker compose -f docker-compose.yaml ps"

echo
echo "Started test panel on port 36081."
