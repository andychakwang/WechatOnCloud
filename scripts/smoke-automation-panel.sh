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

cleanup() {
  rm -f "$cookie_jar" "$body_file"
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
for task in payload.get("tasks", []):
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
for task in payload.get("tasks", []):
    if task.get("id") == task_id:
        raise SystemExit(0)
raise SystemExit(f"task {task_id} should be listed")
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
request_json GET /api/admin/automation/bridge
json_assert_path bridge.runnerGuide.envFile
json_assert_path bridge.runnerGuide.commands.writeEnv
json_assert_path bridge.runnerGuide.commands.dryRunAll
if [[ "$(json_get bridge.runnerGuide.envFile)" != *"AUTOMATION_BRIDGE_TOKEN="* ]]; then
  echo "ERROR: Bridge runner guide env file is missing AUTOMATION_BRIDGE_TOKEN placeholder" >&2
  sed -n '1,120p' "$body_file" >&2
  exit 1
fi
if [[ -n "${AUTOMATION_BRIDGE_TOKEN:-}" ]] && grep -qF "$AUTOMATION_BRIDGE_TOKEN" "$body_file"; then
  echo "ERROR: Bridge runner guide leaked the real AUTOMATION_BRIDGE_TOKEN" >&2
  exit 1
fi

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

if [[ -n "${AUTOMATION_BRIDGE_TOKEN:-}" ]]; then
  say "Check WeCom Mac handler dry-run"
  WECOM_HANDLER_MODE=dry-run "$WECOM_REPLY_HANDLER" < "$ROOT/doc/examples/wecom-bridge-reply.sample.json" > "$body_file"
  json_assert_path ok

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

  say "Report WeCom Bridge worker heartbeat"
  WOC_PANEL_URL="$PANEL_URL" AUTOMATION_BRIDGE_TOKEN="$AUTOMATION_BRIDGE_TOKEN" node "$BRIDGE_CLIENT" heartbeat --worker-id smoke-worker --mode dry-run > "$body_file"
  json_assert_eq worker.workerId smoke-worker
  json_assert_path worker.lastSeenAt
  json_assert_path pendingReplies

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
  request_json PATCH "/api/admin/automation/bridge-events/$bridge_event_id" '{"replyDraft":"这是经过人工确认的 Bridge smoke 回复草稿。","replyApproved":true}'
  json_assert_path event.replyApproved
  WOC_PANEL_URL="$PANEL_URL" AUTOMATION_BRIDGE_TOKEN="$AUTOMATION_BRIDGE_TOKEN" WECOM_RUNNER_MODE=dry-run "$WECOM_BRIDGE_RUNNER" run-once > "$body_file"
  json_assert_path handled[0].dryRun
  WOC_PANEL_URL="$PANEL_URL" AUTOMATION_BRIDGE_TOKEN="$AUTOMATION_BRIDGE_TOKEN" node "$BRIDGE_CLIENT" pull-replies --limit 20 > "$body_file"
  json_assert_path replies[0].id
  WOC_PANEL_URL="$PANEL_URL" AUTOMATION_BRIDGE_TOKEN="$AUTOMATION_BRIDGE_TOKEN" node "$BRIDGE_CLIENT" claim-reply "$bridge_event_id" --worker-id smoke-worker > "$body_file"
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
  WOC_PANEL_URL="$PANEL_URL" AUTOMATION_BRIDGE_TOKEN="$AUTOMATION_BRIDGE_TOKEN" node "$BRIDGE_CLIENT" mark-failed "$bridge_event_id" --error "smoke handler failed once" > "$body_file"
  json_assert_path event.replyFailedAt
  json_assert_path event.replyError
  WOC_PANEL_URL="$PANEL_URL" AUTOMATION_BRIDGE_TOKEN="$AUTOMATION_BRIDGE_TOKEN" node "$BRIDGE_CLIENT" mark-delivered "$bridge_event_id" --worker-id smoke-worker > "$body_file"
  json_assert_path event.replyDeliveredAt
  request_json PATCH "/api/admin/automation/bridge-events/$bridge_event_id" '{"status":"archived"}'
  json_assert_eq event.status archived

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
settings["perConversationCooldownMinutes"] = 0
config["settings"] = settings
print(json.dumps(config, ensure_ascii=False))
PY
)"
  request_json PUT /api/admin/automation/config "$mass_config_payload"
  json_assert_path config.settings.massSendEnabled

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
  json_assert_eq job.status paused

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

  WOC_PANEL_URL="$PANEL_URL" AUTOMATION_BRIDGE_TOKEN="$AUTOMATION_BRIDGE_TOKEN" WECOM_RUNNER_MODE=dry-run WECOM_RUNNER_TARGET=all "$WECOM_BRIDGE_RUNNER" run-once > "$body_file"
  json_assert_path replies.handled[0].dryRun
  json_assert_path mass.handled[0].dryRun
  json_assert_path moments.handled[0].dryRun

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
