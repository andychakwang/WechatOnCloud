#!/usr/bin/env bash
set -euo pipefail

# Periodic Mac-side runner for WechatOnCloud <-> WeCom Bridge.
# Safe default mode is dry-run; prepare/send must be explicitly enabled.

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${WECOM_BRIDGE_ENV_FILE:-$HOME/.config/wechat-on-cloud/wecom-bridge.env}"

if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

CLIENT="${WECOM_BRIDGE_CLIENT:-$ROOT/scripts/wecom-bridge-client.mjs}"
HANDLER="${WECOM_REPLY_HANDLER:-$ROOT/scripts/wecom-mac-reply-handler.sh}"
MASS_HANDLER="${WECOM_MASS_HANDLER:-$ROOT/scripts/wecom-mac-mass-handler.sh}"
MOMENT_HANDLER="${WECOM_MOMENT_HANDLER:-$ROOT/scripts/wecom-mac-moment-handler.sh}"
MODE="${WECOM_RUNNER_MODE:-dry-run}"
TARGET="${WECOM_RUNNER_TARGET:-replies}"
LIMIT="${WECOM_RUNNER_LIMIT:-5}"
CLAIM_TTL_SECONDS="${WECOM_CLAIM_TTL_SECONDS:-300}"

usage() {
  cat <<'EOF'
Usage: scripts/wecom-bridge-runner.sh [run-once|print-config]

Config file:
  ~/.config/wechat-on-cloud/wecom-bridge.env

Required environment/config:
  WOC_PANEL_URL=http://nasbot.cloud:36081
  AUTOMATION_BRIDGE_TOKEN=...

Optional:
  WECOM_RUNNER_MODE=dry-run|prepare|send   default: dry-run
  WECOM_RUNNER_TARGET=replies|mass|moments|all
                                            default: replies
  WECOM_RUNNER_LIMIT=5
  WECOM_CLAIM_TTL_SECONDS=300
  WECOM_BRIDGE_WORKER_ID=mac-mini-01
  WECOM_HANDLER_MODE=dry-run|prepare|send
  WECOM_MASS_HANDLER=./scripts/wecom-mac-mass-handler.sh
  WECOM_MOMENT_HANDLER=./scripts/wecom-mac-moment-handler.sh
  WECOM_MOMENT_PASTE_MODE=clipboard-only|current-input
  WECOM_ALLOW_SEND=1                       required for send

Modes:
  dry-run  - list target tasks only; no claim, no window automation
  prepare  - claim target tasks, prepare content in WeCom, do not publish/send
  send     - claim reply/mass tasks, paste, press Enter, mark delivered; requires WECOM_ALLOW_SEND=1

For WECOM_RUNNER_TARGET=moments, only dry-run and prepare are supported. prepare
copies the approved draft to the clipboard by default and marks it prepared.
For WECOM_RUNNER_TARGET=all, tasks run in order: replies, mass, moments. send
mode skips moments because publishing still requires manual confirmation.
EOF
}

cmd="${1:-run-once}"
case "$cmd" in
  help|--help|-h)
    usage
    exit 0
    ;;
  print-config)
    printf 'ROOT=%s\nENV_FILE=%s\nCLIENT=%s\nHANDLER=%s\nMASS_HANDLER=%s\nMOMENT_HANDLER=%s\nMODE=%s\nTARGET=%s\nLIMIT=%s\n' "$ROOT" "$ENV_FILE" "$CLIENT" "$HANDLER" "$MASS_HANDLER" "$MOMENT_HANDLER" "$MODE" "$TARGET" "$LIMIT"
    exit 0
    ;;
  run-once)
    ;;
  *)
    usage >&2
    exit 2
    ;;
esac

if [[ "$MODE" != "dry-run" && "$MODE" != "prepare" && "$MODE" != "send" ]]; then
  echo "ERROR: WECOM_RUNNER_MODE must be dry-run, prepare, or send." >&2
  exit 2
fi

if [[ "$TARGET" != "replies" && "$TARGET" != "mass" && "$TARGET" != "moments" && "$TARGET" != "all" ]]; then
  echo "ERROR: WECOM_RUNNER_TARGET must be replies, mass, moments, or all." >&2
  exit 2
fi

if [[ "$TARGET" == "moments" && "$MODE" == "send" ]]; then
  echo "ERROR: WECOM_RUNNER_TARGET=moments does not support send mode; run prepare, review manually, then use mark-moment-published." >&2
  exit 2
fi

if [[ -z "${WOC_PANEL_URL:-}" && -z "${PANEL_URL:-}" && -z "${WECHATONCLOUD_PANEL_URL:-}" ]]; then
  echo "ERROR: set WOC_PANEL_URL in env or $ENV_FILE." >&2
  exit 2
fi

if [[ -z "${AUTOMATION_BRIDGE_TOKEN:-}" && -z "${WECOM_BRIDGE_TOKEN:-}" ]]; then
  echo "ERROR: set AUTOMATION_BRIDGE_TOKEN in env or $ENV_FILE." >&2
  exit 2
fi

node "$CLIENT" heartbeat --mode "$MODE" >/dev/null

run_all() {
  local replies_file mass_file moments_file
  replies_file="$(mktemp "${TMPDIR:-/tmp}/woc-runner-replies.XXXXXX.json")"
  mass_file="$(mktemp "${TMPDIR:-/tmp}/woc-runner-mass.XXXXXX.json")"
  moments_file="$(mktemp "${TMPDIR:-/tmp}/woc-runner-moments.XXXXXX.json")"
  trap 'rm -f "$replies_file" "$mass_file" "$moments_file"' RETURN

  case "$MODE" in
    dry-run)
      node "$CLIENT" run-approved --limit "$LIMIT" --dry-run --report-run > "$replies_file"
      node "$CLIENT" run-mass --limit "$LIMIT" --dry-run --report-run > "$mass_file"
      node "$CLIENT" run-moments --limit "$LIMIT" --dry-run --report-run > "$moments_file"
      ;;
    prepare)
      node "$CLIENT" run-approved \
        --limit "$LIMIT" \
        --handler "$HANDLER" \
        --claim-ttl-seconds "$CLAIM_TTL_SECONDS" \
        --claim \
        --report-run \
        --report-failure > "$replies_file"
      node "$CLIENT" run-mass \
        --limit "$LIMIT" \
        --handler "$MASS_HANDLER" \
        --claim-ttl-seconds "$CLAIM_TTL_SECONDS" \
        --claim \
        --report-run \
        --report-failure > "$mass_file"
      node "$CLIENT" run-moments \
        --limit "$LIMIT" \
        --handler "$MOMENT_HANDLER" \
        --claim-ttl-seconds "$CLAIM_TTL_SECONDS" \
        --claim \
        --mark-prepared \
        --report-run \
        --report-failure > "$moments_file"
      ;;
    send)
      node "$CLIENT" run-approved \
        --limit "$LIMIT" \
        --handler "$HANDLER" \
        --claim-ttl-seconds "$CLAIM_TTL_SECONDS" \
        --claim \
        --mark-delivered \
        --report-run \
        --report-failure > "$replies_file"
      node "$CLIENT" run-mass \
        --limit "$LIMIT" \
        --handler "$MASS_HANDLER" \
        --claim-ttl-seconds "$CLAIM_TTL_SECONDS" \
        --claim \
        --mark-sent \
        --report-run \
        --report-failure > "$mass_file"
      printf '{"handled":[],"total":0,"skipped":true,"reason":"moments target requires manual publish confirmation"}\n' > "$moments_file"
      ;;
  esac

  node - "$MODE" "$TARGET" "$replies_file" "$mass_file" "$moments_file" <<'NODE'
const [mode, target, repliesFile, massFile, momentsFile] = process.argv.slice(2);
const fs = require('node:fs');
function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    return { error: error.message };
  }
}
const replies = readJson(repliesFile);
const mass = readJson(massFile);
const moments = readJson(momentsFile);
const total =
  Number(replies.total || 0) +
  Number(mass.total || 0) +
  Number(moments.total || 0);
process.stdout.write(`${JSON.stringify({ mode, target, total, replies, mass, moments }, null, 2)}\n`);
NODE
}

case "$MODE" in
  dry-run)
    if [[ "$TARGET" == "all" ]]; then
      run_all
      exit 0
    fi
    if [[ "$TARGET" == "mass" ]]; then
      exec node "$CLIENT" run-mass --limit "$LIMIT" --dry-run --report-run
    fi
    if [[ "$TARGET" == "moments" ]]; then
      exec node "$CLIENT" run-moments --limit "$LIMIT" --dry-run --report-run
    fi
    exec node "$CLIENT" run-approved --limit "$LIMIT" --dry-run --report-run
    ;;
  prepare)
    export WECOM_HANDLER_MODE="${WECOM_HANDLER_MODE:-prepare}"
    if [[ "$TARGET" == "all" ]]; then
      run_all
      exit 0
    fi
    if [[ "$TARGET" == "mass" ]]; then
      exec node "$CLIENT" run-mass \
        --limit "$LIMIT" \
        --handler "$MASS_HANDLER" \
        --claim-ttl-seconds "$CLAIM_TTL_SECONDS" \
        --claim \
        --report-run \
        --report-failure
    fi
    if [[ "$TARGET" == "moments" ]]; then
      exec node "$CLIENT" run-moments \
        --limit "$LIMIT" \
        --handler "$MOMENT_HANDLER" \
        --claim-ttl-seconds "$CLAIM_TTL_SECONDS" \
        --claim \
        --mark-prepared \
        --report-run \
        --report-failure
    fi
    exec node "$CLIENT" run-approved \
      --limit "$LIMIT" \
      --handler "$HANDLER" \
      --claim-ttl-seconds "$CLAIM_TTL_SECONDS" \
      --claim \
      --report-run \
      --report-failure
    ;;
  send)
    export WECOM_HANDLER_MODE="${WECOM_HANDLER_MODE:-send}"
    if [[ "${WECOM_ALLOW_SEND:-}" != "1" ]]; then
      echo "ERROR: send mode requires WECOM_ALLOW_SEND=1." >&2
      exit 2
    fi
    if [[ "$TARGET" == "all" ]]; then
      run_all
      exit 0
    fi
    if [[ "$TARGET" == "mass" ]]; then
      exec node "$CLIENT" run-mass \
        --limit "$LIMIT" \
        --handler "$MASS_HANDLER" \
        --claim-ttl-seconds "$CLAIM_TTL_SECONDS" \
        --claim \
        --mark-sent \
        --report-run \
        --report-failure
    fi
    exec node "$CLIENT" run-approved \
      --limit "$LIMIT" \
      --handler "$HANDLER" \
      --claim-ttl-seconds "$CLAIM_TTL_SECONDS" \
      --claim \
      --mark-delivered \
      --report-run \
      --report-failure
    ;;
esac
