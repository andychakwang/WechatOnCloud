#!/usr/bin/env bash
set -euo pipefail

PANEL_URL="${PANEL_URL:-http://192.168.8.152:36081}"
PANEL_USER="${PANEL_USER:-admin}"
PANEL_PASSWORD="${PANEL_PASSWORD:-${PANEL_ADMIN_PASSWORD:-${WOC_TEST_PASSWORD:-wechat}}}"

PANEL_URL="${PANEL_URL%/}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BRIDGE_CLIENT="${BRIDGE_CLIENT:-$ROOT/scripts/wecom-bridge-client.mjs}"
WECOM_REPLY_HANDLER="${WECOM_REPLY_HANDLER:-$ROOT/scripts/wecom-mac-reply-handler.sh}"
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
  WOC_PANEL_URL="$PANEL_URL" AUTOMATION_BRIDGE_TOKEN="$AUTOMATION_BRIDGE_TOKEN" node "$BRIDGE_CLIENT" pull-replies --limit 20 > "$body_file"
  json_assert_no_reply_id "$bridge_event_id"
  WOC_PANEL_URL="$PANEL_URL" AUTOMATION_BRIDGE_TOKEN="$AUTOMATION_BRIDGE_TOKEN" node "$BRIDGE_CLIENT" mark-failed "$bridge_event_id" --error "smoke handler failed once" > "$body_file"
  json_assert_path event.replyFailedAt
  json_assert_path event.replyError
  WOC_PANEL_URL="$PANEL_URL" AUTOMATION_BRIDGE_TOKEN="$AUTOMATION_BRIDGE_TOKEN" node "$BRIDGE_CLIENT" mark-delivered "$bridge_event_id" --worker-id smoke-worker > "$body_file"
  json_assert_path event.replyDeliveredAt
  request_json PATCH "/api/admin/automation/bridge-events/$bridge_event_id" '{"status":"archived"}'
  json_assert_eq event.status archived
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
