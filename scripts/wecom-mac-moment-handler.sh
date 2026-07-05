#!/usr/bin/env bash
set -euo pipefail

# Handler for scripts/wecom-bridge-client.mjs run-moments.
# Safe default: copy the approved Moments draft to the clipboard, but never publish.
#
# Environment:
#   WECOM_HANDLER_MODE=dry-run|prepare        default: prepare
#   WECOM_APP_NAME='企业微信'                  macOS app name
#   WECOM_MOMENT_PASTE_MODE=clipboard-only|current-input
#   WECOM_VERIFY_TARGET=1                     include window-title verification in handler JSON
#   WECOM_MATERIAL_MAP='{"poster":"/Users/me/Pictures/poster.png"}'
#   WECOM_MATERIAL_MAP_FILE=/path/to/wecom-materials.json

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
const fs = require('node:fs');
const title = String(payload.title || '').trim();
const text = String(payload.text || '').trim();
const imageNotes = String(payload.imageNotes || '').trim();
function normalizeKey(value) {
  return String(value ?? '').trim();
}
function materialPathFromItem(item) {
  if (typeof item === 'string') return '';
  return String(item?.localPath ?? item?.path ?? item?.filePath ?? item?.imagePath ?? '').trim();
}
function materialKeyFromItem(item, fallback = '') {
  if (typeof item === 'string') return normalizeKey(item);
  return normalizeKey(item?.materialKey ?? item?.imageKey ?? item?.assetKey ?? item?.key ?? item?.id ?? item?.name ?? fallback);
}
function readMaterialMap() {
  const map = new Map();
  const add = (key, path) => {
    const k = normalizeKey(key);
    const p = String(path ?? '').trim();
    if (!k || !p) return;
    map.set(k, p);
    map.set(k.toLowerCase(), p);
  };
  const absorb = (value) => {
    if (!value) return;
    if (Array.isArray(value)) {
      for (const item of value) {
        if (typeof item === 'string') continue;
        add(materialKeyFromItem(item), materialPathFromItem(item));
      }
      return;
    }
    if (typeof value !== 'object') return;
    if (Array.isArray(value.assets)) absorb(value.assets);
    if (Array.isArray(value.materials)) absorb(value.materials);
    for (const [key, item] of Object.entries(value)) {
      if (key === 'assets' || key === 'materials') continue;
      if (typeof item === 'string') {
        add(key, item);
      } else if (item && typeof item === 'object') {
        add(materialKeyFromItem(item, key), materialPathFromItem(item));
      }
    }
  };
  const parse = (raw, source) => {
    const sourceText = String(raw || '').trim();
    if (!sourceText) return;
    try {
      absorb(JSON.parse(sourceText));
    } catch (error) {
      throw new Error(`Invalid material map JSON from ${source}: ${error.message}`);
    }
  };
  parse(process.env.WECOM_MATERIAL_MAP, 'WECOM_MATERIAL_MAP');
  const file = String(process.env.WECOM_MATERIAL_MAP_FILE || '').trim();
  if (file) parse(fs.readFileSync(file, 'utf8'), file);
  return map;
}
function normalizeMaterial(raw, index, materialMap) {
  const directPath = materialPathFromItem(raw);
  const key = materialKeyFromItem(raw, `material-${index + 1}`);
  const rawText = typeof raw === 'string' ? raw.trim() : '';
  const pathLike = rawText && (rawText.startsWith('/') || rawText.startsWith('./') || rawText.startsWith('../') || rawText.startsWith('~'));
  const mappedPath = key ? (materialMap.get(key) || materialMap.get(key.toLowerCase()) || '') : '';
  const localPath = directPath || mappedPath || (pathLike ? rawText : '');
  const exists = !!localPath && fs.existsSync(localPath);
  return {
    key,
    localPath,
    exists,
    resolvedFromMap: !!mappedPath && !directPath,
    source: directPath ? 'direct-path' : mappedPath ? 'material-map' : pathLike ? 'path-like' : 'key',
  };
}
if (!text) {
  console.error('ERROR: Bridge moment task is missing text.');
  process.exit(2);
}
const materialMap = readMaterialMap();
const rawMaterials = Array.isArray(payload.materials) ? payload.materials : [];
const materials = rawMaterials
  .map((item, index) => normalizeMaterial(item, index, materialMap))
  .filter((item) => item.key || item.localPath);
process.stdout.write(JSON.stringify({
  id: payload.id || payload.draftId || '',
  draftId: payload.draftId || payload.id || '',
  title,
  text,
  imageNotes,
  materials,
  textChars: [...text].length,
  materialCount: materials.length,
  resolvedMaterialCount: materials.filter((item) => item.localPath && item.exists).length,
  missingMaterialRefs: materials.filter((item) => !item.localPath).map((item) => item.key),
  missingMaterialPaths: materials.filter((item) => item.localPath && !item.exists).map((item) => item.localPath),
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

material_errors="$(node -e '
const p = JSON.parse(process.argv[1]);
const refs = (p.missingMaterialRefs || []).filter(Boolean).map((key) => `unmapped material key: ${key}`);
const paths = (p.missingMaterialPaths || []).filter(Boolean).map((path) => `missing material file: ${path}`);
process.stdout.write([...refs, ...paths].join("\n"));
' "$parsed")"
if [[ -n "$material_errors" ]]; then
  echo "ERROR: Bridge moment material assets are not ready:" >&2
  echo "$material_errors" >&2
  exit 4
fi

if ! command -v osascript >/dev/null 2>&1; then
  echo "ERROR: osascript is required for prepare mode on macOS." >&2
  exit 3
fi

target_verification() {
  local expected_name="$1"
  local required="${2:-0}"
  local enabled="${WECOM_VERIFY_TARGET:-1}"
  if [[ "$enabled" == "0" || "$enabled" == "false" || "$enabled" == "off" ]]; then
    printf ''
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
const required = String(process.argv[4] || '0') !== '0';
console.log(JSON.stringify({
  required,
  verified: false,
  expectedName,
  activeApp,
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
const required = String(process.argv[4] || '0') !== '0';
const snapshot = String(process.argv[5] || '');
const [frontAppRaw = '', ...titleLines] = snapshot.split(/\r?\n/);
const activeApp = frontAppRaw.trim() || appName;
const windowTitle = titleLines.join('\n').trim();
const norm = (value) => String(value || '').trim().toLowerCase();
const inputReady = activeApp === appName || norm(activeApp) === norm(appName);
console.log(JSON.stringify({
  required,
  verified: inputReady || !!windowTitle,
  expectedName,
  inputReady,
  activeApp,
  windowTitle,
  confidence: inputReady ? 0.75 : 0,
  checkedAt: new Date().toISOString(),
}));
NODE
}

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

verification_json="$(target_verification "$title" 0)"
node -e '
const verification = process.argv[7] ? JSON.parse(process.argv[7]) : undefined;
console.log(JSON.stringify({
  ok: true,
  mode: "prepare",
  pasteMode: process.argv[1],
  appName: process.argv[2],
  title: process.argv[3],
  textChars: Number(process.argv[4]),
  materialsCount: Number(process.argv[5]),
  resolvedMaterialsCount: Number(process.argv[6]),
  ...(verification ? { verification } : {}),
}, null, 2));
' "$PASTE_MODE" "$APP_NAME" "$title" "$text_chars" "$materials_count" "$(node -e 'const p=JSON.parse(process.argv[1]); process.stdout.write(String(p.resolvedMaterialCount || 0))' "$parsed")" "$verification_json"
