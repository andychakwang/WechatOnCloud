#!/usr/bin/env bash
set -euo pipefail

NAS_LAN_HOST="${NAS_LAN_HOST:-192.168.8.152}"
NAS_EDGE_HOST="${NAS_EDGE_HOST:-192.168.5.2}"
PUBLIC_HOST="${PUBLIC_HOST:-nasbot.cloud}"
PROD_PORT="${PROD_PORT:-36080}"
TEST_PORT="${TEST_PORT:-36081}"
FNOS_PORT="${FNOS_PORT:-5666}"
SSH_USERS="${SSH_USERS:-admin root andy}"
CONNECT_TIMEOUT="${CONNECT_TIMEOUT:-5}"

ok=0
warn=0

http_code() {
  local url="$1"
  curl -sS -o /dev/null -w '%{http_code}' --connect-timeout "$CONNECT_TIMEOUT" "$url" 2>/dev/null || true
}

http_head_status() {
  local url="$1"
  local first
  first="$(curl -sS -I --connect-timeout "$CONNECT_TIMEOUT" "$url" 2>/dev/null | sed -n '1p' || true)"
  [[ -n "$first" ]] && printf '%s' "$first" || printf 'unreachable'
}

tcp_status() {
  local host="$1"
  local port="$2"
  if nc -z -G "$CONNECT_TIMEOUT" "$host" "$port" >/dev/null 2>&1; then
    printf 'open'
  else
    printf 'closed'
  fi
}

resolve_host() {
  local host="$1"
  python3 - "$host" <<'PY' 2>/dev/null || true
import socket
import sys

try:
    print(socket.gethostbyname(sys.argv[1]))
except Exception:
    pass
PY
}

ssh_key_user() {
  local host="$1"
  local user
  for user in $SSH_USERS; do
    if ssh \
      -o BatchMode=yes \
      -o ConnectTimeout="$CONNECT_TIMEOUT" \
      -o StrictHostKeyChecking=no \
      -o UserKnownHostsFile=/dev/null \
      "$user@$host" 'echo SSH_OK' >/dev/null 2>&1; then
      printf '%s' "$user"
      return 0
    fi
  done
  return 1
}

line() {
  printf '%-30s %s\n' "$1" "$2"
}

echo "WechatOnCloud FlyNAS deployment readiness"
echo

public_ip="$(resolve_host "$PUBLIC_HOST")"
line "public host" "$PUBLIC_HOST${public_ip:+ -> $public_ip}"

prod_lan="$(http_code "http://$NAS_LAN_HOST:$PROD_PORT/")"
test_lan="$(http_code "http://$NAS_LAN_HOST:$TEST_PORT/")"
prod_edge="$(http_code "http://$NAS_EDGE_HOST:$PROD_PORT/")"
test_edge="$(http_code "http://$NAS_EDGE_HOST:$TEST_PORT/")"
prod_public="$(http_code "http://$PUBLIC_HOST:$PROD_PORT/")"
test_public="$(http_code "http://$PUBLIC_HOST:$TEST_PORT/")"
fnos_web="$(http_head_status "http://$NAS_LAN_HOST/")"
fnos_docker="$(http_head_status "http://$NAS_LAN_HOST:$FNOS_PORT/apps/docker/")"
ssh_port="$(tcp_status "$NAS_LAN_HOST" 22)"

line "LAN production panel" "http://$NAS_LAN_HOST:$PROD_PORT/ -> ${prod_lan:-unreachable}"
line "LAN automation test" "http://$NAS_LAN_HOST:$TEST_PORT/ -> ${test_lan:-unreachable}"
line "edge production panel" "http://$NAS_EDGE_HOST:$PROD_PORT/ -> ${prod_edge:-unreachable}"
line "edge automation test" "http://$NAS_EDGE_HOST:$TEST_PORT/ -> ${test_edge:-unreachable}"
line "public production panel" "http://$PUBLIC_HOST:$PROD_PORT/ -> ${prod_public:-unreachable}"
line "public automation test" "http://$PUBLIC_HOST:$TEST_PORT/ -> ${test_public:-unreachable}"
line "fnOS web" "$fnos_web"
line "fnOS Docker app" "$fnos_docker"
line "SSH port" "$NAS_LAN_HOST:22 -> $ssh_port"

ssh_user=""
if [[ "$ssh_port" == "open" ]]; then
  ssh_user="$(ssh_key_user "$NAS_LAN_HOST" || true)"
fi
if [[ -n "$ssh_user" ]]; then
  line "SSH key login" "$ssh_user@$NAS_LAN_HOST -> ok"
else
  line "SSH key login" "not available with users: $SSH_USERS"
fi

echo
echo "Summary"

if [[ "$prod_lan" == "200" ]]; then
  echo "- Existing production panel is alive on LAN $PROD_PORT."
else
  echo "- WARNING: production panel did not return 200 on LAN $PROD_PORT."
  warn=1
fi

if [[ "$test_lan" == "200" ]]; then
  echo "- Automation test panel is already up on LAN $TEST_PORT."
  echo "  Smoke:"
  echo "  PANEL_URL='http://$NAS_LAN_HOST:$TEST_PORT' PANEL_USER='admin' PANEL_PASSWORD='...' ./scripts/smoke-automation-panel.sh"
  ok=1
else
  echo "- Automation test panel is not running on LAN $TEST_PORT yet."
fi

if [[ -n "$ssh_user" ]]; then
  echo "- SSH deployment can run without prompting for a password."
  echo "  Deploy:"
  echo "  PANEL_ADMIN_PASSWORD='...' SSH_TARGET='$ssh_user@$NAS_LAN_HOST' ./scripts/deploy-fnos-automation-test-ssh.sh"
  ok=1
else
  echo "- Need fnOS web login or an SSH password/key before deployment can proceed."
fi

if [[ "$prod_public" != "200" ]]; then
  echo "- Public $PUBLIC_HOST:$PROD_PORT is not returning 200 from this machine; check router/NAT/hairpin if public access matters now."
fi

exit "$warn"
