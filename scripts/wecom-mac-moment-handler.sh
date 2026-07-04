#!/usr/bin/env bash
set -euo pipefail

# Handler for scripts/wecom-bridge-client.mjs run-moments.
# Safe default: copy the approved Moments draft to the clipboard, but never publish.
#
# Environment:
#   WECOM_HANDLER_MODE=dry-run|prepare        default: prepare
#   WECOM_APP_NAME='企业微信'                  macOS app name
#   WECOM_MOMENT_PASTE_MODE=clipboard-only|current-input

APP_NAME="${WECOM_APP_NAME:-企业微信}"
MODE="${WECOM_HANDLER_MODE:-prepare}"
PASTE_MODE="${WECOM_MOMENT_PASTE_MODE:-clipboard-only}"

if [[ "$MODE" != "dry-run" && "$MODE" != "prepare" ]]; then
  echo "ERROR: WECOM_HANDLER_MODE for moments must be dry-run or prepare." >&2
  exit 2
fi

if [[ "$PASTE_MODE" != "clipboard-only" && "$PASTE_MODE" != "current-input" ]]; then
  echo "ERROR: WECOM_MOMENT_PASTE_MODE must be clipboard-only or current-input." >&2
  exit 2
fi

task_json="$(cat)"
if [[ -z "${task_json//[[:space:]]/}" ]]; then
  echo "ERROR: empty Bridge moment task JSON on stdin." >&2
  exit 2
fi

parsed="$(TASK_JSON="$task_json" node <<'NODE'
const payload = JSON.parse(process.env.TASK_JSON || '{}');
const title = String(payload.title || '').trim();
const text = String(payload.text || '').trim();
const imageNotes = String(payload.imageNotes || '').trim();
const materials = Array.isArray(payload.materials) ? payload.materials.map(String).filter(Boolean) : [];
if (!text) {
  console.error('ERROR: Bridge moment task is missing text.');
  process.exit(2);
}
process.stdout.write(JSON.stringify({
  id: payload.id || payload.draftId || '',
  draftId: payload.draftId || payload.id || '',
  title,
  text,
  imageNotes,
  materials,
  textChars: [...text].length,
}));
NODE
)"

title="$(node -e 'const p=JSON.parse(process.argv[1]); process.stdout.write(p.title || p.id)' "$parsed")"
moment_text="$(node -e 'const p=JSON.parse(process.argv[1]); process.stdout.write(p.text)' "$parsed")"
text_chars="$(node -e 'const p=JSON.parse(process.argv[1]); process.stdout.write(String(p.textChars))' "$parsed")"
materials_count="$(node -e 'const p=JSON.parse(process.argv[1]); process.stdout.write(String((p.materials || []).length))' "$parsed")"

if [[ "$MODE" == "dry-run" ]]; then
  node -e 'const p=JSON.parse(process.argv[1]); p.ok=true; p.mode="dry-run"; console.log(JSON.stringify(p, null, 2))' "$parsed"
  exit 0
fi

if ! command -v osascript >/dev/null 2>&1; then
  echo "ERROR: osascript is required for prepare mode on macOS." >&2
  exit 3
fi

osascript - "$APP_NAME" "$moment_text" "$PASTE_MODE" <<'APPLESCRIPT'
on run argv
  set appName to item 1 of argv
  set momentText to item 2 of argv
  set pasteMode to item 3 of argv

  tell application appName to activate
  delay 0.5

  set the clipboard to momentText

  if pasteMode is "current-input" then
    tell application "System Events"
      if not (exists process appName) then error "WeCom app process not found: " & appName
      tell process appName
        set frontmost to true
        delay 0.2
        keystroke "v" using command down
      end tell
    end tell
  end if
end run
APPLESCRIPT

node -e 'console.log(JSON.stringify({ok:true, mode:"prepare", pasteMode:process.argv[1], appName:process.argv[2], title:process.argv[3], textChars:Number(process.argv[4]), materialsCount:Number(process.argv[5])}, null, 2))' \
  "$PASTE_MODE" "$APP_NAME" "$title" "$text_chars" "$materials_count"
