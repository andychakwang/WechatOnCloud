#!/usr/bin/env bash
set -euo pipefail

PANEL_URL="${PANEL_URL:-http://192.168.8.152:36081}"
PANEL_USER="${PANEL_USER:-admin}"
PANEL_PASSWORD="${PANEL_PASSWORD:-${PANEL_ADMIN_PASSWORD:-${WOC_TEST_PASSWORD:-wechat}}}"

PANEL_URL="${PANEL_URL%/}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BRIDGE_CLIENT="${BRIDGE_CLIENT:-$ROOT/scripts/wecom-bridge-client.mjs}"
WECOM_REPLY_HANDLER="${WECOM_REPLY_HANDLER:-$ROOT/scripts/wecom-mac-reply-handler.sh}"
WECOM_MASS_HANDLER="${WECOM_MASS_HANDLER:-$ROOT/scripts/wecom-mac-mass-handler.sh}"
WECOM_MOMENT_HANDLER="${WECOM_MOMENT_HANDLER:-$ROOT/scripts/wecom-mac-moment-handler.sh}"
WECOM_BRIDGE_RUNNER="${WECOM_BRIDGE_RUNNER:-$ROOT/scripts/wecom-bridge-runner.sh}"
stamp="$(date +%Y%m%d%H%M%S)"
cookie_jar="$(mktemp "${TMPDIR:-/tmp}/woc-smoke-cookie.XXXXXX")"
body_file="$(mktemp "${TMPDIR:-/tmp}/woc-smoke-body.XXXXXX.json")"
reply_image_file="$(mktemp "${TMPDIR:-/tmp}/woc-smoke-reply-image.XXXXXX.png")"
material_map_file="$(mktemp "${TMPDIR:-/tmp}/woc-smoke-material-map.XXXXXX.json")"
rpa_package_file="$(mktemp "${TMPDIR:-/tmp}/woc-smoke-rpa-package.XXXXXX.json")"
expired_rpa_package_file="$(mktemp "${TMPDIR:-/tmp}/woc-smoke-expired-rpa-package.XXXXXX.json")"
rpa_cloud_package_file="$(mktemp "${TMPDIR:-/tmp}/woc-smoke-rpa-cloud-package.XXXXXX.jsonl")"
verification_handler_file="$(mktemp "${TMPDIR:-/tmp}/woc-smoke-verification-handler.XXXXXX.sh")"
handler_error_file="$(mktemp "${TMPDIR:-/tmp}/woc-smoke-handler-error.XXXXXX.log")"
fake_osascript_log_file="$(mktemp "${TMPDIR:-/tmp}/woc-smoke-fake-osascript.XXXXXX.log")"
fake_osascript_dir="$(mktemp -d "${TMPDIR:-/tmp}/woc-smoke-fake-osascript.XXXXXX")"
reply_image_key="smoke-poster"
: > "$reply_image_file"

cleanup() {
  rm -f "$cookie_jar" "$body_file" "$reply_image_file" "$material_map_file" "$rpa_package_file" "$expired_rpa_package_file" "$rpa_cloud_package_file" "$verification_handler_file" "$handler_error_file" "$fake_osascript_log_file"
  rm -rf "$fake_osascript_dir"
}
trap cleanup EXIT

say() {
  printf '==> %s\n' "$*"
}

request_json() {
  local method="$1"
  local path="$2"
  local payload="${3:-}"
  local expect="${4:-200}"
  local status

  if [[ -n "$payload" ]]; then
    status="$(curl -sS -o "$body_file" -w '%{http_code}' \
      -b "$cookie_jar" -c "$cookie_jar" \
      -X "$method" \
      -H 'content-type: application/json' \
      --data "$payload" \
      "$PANEL_URL$path")"
  else
    status="$(curl -sS -o "$body_file" -w '%{http_code}' \
      -b "$cookie_jar" -c "$cookie_jar" \
      -X "$method" \
      "$PANEL_URL$path")"
  fi

  if [[ "$status" != "$expect" ]]; then
    echo "ERROR: $method $path expected HTTP $expect, got $status" >&2
    sed -n '1,80p' "$body_file" >&2
    exit 1
  fi
}

request_bridge_json() {
  local method="$1"
  local path="$2"
  local payload="${3:-}"
  local expect="${4:-200}"
  local status

  if [[ -n "$payload" ]]; then
    status="$(curl -sS -o "$body_file" -w '%{http_code}' \
      -X "$method" \
      -H 'content-type: application/json' \
      -H "Authorization: Bearer $AUTOMATION_BRIDGE_TOKEN" \
      --data "$payload" \
      "$PANEL_URL$path")"
  else
    status="$(curl -sS -o "$body_file" -w '%{http_code}' \
      -X "$method" \
      -H 'content-type: application/json' \
      -H "Authorization: Bearer $AUTOMATION_BRIDGE_TOKEN" \
      "$PANEL_URL$path")"
  fi

  if [[ "$status" != "$expect" ]]; then
    echo "ERROR: $method $path expected HTTP $expect, got $status" >&2
    sed -n '1,80p' "$body_file" >&2
    exit 1
  fi
}

json_get() {
  local path="$1"
  python3 - "$body_file" "$path" <<'PY'
import json
import sys

file, path = sys.argv[1], sys.argv[2]
with open(file, "r", encoding="utf-8") as fh:
    value = json.load(fh)
for part in path.split("."):
    if part.endswith("]"):
        name, idx = part[:-1].split("[", 1)
        if name:
            value = value[name]
        value = value[int(idx)]
    else:
        value = value[part]
if isinstance(value, (dict, list)):
    print(json.dumps(value, ensure_ascii=False))
else:
    print(value)
PY
}

json_assert_path() {
  local path="$1"
  python3 - "$body_file" "$path" <<'PY'
import json
import sys

file, path = sys.argv[1], sys.argv[2]
with open(file, "r", encoding="utf-8") as fh:
    value = json.load(fh)
for part in path.split("."):
    if part.endswith("]"):
        name, idx = part[:-1].split("[", 1)
        if name:
            value = value[name]
        value = value[int(idx)]
    else:
        value = value[part]
PY
}

json_assert_no_reply_id() {
  local event_id="$1"
  python3 - "$body_file" "$event_id" <<'PY'
import json
import sys

file, event_id = sys.argv[1], sys.argv[2]
with open(file, "r", encoding="utf-8") as fh:
    payload = json.load(fh)
for reply in payload.get("replies", []):
    if reply.get("id") == event_id:
        raise SystemExit(f"reply {event_id} should not be listed")
PY
}

json_assert_reply_id() {
  local event_id="$1"
  python3 - "$body_file" "$event_id" <<'PY'
import json
import sys

file, event_id = sys.argv[1], sys.argv[2]
with open(file, "r", encoding="utf-8") as fh:
    payload = json.load(fh)
for reply in payload.get("replies", []):
    if reply.get("id") == event_id:
        raise SystemExit(0)
raise SystemExit(f"reply {event_id} should be listed")
PY
}

json_assert_no_task_id() {
  local task_id="$1"
  python3 - "$body_file" "$task_id" <<'PY'
import json
import sys

file, task_id = sys.argv[1], sys.argv[2]
with open(file, "r", encoding="utf-8") as fh:
    payload = json.load(fh)
tasks = payload.get("tasks")
if tasks is None and isinstance(payload.get("package"), dict):
    tasks = payload["package"].get("tasks", [])
for task in tasks or []:
    if task.get("id") == task_id:
        raise SystemExit(f"task {task_id} should not be listed")
PY
}

json_assert_task_id() {
  local task_id="$1"
  python3 - "$body_file" "$task_id" <<'PY'
import json
import sys

file, task_id = sys.argv[1], sys.argv[2]
with open(file, "r", encoding="utf-8") as fh:
    payload = json.load(fh)
tasks = payload.get("tasks")
if tasks is None and isinstance(payload.get("package"), dict):
    tasks = payload["package"].get("tasks", [])
for task in tasks or []:
    if task.get("id") == task_id:
        raise SystemExit(0)
raise SystemExit(f"task {task_id} should be listed")
PY
}

json_assert_check_id() {
  local check_id="$1"
  local expected_level="${2:-}"
  python3 - "$body_file" "$check_id" "$expected_level" <<'PY'
import json
import sys

file, check_id, expected_level = sys.argv[1], sys.argv[2], sys.argv[3]
with open(file, "r", encoding="utf-8") as fh:
    payload = json.load(fh)
for check in payload.get("report", {}).get("checks", []):
    if check.get("id") == check_id:
        if expected_level and check.get("level") != expected_level:
            raise SystemExit(f"check {check_id} level should be {expected_level}, got {check.get('level')}")
        raise SystemExit(0)
raise SystemExit(f"check {check_id} should be listed")
PY
}

json_assert_missing_or_empty() {
  local path="$1"
  python3 - "$body_file" "$path" <<'PY'
import json
import sys

file, path = sys.argv[1], sys.argv[2]
with open(file, "r", encoding="utf-8") as fh:
    value = json.load(fh)
for part in path.split("."):
    if isinstance(value, dict) and part in value:
        value = value[part]
    else:
        raise SystemExit(0)
if value not in (None, ""):
    raise SystemExit(f"expected {path} to be missing or empty, got {value!r}")
PY
}

json_assert_eq() {
  local path="$1"
  local expected="$2"
  local actual
  actual="$(json_get "$path")"
  if [[ "$actual" != "$expected" ]]; then
    echo "ERROR: expected JSON path $path to be '$expected', got '$actual'" >&2
    sed -n '1,80p' "$body_file" >&2
    exit 1
  fi
}

json_assert_array_contains() {
  local path="$1"
  local expected="$2"
  python3 - "$body_file" "$path" "$expected" <<'PY'
import json
import sys

file, path, expected = sys.argv[1], sys.argv[2], sys.argv[3]
with open(file, "r", encoding="utf-8") as fh:
    value = json.load(fh)
for part in path.split("."):
    if part.endswith("]"):
        name, idx = part[:-1].split("[", 1)
        if name:
            value = value[name]
        value = value[int(idx)]
    else:
        value = value[part]
if not isinstance(value, list) or expected not in value:
    raise SystemExit(f"expected {path} to contain {expected!r}, got {value!r}")
PY
}

say "Smoke target: $PANEL_URL"

say "Login"
login_payload="$(python3 - "$PANEL_USER" "$PANEL_PASSWORD" <<'PY'
import json
import sys

print(json.dumps({"username": sys.argv[1], "password": sys.argv[2]}, ensure_ascii=False))
PY
)"
request_json POST /api/auth/login "$login_payload"
json_assert_path user.username

say "Read version and automation config"
request_json GET /api/version
json_assert_path current
request_json GET /api/admin/automation/config
json_assert_path config.settings
request_json GET /api/admin/automation/overview
json_assert_path overview.generatedAt
json_assert_path overview.settings
json_assert_path overview.gates.blocked
json_assert_path overview.gates.dailyActions
json_assert_path overview.gates.quietHoursWindow
json_assert_path overview.audience.total
json_assert_path overview.materials.total
json_assert_path overview.bridge.pendingReplies
json_assert_path overview.bridge.runnerPolicy.mode
json_assert_path overview.bridge.capabilities.reply
json_assert_path overview.bridge.capabilities.rpa-package
json_assert_path overview.bridge.capabilities.unknown
json_assert_path overview.mass.itemsPending
json_assert_path overview.moments.draftsTotal
request_json GET /api/admin/automation/preflight
json_assert_path report.generatedAt
json_assert_path report.level
json_assert_path report.summary.block
json_assert_path report.checks[0].id
request_json GET /api/admin/automation/bridge
json_assert_path bridge.runnerGuide.envFile
json_assert_path bridge.runnerGuide.commands.writeEnv
json_assert_path bridge.runnerGuide.commands.dryRunAll
json_assert_path bridge.runnerGuide.commands.doctorReport
json_assert_path bridge.audienceEndpoint
json_assert_path bridge.materialEndpoint
json_assert_path bridge.materialMapEndpoint
json_assert_path bridge.runReportEndpoint
json_assert_path bridge.runnerPolicyEndpoint
json_assert_path bridge.runnerGuide.commands.syncMaterialMap
if [[ "$(json_get bridge.runnerGuide.envFile)" != *"AUTOMATION_BRIDGE_TOKEN="* ]]; then
  echo "ERROR: Bridge runner guide env file is missing AUTOMATION_BRIDGE_TOKEN placeholder" >&2
  sed -n '1,120p' "$body_file" >&2
  exit 1
fi
if [[ "$(json_get bridge.runnerGuide.envFile)" != *"WECOM_MATERIAL_MAP_FILE="* ]]; then
  echo "ERROR: Bridge runner guide env file is missing WECOM_MATERIAL_MAP_FILE" >&2
  sed -n '1,120p' "$body_file" >&2
  exit 1
fi
if [[ "$(json_get bridge.runnerGuide.envFile)" != *"WECOM_USE_RPA_PACKAGE="* ]]; then
  echo "ERROR: Bridge runner guide env file is missing WECOM_USE_RPA_PACKAGE" >&2
  sed -n '1,120p' "$body_file" >&2
  exit 1
fi
if [[ "$(json_get bridge.runnerGuide.envFile)" != *"WECOM_RUNNER_ENGINE="* ]]; then
  echo "ERROR: Bridge runner guide env file is missing WECOM_RUNNER_ENGINE" >&2
  sed -n '1,120p' "$body_file" >&2
  exit 1
fi
json_assert_path bridge.runnerGuide.commands.dryRunRpaPackageAll
if [[ "$(json_get bridge.runnerGuide.envFile)" != *"WECOM_BRIDGE_CAPABILITIES="* ]]; then
  echo "ERROR: Bridge runner guide env file is missing WECOM_BRIDGE_CAPABILITIES" >&2
  sed -n '1,120p' "$body_file" >&2
  exit 1
fi
if [[ "$(json_get bridge.runnerGuide.envFile)" != *"WECOM_REQUIRE_TARGET_MATCH="* ]]; then
  echo "ERROR: Bridge runner guide env file is missing WECOM_REQUIRE_TARGET_MATCH" >&2
  sed -n '1,120p' "$body_file" >&2
  exit 1
fi
if [[ "$(json_get bridge.runnerGuide.envFile)" != *"WECOM_REQUIRE_HANDLER_VERIFICATION="* ]]; then
  echo "ERROR: Bridge runner guide env file is missing WECOM_REQUIRE_HANDLER_VERIFICATION" >&2
  sed -n '1,120p' "$body_file" >&2
  exit 1
fi
if [[ -n "${AUTOMATION_BRIDGE_TOKEN:-}" ]] && grep -qF "$AUTOMATION_BRIDGE_TOKEN" "$body_file"; then
  echo "ERROR: Bridge runner guide leaked the real AUTOMATION_BRIDGE_TOKEN" >&2
  exit 1
fi

say "Check automation preflight missing material guard"
request_json GET /api/admin/automation/config
original_config="$(python3 - "$body_file" <<'PY'
import json
import sys

with open(sys.argv[1], "r", encoding="utf-8") as fh:
    payload = json.load(fh)
print(json.dumps(payload["config"], ensure_ascii=False))
PY
)"
preflight_rule_name="smoke-preflight-rule-$stamp"
preflight_missing_key="smoke-missing-material-$stamp"
preflight_config_payload="$(python3 - "$body_file" "$preflight_rule_name" "$preflight_missing_key" <<'PY'
import json
import sys

file, rule_name, missing_key = sys.argv[1], sys.argv[2], sys.argv[3]
with open(file, "r", encoding="utf-8") as fh:
    payload = json.load(fh)
config = payload["config"]
settings = config.get("settings", {})
settings["enabled"] = True
settings["automaticRuleRepliesEnabled"] = True
config["settings"] = settings
config.setdefault("rules", []).append({
    "name": rule_name,
    "enabled": True,
    "approved": True,
    "priority": 9,
    "triggers": [f"preflight {missing_key}"],
    "responseSteps": [{"type": "image", "imageKey": missing_key, "sendEnter": True}],
})
print(json.dumps(config, ensure_ascii=False))
PY
)"
request_json PUT /api/admin/automation/config "$preflight_config_payload"
request_json GET /api/admin/automation/preflight
json_assert_eq report.level block
json_assert_check_id material_missing block
request_json PUT /api/admin/automation/config "$original_config"
json_assert_path config.settings

say "Import and remove WeCom knowledge item"
knowledge_title="smoke-knowledge-$stamp"
knowledge_payload="$(python3 - "$knowledge_title" <<'PY'
import json
import sys

title = sys.argv[1]
print(json.dumps({
    "source": "smoke-wecom-mac",
    "category": "faq",
    "approveImported": False,
    "mode": "upsert",
    "items": [{
        "title": title,
        "tags": ["smoke"],
        "triggers": ["smoke 测试"],
        "content": "这是一条企业微信自动化接入资料 smoke 测试，不会用于真实发送。",
        "targetNames": ["Smoke Test Contact"],
    }],
}, ensure_ascii=False))
PY
)"
request_json POST /api/admin/automation/knowledge/import "$knowledge_payload"
json_assert_path result.items[0].id
knowledge_id="$(json_get result.items[0].id)"
request_json PATCH "/api/admin/automation/knowledge/$knowledge_id" '{"approved":true,"enabled":true}'
json_assert_path item.approved
request_json DELETE "/api/admin/automation/knowledge/$knowledge_id"
json_assert_path ok

say "Import and remove automation audience contact"
audience_name="Smoke Audience $stamp"
audience_payload="$(python3 - "$audience_name" <<'PY'
import json
import sys

name = sys.argv[1]
print(json.dumps({
    "source": "smoke-wecom-mac",
    "type": "group",
    "approveImported": True,
    "mode": "upsert",
    "contacts": [{
        "name": name,
        "tags": ["smoke", "群发测试"],
        "aliases": [name + " alias"],
        "note": "这是一条受众资产 smoke 测试，不会用于真实发送。",
    }],
}, ensure_ascii=False))
PY
)"
request_json POST /api/admin/automation/audience/import "$audience_payload"
json_assert_path result.contacts[0].id
audience_id="$(json_get result.contacts[0].id)"
request_json GET /api/admin/automation/audience
json_assert_path contacts[0].id
request_json PATCH "/api/admin/automation/audience/$audience_id" '{"approved":true,"enabled":true}'
json_assert_path contact.approved
audience_mass_payload="$(python3 - "$stamp" <<'PY'
import json
import sys

stamp = sys.argv[1]
print(json.dumps({
    "title": f"smoke-audience-mass-{stamp}",
    "message": "这是一条按受众筛选生成的 smoke 群发队列，不会发送。",
    "audienceFilter": {
        "tag": "群发测试",
        "type": "group",
        "limit": 20,
    },
    "options": {
        "perSendDelaySeconds": 0,
        "requireOperatorConfirmRecipient": True,
        "openConversationBeforeSend": False,
    },
}, ensure_ascii=False))
PY
)"
request_json POST /api/admin/automation/mass-jobs/from-audience "$audience_mass_payload"
json_assert_eq selection.selected 1
json_assert_path job.id
audience_mass_job_id="$(json_get job.id)"
request_json PATCH "/api/admin/automation/mass-jobs/$audience_mass_job_id" '{"status":"cancelled","approved":false}'
json_assert_eq job.status cancelled
request_json DELETE "/api/admin/automation/audience/$audience_id"
json_assert_path ok

say "Import and remove automation material asset"
material_key="smoke-poster-$stamp"
material_payload="$(python3 - "$material_key" "$reply_image_file" <<'PY'
import json
import sys

key = sys.argv[1]
path = sys.argv[2]
print(json.dumps({
    "source": "smoke-wecom-mac",
    "kind": "image",
    "approveImported": False,
    "mode": "upsert",
    "rawText": f"{key} | {path}",
}, ensure_ascii=False))
PY
)"
request_json POST /api/admin/automation/materials/import "$material_payload"
json_assert_path result.assets[0].id
json_assert_eq result.assets[0].key "$material_key"
json_assert_eq result.assets[0].kind image
material_id="$(json_get result.assets[0].id)"
request_json GET /api/admin/automation/materials
json_assert_path assets[0].id
request_json PATCH "/api/admin/automation/materials/$material_id" '{"approved":true,"enabled":true}'
json_assert_path asset.approved
request_json DELETE "/api/admin/automation/materials/$material_id"
json_assert_path ok

say "Export, preview and import automation bundle"
bundle_payload="$(python3 - "$stamp" "$reply_image_file" <<'PY'
import json
import sys

stamp = sys.argv[1]
image_path = sys.argv[2]
bundle = {
    "schema": "wechat-on-cloud.automation-bundle",
    "version": 1,
    "exportedAt": "2026-07-05T00:00:00.000Z",
    "config": {
        "settings": {"enabled": True, "aiDraftEnabled": True, "automaticRuleRepliesEnabled": True, "massSendEnabled": True, "momentsEnabled": True, "maximumAutomaticSendsPerHour": 20, "perConversationCooldownMinutes": 10, "requireConfirmForSend": True},
        "persona": "Smoke bundle persona",
        "knowledgeNotes": "Smoke bundle notes",
        "rules": [{"name": f"smoke-bundle-rule-{stamp}", "enabled": True, "approved": True, "priority": 20, "triggers": [f"bundle trigger {stamp}"], "responseSteps": [{"type": "text", "text": "bundle reply", "sendEnter": True}]}],
        "knowledgeItems": [{"title": f"smoke-bundle-knowledge-{stamp}", "category": "faq", "source": "smoke-bundle", "tags": ["bundle"], "triggers": ["bundle"], "content": "bundle knowledge content"}],
    },
    "audienceContacts": [{"name": f"Smoke Bundle Audience {stamp}", "type": "group", "source": "smoke-bundle", "tags": ["bundle"], "note": "bundle audience"}],
    "materialAssets": [{"key": f"smoke-bundle-poster-{stamp}", "title": "Smoke Bundle Poster", "kind": "image", "source": "smoke-bundle", "localPath": image_path, "tags": ["bundle"], "description": "bundle material"}],
    "massSendJobs": [{"title": f"smoke-bundle-mass-{stamp}", "message": "bundle mass message", "approved": True, "status": "queued", "items": [{"recipientName": f"Smoke Bundle Contact {stamp}", "status": "pending"}]}],
    "momentDrafts": [{"title": f"smoke-bundle-moment-{stamp}", "text": "bundle moment text", "approved": True, "status": "ready", "materials": [f"smoke-bundle-poster-{stamp}"]}],
}
print(json.dumps({"bundle": bundle, "mode": "upsert", "includeConfig": False, "keepOperationalState": False}, ensure_ascii=False))
PY
)"
request_json POST /api/admin/automation/bundle/import "$(python3 - "$bundle_payload" <<'PY'
import json
import sys
payload = json.loads(sys.argv[1])
payload["dryRun"] = True
print(json.dumps(payload, ensure_ascii=False))
PY
)"
json_assert_eq result.imported.knowledgeItems 1
json_assert_eq result.imported.audienceContacts 1
json_assert_eq result.imported.materialAssets 1
json_assert_eq result.imported.massSendJobs 1
json_assert_eq result.imported.momentDrafts 1
request_json POST /api/admin/automation/bundle/import "$(python3 - "$bundle_payload" <<'PY'
import json
import sys
payload = json.loads(sys.argv[1])
payload["dryRun"] = False
print(json.dumps(payload, ensure_ascii=False))
PY
)"
json_assert_eq result.imported.knowledgeItems 1
json_assert_path result.ids.knowledgeItems[0]
bundle_rule_id="$(json_get result.ids.rules[0])"
bundle_knowledge_id="$(json_get result.ids.knowledgeItems[0])"
bundle_audience_id="$(json_get result.ids.audienceContacts[0])"
bundle_material_id="$(json_get result.ids.materialAssets[0])"
bundle_mass_job_id="$(json_get result.ids.massSendJobs[0])"
bundle_moment_id="$(json_get result.ids.momentDrafts[0])"
request_json GET /api/admin/automation/bundle
json_assert_path bundle.summary.materialAssets
request_json GET /api/admin/automation/config
bundle_config_cleanup="$(python3 - "$body_file" "$bundle_rule_id" <<'PY'
import json
import sys

file, rule_id = sys.argv[1], sys.argv[2]
with open(file, "r", encoding="utf-8") as fh:
    payload = json.load(fh)
config = payload["config"]
config["rules"] = [rule for rule in config.get("rules", []) if rule.get("id") != rule_id]
print(json.dumps(config, ensure_ascii=False))
PY
)"
request_json DELETE "/api/admin/automation/knowledge/$bundle_knowledge_id"
json_assert_path ok
request_json DELETE "/api/admin/automation/audience/$bundle_audience_id"
json_assert_path ok
request_json DELETE "/api/admin/automation/materials/$bundle_material_id"
json_assert_path ok
request_json PATCH "/api/admin/automation/mass-jobs/$bundle_mass_job_id" '{"status":"cancelled","approved":false}'
json_assert_eq job.status cancelled
request_json PATCH "/api/admin/automation/moment-drafts/$bundle_moment_id" '{"status":"archived","approved":false}'
json_assert_eq draft.status archived
request_json PUT /api/admin/automation/config "$bundle_config_cleanup"
json_assert_path config.rules

if [[ -n "${AUTOMATION_BRIDGE_TOKEN:-}" ]]; then
  say "Check WeCom Mac handler dry-run"
  WECOM_HANDLER_MODE=dry-run "$WECOM_REPLY_HANDLER" < "$ROOT/doc/examples/wecom-bridge-reply.sample.json" > "$body_file"
  json_assert_path ok

  say "Check WeCom Mac handler verification output"
  cat > "$fake_osascript_dir/osascript" <<'SH'
#!/usr/bin/env bash
if [[ -n "${WECOM_FAKE_OSASCRIPT_LOG:-}" ]]; then
  printf '%s\n' "$*" >> "$WECOM_FAKE_OSASCRIPT_LOG"
fi
if [[ "${1:-}" == "-" && "$#" -eq 2 ]]; then
  printf '企业微信\n企业微信 - %s\n' "${WECOM_FAKE_WINDOW_TITLE:-Smoke Verify Conversation}"
fi
exit 0
SH
  chmod +x "$fake_osascript_dir/osascript"
  PATH="$fake_osascript_dir:$PATH" WECOM_HANDLER_MODE=prepare WECOM_SEARCH_SHORTCUT=none WECOM_REQUIRE_TARGET_MATCH=1 WECOM_FAKE_WINDOW_TITLE="Smoke Verify Conversation" "$WECOM_REPLY_HANDLER" <<'JSON' > "$body_file"
{"id":"evt","conversationName":"Smoke Verify Conversation","replyDraft":"hello"}
JSON
  json_assert_path verification.verified
  json_assert_eq verification.matchedName "Smoke Verify Conversation"
  PATH="$fake_osascript_dir:$PATH" WECOM_HANDLER_MODE=prepare WECOM_SEARCH_SHORTCUT=none WECOM_REQUIRE_TARGET_MATCH=1 WECOM_FAKE_WINDOW_TITLE="Smoke Verify Mass" "$WECOM_MASS_HANDLER" <<'JSON' > "$body_file"
{"id":"task","recipientName":"Smoke Verify Mass","message":"hello"}
JSON
  json_assert_path verification.verified
  json_assert_eq verification.matchedName "Smoke Verify Mass"
  PATH="$fake_osascript_dir:$PATH" WECOM_HANDLER_MODE=prepare WECOM_FAKE_WINDOW_TITLE="Smoke Verify Moment" "$WECOM_MOMENT_HANDLER" <<'JSON' > "$body_file"
{"id":"moment","title":"Smoke Verify Moment Draft","text":"hello"}
JSON
  json_assert_path verification.verified
  json_assert_eq verification.windowTitle "企业微信 - Smoke Verify Moment"

  say "Check WeCom Mac handler target gate"
  : > "$fake_osascript_log_file"
  set +e
  PATH="$fake_osascript_dir:$PATH" \
    WECOM_HANDLER_MODE=prepare \
    WECOM_SEARCH_SHORTCUT=none \
    WECOM_REQUIRE_TARGET_MATCH=1 \
    WECOM_FAKE_WINDOW_TITLE="Wrong Conversation" \
    WECOM_FAKE_OSASCRIPT_LOG="$fake_osascript_log_file" \
    "$WECOM_REPLY_HANDLER" <<'JSON' > "$body_file" 2> "$handler_error_file"
{"id":"evt","conversationName":"Smoke Required Reply","replyDraft":"should-not-paste-reply"}
JSON
  reply_gate_status=$?
  set -e
  if [[ "$reply_gate_status" -eq 0 ]]; then
    echo "ERROR: reply handler target gate should have failed" >&2
    sed -n '1,120p' "$body_file" >&2
    exit 1
  fi
  python3 - "$body_file" <<'PY'
import json
import sys

with open(sys.argv[1], "r", encoding="utf-8") as fh:
    payload = json.load(fh)
verification = payload.get("verification") or {}
if payload.get("ok") is not False:
    raise SystemExit("reply gate payload ok should be false")
if payload.get("verificationRequired") is not True:
    raise SystemExit("reply gate should mark verificationRequired")
if verification.get("verified") is not False:
    raise SystemExit("reply gate verification should be false")
if verification.get("matchedName"):
    raise SystemExit("reply gate should not have matchedName on mismatch")
PY
  grep -q "Target verification failed before writing reply" "$handler_error_file"
  if grep -q "should-not-paste-reply" "$fake_osascript_log_file"; then
    echo "ERROR: reply handler pasted text after target gate failure" >&2
    cat "$fake_osascript_log_file" >&2
    exit 1
  fi

  : > "$fake_osascript_log_file"
  set +e
  PATH="$fake_osascript_dir:$PATH" \
    WECOM_HANDLER_MODE=prepare \
    WECOM_SEARCH_SHORTCUT=none \
    WECOM_REQUIRE_TARGET_MATCH=1 \
    WECOM_FAKE_WINDOW_TITLE="Wrong Mass" \
    WECOM_FAKE_OSASCRIPT_LOG="$fake_osascript_log_file" \
    "$WECOM_MASS_HANDLER" <<'JSON' > "$body_file" 2> "$handler_error_file"
{"id":"task","recipientName":"Smoke Required Mass","message":"should-not-paste-mass"}
JSON
  mass_gate_status=$?
  set -e
  if [[ "$mass_gate_status" -eq 0 ]]; then
    echo "ERROR: mass handler target gate should have failed" >&2
    sed -n '1,120p' "$body_file" >&2
    exit 1
  fi
  python3 - "$body_file" <<'PY'
import json
import sys

with open(sys.argv[1], "r", encoding="utf-8") as fh:
    payload = json.load(fh)
verification = payload.get("verification") or {}
if payload.get("ok") is not False:
    raise SystemExit("mass gate payload ok should be false")
if payload.get("verificationRequired") is not True:
    raise SystemExit("mass gate should mark verificationRequired")
if verification.get("verified") is not False:
    raise SystemExit("mass gate verification should be false")
if verification.get("matchedName"):
    raise SystemExit("mass gate should not have matchedName on mismatch")
PY
  grep -q "Target verification failed before writing mass message" "$handler_error_file"
  if grep -q "should-not-paste-mass" "$fake_osascript_log_file"; then
    echo "ERROR: mass handler pasted text after target gate failure" >&2
    cat "$fake_osascript_log_file" >&2
    exit 1
  fi

  say "Import WeCom knowledge through Bridge"
  bridge_title="smoke-bridge-$stamp"
  bridge_payload="$(python3 - "$bridge_title" <<'PY'
import json
import sys

title = sys.argv[1]
print(json.dumps({
    "source": "smoke-wecom-bridge",
    "category": "script",
    "approveImported": False,
    "mode": "upsert",
    "items": [{
        "title": title,
        "tags": ["bridge"],
        "triggers": ["bridge 测试"],
        "content": "这是一条通过 Mac Bridge 推送的 smoke 测试资料，不会用于真实发送。",
    }],
}, ensure_ascii=False))
PY
)"
  request_bridge_json POST /api/automation/bridge/wecom/import "$bridge_payload"
  json_assert_path result.items[0].id
  bridge_id="$(json_get result.items[0].id)"
  request_json DELETE "/api/admin/automation/knowledge/$bridge_id"
  json_assert_path ok

  say "Import audience through Bridge"
  bridge_audience_payload="$(python3 - "$stamp" <<'PY'
import json
import sys

stamp = sys.argv[1]
print(json.dumps({
    "source": "smoke-wecom-bridge",
    "type": "group",
    "approveImported": False,
    "mode": "upsert",
    "contacts": [{"name": f"Smoke Bridge Audience {stamp}", "tags": ["bridge"], "note": "Bridge audience smoke"}],
}, ensure_ascii=False))
PY
)"
  WOC_PANEL_URL="$PANEL_URL" AUTOMATION_BRIDGE_TOKEN="$AUTOMATION_BRIDGE_TOKEN" node "$BRIDGE_CLIENT" import-audience - <<<"$bridge_audience_payload" > "$body_file"
  json_assert_path result.contacts[0].id
  bridge_audience_id="$(json_get result.contacts[0].id)"
  request_json DELETE "/api/admin/automation/audience/$bridge_audience_id"
  json_assert_path ok

  say "Import materials through Bridge"
  bridge_material_payload="$(python3 - "$stamp" "$reply_image_file" <<'PY'
import json
import sys

stamp = sys.argv[1]
path = sys.argv[2]
print(json.dumps({
    "source": "smoke-wecom-bridge",
    "kind": "image",
    "approveImported": True,
    "mode": "upsert",
    "assets": [{
        "key": f"smoke-bridge-poster-{stamp}",
        "title": "Smoke Bridge Poster",
        "localPath": path,
        "tags": ["bridge"],
        "description": "Bridge material smoke",
    }],
}, ensure_ascii=False))
PY
)"
  WOC_PANEL_URL="$PANEL_URL" AUTOMATION_BRIDGE_TOKEN="$AUTOMATION_BRIDGE_TOKEN" node "$BRIDGE_CLIENT" import-materials - <<<"$bridge_material_payload" > "$body_file"
  json_assert_path result.assets[0].id
  json_assert_eq result.assets[0].kind image
  bridge_material_key="$(json_get result.assets[0].key)"
  bridge_material_id="$(json_get result.assets[0].id)"
  request_bridge_json GET "/api/automation/bridge/wecom/material-map?kind=image"
  json_assert_path materialMap.materials[0].key
  json_assert_path materialMap.map
  WOC_PANEL_URL="$PANEL_URL" AUTOMATION_BRIDGE_TOKEN="$AUTOMATION_BRIDGE_TOKEN" node "$BRIDGE_CLIENT" material-map --kind image --output "$material_map_file" > "$body_file"
  json_assert_path materialMap.materials[0].localPath
  python3 - "$material_map_file" "$bridge_material_key" "$reply_image_file" <<'PY'
import json
import sys

file, expected_key, expected_path = sys.argv[1], sys.argv[2], sys.argv[3]
with open(file, "r", encoding="utf-8") as fh:
    payload = json.load(fh)
materials = payload.get("materials", [])
matches = [item for item in materials if item.get("key") == expected_key]
if not matches:
    raise SystemExit(f"material map file missing key {expected_key}")
if matches[0].get("localPath") != expected_path or matches[0].get("path") != expected_path:
    raise SystemExit(f"material map file path mismatch for {expected_key}")
if payload.get("map", {}).get(expected_key) != expected_path:
    raise SystemExit(f"plain map missing key {expected_key}")
PY
  request_json DELETE "/api/admin/automation/materials/$bridge_material_id"
  json_assert_path ok

  say "Report WeCom Bridge worker heartbeat"
  WOC_PANEL_URL="$PANEL_URL" AUTOMATION_BRIDGE_TOKEN="$AUTOMATION_BRIDGE_TOKEN" node "$BRIDGE_CLIENT" heartbeat --worker-id smoke-worker --mode dry-run > "$body_file"
  json_assert_eq worker.workerId smoke-worker
  json_assert_eq worker.enabled True
  json_assert_path worker.lastSeenAt
  json_assert_array_contains worker.capabilities reply
  json_assert_array_contains worker.capabilities mass
  json_assert_array_contains worker.capabilities moment
  json_assert_array_contains worker.capabilities target-match
  json_assert_path pendingReplies
  WECOM_USE_RPA_PACKAGE=1 WOC_PANEL_URL="$PANEL_URL" AUTOMATION_BRIDGE_TOKEN="$AUTOMATION_BRIDGE_TOKEN" node "$BRIDGE_CLIENT" heartbeat --worker-id smoke-rpa-worker --mode dry-run > "$body_file"
  json_assert_eq worker.workerId smoke-rpa-worker
  json_assert_array_contains worker.capabilities rpa-package

  say "Update and fetch WeCom Bridge runner policy"
  request_json GET /api/admin/automation/runner-policy
  json_assert_path policy.mode
  runner_policy_payload='{"runnerEngine":"bridge","mode":"dry-run","target":"replies","limit":3,"claimTtlSeconds":180,"heartbeatIntervalSeconds":45,"momentPasteMode":"clipboard-only","allowSend":false,"requireTargetMatch":true,"requireHandlerVerification":true}'
  request_json PUT /api/admin/automation/runner-policy "$runner_policy_payload"
  json_assert_eq policy.runnerEngine bridge
  json_assert_eq policy.target replies
  json_assert_eq policy.limit 3
  json_assert_eq policy.requireTargetMatch True
  json_assert_eq policy.requireHandlerVerification True
  WOC_PANEL_URL="$PANEL_URL" AUTOMATION_BRIDGE_TOKEN="$AUTOMATION_BRIDGE_TOKEN" node "$BRIDGE_CLIENT" runner-policy --worker-id smoke-worker > "$body_file"
  json_assert_eq policy.runnerEngine bridge
  json_assert_eq env.WECOM_RUNNER_ENGINE bridge
  json_assert_eq env.WECOM_USE_RPA_PACKAGE 0
  json_assert_eq policy.target replies
  json_assert_eq env.WECOM_RUNNER_TARGET replies
  json_assert_eq env.WECOM_REQUIRE_TARGET_MATCH 1
  json_assert_eq env.WECOM_REQUIRE_HANDLER_VERIFICATION 1

  say "Plan WeCom Bridge replies during event ingest"
  request_json GET /api/admin/automation/config
  bridge_plan_config_original="$(python3 - "$body_file" <<'PY'
import json
import sys

with open(sys.argv[1], "r", encoding="utf-8") as fh:
    payload = json.load(fh)
print(json.dumps(payload["config"], ensure_ascii=False))
PY
)"
  bridge_plan_trigger="smoke auto plan $stamp"
  bridge_plan_config_payload="$(python3 - "$body_file" "$bridge_plan_trigger" <<'PY'
import json
import sys

file, trigger = sys.argv[1], sys.argv[2]
with open(file, "r", encoding="utf-8") as fh:
    payload = json.load(fh)
config = payload["config"]
settings = config.get("settings", {})
settings["enabled"] = True
settings["aiDraftEnabled"] = False
settings["automaticRuleRepliesEnabled"] = True
config["settings"] = settings
config.setdefault("rules", []).append({
    "name": f"smoke-auto-plan-rule-{trigger}",
    "enabled": True,
    "approved": True,
    "priority": 7,
    "triggers": [trigger],
    "responseSteps": [{"type": "text", "text": "这是自动规划出的 Bridge 规则回复。", "sendEnter": True}],
})
print(json.dumps(config, ensure_ascii=False))
PY
)"
  request_json PUT /api/admin/automation/config "$bridge_plan_config_payload"
  bridge_plan_event_payload="$(python3 - "$stamp" "$bridge_plan_trigger" <<'PY'
import json
import sys

stamp, trigger = sys.argv[1], sys.argv[2]
print(json.dumps({
    "source": "smoke-wecom-bridge",
    "events": [{
        "externalId": f"smoke-auto-plan-{stamp}",
        "conversationName": "Smoke Auto Plan Conversation",
        "senderName": "Smoke Sender",
        "inboundText": f"你好，{trigger}，请自动生成回复。",
    }],
}, ensure_ascii=False))
PY
)"
  WOC_PANEL_URL="$PANEL_URL" AUTOMATION_BRIDGE_TOKEN="$AUTOMATION_BRIDGE_TOKEN" \
    node "$BRIDGE_CLIENT" push-events --plan-replies --approve-rule-replies - <<<"$bridge_plan_event_payload" > "$body_file"
  json_assert_eq result.planned 1
  json_assert_eq result.approved 1
  json_assert_eq result.events[0].status planned
  json_assert_path result.events[0].replyApproved
  bridge_plan_event_id="$(json_get result.events[0].id)"
  request_bridge_json GET "/api/automation/bridge/wecom/replies?limit=50"
  json_assert_reply_id "$bridge_plan_event_id"
  request_json PATCH "/api/admin/automation/bridge-events/$bridge_plan_event_id" '{"status":"archived","replyApproved":false}'
  json_assert_eq event.status archived
  request_json PUT /api/admin/automation/config "$bridge_plan_config_original"
  json_assert_path config.settings
  bridge_enabled_config_payload="$(python3 - "$body_file" <<'PY'
import json
import sys

with open(sys.argv[1], "r", encoding="utf-8") as fh:
    payload = json.load(fh)
config = payload["config"]
settings = config.get("settings", {})
settings["enabled"] = True
settings["aiDraftEnabled"] = True
settings["automaticRuleRepliesEnabled"] = True
settings["maximumAutomaticActionsPerDay"] = 0
settings["quietHoursEnabled"] = False
config["settings"] = settings
print(json.dumps(config, ensure_ascii=False))
PY
)"
  request_json PUT /api/admin/automation/config "$bridge_enabled_config_payload"
  json_assert_eq config.settings.enabled True

  say "Check WeCom Bridge runner doctor"
  WOC_PANEL_URL="$PANEL_URL" \
    AUTOMATION_BRIDGE_TOKEN="$AUTOMATION_BRIDGE_TOKEN" \
    WECOM_BRIDGE_WORKER_ID=smoke-worker \
    WECOM_MATERIAL_MAP_FILE="$material_map_file" \
    WECOM_DOCTOR_APP=0 \
    WECOM_DOCTOR_REPORT=1 \
    "$WECOM_BRIDGE_RUNNER" doctor > "$body_file"
  grep -q "remote policy reachable" "$body_file"
  grep -q "Summary: 0 failure" "$body_file"
  request_json GET /api/admin/automation/bridge-runs?limit=5
  json_assert_eq reports[0].target doctor
  json_assert_eq reports[0].mode doctor
  json_assert_eq reports[0].items[0].target doctor

  say "Report WeCom Bridge runner result"
  WOC_PANEL_URL="$PANEL_URL" AUTOMATION_BRIDGE_TOKEN="$AUTOMATION_BRIDGE_TOKEN" node "$BRIDGE_CLIENT" report-run \
    --worker-id smoke-worker \
    --target all \
    --mode dry-run \
    --handled-replies 1 \
    --handled-mass-tasks 1 \
    --handled-moment-tasks 1 \
    --summary "smoke run report" > "$body_file"
  json_assert_path report.id
  request_json GET /api/admin/automation/bridge-runs?limit=10
  json_assert_path reports[0].id

  verification_items_json="$(python3 - <<'PY'
import json
print(json.dumps([{
    "id": "smoke-verified-item",
    "target": "reply",
    "conversationName": "Smoke Verified Conversation",
    "action": "prepared",
    "ok": True,
    "verification": {
        "required": True,
        "verified": True,
        "expectedName": "Smoke Verified Conversation",
        "matchedName": "Smoke Verified Conversation",
        "conversationMatched": True,
        "inputReady": True,
        "activeApp": "企业微信",
        "windowTitle": "企业微信 - Smoke Verified Conversation",
        "ocrText": "Smoke Verified Conversation\\n输入框",
        "visualSummary": "窗口标题和 OCR 均命中目标会话",
        "confidence": 0.98,
    },
}], ensure_ascii=False))
PY
)"
  WOC_PANEL_URL="$PANEL_URL" AUTOMATION_BRIDGE_TOKEN="$AUTOMATION_BRIDGE_TOKEN" node "$BRIDGE_CLIENT" report-run \
    --worker-id smoke-worker \
    --target replies \
    --mode prepare \
    --handled-replies 1 \
    --items-json "$verification_items_json" \
    --summary "smoke verification report" > "$body_file"
  json_assert_path report.items[0].verification.verified
  json_assert_eq report.items[0].verification.matchedName "Smoke Verified Conversation"
  json_assert_eq report.items[0].verification.windowTitle "企业微信 - Smoke Verified Conversation"
  request_json GET /api/admin/automation/bridge-runs?limit=10
  json_assert_eq reports[0].items[0].verification.matchedName "Smoke Verified Conversation"
  json_assert_path reports[0].items[0].verification.inputReady

  say "Check Bridge handler verification capture"
  cat > "$verification_handler_file" <<'SH'
#!/usr/bin/env bash
set -euo pipefail
payload="$(cat)"
node - "$payload" <<'NODE'
const payload = JSON.parse(process.argv[2] || '{}');
const name = String(payload.conversationName || payload.senderName || '').trim();
console.log(JSON.stringify({
  ok: true,
  verification: {
    required: true,
    verified: true,
    matchedName: name,
    conversationMatched: true,
    inputReady: true,
    activeApp: '企业微信',
    windowTitle: `企业微信 - ${name}`,
    ocrText: `${name}\n输入框`,
    confidence: 0.99,
  },
}));
NODE
SH
  chmod +x "$verification_handler_file"
  handler_capture_payload="$(python3 - "$stamp" <<'PY'
import json
import sys

stamp = sys.argv[1]
print(json.dumps({
    "source": "smoke-wecom-bridge",
    "events": [{
        "externalId": f"smoke-handler-capture-{stamp}",
        "conversationName": "Smoke Handler Capture",
        "senderName": "Smoke Sender",
        "inboundText": "请验证 handler stdout 校验快照。",
    }],
}, ensure_ascii=False))
PY
)"
  request_bridge_json POST /api/automation/bridge/wecom/events "$handler_capture_payload"
  json_assert_path result.events[0].id
  handler_capture_event_id="$(json_get result.events[0].id)"
  request_json PATCH "/api/admin/automation/bridge-events/$handler_capture_event_id" '{"status":"planned","replyDraft":"handler capture reply","replyApproved":true}'
  json_assert_path event.replyApproved
  WOC_PANEL_URL="$PANEL_URL" AUTOMATION_BRIDGE_TOKEN="$AUTOMATION_BRIDGE_TOKEN" node "$BRIDGE_CLIENT" run-approved \
    --worker-id smoke-worker \
    --handler "$verification_handler_file" \
    --limit 20 \
    --claim \
    --report-run > "$body_file"
  json_assert_path handled[0].verification.verified
  json_assert_eq handled[0].verification.matchedName "Smoke Handler Capture"
  json_assert_eq runReport.report.items[0].verification.windowTitle "企业微信 - Smoke Handler Capture"
  request_json PATCH "/api/admin/automation/bridge-events/$handler_capture_event_id" '{"status":"archived"}'
  json_assert_eq event.status archived

  say "Check Bridge handler verification gate"
  cat > "$verification_handler_file" <<'SH'
#!/usr/bin/env bash
set -euo pipefail
payload="$(cat)"
node - "$payload" <<'NODE'
const payload = JSON.parse(process.argv[2] || '{}');
const name = String(payload.conversationName || payload.senderName || '').trim();
console.log(JSON.stringify({
  ok: true,
  verification: {
    required: true,
    verified: false,
    matchedName: 'Wrong Conversation',
    conversationMatched: false,
    inputReady: true,
    activeApp: '企业微信',
    windowTitle: `企业微信 - Wrong Conversation for ${name}`,
    confidence: 0,
  },
}));
NODE
SH
  chmod +x "$verification_handler_file"
  handler_gate_payload="$(python3 - "$stamp" <<'PY'
import json
import sys

stamp = sys.argv[1]
print(json.dumps({
    "source": "smoke-wecom-bridge",
    "events": [{
        "externalId": f"smoke-handler-gate-{stamp}",
        "conversationName": "Smoke Handler Gate",
        "senderName": "Smoke Sender",
        "inboundText": "请验证 handler 交付门禁。",
    }],
}, ensure_ascii=False))
PY
)"
  request_bridge_json POST /api/automation/bridge/wecom/events "$handler_gate_payload"
  json_assert_path result.events[0].id
  handler_gate_event_id="$(json_get result.events[0].id)"
  request_json PATCH "/api/admin/automation/bridge-events/$handler_gate_event_id" '{"status":"planned","replyDraft":"handler gate reply","replyApproved":true}'
  WECOM_REQUIRE_HANDLER_VERIFICATION=1 WOC_PANEL_URL="$PANEL_URL" AUTOMATION_BRIDGE_TOKEN="$AUTOMATION_BRIDGE_TOKEN" node "$BRIDGE_CLIENT" run-approved \
    --worker-id smoke-worker \
    --handler "$verification_handler_file" \
    --limit 20 \
    --claim \
    --mark-delivered \
    --report-failure \
    --report-run > "$body_file"
  json_assert_eq handled[0].ok False
  json_assert_eq handled[0].action failed
  json_assert_eq handled[0].verification.verified False
  json_assert_path handled[0].error
  json_assert_path handled[0].failed.event.replyFailedAt
  json_assert_eq handled[0].failed.event.replyFailedBy smoke-worker
  json_assert_missing_or_empty handled[0].failed.event.replyDeliveredAt
  json_assert_eq runReport.report.status failed
  request_json PATCH "/api/admin/automation/bridge-events/$handler_gate_event_id" '{"status":"archived"}'
  json_assert_eq event.status archived

  say "Push WeCom inbound message through Bridge"
  bridge_event_payload="$(python3 - "$stamp" <<'PY'
import json
import sys

stamp = sys.argv[1]
print(json.dumps({
    "source": "smoke-wecom-bridge",
    "events": [{
        "externalId": f"smoke-msg-{stamp}",
        "conversationName": "Smoke Test Conversation",
        "senderName": "Smoke Sender",
        "inboundText": "你好，我想了解一下这个自动化服务适合谁。",
        "conversationContext": "客户来自企业微信自动化 Mac 版 smoke 测试。",
    }],
}, ensure_ascii=False))
PY
)"
  request_bridge_json POST /api/automation/bridge/wecom/events "$bridge_event_payload"
  json_assert_path result.events[0].id
  bridge_event_id="$(json_get result.events[0].id)"
  request_json PATCH "/api/admin/automation/bridge-events/$bridge_event_id" '{"status":"planned"}'
  json_assert_eq event.status planned
  bridge_reply_payload="$(python3 - "$reply_image_file" "$reply_image_key" <<'PY'
import json
import sys

image_path = sys.argv[1]
image_key = sys.argv[2]
print(json.dumps({
    "replyDraft": "这是经过人工确认的 Bridge smoke 第一段回复。\n\n[wait 1]\n\n[image " + image_path + "]\n\n[image-key " + image_key + "]\n\n这是经过人工确认的 Bridge smoke 第二段回复。",
    "replySteps": [
        {"type": "text", "text": "这是经过人工确认的 Bridge smoke 第一段回复。", "sendEnter": True},
        {"type": "wait", "seconds": 1},
        {"type": "image", "imagePath": image_path, "sendEnter": True},
        {"type": "image", "imageKey": image_key, "sendEnter": True},
        {"type": "wait", "seconds": 1},
        {"type": "text", "text": "这是经过人工确认的 Bridge smoke 第二段回复。", "sendEnter": True},
    ],
    "replyApproved": True,
}, ensure_ascii=False))
PY
)"
  request_json PATCH "/api/admin/automation/bridge-events/$bridge_event_id" "$bridge_reply_payload"
  json_assert_path event.replyApproved
  json_assert_eq event.replySteps[1].seconds 1
  json_assert_eq event.replySteps[2].imagePath "$reply_image_file"
  json_assert_eq event.replySteps[3].imageKey "$reply_image_key"
  WOC_PANEL_URL="$PANEL_URL" AUTOMATION_BRIDGE_TOKEN="$AUTOMATION_BRIDGE_TOKEN" WECOM_USE_REMOTE_POLICY=1 WECOM_RUNNER_MODE=prepare WECOM_RUNNER_TARGET=mass "$WECOM_BRIDGE_RUNNER" run-once > "$body_file"
  json_assert_path handled[0].dryRun
  json_assert_eq handled[0].stepCount 6
  json_assert_eq handled[0].imageStepCount 2
  json_assert_path runReport.report.id
  json_assert_eq runReport.report.items[0].target reply
  json_assert_eq runReport.report.items[0].action dry-run
  json_assert_eq runReport.report.items[0].id "$bridge_event_id"
  WOC_PANEL_URL="$PANEL_URL" AUTOMATION_BRIDGE_TOKEN="$AUTOMATION_BRIDGE_TOKEN" node "$BRIDGE_CLIENT" pull-replies --limit 20 > "$body_file"
  json_assert_path replies[0].id
  json_assert_eq replies[0].replySteps[1].seconds 1
  json_assert_eq replies[0].replySteps[2].imagePath "$reply_image_file"
  json_assert_eq replies[0].replySteps[3].imageKey "$reply_image_key"
  say "Pause and resume WeCom Bridge worker"
  request_json PATCH "/api/admin/automation/bridge-workers/wecom-mac-bridge:smoke-worker" '{"enabled":false,"reason":"smoke pause worker"}'
  json_assert_eq worker.enabled False
  WOC_PANEL_URL="$PANEL_URL" AUTOMATION_BRIDGE_TOKEN="$AUTOMATION_BRIDGE_TOKEN" node "$BRIDGE_CLIENT" pull-replies --limit 20 --worker-id smoke-worker > "$body_file"
  json_assert_no_reply_id "$bridge_event_id"
  request_json GET "/api/admin/automation/rpa-package?target=replies&limit=20&format=json&workerId=smoke-worker"
  json_assert_no_task_id "$bridge_event_id"
  request_bridge_json PATCH "/api/automation/bridge/wecom/replies/$bridge_event_id" '{"deliveryStatus":"claimed","workerId":"smoke-worker","capabilities":["reply"],"claimTtlSeconds":120}' 400
  json_assert_path error
  request_json PATCH "/api/admin/automation/bridge-workers/wecom-mac-bridge:smoke-worker" '{"enabled":true}'
  json_assert_eq worker.enabled True
  WOC_PANEL_URL="$PANEL_URL" AUTOMATION_BRIDGE_TOKEN="$AUTOMATION_BRIDGE_TOKEN" node "$BRIDGE_CLIENT" pull-replies --limit 20 --worker-id smoke-worker > "$body_file"
  json_assert_reply_id "$bridge_event_id"
  request_json GET "/api/admin/automation/rpa-package?target=replies&limit=20&format=json&workerId=smoke-worker"
  json_assert_task_id "$bridge_event_id"
  request_bridge_json PATCH "/api/automation/bridge/wecom/replies/$bridge_event_id" '{"deliveryStatus":"claimed","workerId":"smoke-moment-only","capabilities":["moment"],"claimTtlSeconds":120}' 400
  json_assert_path error
  WECOM_BRIDGE_CAPABILITIES=reply WOC_PANEL_URL="$PANEL_URL" AUTOMATION_BRIDGE_TOKEN="$AUTOMATION_BRIDGE_TOKEN" node "$BRIDGE_CLIENT" claim-reply "$bridge_event_id" --worker-id smoke-worker > "$body_file"
  json_assert_path event.replyClaimedAt
  json_assert_eq event.replyClaimedBy smoke-worker
  json_assert_path event.replyClaimExpiresAt
  WOC_PANEL_URL="$PANEL_URL" AUTOMATION_BRIDGE_TOKEN="$AUTOMATION_BRIDGE_TOKEN" node "$BRIDGE_CLIENT" pull-replies --limit 20 > "$body_file"
  json_assert_no_reply_id "$bridge_event_id"
  WOC_PANEL_URL="$PANEL_URL" AUTOMATION_BRIDGE_TOKEN="$AUTOMATION_BRIDGE_TOKEN" node "$BRIDGE_CLIENT" release-reply "$bridge_event_id" --worker-id smoke-worker --reason "smoke release claim" > "$body_file"
  json_assert_missing_or_empty event.replyClaimedAt
  WOC_PANEL_URL="$PANEL_URL" AUTOMATION_BRIDGE_TOKEN="$AUTOMATION_BRIDGE_TOKEN" node "$BRIDGE_CLIENT" pull-replies --limit 20 > "$body_file"
  json_assert_reply_id "$bridge_event_id"
  WOC_PANEL_URL="$PANEL_URL" AUTOMATION_BRIDGE_TOKEN="$AUTOMATION_BRIDGE_TOKEN" node "$BRIDGE_CLIENT" claim-reply "$bridge_event_id" --worker-id smoke-worker --claim-ttl-seconds 120 > "$body_file"
  json_assert_path event.replyClaimExpiresAt
  WOC_PANEL_URL="$PANEL_URL" AUTOMATION_BRIDGE_TOKEN="$AUTOMATION_BRIDGE_TOKEN" node "$BRIDGE_CLIENT" mark-failed "$bridge_event_id" --worker-id smoke-worker --error "smoke handler failed once" > "$body_file"
  json_assert_path event.replyFailedAt
  json_assert_eq event.replyFailedBy smoke-worker
  json_assert_path event.replyError
  request_json POST /api/admin/automation/bridge-recovery '{"dryRun":true,"releaseClaims":"expired","retryFailed":true,"includeMass":false,"includeMoments":false,"workerId":"other-worker"}'
  json_assert_eq result.totalChanged 0
  request_json POST /api/admin/automation/bridge-recovery '{"dryRun":true,"releaseClaims":"expired","retryFailed":true,"includeMass":false,"includeMoments":false,"workerId":"smoke-worker","failureReason":"not-present"}'
  json_assert_eq result.totalChanged 0
  request_json POST /api/admin/automation/bridge-recovery '{"dryRun":true,"releaseClaims":"expired","retryFailed":true,"includeMass":false,"includeMoments":false,"workerId":"smoke-worker","failureReason":"handler failed","minFailedAgeSeconds":86400}'
  json_assert_eq result.minFailedAgeSeconds 86400
  json_assert_eq result.totalChanged 0
  request_json POST /api/admin/automation/bridge-recovery '{"dryRun":true,"releaseClaims":"expired","retryFailed":true,"includeMass":false,"includeMoments":false,"workerId":"smoke-worker","failureReason":"handler failed","maxRetryAttempts":2,"limit":1}'
  json_assert_eq result.dryRun True
  json_assert_eq result.workerId smoke-worker
  json_assert_eq result.failureReason "handler failed"
  json_assert_eq result.minFailedAgeSeconds 0
  json_assert_eq result.maxRetryAttempts 2
  json_assert_eq result.limit 1
  json_assert_eq result.totalChanged 1
  json_assert_eq result.changes[0].target reply
  json_assert_eq result.changes[0].action retry-failed
  json_assert_eq result.changes[0].workerId smoke-worker
  json_assert_eq result.changes[0].retryCount 0
  json_assert_eq result.changes[0].nextRetryCount 1
  json_assert_path result.changes[0].error
  json_assert_path result.changes[0].failedAt
  json_assert_path result.changes[0].cursor
  reply_recovery_cursor="$(json_get result.changes[0].cursor)"
  reply_cursor_payload="$(python3 - "$reply_recovery_cursor" <<'PY'
import json
import sys

print(json.dumps({
    "dryRun": True,
    "releaseClaims": "expired",
    "retryFailed": True,
    "includeMass": False,
    "includeMoments": False,
    "workerId": "smoke-worker",
    "failureReason": "handler failed",
    "cursor": sys.argv[1],
}))
PY
)"
  request_json POST /api/admin/automation/bridge-recovery "$reply_cursor_payload"
  json_assert_eq result.totalChanged 0
  request_json POST /api/admin/automation/bridge-recovery '{"releaseClaims":"expired","retryFailed":true,"includeMass":false,"includeMoments":false,"workerId":"smoke-worker","failureReason":"handler failed","maxRetryAttempts":2}'
  json_assert_eq result.replies.retriedFailed 1
  json_assert_eq result.failureReason "handler failed"
  json_assert_eq result.maxRetryAttempts 2
  json_assert_eq result.changes[0].target reply
  json_assert_eq result.changes[0].action retry-failed
  json_assert_eq result.changes[0].workerId smoke-worker
  json_assert_eq result.changes[0].retryCount 0
  json_assert_eq result.changes[0].nextRetryCount 1
  json_assert_path result.changes[0].failedAt
  json_assert_path result.changes[0].cursor
  WOC_PANEL_URL="$PANEL_URL" AUTOMATION_BRIDGE_TOKEN="$AUTOMATION_BRIDGE_TOKEN" node "$BRIDGE_CLIENT" pull-replies --limit 20 > "$body_file"
  json_assert_reply_id "$bridge_event_id"
  WOC_PANEL_URL="$PANEL_URL" AUTOMATION_BRIDGE_TOKEN="$AUTOMATION_BRIDGE_TOKEN" node "$BRIDGE_CLIENT" claim-reply "$bridge_event_id" --worker-id smoke-worker --claim-ttl-seconds 120 > "$body_file"
  json_assert_path event.replyClaimExpiresAt
  WOC_PANEL_URL="$PANEL_URL" AUTOMATION_BRIDGE_TOKEN="$AUTOMATION_BRIDGE_TOKEN" node "$BRIDGE_CLIENT" mark-failed "$bridge_event_id" --worker-id smoke-worker --error "smoke handler failed twice" > "$body_file"
  json_assert_path event.replyFailedAt
  request_json POST /api/admin/automation/bridge-recovery '{"dryRun":true,"releaseClaims":"expired","retryFailed":true,"includeMass":false,"includeMoments":false,"workerId":"smoke-worker","failureReason":"handler failed","maxRetryAttempts":1}'
  json_assert_eq result.maxRetryAttempts 1
  json_assert_eq result.totalChanged 0
  request_json POST /api/admin/automation/bridge-recovery '{"releaseClaims":"expired","retryFailed":true,"includeMass":false,"includeMoments":false,"workerId":"smoke-worker","failureReason":"handler failed","maxRetryAttempts":2}'
  json_assert_eq result.replies.retriedFailed 1
  json_assert_eq result.maxRetryAttempts 2
  json_assert_eq result.changes[0].retryCount 1
  json_assert_eq result.changes[0].nextRetryCount 2
  WOC_PANEL_URL="$PANEL_URL" AUTOMATION_BRIDGE_TOKEN="$AUTOMATION_BRIDGE_TOKEN" node "$BRIDGE_CLIENT" pull-replies --limit 20 > "$body_file"
  json_assert_reply_id "$bridge_event_id"
  WOC_PANEL_URL="$PANEL_URL" AUTOMATION_BRIDGE_TOKEN="$AUTOMATION_BRIDGE_TOKEN" node "$BRIDGE_CLIENT" mark-delivered "$bridge_event_id" --worker-id smoke-worker > "$body_file"
  json_assert_path event.replyDeliveredAt
  say "Enforce Bridge reply send cooldown"
  bridge_cooldown_event_payload="$(python3 - "$stamp" <<'PY'
import json
import sys

stamp = sys.argv[1]
print(json.dumps({
    "source": "smoke-wecom-bridge",
    "events": [{
        "externalId": f"smoke-reply-cooldown-{stamp}",
        "conversationName": "Smoke Test Conversation",
        "senderName": "Smoke Sender",
        "inboundText": "你好，我还有一个普通问题。",
    }],
}, ensure_ascii=False))
PY
)"
  request_bridge_json POST /api/automation/bridge/wecom/events "$bridge_cooldown_event_payload"
  json_assert_path result.events[0].id
  bridge_cooldown_event_id="$(json_get result.events[0].id)"
  request_json PATCH "/api/admin/automation/bridge-events/$bridge_cooldown_event_id" '{"replyDraft":"这是同会话冷却测试回复。","replyApproved":true}'
  json_assert_path event.replyApproved
  WOC_PANEL_URL="$PANEL_URL" AUTOMATION_BRIDGE_TOKEN="$AUTOMATION_BRIDGE_TOKEN" node "$BRIDGE_CLIENT" pull-replies --limit 20 --mode send > "$body_file"
  json_assert_no_reply_id "$bridge_cooldown_event_id"
  request_bridge_json PATCH "/api/automation/bridge/wecom/replies/$bridge_cooldown_event_id" '{"deliveryStatus":"claimed","workerId":"smoke-send-worker","capabilities":["reply","send"],"claimTtlSeconds":120}' 400
  json_assert_path error
  request_json PATCH "/api/admin/automation/bridge-events/$bridge_cooldown_event_id" '{"status":"archived","replyApproved":false}'
  json_assert_eq event.status archived
  request_json PATCH "/api/admin/automation/bridge-events/$bridge_event_id" '{"status":"archived"}'
  json_assert_eq event.status archived

  say "Check WeCom reply handler sequence dry-run"
  reply_handler_payload="$(python3 - "$reply_image_file" "$reply_image_key" <<'PY'
import json
import sys
image_path = sys.argv[1]
image_key = sys.argv[2]
print(json.dumps({
    "id": "smoke-reply-sequence",
    "conversationName": "Smoke Test Conversation",
    "senderName": "Smoke Sender",
    "replySteps": [
        {"type": "text", "text": "第一段顺序回复。", "sendEnter": True},
        {"type": "wait", "seconds": 1},
        {"type": "image", "imagePath": image_path, "sendEnter": True},
        {"type": "image", "imageKey": image_key, "sendEnter": True},
        {"type": "text", "text": "第二段顺序回复。", "sendEnter": True},
    ],
}, ensure_ascii=False))
PY
)"
  WECOM_HANDLER_MODE=dry-run WECOM_MATERIAL_MAP="{\"$reply_image_key\":\"$reply_image_file\"}" "$WECOM_REPLY_HANDLER" <<<"$reply_handler_payload" > "$body_file"
  json_assert_eq stepCount 5
  json_assert_eq textStepCount 2
  json_assert_eq imageStepCount 2
  json_assert_eq steps[3].imagePath "$reply_image_file"
  json_assert_path steps[3].resolvedFromMap

  say "Check WeCom mass handler dry-run"
  mass_handler_payload="$(python3 <<'PY'
import json
print(json.dumps({
    "id": "smoke-job:smoke-item",
    "jobId": "smoke-job",
    "itemId": "smoke-item",
    "jobTitle": "smoke mass handler",
    "recipientName": "Smoke Test Contact",
    "message": "这是一条 Bridge smoke 测试通知内容，仅用于测试联系人。",
}, ensure_ascii=False))
PY
)"
  WECOM_HANDLER_MODE=dry-run "$WECOM_MASS_HANDLER" <<<"$mass_handler_payload" > "$body_file"
  json_assert_path ok

  say "Check WeCom moment handler dry-run"
  moment_handler_payload="$(python3 <<'PY'
import json
print(json.dumps({
    "id": "smoke-moment",
    "draftId": "smoke-moment",
    "title": "smoke moment handler",
    "text": "这是一条 Bridge smoke 测试朋友圈草稿，不会发布。",
    "imageNotes": "无需配图",
    "materials": [],
}, ensure_ascii=False))
PY
)"
  WECOM_HANDLER_MODE=dry-run "$WECOM_MOMENT_HANDLER" <<<"$moment_handler_payload" > "$body_file"
  json_assert_path ok

  say "Enable automation mass-send for Bridge task smoke"
  request_json GET /api/admin/automation/config
  mass_config_payload="$(python3 - "$body_file" <<'PY'
import json
import sys

with open(sys.argv[1], "r", encoding="utf-8") as fh:
    payload = json.load(fh)
config = payload["config"]
settings = config["settings"]
settings["enabled"] = True
settings["massSendEnabled"] = True
settings["momentsEnabled"] = True
settings["maximumAutomaticSendsPerHour"] = 200
settings["maximumAutomaticActionsPerDay"] = 0
settings["perConversationCooldownMinutes"] = 0
settings["quietHoursEnabled"] = False
config["settings"] = settings
print(json.dumps(config, ensure_ascii=False))
PY
)"
  request_json PUT /api/admin/automation/config "$mass_config_payload"
  json_assert_path config.settings.massSendEnabled

  say "Check scheduled mass and moment tasks wait until due"
  scheduled_mass_payload="$(python3 - "$stamp" <<'PY'
import json
import sys
from datetime import datetime, timedelta, timezone

stamp = sys.argv[1]
print(json.dumps({
    "title": f"smoke-scheduled-mass-{stamp}",
    "message": "scheduled mass message",
    "scheduledAt": (datetime.now(timezone.utc) + timedelta(hours=2)).isoformat(),
    "recipients": [f"Smoke Scheduled Contact {stamp}"],
    "options": {
        "perSendDelaySeconds": 0,
        "requireOperatorConfirmRecipient": True,
        "openConversationBeforeSend": False,
    },
}, ensure_ascii=False))
PY
)"
  request_json POST /api/admin/automation/mass-jobs "$scheduled_mass_payload"
  scheduled_mass_job_id="$(json_get job.id)"
  scheduled_mass_item_id="$(json_get job.items[0].id)"
  scheduled_mass_task_id="$scheduled_mass_job_id:$scheduled_mass_item_id"
  request_json PATCH "/api/admin/automation/mass-jobs/$scheduled_mass_job_id" '{"approved":true,"status":"queued"}'

  scheduled_moment_payload="$(python3 - "$stamp" <<'PY'
import json
import sys
from datetime import datetime, timedelta, timezone

stamp = sys.argv[1]
print(json.dumps({
    "title": f"smoke-scheduled-moment-{stamp}",
    "text": "scheduled moment text",
    "scheduledAt": (datetime.now(timezone.utc) + timedelta(hours=2)).isoformat(),
}, ensure_ascii=False))
PY
)"
  request_json POST /api/admin/automation/moment-drafts "$scheduled_moment_payload"
  scheduled_moment_id="$(json_get draft.id)"
  request_json PATCH "/api/admin/automation/moment-drafts/$scheduled_moment_id" '{"approved":true,"status":"ready"}'

  WOC_PANEL_URL="$PANEL_URL" AUTOMATION_BRIDGE_TOKEN="$AUTOMATION_BRIDGE_TOKEN" node "$BRIDGE_CLIENT" pull-mass-tasks --limit 50 > "$body_file"
  json_assert_no_task_id "$scheduled_mass_task_id"
  WOC_PANEL_URL="$PANEL_URL" AUTOMATION_BRIDGE_TOKEN="$AUTOMATION_BRIDGE_TOKEN" node "$BRIDGE_CLIENT" pull-moment-tasks --limit 50 > "$body_file"
  json_assert_no_task_id "$scheduled_moment_id"
  request_json GET "/api/admin/automation/rpa-package?target=all&limit=50&format=json"
  json_assert_no_task_id "$scheduled_mass_task_id"
  json_assert_no_task_id "$scheduled_moment_id"
  request_json GET /api/admin/automation/preflight
  json_assert_check_id mass_scheduled_waiting ok
  json_assert_check_id moments_scheduled_waiting ok

  scheduled_due_payload="$(python3 <<'PY'
import json
from datetime import datetime, timedelta, timezone

print(json.dumps({"scheduledAt": (datetime.now(timezone.utc) - timedelta(minutes=1)).isoformat()}))
PY
)"
  request_json PATCH "/api/admin/automation/mass-jobs/$scheduled_mass_job_id" "$scheduled_due_payload"
  request_json PATCH "/api/admin/automation/moment-drafts/$scheduled_moment_id" "$scheduled_due_payload"
  WOC_PANEL_URL="$PANEL_URL" AUTOMATION_BRIDGE_TOKEN="$AUTOMATION_BRIDGE_TOKEN" node "$BRIDGE_CLIENT" pull-mass-tasks --limit 50 > "$body_file"
  json_assert_task_id "$scheduled_mass_task_id"
  WOC_PANEL_URL="$PANEL_URL" AUTOMATION_BRIDGE_TOKEN="$AUTOMATION_BRIDGE_TOKEN" node "$BRIDGE_CLIENT" pull-moment-tasks --limit 50 > "$body_file"
  json_assert_task_id "$scheduled_moment_id"
  request_json GET "/api/admin/automation/rpa-package?target=all&limit=50&format=json"
  json_assert_task_id "$scheduled_mass_task_id"
  json_assert_task_id "$scheduled_moment_id"

  say "Check automation quiet-hours gate blocks Bridge and RPA pulls"
  request_json GET /api/admin/automation/config
  quiet_gate_config_payload="$(python3 - "$body_file" <<'PY'
import json
import sys
from datetime import datetime, timedelta

with open(sys.argv[1], "r", encoding="utf-8") as fh:
    payload = json.load(fh)
config = payload["config"]
settings = config["settings"]
now = datetime.now()
start = now - timedelta(minutes=1)
end = now + timedelta(minutes=2)
settings["enabled"] = True
settings["massSendEnabled"] = True
settings["momentsEnabled"] = True
settings["quietHoursEnabled"] = True
settings["quietHoursStart"] = start.strftime("%H:%M")
settings["quietHoursEnd"] = end.strftime("%H:%M")
settings["maximumAutomaticActionsPerDay"] = 0
config["settings"] = settings
print(json.dumps(config, ensure_ascii=False))
PY
)"
  request_json PUT /api/admin/automation/config "$quiet_gate_config_payload"
  request_json GET /api/admin/automation/preflight
  json_assert_check_id quiet_hours_active block
  WOC_PANEL_URL="$PANEL_URL" AUTOMATION_BRIDGE_TOKEN="$AUTOMATION_BRIDGE_TOKEN" node "$BRIDGE_CLIENT" pull-mass-tasks --limit 50 > "$body_file"
  json_assert_no_task_id "$scheduled_mass_task_id"
  WOC_PANEL_URL="$PANEL_URL" AUTOMATION_BRIDGE_TOKEN="$AUTOMATION_BRIDGE_TOKEN" node "$BRIDGE_CLIENT" pull-moment-tasks --limit 50 > "$body_file"
  json_assert_no_task_id "$scheduled_moment_id"
  request_json GET "/api/admin/automation/rpa-package?target=all&limit=50&format=json"
  json_assert_no_task_id "$scheduled_mass_task_id"
  json_assert_no_task_id "$scheduled_moment_id"

  request_json GET /api/admin/automation/config
  quiet_gate_restore_payload="$(python3 - "$body_file" <<'PY'
import json
import sys

with open(sys.argv[1], "r", encoding="utf-8") as fh:
    payload = json.load(fh)
config = payload.get("config") or {}
if not config:
    raise SystemExit("missing config payload")
settings = config["settings"]
settings["quietHoursEnabled"] = False
settings["maximumAutomaticActionsPerDay"] = 0
config["settings"] = settings
print(json.dumps(config, ensure_ascii=False))
PY
)"
  request_json PUT /api/admin/automation/config "$quiet_gate_restore_payload"
  request_json PATCH "/api/admin/automation/mass-jobs/$scheduled_mass_job_id" '{"status":"cancelled","approved":false}'
  request_json PATCH "/api/admin/automation/moment-drafts/$scheduled_moment_id" '{"status":"archived","approved":false}'

  say "Apply WeCom Bridge run-report delivery callbacks"
  WOC_PANEL_URL="$PANEL_URL" AUTOMATION_BRIDGE_TOKEN="$AUTOMATION_BRIDGE_TOKEN" node "$BRIDGE_CLIENT" heartbeat --worker-id smoke-report-worker --mode send > "$body_file"
  json_assert_eq worker.workerId smoke-report-worker
  json_assert_array_contains worker.capabilities send

  report_apply_event_payload="$(python3 - "$stamp" <<'PY'
import json
import sys

stamp = sys.argv[1]
print(json.dumps({
    "source": "smoke-wecom-bridge",
    "events": [{
        "externalId": f"smoke-report-apply-{stamp}",
        "conversationName": "Smoke Report Apply Conversation",
        "senderName": "Smoke Sender",
        "inboundText": "请验证 run-report 回执反写。",
    }],
}, ensure_ascii=False))
PY
)"
  request_bridge_json POST /api/automation/bridge/wecom/events "$report_apply_event_payload"
  json_assert_path result.events[0].id
  report_apply_event_id="$(json_get result.events[0].id)"
  request_json PATCH "/api/admin/automation/bridge-events/$report_apply_event_id" '{"status":"planned","replyDraft":"report apply reply","replyApproved":true}'
  json_assert_path event.replyApproved

  report_apply_mass_payload="$(python3 - "$stamp" <<'PY'
import json
import sys

stamp = sys.argv[1]
print(json.dumps({
    "title": f"smoke-report-apply-mass-{stamp}",
    "message": "这是一条 run-report 回执反写 smoke 群发内容。",
    "recipients": ["Smoke Report Apply Contact"],
    "options": {
        "perSendDelaySeconds": 0,
        "requireOperatorConfirmRecipient": False,
        "openConversationBeforeSend": False,
    },
}, ensure_ascii=False))
PY
)"
  request_json POST /api/admin/automation/mass-jobs "$report_apply_mass_payload"
  json_assert_path job.id
  report_apply_mass_job_id="$(json_get job.id)"
  report_apply_mass_item_id="$(json_get job.items[0].id)"
  request_json PATCH "/api/admin/automation/mass-jobs/$report_apply_mass_job_id" '{"approved":true,"status":"queued"}'
  json_assert_eq job.status queued

  report_apply_moment_payload="$(python3 - "$stamp" <<'PY'
import json
import sys

stamp = sys.argv[1]
print(json.dumps({
    "title": f"smoke-report-apply-moment-{stamp}",
    "text": "这是一条 run-report 回执反写 smoke 朋友圈草稿。",
    "imageNotes": "无需配图",
    "materials": [],
}, ensure_ascii=False))
PY
)"
  request_json POST /api/admin/automation/moment-drafts "$report_apply_moment_payload"
  json_assert_path draft.id
  report_apply_moment_id="$(json_get draft.id)"
  request_json PATCH "/api/admin/automation/moment-drafts/$report_apply_moment_id" '{"approved":true,"status":"ready"}'
  json_assert_eq draft.status ready

  report_apply_items_json="$(python3 - "$report_apply_event_id" "$report_apply_mass_job_id" "$report_apply_mass_item_id" "$report_apply_moment_id" <<'PY'
import json
import sys

event_id, job_id, item_id, moment_id = sys.argv[1:5]
print(json.dumps([
    {
        "id": event_id,
        "target": "reply",
        "conversationName": "Smoke Report Apply Conversation",
        "action": "delivered",
        "ok": True,
        "verification": {"verified": True, "matchedName": "Smoke Report Apply Conversation", "inputReady": True},
    },
    {
        "target": "mass",
        "jobId": job_id,
        "itemId": item_id,
        "recipientName": "Smoke Report Apply Contact",
        "action": "sent",
        "ok": True,
        "verification": {"verified": True, "matchedName": "Smoke Report Apply Contact", "inputReady": True},
    },
    {
        "target": "moment",
        "draftId": moment_id,
        "title": "Smoke Report Apply Moment",
        "action": "prepared",
        "ok": True,
        "verification": {"verified": True, "inputReady": True},
    },
], ensure_ascii=False))
PY
)"
  WOC_PANEL_URL="$PANEL_URL" AUTOMATION_BRIDGE_TOKEN="$AUTOMATION_BRIDGE_TOKEN" node "$BRIDGE_CLIENT" report-run \
    --worker-id smoke-report-worker \
    --target all \
    --mode send \
    --handled-replies 1 \
    --handled-mass-tasks 1 \
    --handled-moment-tasks 1 \
    --items-json "$report_apply_items_json" \
    --summary "smoke report delivery apply" > "$body_file"
  json_assert_path report.id
  json_assert_eq report.items[0].action delivered
  json_assert_eq report.items[1].id "$report_apply_mass_job_id:$report_apply_mass_item_id"
  json_assert_eq report.items[2].id "$report_apply_moment_id"

  WOC_PANEL_URL="$PANEL_URL" AUTOMATION_BRIDGE_TOKEN="$AUTOMATION_BRIDGE_TOKEN" node "$BRIDGE_CLIENT" pull-replies --limit 50 > "$body_file"
  json_assert_no_reply_id "$report_apply_event_id"
  WOC_PANEL_URL="$PANEL_URL" AUTOMATION_BRIDGE_TOKEN="$AUTOMATION_BRIDGE_TOKEN" node "$BRIDGE_CLIENT" pull-mass-tasks --limit 50 > "$body_file"
  json_assert_no_task_id "$report_apply_mass_job_id:$report_apply_mass_item_id"
  WOC_PANEL_URL="$PANEL_URL" AUTOMATION_BRIDGE_TOKEN="$AUTOMATION_BRIDGE_TOKEN" node "$BRIDGE_CLIENT" pull-moment-tasks --limit 50 > "$body_file"
  json_assert_no_task_id "$report_apply_moment_id"

  request_json GET "/api/admin/automation/bridge-events?limit=50"
  python3 - "$body_file" "$report_apply_event_id" <<'PY'
import json
import sys

file, event_id = sys.argv[1], sys.argv[2]
with open(file, "r", encoding="utf-8") as fh:
    payload = json.load(fh)
events = payload.get("events", [])
matches = [event for event in events if event.get("id") == event_id]
if not matches:
    raise SystemExit(f"report-apply reply event missing: {event_id}")
if not matches[0].get("replyDeliveredAt"):
    raise SystemExit("report-apply reply was not marked delivered")
if matches[0].get("replyFailedAt"):
    raise SystemExit("report-apply reply should not be failed")
PY
  request_json GET "/api/admin/automation/mass-jobs?limit=50"
  python3 - "$body_file" "$report_apply_mass_job_id" "$report_apply_mass_item_id" <<'PY'
import json
import sys

file, job_id, item_id = sys.argv[1:4]
with open(file, "r", encoding="utf-8") as fh:
    payload = json.load(fh)
jobs = payload.get("jobs", [])
matches = [job for job in jobs if job.get("id") == job_id]
if not matches:
    raise SystemExit(f"report-apply mass job missing: {job_id}")
job = matches[0]
items = [item for item in job.get("items", []) if item.get("id") == item_id]
if not items:
    raise SystemExit(f"report-apply mass item missing: {item_id}")
if job.get("status") != "completed" or items[0].get("status") != "sent" or not items[0].get("sentAt"):
    raise SystemExit("report-apply mass item was not marked sent/completed")
PY
  request_json GET "/api/admin/automation/moment-drafts?limit=50"
  python3 - "$body_file" "$report_apply_moment_id" <<'PY'
import json
import sys

file, draft_id = sys.argv[1], sys.argv[2]
with open(file, "r", encoding="utf-8") as fh:
    payload = json.load(fh)
drafts = payload.get("drafts", [])
matches = [draft for draft in drafts if draft.get("id") == draft_id]
if not matches:
    raise SystemExit(f"report-apply moment draft missing: {draft_id}")
draft = matches[0]
if draft.get("status") != "prepared" or not draft.get("lastPreparedAt"):
    raise SystemExit("report-apply moment draft was not marked prepared")
PY

  say "Check daily automation action limit preflight gate"
  request_json GET /api/admin/automation/config
  daily_gate_config_payload="$(python3 - "$body_file" <<'PY'
import json
import sys

with open(sys.argv[1], "r", encoding="utf-8") as fh:
    payload = json.load(fh)
config = payload["config"]
settings = config["settings"]
settings["enabled"] = True
settings["quietHoursEnabled"] = False
settings["maximumAutomaticActionsPerDay"] = 1
config["settings"] = settings
print(json.dumps(config, ensure_ascii=False))
PY
)"
  request_json PUT /api/admin/automation/config "$daily_gate_config_payload"
  request_json GET /api/admin/automation/preflight
  json_assert_check_id daily_action_limit_reached block
  request_json GET /api/admin/automation/config
  daily_gate_restore_payload="$(python3 - "$body_file" <<'PY'
import json
import sys

with open(sys.argv[1], "r", encoding="utf-8") as fh:
    payload = json.load(fh)
config = payload["config"]
settings = config["settings"]
settings["maximumAutomaticActionsPerDay"] = 0
config["settings"] = settings
print(json.dumps(config, ensure_ascii=False))
PY
)"
  request_json PUT /api/admin/automation/config "$daily_gate_restore_payload"
  request_json PATCH "/api/admin/automation/bridge-events/$report_apply_event_id" '{"status":"archived"}'
  json_assert_eq event.status archived
  request_json PATCH "/api/admin/automation/mass-jobs/$report_apply_mass_job_id" '{"status":"cancelled","approved":false}'
  json_assert_eq job.status cancelled
  request_json PATCH "/api/admin/automation/moment-drafts/$report_apply_moment_id" '{"status":"archived","approved":false}'
  json_assert_eq draft.status archived

  say "Claim, release, fail and sent WeCom mass Bridge tasks"
  bridge_mass_title="smoke-bridge-mass-$stamp"
  bridge_mass_payload="$(python3 - "$bridge_mass_title" <<'PY'
import json
import sys

title = sys.argv[1]
print(json.dumps({
    "title": title,
    "message": "这是一条 Bridge smoke 测试通知内容，仅用于测试联系人。",
    "recipients": ["Smoke Bridge Contact A"],
    "options": {
        "perSendDelaySeconds": 0,
        "requireOperatorConfirmRecipient": False,
        "openConversationBeforeSend": False,
    },
}, ensure_ascii=False))
PY
)"
  request_json POST /api/admin/automation/mass-jobs "$bridge_mass_payload"
  json_assert_path job.id
  bridge_mass_job_id="$(json_get job.id)"
  request_json PATCH "/api/admin/automation/mass-jobs/$bridge_mass_job_id" '{"approved":true,"status":"queued"}'
  json_assert_eq job.status queued
  WOC_PANEL_URL="$PANEL_URL" AUTOMATION_BRIDGE_TOKEN="$AUTOMATION_BRIDGE_TOKEN" WECOM_RUNNER_MODE=dry-run WECOM_RUNNER_TARGET=mass "$WECOM_BRIDGE_RUNNER" run-once > "$body_file"
  json_assert_path handled[0].dryRun
  WOC_PANEL_URL="$PANEL_URL" AUTOMATION_BRIDGE_TOKEN="$AUTOMATION_BRIDGE_TOKEN" node "$BRIDGE_CLIENT" pull-mass-tasks --limit 20 > "$body_file"
  json_assert_path tasks[0].id
  bridge_mass_task_id="$(json_get tasks[0].id)"
  WOC_PANEL_URL="$PANEL_URL" AUTOMATION_BRIDGE_TOKEN="$AUTOMATION_BRIDGE_TOKEN" node "$BRIDGE_CLIENT" claim-mass-task "$bridge_mass_task_id" --worker-id smoke-worker > "$body_file"
  json_assert_path task.claimedAt
  json_assert_eq task.claimedBy smoke-worker
  WOC_PANEL_URL="$PANEL_URL" AUTOMATION_BRIDGE_TOKEN="$AUTOMATION_BRIDGE_TOKEN" node "$BRIDGE_CLIENT" pull-mass-tasks --limit 20 > "$body_file"
  json_assert_no_task_id "$bridge_mass_task_id"
  WOC_PANEL_URL="$PANEL_URL" AUTOMATION_BRIDGE_TOKEN="$AUTOMATION_BRIDGE_TOKEN" node "$BRIDGE_CLIENT" release-mass-task "$bridge_mass_task_id" --worker-id smoke-worker --reason "smoke release mass task" > "$body_file"
  json_assert_missing_or_empty task.claimedAt
  WOC_PANEL_URL="$PANEL_URL" AUTOMATION_BRIDGE_TOKEN="$AUTOMATION_BRIDGE_TOKEN" node "$BRIDGE_CLIENT" pull-mass-tasks --limit 20 > "$body_file"
  json_assert_task_id "$bridge_mass_task_id"
  WOC_PANEL_URL="$PANEL_URL" AUTOMATION_BRIDGE_TOKEN="$AUTOMATION_BRIDGE_TOKEN" node "$BRIDGE_CLIENT" claim-mass-task "$bridge_mass_task_id" --worker-id smoke-worker --claim-ttl-seconds 120 > "$body_file"
  json_assert_path task.claimExpiresAt
  WOC_PANEL_URL="$PANEL_URL" AUTOMATION_BRIDGE_TOKEN="$AUTOMATION_BRIDGE_TOKEN" node "$BRIDGE_CLIENT" mark-mass-failed "$bridge_mass_task_id" --worker-id smoke-worker --error "smoke mass handler failed once" > "$body_file"
  json_assert_eq item.status failed
  json_assert_eq item.bridgeFailedBy smoke-worker
  json_assert_eq job.status paused
  request_json POST /api/admin/automation/bridge-recovery '{"releaseClaims":"expired","retryFailed":true,"includeReplies":false,"includeMoments":false,"workerId":"smoke-worker","failureReason":"mass handler failed","maxRetryAttempts":2}'
  json_assert_eq result.workerId smoke-worker
  json_assert_eq result.failureReason "mass handler failed"
  json_assert_eq result.maxRetryAttempts 2
  json_assert_eq result.mass.retriedFailed 1
  json_assert_eq result.mass.resumedJobs 1
  json_assert_eq result.changes[0].target mass
  json_assert_eq result.changes[0].action retry-failed
  json_assert_eq result.changes[0].workerId smoke-worker
  json_assert_eq result.changes[0].retryCount 0
  json_assert_eq result.changes[0].nextRetryCount 1
  json_assert_path result.changes[0].error
  json_assert_path result.changes[0].failedAt
  json_assert_path result.changes[0].cursor
  WOC_PANEL_URL="$PANEL_URL" AUTOMATION_BRIDGE_TOKEN="$AUTOMATION_BRIDGE_TOKEN" node "$BRIDGE_CLIENT" pull-mass-tasks --limit 20 > "$body_file"
  json_assert_task_id "$bridge_mass_task_id"
  request_json PATCH "/api/admin/automation/mass-jobs/$bridge_mass_job_id" '{"status":"cancelled","approved":false}'
  json_assert_eq job.status cancelled

  bridge_mass_sent_payload="$(python3 - "$bridge_mass_title" <<'PY'
import json
import sys

title = sys.argv[1] + "-sent"
print(json.dumps({
    "title": title,
    "message": "这是一条 Bridge smoke 测试通知内容，仅用于测试联系人。",
    "recipients": ["Smoke Bridge Contact B"],
    "options": {
        "perSendDelaySeconds": 0,
        "requireOperatorConfirmRecipient": False,
        "openConversationBeforeSend": False,
    },
}, ensure_ascii=False))
PY
)"
  request_json POST /api/admin/automation/mass-jobs "$bridge_mass_sent_payload"
  json_assert_path job.id
  bridge_mass_sent_job_id="$(json_get job.id)"
  request_json PATCH "/api/admin/automation/mass-jobs/$bridge_mass_sent_job_id" '{"approved":true,"status":"queued"}'
  WOC_PANEL_URL="$PANEL_URL" AUTOMATION_BRIDGE_TOKEN="$AUTOMATION_BRIDGE_TOKEN" node "$BRIDGE_CLIENT" pull-mass-tasks --limit 20 > "$body_file"
  json_assert_path tasks[0].id
  bridge_mass_sent_task_id="$(json_get tasks[0].id)"
  WOC_PANEL_URL="$PANEL_URL" AUTOMATION_BRIDGE_TOKEN="$AUTOMATION_BRIDGE_TOKEN" node "$BRIDGE_CLIENT" claim-mass-task "$bridge_mass_sent_task_id" --worker-id smoke-worker > "$body_file"
  json_assert_path task.claimedAt
  WOC_PANEL_URL="$PANEL_URL" AUTOMATION_BRIDGE_TOKEN="$AUTOMATION_BRIDGE_TOKEN" node "$BRIDGE_CLIENT" mark-mass-sent "$bridge_mass_sent_task_id" --worker-id smoke-worker > "$body_file"
  json_assert_eq item.status sent
  json_assert_eq job.status completed

  say "Claim, release, fail, prepare and publish WeCom moment Bridge tasks"
  bridge_moment_title="smoke-bridge-moment-$stamp"
  bridge_moment_payload="$(python3 - "$bridge_moment_title" <<'PY'
import json
import sys

title = sys.argv[1]
print(json.dumps({
    "title": title,
    "text": "这是一条 Bridge smoke 测试朋友圈草稿，不会发布。",
    "imageNotes": "无需配图",
    "materials": [],
}, ensure_ascii=False))
PY
)"
  request_json POST /api/admin/automation/moment-drafts "$bridge_moment_payload"
  json_assert_path draft.id
  bridge_moment_draft_id="$(json_get draft.id)"
  request_json PATCH "/api/admin/automation/moment-drafts/$bridge_moment_draft_id" '{"approved":true,"status":"ready"}'
  json_assert_eq draft.status ready
  WOC_PANEL_URL="$PANEL_URL" AUTOMATION_BRIDGE_TOKEN="$AUTOMATION_BRIDGE_TOKEN" WECOM_RUNNER_MODE=dry-run WECOM_RUNNER_TARGET=moments "$WECOM_BRIDGE_RUNNER" run-once > "$body_file"
  json_assert_path handled[0].dryRun
  WOC_PANEL_URL="$PANEL_URL" AUTOMATION_BRIDGE_TOKEN="$AUTOMATION_BRIDGE_TOKEN" node "$BRIDGE_CLIENT" pull-moment-tasks --limit 20 > "$body_file"
  json_assert_path tasks[0].id
  bridge_moment_task_id="$(json_get tasks[0].id)"
  WOC_PANEL_URL="$PANEL_URL" AUTOMATION_BRIDGE_TOKEN="$AUTOMATION_BRIDGE_TOKEN" node "$BRIDGE_CLIENT" claim-moment-task "$bridge_moment_task_id" --worker-id smoke-worker > "$body_file"
  json_assert_path task.claimedAt
  json_assert_eq task.claimedBy smoke-worker
  WOC_PANEL_URL="$PANEL_URL" AUTOMATION_BRIDGE_TOKEN="$AUTOMATION_BRIDGE_TOKEN" node "$BRIDGE_CLIENT" pull-moment-tasks --limit 20 > "$body_file"
  json_assert_no_task_id "$bridge_moment_task_id"
  WOC_PANEL_URL="$PANEL_URL" AUTOMATION_BRIDGE_TOKEN="$AUTOMATION_BRIDGE_TOKEN" node "$BRIDGE_CLIENT" release-moment-task "$bridge_moment_task_id" --worker-id smoke-worker --reason "smoke release moment task" > "$body_file"
  json_assert_missing_or_empty task.claimedAt
  WOC_PANEL_URL="$PANEL_URL" AUTOMATION_BRIDGE_TOKEN="$AUTOMATION_BRIDGE_TOKEN" node "$BRIDGE_CLIENT" pull-moment-tasks --limit 20 > "$body_file"
  json_assert_task_id "$bridge_moment_task_id"
  WOC_PANEL_URL="$PANEL_URL" AUTOMATION_BRIDGE_TOKEN="$AUTOMATION_BRIDGE_TOKEN" node "$BRIDGE_CLIENT" claim-moment-task "$bridge_moment_task_id" --worker-id smoke-worker --claim-ttl-seconds 120 > "$body_file"
  json_assert_path task.claimExpiresAt
  WOC_PANEL_URL="$PANEL_URL" AUTOMATION_BRIDGE_TOKEN="$AUTOMATION_BRIDGE_TOKEN" node "$BRIDGE_CLIENT" mark-moment-failed "$bridge_moment_task_id" --worker-id smoke-worker --error "smoke moment handler failed once" > "$body_file"
  json_assert_eq draft.status draft
  json_assert_eq draft.approved False
  json_assert_eq draft.bridgeFailedBy smoke-worker
  request_json POST /api/admin/automation/bridge-recovery '{"releaseClaims":"expired","retryFailed":true,"includeReplies":false,"includeMass":false,"workerId":"smoke-worker","failureReason":"moment handler failed","maxRetryAttempts":2}'
  json_assert_eq result.workerId smoke-worker
  json_assert_eq result.failureReason "moment handler failed"
  json_assert_eq result.maxRetryAttempts 2
  json_assert_eq result.moments.retriedFailed 1
  json_assert_eq result.changes[0].target moment
  json_assert_eq result.changes[0].action retry-failed
  json_assert_eq result.changes[0].workerId smoke-worker
  json_assert_eq result.changes[0].retryCount 0
  json_assert_eq result.changes[0].nextRetryCount 1
  json_assert_path result.changes[0].error
  json_assert_path result.changes[0].failedAt
  json_assert_path result.changes[0].cursor
  WOC_PANEL_URL="$PANEL_URL" AUTOMATION_BRIDGE_TOKEN="$AUTOMATION_BRIDGE_TOKEN" node "$BRIDGE_CLIENT" pull-moment-tasks --limit 20 > "$body_file"
  json_assert_task_id "$bridge_moment_task_id"
  request_json PATCH "/api/admin/automation/moment-drafts/$bridge_moment_draft_id" '{"status":"archived","approved":false}'
  json_assert_eq draft.status archived

  bridge_moment_prepare_payload="$(python3 - "$bridge_moment_title" <<'PY'
import json
import sys

title = sys.argv[1] + "-prepared"
print(json.dumps({
    "title": title,
    "text": "这是一条 Bridge smoke 测试朋友圈草稿，不会发布。",
    "imageNotes": "无需配图",
    "materials": [],
}, ensure_ascii=False))
PY
)"
  request_json POST /api/admin/automation/moment-drafts "$bridge_moment_prepare_payload"
  json_assert_path draft.id
  bridge_moment_prepare_id="$(json_get draft.id)"
  request_json PATCH "/api/admin/automation/moment-drafts/$bridge_moment_prepare_id" '{"approved":true,"status":"ready"}'
  WOC_PANEL_URL="$PANEL_URL" AUTOMATION_BRIDGE_TOKEN="$AUTOMATION_BRIDGE_TOKEN" node "$BRIDGE_CLIENT" pull-moment-tasks --limit 20 > "$body_file"
  json_assert_path tasks[0].id
  bridge_moment_prepare_task_id="$(json_get tasks[0].id)"
  WOC_PANEL_URL="$PANEL_URL" AUTOMATION_BRIDGE_TOKEN="$AUTOMATION_BRIDGE_TOKEN" node "$BRIDGE_CLIENT" claim-moment-task "$bridge_moment_prepare_task_id" --worker-id smoke-worker > "$body_file"
  json_assert_path task.claimedAt
  WOC_PANEL_URL="$PANEL_URL" AUTOMATION_BRIDGE_TOKEN="$AUTOMATION_BRIDGE_TOKEN" node "$BRIDGE_CLIENT" mark-moment-prepared "$bridge_moment_prepare_task_id" --worker-id smoke-worker > "$body_file"
  json_assert_eq draft.status prepared
  WOC_PANEL_URL="$PANEL_URL" AUTOMATION_BRIDGE_TOKEN="$AUTOMATION_BRIDGE_TOKEN" node "$BRIDGE_CLIENT" mark-moment-published "$bridge_moment_prepare_task_id" --worker-id smoke-worker > "$body_file"
  json_assert_eq draft.status published

  say "Check all-target WeCom Bridge runner dry-run"
  all_event_payload="$(python3 - "$stamp" <<'PY'
import json
import sys

stamp = sys.argv[1]
print(json.dumps({
    "source": "smoke-wecom-bridge",
    "events": [{
        "externalId": f"smoke-all-msg-{stamp}",
        "conversationName": "Smoke All Conversation",
        "senderName": "Smoke All Sender",
        "inboundText": "你好，我想了解自动化测试。",
    }],
}, ensure_ascii=False))
PY
)"
  request_bridge_json POST /api/automation/bridge/wecom/events "$all_event_payload"
  json_assert_path result.events[0].id
  all_event_id="$(json_get result.events[0].id)"
  request_json PATCH "/api/admin/automation/bridge-events/$all_event_id" '{"status":"planned","replyDraft":"这是 all-target smoke 回复草稿。","replyApproved":true}'
  json_assert_path event.replyApproved

  all_mass_payload="$(python3 - "$stamp" <<'PY'
import json
import sys

stamp = sys.argv[1]
print(json.dumps({
    "title": f"smoke-all-mass-{stamp}",
    "message": "这是一条 all-target Bridge smoke 测试通知内容。",
    "recipients": ["Smoke All Contact"],
    "options": {
        "perSendDelaySeconds": 0,
        "requireOperatorConfirmRecipient": False,
        "openConversationBeforeSend": False,
    },
}, ensure_ascii=False))
PY
)"
  request_json POST /api/admin/automation/mass-jobs "$all_mass_payload"
  json_assert_path job.id
  all_mass_job_id="$(json_get job.id)"
  request_json PATCH "/api/admin/automation/mass-jobs/$all_mass_job_id" '{"approved":true,"status":"queued"}'
  json_assert_eq job.status queued

  all_moment_payload="$(python3 - "$stamp" <<'PY'
import json
import sys

stamp = sys.argv[1]
print(json.dumps({
    "title": f"smoke-all-moment-{stamp}",
    "text": "这是一条 all-target Bridge smoke 测试朋友圈草稿，不会发布。",
    "imageNotes": "无需配图",
    "materials": [],
}, ensure_ascii=False))
PY
)"
  request_json POST /api/admin/automation/moment-drafts "$all_moment_payload"
  json_assert_path draft.id
  all_moment_draft_id="$(json_get draft.id)"
  request_json PATCH "/api/admin/automation/moment-drafts/$all_moment_draft_id" '{"approved":true,"status":"ready"}'
  json_assert_eq draft.status ready

  request_json GET "/api/admin/automation/action-queue?limit=20"
  python3 - "$body_file" <<'PY'
import json
import sys

with open(sys.argv[1], "r", encoding="utf-8") as fh:
    handoff = json.load(fh)["queue"]["handoff"]["rpa"]
if handoff.get("total", 0) < 3:
    raise SystemExit("action queue RPA handoff should count all target tasks")
if handoff.get("blockedByWorker") is not False:
    raise SystemExit("action queue RPA handoff should not be worker-blocked")
readiness = handoff.get("workerReadiness") or {}
for target in ("replies", "mass", "moments"):
    state = readiness.get(target)
    if not state:
        raise SystemExit(f"missing worker readiness for {target}")
    if state.get("tasks", 0) < 1:
        raise SystemExit(f"worker readiness should count tasks for {target}")
    if state.get("capableWorkers", 0) < 1:
        raise SystemExit(f"worker readiness should include capable workers for {target}")
    if state.get("blocked") is not False:
        raise SystemExit(f"worker readiness should not block {target}")
PY

  WOC_PANEL_URL="$PANEL_URL" AUTOMATION_BRIDGE_TOKEN="$AUTOMATION_BRIDGE_TOKEN" node "$BRIDGE_CLIENT" export-rpa-package \
    --target all \
    --limit 20 \
    --format json \
    --output "$rpa_package_file" > "$body_file"
  json_assert_eq exported.schema woc.wecom.rpa.package.v1
  json_assert_eq exported.format json
  python3 - "$rpa_package_file" "$all_event_id" "$all_mass_job_id" "$all_moment_draft_id" <<'PY'
import json
import sys

package_file, event_id, mass_job_id, moment_draft_id = sys.argv[1:5]
with open(package_file, "r", encoding="utf-8") as fh:
    package = json.load(fh)
if package.get("schema") != "woc.wecom.rpa.package.v1":
    raise SystemExit("unexpected RPA package schema")
tasks = package.get("tasks", [])
exported_at = package.get("exportedAt")
expires_at = package.get("expiresAt")
ttl_minutes = package.get("ttlMinutes")
if not exported_at or not expires_at or not isinstance(ttl_minutes, int):
    raise SystemExit("RPA package missing exportedAt/expiresAt/ttlMinutes")
if expires_at <= exported_at:
    raise SystemExit("RPA package expiresAt should be after exportedAt")
handoff = package.get("handoff", {})
if handoff.get("packageExpiresAt") != expires_at or handoff.get("packageTtlMinutes") != ttl_minutes:
    raise SystemExit("RPA handoff should preserve package TTL and expiry")
if not any(t.get("target") == "reply" and t.get("id") == event_id and t.get("operation") == "reply.prepare" for t in tasks):
    raise SystemExit("reply RPA task missing")
if not any(t.get("target") == "mass" and t.get("jobId") == mass_job_id and t.get("operation") == "mass.prepare" for t in tasks):
    raise SystemExit("mass RPA task missing")
if not any(t.get("target") == "moment" and t.get("draftId") == moment_draft_id and t.get("operation") == "moment.prepare" for t in tasks):
    raise SystemExit("moment RPA task missing")
if package.get("counts", {}).get("total", 0) < 3:
    raise SystemExit("RPA package should contain at least three tasks")
if any(t.get("expiresAt") != expires_at for t in tasks):
    raise SystemExit("RPA package task expiresAt should match package expiresAt")
PY

  request_json GET "/api/admin/automation/rpa-package?target=all&limit=20&format=json"
  json_assert_eq package.schema woc.wecom.rpa.package.v1
  python3 - "$body_file" "$all_event_id" "$all_mass_job_id" "$all_moment_draft_id" <<'PY'
import json
import sys

file, event_id, mass_job_id, moment_draft_id = sys.argv[1:5]
with open(file, "r", encoding="utf-8") as fh:
    package = json.load(fh)["package"]
if package.get("counts", {}).get("total", 0) < 3:
    raise SystemExit("admin RPA package should contain at least three tasks")
if not package.get("expiresAt") or not isinstance(package.get("ttlMinutes"), int):
    raise SystemExit("admin RPA package missing expiry metadata")
tasks = package.get("tasks", [])
if any(t.get("expiresAt") != package.get("expiresAt") for t in tasks):
    raise SystemExit("admin RPA package tasks missing matching expiresAt")
if not any(t.get("target") == "reply" and t.get("id") == event_id for t in tasks):
    raise SystemExit("admin reply RPA task missing")
if not any(t.get("target") == "mass" and t.get("jobId") == mass_job_id for t in tasks):
    raise SystemExit("admin mass RPA task missing")
if not any(t.get("target") == "moment" and t.get("draftId") == moment_draft_id for t in tasks):
    raise SystemExit("admin moment RPA task missing")
PY

  request_json GET "/api/admin/automation/rpa-package?target=all&limit=20&format=json&workerId=smoke-worker&capabilities=reply"
  python3 - "$body_file" "$all_event_id" "$all_mass_job_id" "$all_moment_draft_id" <<'PY'
import json
import sys

file, event_id, mass_job_id, moment_draft_id = sys.argv[1:5]
with open(file, "r", encoding="utf-8") as fh:
    package = json.load(fh)["package"]
counts = package.get("counts", {})
if counts.get("replies", 0) < 1:
    raise SystemExit("reply-capable RPA package should include reply tasks")
if counts.get("mass") != 0:
    raise SystemExit("reply-capable RPA package should not include mass tasks")
if counts.get("moments") != 0:
    raise SystemExit("reply-capable RPA package should not include moment tasks")
tasks = package.get("tasks", [])
if not any(t.get("target") == "reply" and t.get("id") == event_id for t in tasks):
    raise SystemExit("reply-capable RPA package missing reply task")
if any(t.get("target") == "mass" or t.get("jobId") == mass_job_id for t in tasks):
    raise SystemExit("reply-capable RPA package leaked mass task")
if any(t.get("target") == "moment" or t.get("draftId") == moment_draft_id for t in tasks):
    raise SystemExit("reply-capable RPA package leaked moment task")
PY

  request_json GET "/api/admin/automation/rpa-package?target=all&limit=20&format=jsonl"
  python3 - "$body_file" "$all_event_id" "$all_mass_job_id" "$all_moment_draft_id" <<'PY'
import json
import sys

file, event_id, mass_job_id, moment_draft_id = sys.argv[1:5]
tasks = []
with open(file, "r", encoding="utf-8") as fh:
    for line in fh:
        line = line.strip()
        if line:
            tasks.append(json.loads(line))
if not any(t.get("target") == "reply" and t.get("id") == event_id for t in tasks):
    raise SystemExit("admin JSONL reply RPA task missing")
if any(not t.get("expiresAt") for t in tasks):
    raise SystemExit("admin JSONL RPA task missing expiresAt")
if not any(t.get("target") == "mass" and t.get("jobId") == mass_job_id for t in tasks):
    raise SystemExit("admin JSONL mass RPA task missing")
if not any(t.get("target") == "moment" and t.get("draftId") == moment_draft_id for t in tasks):
    raise SystemExit("admin JSONL moment RPA task missing")
PY

  say "Check expired RPA package gate"
  python3 - "$rpa_package_file" "$expired_rpa_package_file" <<'PY'
import json
import sys

source, dest = sys.argv[1:3]
with open(source, "r", encoding="utf-8") as fh:
    package = json.load(fh)
expired_at = "2000-01-01T00:00:00.000Z"
package["expiresAt"] = expired_at
package["ttlMinutes"] = 5
package.setdefault("handoff", {})["packageExpiresAt"] = expired_at
package["handoff"]["packageTtlMinutes"] = 5
for task in package.get("tasks", []):
    task["expiresAt"] = expired_at
with open(dest, "w", encoding="utf-8") as fh:
    json.dump(package, fh, ensure_ascii=False)
PY
  set +e
  WOC_PANEL_URL="$PANEL_URL" AUTOMATION_BRIDGE_TOKEN="$AUTOMATION_BRIDGE_TOKEN" node "$BRIDGE_CLIENT" run-rpa-package "$expired_rpa_package_file" \
    --target all \
    --mode dry-run \
    --no-handler > "$body_file" 2> "$handler_error_file"
  expired_status=$?
  set -e
  if [[ "$expired_status" -eq 0 ]]; then
    echo "ERROR: expired RPA package should be rejected by default" >&2
    sed -n '1,120p' "$body_file" >&2
    exit 1
  fi
  grep -q "RPA package expired" "$handler_error_file"
  WOC_PANEL_URL="$PANEL_URL" AUTOMATION_BRIDGE_TOKEN="$AUTOMATION_BRIDGE_TOKEN" node "$BRIDGE_CLIENT" run-rpa-package "$expired_rpa_package_file" \
    --target all \
    --mode dry-run \
    --no-handler \
    --allow-expired-rpa-package > "$body_file"
  json_assert_eq packageExpired True
  json_assert_path packageExpiresAt

  WOC_PANEL_URL="$PANEL_URL" AUTOMATION_BRIDGE_TOKEN="$AUTOMATION_BRIDGE_TOKEN" node "$BRIDGE_CLIENT" run-rpa-package "$rpa_package_file" \
    --target all \
    --mode dry-run \
    --handler-reply "$WECOM_REPLY_HANDLER" \
    --handler-mass "$WECOM_MASS_HANDLER" \
    --handler-moment "$WECOM_MOMENT_HANDLER" \
    --report-run > "$body_file"
  json_assert_path runReport.report.packageHandoff.generatedFrom
  python3 - "$body_file" "$all_event_id" "$all_mass_job_id" "$all_moment_draft_id" <<'PY'
import json
import sys

file, event_id, mass_job_id, moment_draft_id = sys.argv[1:5]
with open(file, "r", encoding="utf-8") as fh:
    payload = json.load(fh)
if payload.get("mode") != "dry-run":
    raise SystemExit("RPA package runner should use dry-run mode")
handled = payload.get("handled", [])
if not any(item.get("target") == "reply" and item.get("id") == event_id and item.get("action") == "dry-run" and item.get("ok") is True for item in handled):
    raise SystemExit("reply RPA package task was not handled")
if not any(item.get("target") == "mass" and item.get("jobId") == mass_job_id and item.get("action") == "dry-run" and item.get("ok") is True for item in handled):
    raise SystemExit("mass RPA package task was not handled")
if not any(item.get("target") == "moment" and item.get("draftId") == moment_draft_id and item.get("action") == "dry-run" and item.get("ok") is True for item in handled):
    raise SystemExit("moment RPA package task was not handled")
PY

  request_json GET "/api/admin/automation/bridge-runs/summary?hours=24&limit=300"
  python3 - "$body_file" <<'PY'
import json
import sys

with open(sys.argv[1], "r", encoding="utf-8") as fh:
    summary = json.load(fh)["summary"]
if summary.get("totalRuns", 0) < 4:
    raise SystemExit("Bridge run summary should include recent smoke reports")
if summary.get("rpaPackage", {}).get("runs", 0) < 1:
    raise SystemExit("Bridge run summary missing RPA package run count")
if summary.get("rpaPackage", {}).get("packageTarget", {}).get("all", 0) < 1:
    raise SystemExit("Bridge run summary missing all-target RPA package count")
if summary.get("totals", {}).get("verificationFailed", 0) < 1:
    raise SystemExit("Bridge run summary missing verification failure count")
if not summary.get("workers"):
    raise SystemExit("Bridge run summary missing worker breakdown")
if not summary.get("topErrors"):
    raise SystemExit("Bridge run summary missing top errors")
PY

  WOC_PANEL_URL="$PANEL_URL" AUTOMATION_BRIDGE_TOKEN="$AUTOMATION_BRIDGE_TOKEN" node "$BRIDGE_CLIENT" run-cloud-rpa-package \
    --target all \
    --limit 20 \
    --mode dry-run \
    --handler-reply "$WECOM_REPLY_HANDLER" \
    --handler-mass "$WECOM_MASS_HANDLER" \
    --handler-moment "$WECOM_MOMENT_HANDLER" \
    --save-package "$rpa_cloud_package_file" > "$body_file"
  python3 - "$body_file" "$rpa_cloud_package_file" "$all_event_id" "$all_mass_job_id" "$all_moment_draft_id" <<'PY'
import json
import sys

result_file, package_file, event_id, mass_job_id, moment_draft_id = sys.argv[1:6]
with open(result_file, "r", encoding="utf-8") as fh:
    payload = json.load(fh)
if payload.get("mode") != "dry-run":
    raise SystemExit("cloud RPA runner should use dry-run mode")
if payload.get("savedPackagePath") != package_file:
    raise SystemExit("cloud RPA runner should save the pulled package")
if payload.get("packageCounts", {}).get("total", 0) < 3:
    raise SystemExit("cloud RPA package should contain at least three tasks")
handled = payload.get("handled", [])
if not any(item.get("target") == "reply" and item.get("id") == event_id and item.get("action") == "dry-run" and item.get("ok") is True for item in handled):
    raise SystemExit("cloud reply RPA package task was not handled")
if not any(item.get("target") == "mass" and item.get("jobId") == mass_job_id and item.get("action") == "dry-run" and item.get("ok") is True for item in handled):
    raise SystemExit("cloud mass RPA package task was not handled")
if not any(item.get("target") == "moment" and item.get("draftId") == moment_draft_id and item.get("action") == "dry-run" and item.get("ok") is True for item in handled):
    raise SystemExit("cloud moment RPA package task was not handled")
with open(package_file, "r", encoding="utf-8") as fh:
    tasks = [json.loads(line) for line in fh if line.strip()]
if not any(task.get("target") == "reply" and task.get("id") == event_id for task in tasks):
    raise SystemExit("saved cloud RPA package missing reply task")
if not any(task.get("target") == "mass" and task.get("jobId") == mass_job_id for task in tasks):
    raise SystemExit("saved cloud RPA package missing mass task")
if not any(task.get("target") == "moment" and task.get("draftId") == moment_draft_id for task in tasks):
    raise SystemExit("saved cloud RPA package missing moment task")
PY

  WOC_PANEL_URL="$PANEL_URL" AUTOMATION_BRIDGE_TOKEN="$AUTOMATION_BRIDGE_TOKEN" WECOM_USE_RPA_PACKAGE=1 WECOM_RPA_PACKAGE_SAVE_DIR="$(dirname "$rpa_cloud_package_file")" WECOM_RUNNER_MODE=dry-run WECOM_RUNNER_TARGET=all "$WECOM_BRIDGE_RUNNER" run-once > "$body_file"
  python3 - "$body_file" "$all_event_id" "$all_mass_job_id" "$all_moment_draft_id" <<'PY'
import json
import sys

file, event_id, mass_job_id, moment_draft_id = sys.argv[1:5]
with open(file, "r", encoding="utf-8") as fh:
    payload = json.load(fh)
if payload.get("target") != "all":
    raise SystemExit("RPA package runner should preserve all target")
handled = payload.get("handled", [])
if not any(item.get("target") == "reply" and item.get("id") == event_id for item in handled):
    raise SystemExit("RPA package runner env mode missing reply")
if not any(item.get("target") == "mass" and item.get("jobId") == mass_job_id for item in handled):
    raise SystemExit("RPA package runner env mode missing mass")
if not any(item.get("target") == "moment" and item.get("draftId") == moment_draft_id for item in handled):
    raise SystemExit("RPA package runner env mode missing moment")
if not payload.get("savedPackagePath"):
    raise SystemExit("RPA package runner env mode should save a package copy")
PY

  request_json PUT /api/admin/automation/runner-policy '{"runnerEngine":"rpa-package","mode":"dry-run","target":"all","limit":20,"claimTtlSeconds":180,"heartbeatIntervalSeconds":45,"momentPasteMode":"clipboard-only","allowSend":false,"requireTargetMatch":true,"requireHandlerVerification":false}'
  json_assert_eq policy.runnerEngine rpa-package
  WOC_PANEL_URL="$PANEL_URL" AUTOMATION_BRIDGE_TOKEN="$AUTOMATION_BRIDGE_TOKEN" node "$BRIDGE_CLIENT" runner-policy --worker-id smoke-worker > "$body_file"
  json_assert_eq env.WECOM_RUNNER_ENGINE rpa-package
  json_assert_eq env.WECOM_USE_RPA_PACKAGE 1
  json_assert_eq env.WECOM_RUNNER_TARGET all
  request_json GET /api/admin/automation/preflight
  json_assert_check_id worker_capability_rpa_package ok
  WOC_PANEL_URL="$PANEL_URL" AUTOMATION_BRIDGE_TOKEN="$AUTOMATION_BRIDGE_TOKEN" WECOM_USE_REMOTE_POLICY=1 WECOM_RPA_PACKAGE_SAVE_DIR="$(dirname "$rpa_cloud_package_file")" "$WECOM_BRIDGE_RUNNER" run-once > "$body_file"
  python3 - "$body_file" "$all_event_id" "$all_mass_job_id" "$all_moment_draft_id" <<'PY'
import json
import sys

file, event_id, mass_job_id, moment_draft_id = sys.argv[1:5]
with open(file, "r", encoding="utf-8") as fh:
    payload = json.load(fh)
if payload.get("target") != "all" or payload.get("mode") != "dry-run":
    raise SystemExit("remote policy RPA package runner should use all/dry-run")
handled = payload.get("handled", [])
if not any(item.get("target") == "reply" and item.get("id") == event_id and item.get("ok") is True for item in handled):
    raise SystemExit("remote policy RPA package runner missing reply")
if not any(item.get("target") == "mass" and item.get("jobId") == mass_job_id and item.get("ok") is True for item in handled):
    raise SystemExit("remote policy RPA package runner missing mass")
if not any(item.get("target") == "moment" and item.get("draftId") == moment_draft_id and item.get("ok") is True for item in handled):
    raise SystemExit("remote policy RPA package runner missing moment")
if not payload.get("savedPackagePath"):
    raise SystemExit("remote policy RPA package runner should save a package copy")
PY

  WOC_PANEL_URL="$PANEL_URL" AUTOMATION_BRIDGE_TOKEN="$AUTOMATION_BRIDGE_TOKEN" WECOM_RUNNER_MODE=dry-run WECOM_RUNNER_TARGET=all "$WECOM_BRIDGE_RUNNER" run-once > "$body_file"
  json_assert_path replies.handled[0].dryRun
  json_assert_path mass.handled[0].dryRun
  json_assert_path moments.handled[0].dryRun
  json_assert_path replies.runReport.report.id
  json_assert_path mass.runReport.report.id
  json_assert_path moments.runReport.report.id
  json_assert_eq replies.runReport.report.items[0].target reply
  json_assert_eq mass.runReport.report.items[0].target mass
  json_assert_eq moments.runReport.report.items[0].target moment
  json_assert_eq replies.runReport.report.items[0].action dry-run
  json_assert_eq mass.runReport.report.items[0].action dry-run
  json_assert_eq moments.runReport.report.items[0].action dry-run

  request_json PATCH "/api/admin/automation/bridge-events/$all_event_id" '{"status":"archived"}'
  json_assert_eq event.status archived
  request_json PATCH "/api/admin/automation/mass-jobs/$all_mass_job_id" '{"status":"cancelled","approved":false}'
  json_assert_eq job.status cancelled
  request_json PATCH "/api/admin/automation/moment-drafts/$all_moment_draft_id" '{"status":"archived","approved":false}'
  json_assert_eq draft.status archived
fi

say "Simulate inbound message without sending"
request_json POST /api/admin/automation/simulate '{"inboundText":"你好，我想了解服务价格"}'
json_assert_path decision.action

say "Create and cancel controlled mass-send queue"
mass_title="smoke-mass-$stamp"
mass_payload="$(python3 - "$mass_title" <<'PY'
import json
import sys

title = sys.argv[1]
print(json.dumps({
    "title": title,
    "message": "这是一条自动化 smoke 测试队列，不会发送。",
    "recipients": ["Smoke Test Contact"],
    "options": {
        "perSendDelaySeconds": 1,
        "requireOperatorConfirmRecipient": True,
        "openConversationBeforeSend": False,
    },
}, ensure_ascii=False))
PY
)"
request_json POST /api/admin/automation/mass-jobs "$mass_payload"
json_assert_path job.id
job_id="$(json_get job.id)"
request_json PATCH "/api/admin/automation/mass-jobs/$job_id" '{"status":"cancelled","approved":false}'
json_assert_eq job.status cancelled

say "Create and archive Moments draft"
moment_title="smoke-moment-$stamp"
moment_payload="$(python3 - "$moment_title" <<'PY'
import json
import sys

title = sys.argv[1]
print(json.dumps({
    "title": title,
    "text": "这是一条朋友圈半自动 smoke 测试草稿，不会发布。",
    "imageNotes": "无需配图",
    "materials": [],
}, ensure_ascii=False))
PY
)"
request_json POST /api/admin/automation/moment-drafts "$moment_payload"
json_assert_path draft.id
draft_id="$(json_get draft.id)"
request_json PATCH "/api/admin/automation/moment-drafts/$draft_id" '{"status":"archived","approved":false}'
json_assert_eq draft.status archived

say "Read automation audit"
request_json GET "/api/admin/automation/audit?limit=20"
json_assert_path events

say "Automation panel smoke test passed"
