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

osascript - "$APP_NAME" "$recipient_name" "$message_text" "$MODE" "$SEARCH_SHORTCUT" <<'APPLESCRIPT'
on run argv
  set appName to item 1 of argv
  set recipientName to item 2 of argv
  set messageText to item 3 of argv
  set handlerMode to item 4 of argv
  set searchShortcut to item 5 of argv

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

node -e 'console.log(JSON.stringify({ok:true, mode:process.argv[1], appName:process.argv[2], recipientName:process.argv[3], messageChars:Number(process.argv[4])}, null, 2))' \
  "$MODE" "$APP_NAME" "$recipient_name" "$message_chars"
