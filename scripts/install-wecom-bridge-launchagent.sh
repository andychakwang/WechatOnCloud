#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LABEL="${WECOM_BRIDGE_LAUNCHD_LABEL:-com.wechatoncloud.wecom-bridge}"
INTERVAL="${WECOM_BRIDGE_INTERVAL_SEC:-60}"
ENV_FILE="${WECOM_BRIDGE_ENV_FILE:-$HOME/.config/wechat-on-cloud/wecom-bridge.env}"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
RUNNER="$ROOT/scripts/wecom-bridge-runner.sh"
MODE="${WECOM_RUNNER_MODE:-dry-run}"
TARGET="${WECOM_RUNNER_TARGET:-replies}"
LIMIT="${WECOM_RUNNER_LIMIT:-5}"
CLAIM_TTL_SECONDS="${WECOM_CLAIM_TTL_SECONDS:-300}"
USE_REMOTE_POLICY="${WECOM_USE_REMOTE_POLICY:-}"
ACCEPT_REMOTE_SEND="${WECOM_ACCEPT_REMOTE_SEND:-}"
USE_RPA_PACKAGE="${WECOM_USE_RPA_PACKAGE:-}"
RPA_PACKAGE_SAVE_DIR="${WECOM_RPA_PACKAGE_SAVE_DIR:-}"
RPA_PACKAGE_ACK="${WECOM_RPA_PACKAGE_ACK:-}"
REQUIRE_TARGET_MATCH="${WECOM_REQUIRE_TARGET_MATCH:-}"
REQUIRE_HANDLER_VERIFICATION="${WECOM_REQUIRE_HANDLER_VERIFICATION:-}"
BRIDGE_CAPABILITIES="${WECOM_BRIDGE_CAPABILITIES:-}"
DRY_RUN=0

if [[ "${1:-}" == "--dry-run" ]]; then
  DRY_RUN=1
fi

quote() {
  local value="${1//\'/\'\\\'\'}"
  printf "'%s'" "$value"
}

if [[ "$MODE" != "dry-run" && "$MODE" != "prepare" && "$MODE" != "send" ]]; then
  echo "ERROR: WECOM_RUNNER_MODE must be dry-run, prepare, or send." >&2
  exit 2
fi

if [[ "$TARGET" != "replies" && "$TARGET" != "mass" && "$TARGET" != "moments" && "$TARGET" != "all" ]]; then
  echo "ERROR: WECOM_RUNNER_TARGET must be replies, mass, moments, or all." >&2
  exit 2
fi

if [[ "$TARGET" == "moments" && "$MODE" == "send" ]]; then
  echo "ERROR: WECOM_RUNNER_TARGET=moments only supports dry-run or prepare." >&2
  exit 2
fi

if [[ "$MODE" == "send" && "${WECOM_ALLOW_SEND:-}" != "1" ]]; then
  echo "ERROR: WECOM_RUNNER_MODE=send requires WECOM_ALLOW_SEND=1." >&2
  exit 2
fi

if [[ "$DRY_RUN" == "0" ]]; then
  if [[ -z "${WOC_PANEL_URL:-}" && -z "${PANEL_URL:-}" && -z "${WECHATONCLOUD_PANEL_URL:-}" ]]; then
    echo "ERROR: set WOC_PANEL_URL before installing." >&2
    exit 2
  fi
  if [[ -z "${AUTOMATION_BRIDGE_TOKEN:-}" && -z "${WECOM_BRIDGE_TOKEN:-}" ]]; then
    echo "ERROR: set AUTOMATION_BRIDGE_TOKEN before installing." >&2
    exit 2
  fi
fi

env_text() {
  {
    echo "# WechatOnCloud WeCom Bridge runner config"
    echo "# chmod 600; contains the Bridge token."
    [[ -n "${WOC_PANEL_URL:-}" ]] && printf 'WOC_PANEL_URL=%s\n' "$(quote "$WOC_PANEL_URL")"
    [[ -n "${PANEL_URL:-}" ]] && printf 'PANEL_URL=%s\n' "$(quote "$PANEL_URL")"
    [[ -n "${WECHATONCLOUD_PANEL_URL:-}" ]] && printf 'WECHATONCLOUD_PANEL_URL=%s\n' "$(quote "$WECHATONCLOUD_PANEL_URL")"
    [[ -n "${AUTOMATION_BRIDGE_TOKEN:-}" ]] && printf 'AUTOMATION_BRIDGE_TOKEN=%s\n' "$(quote "$AUTOMATION_BRIDGE_TOKEN")"
    [[ -n "${WECOM_BRIDGE_TOKEN:-}" ]] && printf 'WECOM_BRIDGE_TOKEN=%s\n' "$(quote "$WECOM_BRIDGE_TOKEN")"
    [[ -n "$USE_REMOTE_POLICY" ]] && printf 'WECOM_USE_REMOTE_POLICY=%s\n' "$(quote "$USE_REMOTE_POLICY")"
    [[ -n "$ACCEPT_REMOTE_SEND" ]] && printf 'WECOM_ACCEPT_REMOTE_SEND=%s\n' "$(quote "$ACCEPT_REMOTE_SEND")"
    [[ -n "$USE_RPA_PACKAGE" ]] && printf 'WECOM_USE_RPA_PACKAGE=%s\n' "$(quote "$USE_RPA_PACKAGE")"
    [[ -n "$RPA_PACKAGE_SAVE_DIR" ]] && printf 'WECOM_RPA_PACKAGE_SAVE_DIR=%s\n' "$(quote "$RPA_PACKAGE_SAVE_DIR")"
    [[ -n "$RPA_PACKAGE_ACK" ]] && printf 'WECOM_RPA_PACKAGE_ACK=%s\n' "$(quote "$RPA_PACKAGE_ACK")"
    printf 'WECOM_RUNNER_MODE=%s\n' "$(quote "$MODE")"
    printf 'WECOM_RUNNER_TARGET=%s\n' "$(quote "$TARGET")"
    printf 'WECOM_RUNNER_LIMIT=%s\n' "$(quote "$LIMIT")"
    printf 'WECOM_MASS_HANDLER=%s\n' "$(quote "${WECOM_MASS_HANDLER:-$ROOT/scripts/wecom-mac-mass-handler.sh}")"
    printf 'WECOM_MOMENT_HANDLER=%s\n' "$(quote "${WECOM_MOMENT_HANDLER:-$ROOT/scripts/wecom-mac-moment-handler.sh}")"
    printf 'WECOM_MOMENT_PASTE_MODE=%s\n' "$(quote "${WECOM_MOMENT_PASTE_MODE:-clipboard-only}")"
    printf 'WECOM_CLAIM_TTL_SECONDS=%s\n' "$(quote "$CLAIM_TTL_SECONDS")"
    printf 'WECOM_BRIDGE_WORKER_ID=%s\n' "$(quote "${WECOM_BRIDGE_WORKER_ID:-$(hostname)-launchagent}")"
    printf 'WECOM_APP_NAME=%s\n' "$(quote "${WECOM_APP_NAME:-企业微信}")"
    printf 'WECOM_SEARCH_SHORTCUT=%s\n' "$(quote "${WECOM_SEARCH_SHORTCUT:-command+k}")"
    [[ -n "$BRIDGE_CAPABILITIES" ]] && printf 'WECOM_BRIDGE_CAPABILITIES=%s\n' "$(quote "$BRIDGE_CAPABILITIES")"
    [[ -n "$REQUIRE_TARGET_MATCH" ]] && printf 'WECOM_REQUIRE_TARGET_MATCH=%s\n' "$(quote "$REQUIRE_TARGET_MATCH")"
    [[ -n "$REQUIRE_HANDLER_VERIFICATION" ]] && printf 'WECOM_REQUIRE_HANDLER_VERIFICATION=%s\n' "$(quote "$REQUIRE_HANDLER_VERIFICATION")"
    [[ -n "${WECOM_ALLOW_SEND:-}" ]] && printf 'WECOM_ALLOW_SEND=%s\n' "$(quote "$WECOM_ALLOW_SEND")"
  }
}

plist_text() {
  cat <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>$LABEL</string>
  <key>ProgramArguments</key>
  <array>
    <string>$RUNNER</string>
    <string>run-once</string>
  </array>
  <key>StartInterval</key>
  <integer>$INTERVAL</integer>
  <key>RunAtLoad</key>
  <true/>
  <key>StandardOutPath</key>
  <string>$HOME/Library/Logs/$LABEL.log</string>
  <key>StandardErrorPath</key>
  <string>$HOME/Library/Logs/$LABEL.err.log</string>
</dict>
</plist>
EOF
}

if [[ "$DRY_RUN" == "1" ]]; then
  echo "ENV_FILE=$ENV_FILE"
  echo "PLIST=$PLIST"
  echo
  env_text
  echo
  plist_text
  exit 0
fi

mkdir -p "$(dirname "$ENV_FILE")" "$HOME/Library/LaunchAgents" "$HOME/Library/Logs"
umask 077
env_text > "$ENV_FILE"
chmod 600 "$ENV_FILE"
plist_text > "$PLIST"
chmod 644 "$PLIST"

launchctl unload "$PLIST" >/dev/null 2>&1 || true
launchctl load "$PLIST"

echo "Installed $LABEL"
echo "Config: $ENV_FILE"
echo "Plist:  $PLIST"
echo "Mode:   $MODE"
echo "Logs:   $HOME/Library/Logs/$LABEL.log"
