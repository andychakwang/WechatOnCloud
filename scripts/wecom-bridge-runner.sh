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
MODE="${WECOM_RUNNER_MODE:-dry-run}"
LIMIT="${WECOM_RUNNER_LIMIT:-5}"

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
  WECOM_RUNNER_LIMIT=5
  WECOM_BRIDGE_WORKER_ID=mac-mini-01
  WECOM_HANDLER_MODE=dry-run|prepare|send
  WECOM_ALLOW_SEND=1                       required for send

Modes:
  dry-run  - list approved replies only; no claim, no window automation
  prepare  - claim one or more replies, paste into WeCom input box, do not send
  send     - claim, paste, press Enter, mark delivered; requires WECOM_ALLOW_SEND=1
EOF
}

cmd="${1:-run-once}"
case "$cmd" in
  help|--help|-h)
    usage
    exit 0
    ;;
  print-config)
    printf 'ROOT=%s\nENV_FILE=%s\nCLIENT=%s\nHANDLER=%s\nMODE=%s\nLIMIT=%s\n' "$ROOT" "$ENV_FILE" "$CLIENT" "$HANDLER" "$MODE" "$LIMIT"
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

if [[ -z "${WOC_PANEL_URL:-}" && -z "${PANEL_URL:-}" && -z "${WECHATONCLOUD_PANEL_URL:-}" ]]; then
  echo "ERROR: set WOC_PANEL_URL in env or $ENV_FILE." >&2
  exit 2
fi

if [[ -z "${AUTOMATION_BRIDGE_TOKEN:-}" && -z "${WECOM_BRIDGE_TOKEN:-}" ]]; then
  echo "ERROR: set AUTOMATION_BRIDGE_TOKEN in env or $ENV_FILE." >&2
  exit 2
fi

node "$CLIENT" heartbeat --mode "$MODE" >/dev/null

case "$MODE" in
  dry-run)
    exec node "$CLIENT" run-approved --limit "$LIMIT" --dry-run
    ;;
  prepare)
    export WECOM_HANDLER_MODE="${WECOM_HANDLER_MODE:-prepare}"
    exec node "$CLIENT" run-approved \
      --limit "$LIMIT" \
      --handler "$HANDLER" \
      --claim \
      --report-failure
    ;;
  send)
    export WECOM_HANDLER_MODE="${WECOM_HANDLER_MODE:-send}"
    if [[ "${WECOM_ALLOW_SEND:-}" != "1" ]]; then
      echo "ERROR: send mode requires WECOM_ALLOW_SEND=1." >&2
      exit 2
    fi
    exec node "$CLIENT" run-approved \
      --limit "$LIMIT" \
      --handler "$HANDLER" \
      --claim \
      --mark-delivered \
      --report-failure
    ;;
esac
