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
const fs = require('node:fs');
const conversationName = String(payload.conversationName || payload.senderName || '').trim();
const fallbackDraft = String(payload.replyDraft || '').trim();
function clampInt(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(n)));
}
function normalizeStep(raw) {
  if (!raw || typeof raw !== 'object') return [];
  const type = String(raw.type || raw.contentType || '').trim().toLowerCase();
  const delay = clampInt(raw.delayBeforeSendingSeconds ?? raw.delaySeconds ?? raw.waitSeconds, 0, 600, 0);
  if (type === 'wait' || type === 'delay') {
    const seconds = clampInt(raw.seconds ?? raw.delayBeforeSendingSeconds ?? raw.delaySeconds, 0, 600, 1);
    return seconds > 0 ? [{ type: 'wait', seconds }] : [];
  }
  if (type === 'text' || raw.text !== undefined || raw.content !== undefined) {
    const text = String(raw.text ?? raw.content ?? raw.message ?? '').trim();
    if (!text) return [];
    const steps = [];
    if (delay > 0) steps.push({ type: 'wait', seconds: delay });
    steps.push({ type: 'text', text, sendEnter: raw.sendEnter !== false });
    return steps;
  }
  if (type === 'image' || raw.imagePath !== undefined || raw.path !== undefined || raw.filePath !== undefined) {
    const imagePath = String(raw.imagePath ?? raw.path ?? raw.filePath ?? '').trim();
    if (!imagePath) return [];
    const steps = [];
    if (delay > 0) steps.push({ type: 'wait', seconds: delay });
    steps.push({
      type: 'image',
      imagePath,
      sendEnter: raw.sendEnter !== false,
      exists: fs.existsSync(imagePath),
    });
    return steps;
  }
  return [];
}
const rawSteps = Array.isArray(payload.replySteps) ? payload.replySteps : [];
const steps = rawSteps.flatMap(normalizeStep).slice(0, 30);
if (!steps.length && fallbackDraft) steps.push({ type: 'text', text: fallbackDraft, sendEnter: true });
const textSteps = steps.filter((step) => step.type === 'text' && step.text.trim());
const imageSteps = steps.filter((step) => step.type === 'image' && step.imagePath.trim());
const replyDraft = textSteps.map((step) => step.text.trim()).join('\n\n').slice(0, 4000);
if (!conversationName) {
  console.error('ERROR: Bridge reply is missing conversationName/senderName.');
  process.exit(2);
}
if (!textSteps.length && !imageSteps.length) {
  console.error('ERROR: Bridge reply is missing executable text/image steps.');
  process.exit(2);
}
process.stdout.write(JSON.stringify({
  id: payload.id || '',
  conversationName,
  senderName: payload.senderName || '',
  replyDraft,
  replyChars: [...replyDraft].length,
  stepCount: steps.length,
  textStepCount: textSteps.length,
  imageStepCount: imageSteps.length,
  missingImagePaths: imageSteps.filter((step) => !step.exists).map((step) => step.imagePath),
  waitSeconds: steps.reduce((sum, step) => step.type === 'wait' ? sum + step.seconds : sum, 0),
  steps,
}));
NODE
)"

conversation_name="$(node -e 'const p=JSON.parse(process.argv[1]); process.stdout.write(p.conversationName)' "$parsed")"
reply_draft="$(node -e 'const p=JSON.parse(process.argv[1]); process.stdout.write(p.replyDraft)' "$parsed")"
reply_chars="$(node -e 'const p=JSON.parse(process.argv[1]); process.stdout.write(String(p.replyChars))' "$parsed")"
step_count="$(node -e 'const p=JSON.parse(process.argv[1]); process.stdout.write(String(p.stepCount))' "$parsed")"
text_step_count="$(node -e 'const p=JSON.parse(process.argv[1]); process.stdout.write(String(p.textStepCount))' "$parsed")"
image_step_count="$(node -e 'const p=JSON.parse(process.argv[1]); process.stdout.write(String(p.imageStepCount))' "$parsed")"

if [[ "$MODE" == "dry-run" ]]; then
  node -e 'const p=JSON.parse(process.argv[1]); p.ok=true; p.mode="dry-run"; console.log(JSON.stringify(p, null, 2))' "$parsed"
  exit 0
fi

if ! command -v osascript >/dev/null 2>&1; then
  echo "ERROR: osascript is required for prepare/send mode on macOS." >&2
  exit 3
fi

focus_conversation() {
  osascript - "$APP_NAME" "$conversation_name" "$SEARCH_SHORTCUT" <<'APPLESCRIPT'
on run argv
  set appName to item 1 of argv
  set conversationName to item 2 of argv
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
        set the clipboard to conversationName
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

paste_reply_text() {
  local text="$1"
  local send_enter="$2"
  osascript - "$APP_NAME" "$text" "$send_enter" <<'APPLESCRIPT'
on run argv
  set appName to item 1 of argv
  set replyText to item 2 of argv
  set sendEnter to item 3 of argv

  set originalClipboard to ""
  try
    set originalClipboard to the clipboard as text
  end try

  tell application "System Events"
    if not (exists process appName) then error "WeCom app process not found: " & appName
    tell process appName
      set frontmost to true
      delay 0.1
      set the clipboard to replyText
      keystroke "v" using command down
      delay 0.2
      if sendEnter is "1" then
        key code 36
        delay 0.4
      end if
    end tell
  end tell

  try
    set the clipboard to originalClipboard
  end try
end run
APPLESCRIPT
}

paste_reply_image() {
  local image_path="$1"
  local send_enter="$2"
  if [[ ! -f "$image_path" ]]; then
    echo "ERROR: image file does not exist: $image_path" >&2
    exit 4
  fi
  osascript -l JavaScript - "$image_path" <<'JXA'
function run(argv) {
  ObjC.import('AppKit');
  const path = $.NSString.alloc.initWithUTF8String(argv[0]);
  const image = $.NSImage.alloc.initWithContentsOfFile(path);
  if (!image) throw new Error(`Unable to read image: ${argv[0]}`);
  const pasteboard = $.NSPasteboard.generalPasteboard;
  pasteboard.clearContents;
  if (!pasteboard.writeObjects([image])) throw new Error(`Unable to write image to pasteboard: ${argv[0]}`);
}
JXA
  osascript - "$APP_NAME" "$send_enter" <<'APPLESCRIPT'
on run argv
  set appName to item 1 of argv
  set sendEnter to item 2 of argv

  tell application "System Events"
    if not (exists process appName) then error "WeCom app process not found: " & appName
    tell process appName
      set frontmost to true
      delay 0.1
      keystroke "v" using command down
      delay 0.4
      if sendEnter is "1" then
        key code 36
        delay 0.5
      end if
    end tell
  end tell
end run
APPLESCRIPT
}

focus_conversation

if [[ "$MODE" == "prepare" ]]; then
  if [[ -n "$reply_draft" ]]; then
    paste_reply_text "$reply_draft" 0
  fi
  while IFS=$'\t' read -r step_type _seconds _send_enter encoded_text; do
    if [[ "$step_type" != "image" ]]; then
      continue
    fi
    image_path="$(node -e 'process.stdout.write(Buffer.from(process.argv[1], "base64").toString("utf8"))' "$encoded_text")"
    paste_reply_image "$image_path" 0
  done < <(node -e '
const p = JSON.parse(process.argv[1]);
for (const step of p.steps || []) {
  if (step.type === "image") {
    const imagePath = Buffer.from(String(step.imagePath || ""), "utf8").toString("base64");
    console.log(["image", "0", "0", imagePath].join("\t"));
  }
}
' "$parsed")
else
  while IFS=$'\t' read -r step_type seconds send_enter encoded_text; do
    if [[ "$step_type" == "wait" ]]; then
      sleep "$seconds"
      continue
    fi
    if [[ "$step_type" == "text" ]]; then
      step_text="$(node -e 'process.stdout.write(Buffer.from(process.argv[1], "base64").toString("utf8"))' "$encoded_text")"
      paste_reply_text "$step_text" "$send_enter"
    elif [[ "$step_type" == "image" ]]; then
      image_path="$(node -e 'process.stdout.write(Buffer.from(process.argv[1], "base64").toString("utf8"))' "$encoded_text")"
      paste_reply_image "$image_path" "$send_enter"
    fi
  done < <(node -e '
const p = JSON.parse(process.argv[1]);
for (const step of p.steps || []) {
  if (step.type === "wait") {
    console.log(["wait", Math.max(0, Number(step.seconds) || 0), "0", ""].join("\t"));
  } else if (step.type === "text") {
    const text = Buffer.from(String(step.text || ""), "utf8").toString("base64");
    console.log(["text", "0", step.sendEnter === false ? "0" : "1", text].join("\t"));
  } else if (step.type === "image") {
    const imagePath = Buffer.from(String(step.imagePath || ""), "utf8").toString("base64");
    console.log(["image", "0", step.sendEnter === false ? "0" : "1", imagePath].join("\t"));
  }
}
' "$parsed")
fi

node -e 'console.log(JSON.stringify({ok:true, mode:process.argv[1], appName:process.argv[2], conversationName:process.argv[3], replyChars:Number(process.argv[4]), stepCount:Number(process.argv[5]), textStepCount:Number(process.argv[6]), imageStepCount:Number(process.argv[7])}, null, 2))' \
  "$MODE" "$APP_NAME" "$conversation_name" "$reply_chars" "$step_count" "$text_step_count" "$image_step_count"
