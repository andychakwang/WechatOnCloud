#!/usr/bin/env bash
set -euo pipefail

# Handler for scripts/wecom-bridge-client.mjs run-approved.
# Safe default: prepare a reply in the WeCom input box, but do not send it.
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

reply_json="$(cat)"
if [[ -z "${reply_json//[[:space:]]/}" ]]; then
  echo "ERROR: empty Bridge reply JSON on stdin." >&2
  exit 2
fi

parsed="$(REPLY_JSON="$reply_json" node <<'NODE'
const payload = JSON.parse(process.env.REPLY_JSON || '{}');
const conversationName = String(payload.conversationName || payload.senderName || '').trim();
const replyDraft = String(payload.replyDraft || '').trim();
if (!conversationName) {
  console.error('ERROR: Bridge reply is missing conversationName/senderName.');
  process.exit(2);
}
if (!replyDraft) {
  console.error('ERROR: Bridge reply is missing replyDraft.');
  process.exit(2);
}
process.stdout.write(JSON.stringify({
  id: payload.id || '',
  conversationName,
  senderName: payload.senderName || '',
  replyDraft,
  replyChars: [...replyDraft].length,
}));
NODE
)"

conversation_name="$(node -e 'const p=JSON.parse(process.argv[1]); process.stdout.write(p.conversationName)' "$parsed")"
reply_draft="$(node -e 'const p=JSON.parse(process.argv[1]); process.stdout.write(p.replyDraft)' "$parsed")"
reply_chars="$(node -e 'const p=JSON.parse(process.argv[1]); process.stdout.write(String(p.replyChars))' "$parsed")"

if [[ "$MODE" == "dry-run" ]]; then
  node -e 'const p=JSON.parse(process.argv[1]); p.ok=true; p.mode="dry-run"; console.log(JSON.stringify(p, null, 2))' "$parsed"
  exit 0
fi

if ! command -v osascript >/dev/null 2>&1; then
  echo "ERROR: osascript is required for prepare/send mode on macOS." >&2
  exit 3
fi

osascript - "$APP_NAME" "$conversation_name" "$reply_draft" "$MODE" "$SEARCH_SHORTCUT" <<'APPLESCRIPT'
on run argv
  set appName to item 1 of argv
  set conversationName to item 2 of argv
  set replyText to item 3 of argv
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
        set the clipboard to conversationName
        keystroke "v" using command down
        delay 0.25
        key code 36
        delay 0.8
      end if

      set the clipboard to replyText
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

node -e 'console.log(JSON.stringify({ok:true, mode:process.argv[1], appName:process.argv[2], conversationName:process.argv[3], replyChars:Number(process.argv[4])}, null, 2))' \
  "$MODE" "$APP_NAME" "$conversation_name" "$reply_chars"
