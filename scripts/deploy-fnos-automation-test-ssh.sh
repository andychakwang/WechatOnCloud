#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

SSH_TARGET="${SSH_TARGET:-admin@192.168.8.152}"
REMOTE_DIR="${REMOTE_DIR:-woc-automation-test}"
COMPOSE_LOCAL="${COMPOSE_LOCAL:-$ROOT/fnos/woc-automation-test/docker-compose.yaml}"
DRY_RUN="${DRY_RUN:-0}"

if [[ "${1:-}" == "--dry-run" ]]; then
  DRY_RUN=1
fi

if [[ -z "${PANEL_ADMIN_PASSWORD:-}" ]]; then
  echo "ERROR: set PANEL_ADMIN_PASSWORD before running." >&2
  echo "Example:" >&2
  echo "  PANEL_ADMIN_PASSWORD='replace-me' SSH_TARGET='admin@192.168.8.152' $0" >&2
  exit 2
fi

if [[ ! "$REMOTE_DIR" =~ ^[A-Za-z0-9._/@~-]+$ ]]; then
  echo "ERROR: REMOTE_DIR may only contain letters, numbers, '.', '_', '-', '/', '@', and '~'." >&2
  exit 2
fi

tmp_compose="$(mktemp "${TMPDIR:-/tmp}/woc-automation-test.XXXXXX.yml")"
redacted_compose=""
cleanup() {
  rm -f "$tmp_compose" "${redacted_compose:-}"
}
trap cleanup EXIT

python3 - "$COMPOSE_LOCAL" "$tmp_compose" <<'PY'
import json
import os
import re
import sys

src, dst = sys.argv[1], sys.argv[2]
with open(src, "r", encoding="utf-8") as fh:
    text = fh.read()

def set_env(compose_text: str, key: str, value: str) -> str:
    env_item = json.dumps(f"{key}={value}", ensure_ascii=False)
    pattern = re.compile(rf"^(\s*-\s*){re.escape(key)}=.*$", re.MULTILINE)
    next_text, count = pattern.subn(lambda match: match.group(1) + env_item, compose_text)
    if count != 1:
        raise SystemExit(f"ERROR: expected exactly one {key}= entry, found {count}")
    return next_text

text = set_env(text, "PANEL_ADMIN_PASSWORD", os.environ["PANEL_ADMIN_PASSWORD"])

optional_envs = [
    "AUTOMATION_AI_API_KEY",
    "AUTOMATION_AI_BASE_URL",
    "AUTOMATION_AI_MODEL",
    "AUTOMATION_BRIDGE_TOKEN",
]
for key in optional_envs:
    if os.environ.get(key):
        text = set_env(text, key, os.environ[key])

with open(dst, "w", encoding="utf-8") as fh:
    fh.write(text)
PY

redacted_compose="$(mktemp "${TMPDIR:-/tmp}/woc-automation-test.redacted.XXXXXX.yml")"
python3 - "$tmp_compose" "$redacted_compose" <<'PY'
import re
import sys

src, dst = sys.argv[1], sys.argv[2]
with open(src, "r", encoding="utf-8") as fh:
    text = fh.read()

for key in ("PANEL_ADMIN_PASSWORD", "AUTOMATION_AI_API_KEY", "AUTOMATION_BRIDGE_TOKEN"):
    text = re.sub(
        rf"^(\s*-\s*)\"?{key}=.*$",
        rf'\1"{key}=***REDACTED***"',
        text,
        flags=re.MULTILINE,
    )

with open(dst, "w", encoding="utf-8") as fh:
    fh.write(text)
PY

echo "Deploying WOC automation test panel"
echo "  target:     $SSH_TARGET"
echo "  remote dir: $REMOTE_DIR"
echo "  compose:    $COMPOSE_LOCAL"
echo

if [[ "$DRY_RUN" == "1" ]]; then
  echo "DRY_RUN=1, not connecting to NAS. Rendered compose with secrets redacted:"
  echo
  cat "$redacted_compose"
  exit 0
fi

ssh "$SSH_TARGET" "mkdir -p $REMOTE_DIR && command -v docker >/dev/null && docker compose version >/dev/null"
scp "$tmp_compose" "$SSH_TARGET:$REMOTE_DIR/docker-compose.yaml"
ssh "$SSH_TARGET" "cd $REMOTE_DIR && docker compose -f docker-compose.yaml pull && docker compose -f docker-compose.yaml up -d"
ssh "$SSH_TARGET" "cd $REMOTE_DIR && docker compose -f docker-compose.yaml ps"

echo
echo "Started test panel on port 36081."
