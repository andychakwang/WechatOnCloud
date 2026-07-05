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

if [[ -n "${WECOM_MATERIAL_MAP_FILE:-}" ]]; then
  WECOM_MATERIAL_MAP_FILE="${WECOM_MATERIAL_MAP_FILE/#\~/$HOME}"
  export WECOM_MATERIAL_MAP_FILE
fi

CLIENT="${WECOM_BRIDGE_CLIENT:-$ROOT/scripts/wecom-bridge-client.mjs}"
HANDLER="${WECOM_REPLY_HANDLER:-$ROOT/scripts/wecom-mac-reply-handler.sh}"
MASS_HANDLER="${WECOM_MASS_HANDLER:-$ROOT/scripts/wecom-mac-mass-handler.sh}"
MOMENT_HANDLER="${WECOM_MOMENT_HANDLER:-$ROOT/scripts/wecom-mac-moment-handler.sh}"
MODE="${WECOM_RUNNER_MODE:-dry-run}"
TARGET="${WECOM_RUNNER_TARGET:-replies}"
LIMIT="${WECOM_RUNNER_LIMIT:-5}"
CLAIM_TTL_SECONDS="${WECOM_CLAIM_TTL_SECONDS:-300}"
USE_RPA_PACKAGE="${WECOM_USE_RPA_PACKAGE:-}"
RUNNER_ENGINE="${WECOM_RUNNER_ENGINE:-bridge}"
RPA_PACKAGE_ACK="${WECOM_RPA_PACKAGE_ACK:-}"
RPA_PACKAGE_SAVE_DIR="${WECOM_RPA_PACKAGE_SAVE_DIR:-}"

usage() {
  cat <<'EOF'
Usage: scripts/wecom-bridge-runner.sh [run-once|print-config|doctor]

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
  WECOM_USE_REMOTE_POLICY=1               pull mode/target/limits from panel
  WECOM_ACCEPT_REMOTE_SEND=1              allow remote policy to enable send
  WECOM_USE_RPA_PACKAGE=1                 run through the standard RPA package boundary
  WECOM_RPA_PACKAGE_SAVE_DIR=~/...        keep a JSONL copy of each pulled package
  WECOM_RPA_PACKAGE_ACK=1                 ack successful package tasks where supported
  WECOM_CLAIM_TTL_SECONDS=300
  WECOM_BRIDGE_WORKER_ID=mac-mini-01
  WECOM_HANDLER_MODE=dry-run|prepare|send
  WECOM_MATERIAL_MAP_FILE=~/.config/wechat-on-cloud/wecom-materials.json
  WECOM_SYNC_MATERIAL_MAP=1                 set 0 to disable material-map refresh
  WECOM_REQUIRE_TARGET_MATCH=1              abort reply/mass before paste if target title mismatches
  WECOM_REQUIRE_HANDLER_VERIFICATION=1      require handler verification before marking delivered/sent/prepared
  WECOM_MASS_HANDLER=./scripts/wecom-mac-mass-handler.sh
  WECOM_MOMENT_HANDLER=./scripts/wecom-mac-moment-handler.sh
  WECOM_MOMENT_PASTE_MODE=clipboard-only|current-input
  WECOM_ALLOW_SEND=1                       required for send
  WECOM_DOCTOR_REMOTE=0                    skip remote policy auth check in doctor
  WECOM_DOCTOR_APP=0                       skip WeCom AppleScript window check in doctor
  WECOM_DOCTOR_REPORT=1                    report doctor result to the panel

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
    printf 'ROOT=%s\nENV_FILE=%s\nCLIENT=%s\nHANDLER=%s\nMASS_HANDLER=%s\nMOMENT_HANDLER=%s\nMODE=%s\nTARGET=%s\nLIMIT=%s\nENGINE=%s\nUSE_RPA_PACKAGE=%s\nRPA_PACKAGE_SAVE_DIR=%s\nMATERIAL_MAP_FILE=%s\n' "$ROOT" "$ENV_FILE" "$CLIENT" "$HANDLER" "$MASS_HANDLER" "$MOMENT_HANDLER" "$MODE" "$TARGET" "$LIMIT" "$RUNNER_ENGINE" "$USE_RPA_PACKAGE" "$RPA_PACKAGE_SAVE_DIR" "${WECOM_MATERIAL_MAP_FILE:-}"
    exit 0
    ;;
  doctor)
    ;;
  run-once)
    ;;
  *)
    usage >&2
    exit 2
    ;;
esac

validate_runner_config() {
  if [[ "$MODE" != "dry-run" && "$MODE" != "prepare" && "$MODE" != "send" ]]; then
    echo "ERROR: WECOM_RUNNER_MODE must be dry-run, prepare, or send." >&2
    return 2
  fi

  if [[ "$TARGET" != "replies" && "$TARGET" != "mass" && "$TARGET" != "moments" && "$TARGET" != "all" ]]; then
    echo "ERROR: WECOM_RUNNER_TARGET must be replies, mass, moments, or all." >&2
    return 2
  fi

  if [[ "$TARGET" == "moments" && "$MODE" == "send" ]]; then
    echo "ERROR: WECOM_RUNNER_TARGET=moments does not support send mode; run prepare, review manually, then use mark-moment-published." >&2
    return 2
  fi
}

DOCTOR_FAILURES=0
DOCTOR_WARNINGS=0
DOCTOR_ITEMS_FILE=""

doctor_ok() {
  printf 'OK    %s\n' "$*"
  if [[ -n "$DOCTOR_ITEMS_FILE" ]]; then
    printf 'ok\t%s\n' "$*" >> "$DOCTOR_ITEMS_FILE"
  fi
}

doctor_warn() {
  DOCTOR_WARNINGS=$((DOCTOR_WARNINGS + 1))
  printf 'WARN  %s\n' "$*"
  if [[ -n "$DOCTOR_ITEMS_FILE" ]]; then
    printf 'warn\t%s\n' "$*" >> "$DOCTOR_ITEMS_FILE"
  fi
}

doctor_fail() {
  DOCTOR_FAILURES=$((DOCTOR_FAILURES + 1))
  printf 'FAIL  %s\n' "$*"
  if [[ -n "$DOCTOR_ITEMS_FILE" ]]; then
    printf 'fail\t%s\n' "$*" >> "$DOCTOR_ITEMS_FILE"
  fi
}

doctor_is_disabled() {
  local value
  value="$(printf '%s' "${1:-}" | tr '[:upper:]' '[:lower:]')"
  [[ "$value" == "0" || "$value" == "false" || "$value" == "off" || "$value" == "no" ]]
}

doctor_check_file() {
  local label="$1"
  local path="$2"
  local executable="${3:-0}"
  if [[ ! -e "$path" ]]; then
    doctor_fail "$label missing: $path"
    return
  fi
  if [[ ! -r "$path" ]]; then
    doctor_fail "$label is not readable: $path"
    return
  fi
  if [[ "$executable" == "1" && ! -x "$path" ]]; then
    doctor_fail "$label is not executable: $path"
    return
  fi
  doctor_ok "$label ready: $path"
}

doctor_env_permissions() {
  if [[ ! -f "$ENV_FILE" ]]; then
    doctor_warn "config file not found yet: $ENV_FILE"
    return
  fi
  local perms
  perms="$(stat -f '%Lp' "$ENV_FILE" 2>/dev/null || stat -c '%a' "$ENV_FILE" 2>/dev/null || true)"
  if [[ -z "$perms" ]]; then
    doctor_ok "config file exists: $ENV_FILE"
    return
  fi
  case "$perms" in
    400|500|600|700)
      doctor_ok "config file permissions $perms: $ENV_FILE"
      ;;
    *)
      doctor_warn "config file permissions are $perms; prefer 600 because it contains the Bridge token"
      ;;
  esac
}

doctor_remote_policy() {
  if doctor_is_disabled "${WECOM_DOCTOR_REMOTE:-}"; then
    doctor_warn "remote policy check skipped by WECOM_DOCTOR_REMOTE=0"
    return
  fi
  if [[ -z "${WOC_PANEL_URL:-}" && -z "${PANEL_URL:-}" && -z "${WECHATONCLOUD_PANEL_URL:-}" ]]; then
    doctor_fail "missing WOC_PANEL_URL/PANEL_URL/WECHATONCLOUD_PANEL_URL"
    return
  fi
  if [[ -z "${AUTOMATION_BRIDGE_TOKEN:-}" && -z "${WECOM_BRIDGE_TOKEN:-}" ]]; then
    doctor_fail "missing AUTOMATION_BRIDGE_TOKEN/WECOM_BRIDGE_TOKEN"
    return
  fi
  local tmp
  tmp="$(mktemp "${TMPDIR:-/tmp}/woc-runner-doctor-policy.XXXXXX.json")"
  if node "$CLIENT" runner-policy --worker-id "${WECOM_BRIDGE_WORKER_ID:-doctor}" > "$tmp" 2>"$tmp.err"; then
    local summary
    summary="$(node - "$tmp" <<'NODE'
const fs = require('node:fs');
const payload = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const policy = payload.policy || {};
const parts = [
  `engine=${policy.runnerEngine || 'bridge'}`,
  `mode=${policy.mode || 'unknown'}`,
  `target=${policy.target || 'unknown'}`,
  `limit=${policy.limit ?? 'unknown'}`,
  `ttl=${policy.claimTtlSeconds ?? 'unknown'}s`,
  `interval=${policy.heartbeatIntervalSeconds ?? 'unknown'}s`,
];
process.stdout.write(parts.join(', '));
NODE
)"
    rm -f "$tmp" "$tmp.err"
    doctor_ok "remote policy reachable: $summary"
  else
    local err
    err="$(tr '\n' ' ' < "$tmp.err" | sed 's/[[:space:]]\{1,\}/ /g' | cut -c1-240)"
    rm -f "$tmp" "$tmp.err"
    doctor_fail "remote policy check failed${err:+: $err}"
  fi
}

doctor_material_map() {
  if [[ -z "${WECOM_MATERIAL_MAP_FILE:-}" ]]; then
    doctor_warn "WECOM_MATERIAL_MAP_FILE not set; image-key steps require a local material map"
    return
  fi
  if [[ -f "$WECOM_MATERIAL_MAP_FILE" ]]; then
    doctor_ok "material map file exists: $WECOM_MATERIAL_MAP_FILE"
  else
    doctor_warn "material map file missing; runner can sync it before run-once: $WECOM_MATERIAL_MAP_FILE"
  fi
}

doctor_wecom_app() {
  if doctor_is_disabled "${WECOM_DOCTOR_APP:-}"; then
    doctor_warn "WeCom app/window check skipped by WECOM_DOCTOR_APP=0"
    return
  fi
  if ! command -v osascript >/dev/null 2>&1; then
    doctor_fail "osascript not found; prepare/send require macOS Automation"
    return
  fi
  local app_name="${WECOM_APP_NAME:-企业微信}"
  local snapshot
  if snapshot="$(osascript - "$app_name" <<'APPLESCRIPT' 2>/dev/null
on run argv
  set appName to item 1 of argv
  set activeApp to ""
  set windowTitle to ""
  tell application "System Events"
    if exists process appName then
      tell process appName
        set activeApp to name
        if exists window 1 then set windowTitle to name of window 1
      end tell
    end if
  end tell
  return activeApp & linefeed & windowTitle
end run
APPLESCRIPT
)"; then
    local active_app window_title
    active_app="$(printf '%s' "$snapshot" | sed -n '1p')"
    window_title="$(printf '%s' "$snapshot" | sed -n '2p')"
    if [[ "$active_app" == "$app_name" ]]; then
      if [[ -n "$window_title" ]]; then
        doctor_ok "WeCom process visible: $active_app / $window_title"
      else
        doctor_warn "WeCom process is running but no window title was readable"
      fi
    else
      doctor_warn "WeCom process '$app_name' is not running or not visible to System Events"
    fi
  else
    doctor_fail "unable to query WeCom via AppleScript; check Automation/Accessibility permission for Terminal"
  fi
}

run_doctor() {
  local started_at finished_at duration_ms report_status summary report_tmp
  local started_epoch
  started_at="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
  started_epoch="$(date +%s)"
  DOCTOR_ITEMS_FILE="$(mktemp "${TMPDIR:-/tmp}/woc-runner-doctor-items.XXXXXX.tsv")"
  printf 'WeCom Bridge runner doctor\n'
  printf 'ROOT=%s\nENV_FILE=%s\nMODE=%s\nTARGET=%s\nLIMIT=%s\n\n' "$ROOT" "$ENV_FILE" "$MODE" "$TARGET" "$LIMIT"

  if command -v node >/dev/null 2>&1; then
    doctor_ok "node available: $(node --version)"
  else
    doctor_fail "node is required"
  fi
  if command -v osascript >/dev/null 2>&1; then
    doctor_ok "osascript available"
  else
    doctor_warn "osascript not found; dry-run can work but prepare/send cannot"
  fi
  if command -v launchctl >/dev/null 2>&1; then
    doctor_ok "launchctl available"
  else
    doctor_warn "launchctl not found; LaunchAgent install is macOS-only"
  fi

  doctor_env_permissions
  doctor_check_file "Bridge client" "$CLIENT" 1
  doctor_check_file "reply handler" "$HANDLER" 1
  doctor_check_file "mass handler" "$MASS_HANDLER" 1
  doctor_check_file "moment handler" "$MOMENT_HANDLER" 1

  local validate_err
  validate_err="$(mktemp "${TMPDIR:-/tmp}/woc-runner-doctor-validate.XXXXXX.err")"
  if validate_runner_config 2>"$validate_err"; then
    doctor_ok "runner config valid: mode=$MODE target=$TARGET"
  else
    doctor_fail "$(tr '\n' ' ' <"$validate_err" | sed 's/[[:space:]]\{1,\}/ /g')"
  fi
  rm -f "$validate_err"

  doctor_remote_policy
  doctor_material_map
  doctor_wecom_app

  printf '\nSummary: %s failure(s), %s warning(s)\n' "$DOCTOR_FAILURES" "$DOCTOR_WARNINGS"
  finished_at="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
  duration_ms="$(( ( $(date +%s) - started_epoch ) * 1000 ))"
  report_status="completed"
  if [[ "$DOCTOR_FAILURES" -gt 0 ]]; then
    report_status="failed"
  fi
  summary="doctor failures=$DOCTOR_FAILURES warnings=$DOCTOR_WARNINGS"

  if [[ "${WECOM_DOCTOR_REPORT:-}" == "1" || "${WECOM_DOCTOR_REPORT:-}" == "true" ]]; then
    if [[ -z "${WOC_PANEL_URL:-}" && -z "${PANEL_URL:-}" && -z "${WECHATONCLOUD_PANEL_URL:-}" ]]; then
      printf 'WARN  doctor report skipped: missing panel URL\n'
    elif [[ -z "${AUTOMATION_BRIDGE_TOKEN:-}" && -z "${WECOM_BRIDGE_TOKEN:-}" ]]; then
      printf 'WARN  doctor report skipped: missing Bridge token\n'
    else
      report_tmp="$(mktemp "${TMPDIR:-/tmp}/woc-runner-doctor-report.XXXXXX.json")"
      node - "$DOCTOR_ITEMS_FILE" > "$report_tmp" <<'NODE'
const fs = require('node:fs');
const file = process.argv[2];
const rows = fs.readFileSync(file, 'utf8').split(/\r?\n/).filter(Boolean);
const items = rows.map((row, index) => {
  const [level, ...rest] = row.split('\t');
  const message = rest.join('\t').trim();
  return {
    id: `doctor-${index + 1}`,
    target: 'doctor',
    name: message || level,
    action: level,
    ok: level === 'ok',
    ...(level === 'warn' || level === 'fail' ? { error: message } : {}),
  };
});
process.stdout.write(JSON.stringify(items));
NODE
      if node "$CLIENT" report-run \
        --target doctor \
        --mode doctor \
        --status "$report_status" \
        --started-at "$started_at" \
        --finished-at "$finished_at" \
        --duration-ms "$duration_ms" \
        --worker-id "${WECOM_BRIDGE_WORKER_ID:-doctor}" \
        --summary "$summary" \
        --items-json "@$report_tmp" >/dev/null; then
        printf 'OK    doctor report uploaded\n'
      else
        printf 'WARN  doctor report upload failed\n'
      fi
      rm -f "$report_tmp"
    fi
  fi

  rm -f "$DOCTOR_ITEMS_FILE"
  DOCTOR_ITEMS_FILE=""
  if [[ "$DOCTOR_FAILURES" -gt 0 ]]; then
    return 1
  fi
}

if [[ "$cmd" == "doctor" ]]; then
  run_doctor
  exit $?
fi

validate_runner_config || exit $?

if [[ -z "${WOC_PANEL_URL:-}" && -z "${PANEL_URL:-}" && -z "${WECHATONCLOUD_PANEL_URL:-}" ]]; then
  echo "ERROR: set WOC_PANEL_URL in env or $ENV_FILE." >&2
  exit 2
fi

if [[ -z "${AUTOMATION_BRIDGE_TOKEN:-}" && -z "${WECOM_BRIDGE_TOKEN:-}" ]]; then
  echo "ERROR: set AUTOMATION_BRIDGE_TOKEN in env or $ENV_FILE." >&2
  exit 2
fi

if [[ "${WECOM_USE_REMOTE_POLICY:-}" == "1" || "${WECOM_USE_REMOTE_POLICY:-}" == "true" ]]; then
  policy_file="$(mktemp "${TMPDIR:-/tmp}/woc-runner-policy.XXXXXX.json")"
  policy_args=(runner-policy)
  if [[ -n "${WECOM_BRIDGE_WORKER_ID:-}" ]]; then
    policy_args+=(--worker-id "$WECOM_BRIDGE_WORKER_ID")
  fi
  if node "$CLIENT" "${policy_args[@]}" > "$policy_file"; then
    remote_allow_send=""
    while IFS='=' read -r key value; do
      case "$key" in
        MODE) MODE="$value" ;;
        RUNNER_ENGINE) RUNNER_ENGINE="$value" ;;
        USE_RPA_PACKAGE) USE_RPA_PACKAGE="$value" ;;
        TARGET) TARGET="$value" ;;
        LIMIT) LIMIT="$value" ;;
        CLAIM_TTL_SECONDS) CLAIM_TTL_SECONDS="$value" ;;
        MOMENT_PASTE_MODE) export WECOM_MOMENT_PASTE_MODE="$value" ;;
        BRIDGE_INTERVAL_SEC) export WECOM_BRIDGE_INTERVAL_SEC="$value" ;;
        ALLOW_SEND) remote_allow_send="$value" ;;
        REQUIRE_TARGET_MATCH) export WECOM_REQUIRE_TARGET_MATCH="$value" ;;
        REQUIRE_HANDLER_VERIFICATION) export WECOM_REQUIRE_HANDLER_VERIFICATION="$value" ;;
      esac
    done < <(node - "$policy_file" <<'NODE'
const fs = require('node:fs');
const payload = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const policy = payload.policy || {};
const out = {
  RUNNER_ENGINE: policy.runnerEngine,
  USE_RPA_PACKAGE: policy.runnerEngine === 'rpa-package' ? '1' : '0',
  MODE: policy.mode,
  TARGET: policy.target,
  LIMIT: policy.limit,
  CLAIM_TTL_SECONDS: policy.claimTtlSeconds,
  MOMENT_PASTE_MODE: policy.momentPasteMode,
  BRIDGE_INTERVAL_SEC: policy.heartbeatIntervalSeconds,
  ALLOW_SEND: policy.allowSend ? '1' : '',
  REQUIRE_TARGET_MATCH: policy.requireTargetMatch ? '1' : '0',
  REQUIRE_HANDLER_VERIFICATION: policy.requireHandlerVerification ? '1' : '0',
};
for (const [key, value] of Object.entries(out)) {
  if (value !== undefined && value !== null && String(value).length > 0) {
    process.stdout.write(`${key}=${String(value).replace(/[\r\n=]/g, '')}\n`);
  }
}
NODE
)
    rm -f "$policy_file"
    if [[ "$remote_allow_send" == "1" && "${WECOM_ACCEPT_REMOTE_SEND:-}" == "1" ]]; then
      export WECOM_ALLOW_SEND=1
    elif [[ "$MODE" == "send" && "${WECOM_ALLOW_SEND:-}" != "1" ]]; then
      echo "WARN: remote runner policy requested send; downgrading to prepare because WECOM_ACCEPT_REMOTE_SEND/WECOM_ALLOW_SEND is not set." >&2
      MODE="prepare"
    fi
  else
    rm -f "$policy_file"
    echo "WARN: failed to fetch remote runner policy; using local runner config." >&2
  fi
fi

validate_runner_config || exit $?

if [[ -n "${WECOM_MATERIAL_MAP_FILE:-}" && "${WECOM_SYNC_MATERIAL_MAP:-1}" != "0" ]]; then
  mkdir -p "$(dirname "$WECOM_MATERIAL_MAP_FILE")"
  if ! node "$CLIENT" material-map --kind image --output "$WECOM_MATERIAL_MAP_FILE" >/dev/null; then
    echo "WARN: failed to sync material map to $WECOM_MATERIAL_MAP_FILE; continuing with existing file if present." >&2
  fi
fi

if [[ -z "${WECOM_BRIDGE_CAPABILITIES:-}" ]]; then
  WECOM_BRIDGE_CAPABILITIES="reply,mass,moment,prepare,material-map"
  if [[ "$MODE" == "send" && "${WECOM_ALLOW_SEND:-}" == "1" ]]; then
    WECOM_BRIDGE_CAPABILITIES="${WECOM_BRIDGE_CAPABILITIES},send"
  fi
  if [[ "${WECOM_VERIFY_TARGET:-1}" != "0" || "${WECOM_REQUIRE_TARGET_MATCH:-}" == "1" ]]; then
    WECOM_BRIDGE_CAPABILITIES="${WECOM_BRIDGE_CAPABILITIES},target-match"
  fi
  if [[ "${WECOM_REQUIRE_HANDLER_VERIFICATION:-}" == "1" ]]; then
    WECOM_BRIDGE_CAPABILITIES="${WECOM_BRIDGE_CAPABILITIES},handler-verification"
  fi
  if [[ "${WECOM_VISUAL_VERIFICATION:-}" == "1" || "${WECOM_OCR_VERIFICATION:-}" == "1" ]]; then
    WECOM_BRIDGE_CAPABILITIES="${WECOM_BRIDGE_CAPABILITIES},visual-verification"
  fi
  export WECOM_BRIDGE_CAPABILITIES
fi

node "$CLIENT" heartbeat --mode "$MODE" >/dev/null

run_rpa_package_engine() {
  local args
  args=(
    run-cloud-rpa-package
    --target "$TARGET"
    --limit "$LIMIT"
    --mode "$MODE"
    --handler-reply "$HANDLER"
    --handler-mass "$MASS_HANDLER"
    --handler-moment "$MOMENT_HANDLER"
    --report-run
    --report-failure
  )
  if [[ "$MODE" == "send" || "$RPA_PACKAGE_ACK" == "1" || "$RPA_PACKAGE_ACK" == "true" ]]; then
    args+=(--ack)
  fi
  if [[ -n "$RPA_PACKAGE_SAVE_DIR" ]]; then
    RPA_PACKAGE_SAVE_DIR="${RPA_PACKAGE_SAVE_DIR/#\~/$HOME}"
    mkdir -p "$RPA_PACKAGE_SAVE_DIR"
    args+=(--save-package-dir "$RPA_PACKAGE_SAVE_DIR")
  fi
  exec node "$CLIENT" "${args[@]}"
}

if [[ "$USE_RPA_PACKAGE" == "1" || "$USE_RPA_PACKAGE" == "true" || "$RUNNER_ENGINE" == "rpa-package" ]]; then
  run_rpa_package_engine
fi

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
