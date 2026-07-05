#!/usr/bin/env bash
set -euo pipefail

# Handler for scripts/wecom-bridge-client.mjs run-mass.
# Safe default: prepare a mass-send message in the WeCom input box, but do not send it.
#
# Environment:
#   WECOM_HANDLER_MODE=dry-run|prepare|send   default: prepare
#   WECOM_ALLOW_SEND=1                        required when mode=send
#   WECOM_APP_NAME='企业微信'                  macOS app name
#   WECOM_SEARCH_SHORTCUT=command+k|command+f|none
#   WECOM_VERIFY_TARGET=1                     include window-title verification in handler JSON
#   WECOM_REQUIRE_TARGET_MATCH=1              abort before paste/send unless window title matches target

APP_NAME="${WECOM_APP_NAME:-企业微信}"
MODE="${WECOM_HANDLER_MODE:-prepare}"
SEARCH_SHORTCUT="${WECOM_SEARCH_SHORTCUT:-command+k}"

if [[ "$MODE" != "dry-run" && "$MODE" != "prepare" && "$MODE" != "send" ]]; then
  echo "ERROR: WECOM_HANDLER_MODE must be dry-run, prepare, or send." >&2
  exit 2
fi

if [[ "$MODE" == "send" && "${WECOM_ALLOW_SEND:-}" != "1" ]]; then
  echo "ERROR: WECOM_HANDLER_MODE=send requires WECOM_ALLOW_SEND=1." >&2
  exit 2
fi

task_json="$(cat)"
if [[ -z "${task_json//[[:space:]]/}" ]]; then
  echo "ERROR: empty Bridge mass task JSON on stdin." >&2
  exit 2
fi

parsed="$(TASK_JSON="$task_json" node <<'NODE'
const payload = JSON.parse(process.env.TASK_JSON || '{}');
const recipientName = String(payload.recipientName || '').trim();
const message = String(payload.message || '').trim();
if (!recipientName) {
  console.error('ERROR: Bridge mass task is missing recipientName.');
  process.exit(2);
}
if (!message) {
  console.error('ERROR: Bridge mass task is missing message.');
  process.exit(2);
}
process.stdout.write(JSON.stringify({
  id: payload.id || '',
  jobId: payload.jobId || '',
  itemId: payload.itemId || '',
  jobTitle: payload.jobTitle || '',
  recipientName,
  message,
  messageChars: [...message].length,
}));
NODE
)"

recipient_name="$(node -e 'const p=JSON.parse(process.argv[1]); process.stdout.write(p.recipientName)' "$parsed")"
message_text="$(node -e 'const p=JSON.parse(process.argv[1]); process.stdout.write(p.message)' "$parsed")"
message_chars="$(node -e 'const p=JSON.parse(process.argv[1]); process.stdout.write(String(p.messageChars))' "$parsed")"

if [[ "$MODE" == "dry-run" ]]; then
  node -e 'const p=JSON.parse(process.argv[1]); p.ok=true; p.mode="dry-run"; console.log(JSON.stringify(p, null, 2))' "$parsed"
  exit 0
fi

if ! command -v osascript >/dev/null 2>&1; then
  echo "ERROR: osascript is required for prepare/send mode on macOS." >&2
  exit 3
fi

target_verification() {
  local expected_name="$1"
  local required="${2:-1}"
  local enabled="${WECOM_VERIFY_TARGET:-1}"
  if [[ "$enabled" == "0" || "$enabled" == "false" || "$enabled" == "off" ]]; then
    if target_match_required; then
      node - "$expected_name" "$APP_NAME" <<'NODE'
const expectedName = String(process.argv[2] || '').trim();
const appName = String(process.argv[3] || '').trim();
console.log(JSON.stringify({
  required: true,
  verified: false,
  expectedName,
  activeApp: appName,
  conversationMatched: false,
  inputReady: false,
  error: 'WECOM_VERIFY_TARGET is disabled while WECOM_REQUIRE_TARGET_MATCH=1',
  checkedAt: new Date().toISOString(),
}));
NODE
    else
      printf ''
    fi
    return
  fi

  local snapshot
  if ! snapshot="$(osascript - "$APP_NAME" <<'APPLESCRIPT' 2>/dev/null
on run argv
  set appName to item 1 of argv
  set frontApp to ""
  set windowTitle to ""
  tell application "System Events"
    try
      set frontApp to name of first application process whose frontmost is true
    end try
    if exists process appName then
      tell process appName
        set frontmost to true
        delay 0.1
        try
          set windowTitle to name of window 1
        end try
      end tell
    end if
  end tell
  return frontApp & linefeed & windowTitle
end run
APPLESCRIPT
)"; then
    node - "$expected_name" "$APP_NAME" "$required" <<'NODE'
const expectedName = String(process.argv[2] || '').trim();
const activeApp = String(process.argv[3] || '').trim();
const required = String(process.argv[4] || '1') !== '0';
console.log(JSON.stringify({
  required,
  verified: false,
  expectedName,
  activeApp,
  conversationMatched: false,
  inputReady: false,
  error: 'Unable to read WeCom window title via AppleScript',
  checkedAt: new Date().toISOString(),
}));
NODE
    return
  fi

  node - "$expected_name" "$APP_NAME" "$required" "$snapshot" <<'NODE'
const expectedName = String(process.argv[2] || '').trim();
const appName = String(process.argv[3] || '').trim();
const required = String(process.argv[4] || '1') !== '0';
const snapshot = String(process.argv[5] || '');
const [frontAppRaw = '', ...titleLines] = snapshot.split(/\r?\n/);
const activeApp = frontAppRaw.trim() || appName;
const windowTitle = titleLines.join('\n').trim();
const norm = (value) => String(value || '').trim().toLowerCase();
const conversationMatched = !!expectedName && norm(windowTitle).includes(norm(expectedName));
const inputReady = activeApp === appName || norm(activeApp) === norm(appName);
const verified = required ? conversationMatched && inputReady : inputReady || !!windowTitle;
console.log(JSON.stringify({
  required,
  verified,
  expectedName,
  matchedName: conversationMatched ? expectedName : '',
  conversationMatched,
  inputReady,
  activeApp,
  windowTitle,
  confidence: conversationMatched ? 0.85 : 0,
  checkedAt: new Date().toISOString(),
}));
NODE
}

target_match_required() {
  case "$(printf '%s' "${WECOM_REQUIRE_TARGET_MATCH:-0}" | tr '[:upper:]' '[:lower:]')" in
    1|true|yes|on) return 0 ;;
    *) return 1 ;;
  esac
}

emit_target_gate_failure() {
  local verification_json="$1"
  node - "$MODE" "$APP_NAME" "$recipient_name" "$message_chars" "$verification_json" <<'NODE'
const verification = process.argv[6] ? JSON.parse(process.argv[6]) : undefined;
console.log(JSON.stringify({
  ok: false,
  mode: process.argv[2],
  appName: process.argv[3],
  recipientName: process.argv[4],
  messageChars: Number(process.argv[5]),
  error: 'Target verification failed before writing mass message',
  verificationRequired: true,
  ...(verification ? { verification } : {}),
}, null, 2));
NODE
}

enforce_target_match() {
  local verification_json="$1"
  local verified
  verified="$(node - "$verification_json" <<'NODE'
try {
  const verification = JSON.parse(process.argv[2] || '{}');
  process.stdout.write(verification && verification.verified === true ? '1' : '0');
} catch {
  process.stdout.write('0');
}
NODE
)"
  if [[ "$verified" != "1" ]]; then
    echo "ERROR: Target verification failed before writing mass message: $recipient_name" >&2
    emit_target_gate_failure "$verification_json"
    exit 5
  fi
}

focus_recipient() {
  osascript - "$APP_NAME" "$recipient_name" "$SEARCH_SHORTCUT" <<'APPLESCRIPT'
on run argv
  set appName to item 1 of argv
  set recipientName to item 2 of argv
  set searchShortcut to item 3 of argv

  set originalClipboard to ""
  try
    set originalClipboard to the clipboard as text
  end try

  tell application appName to activate
  delay 0.6

  tell application "System Events"
    if not (exists process appName) then error "WeCom app process not found: " & appName
    tell process appName
      set frontmost to true
      delay 0.2

      if searchShortcut is not "none" then
        if searchShortcut is "command+k" then
          keystroke "k" using command down
        else if searchShortcut is "command+f" then
          keystroke "f" using command down
        else
          error "Unsupported WECOM_SEARCH_SHORTCUT: " & searchShortcut
        end if
        delay 0.25
        set the clipboard to recipientName
        keystroke "v" using command down
        delay 0.25
        key code 36
        delay 0.8
      end if
    end tell
  end tell

  try
    set the clipboard to originalClipboard
  end try
end run
APPLESCRIPT
}

paste_mass_message() {
  osascript - "$APP_NAME" "$message_text" "$MODE" <<'APPLESCRIPT'
on run argv
  set appName to item 1 of argv
  set messageText to item 2 of argv
  set handlerMode to item 3 of argv

  set originalClipboard to ""
  try
    set originalClipboard to the clipboard as text
  end try

  tell application "System Events"
    if not (exists process appName) then error "WeCom app process not found: " & appName
    tell process appName
      set frontmost to true
      delay 0.1
      set the clipboard to messageText
      keystroke "v" using command down
      delay 0.2

      if handlerMode is "send" then
        key code 36
      end if
    end tell
  end tell

  try
    set the clipboard to originalClipboard
  end try
end run
APPLESCRIPT
}

focus_recipient

preflight_verification_json=""
if target_match_required; then
  preflight_verification_json="$(target_verification "$recipient_name" 1)"
  enforce_target_match "$preflight_verification_json"
fi

paste_mass_message

if [[ -n "$preflight_verification_json" ]]; then
  verification_json="$preflight_verification_json"
else
  verification_json="$(target_verification "$recipient_name" 1)"
fi
node -e '
const verification = process.argv[5] ? JSON.parse(process.argv[5]) : undefined;
console.log(JSON.stringify({
  ok: true,
  mode: process.argv[1],
  appName: process.argv[2],
  recipientName: process.argv[3],
  messageChars: Number(process.argv[4]),
  ...(verification ? { verification } : {}),
}, null, 2));
' "$MODE" "$APP_NAME" "$recipient_name" "$message_chars" "$verification_json"
