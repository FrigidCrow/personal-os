#!/bin/zsh

set -euo pipefail

personal_os_root="${PERSONAL_OS_ROOT_OVERRIDE:-${0:A:h:h}}"
openworker_root="${OPENWORKER_ROOT_OVERRIDE:-/Users/frigidcrow/Documents/Codex/dev/openworker}"
openworker_gui_root="$openworker_root/surfaces/gui"
openworker_state_root="${OPENWORKER_STATE_ROOT_OVERRIDE:-/Users/frigidcrow/.config/coworker}"
openworker_token_file="$openworker_state_root/personal-os-8765.token"
personal_web_url="http://127.0.0.1:5273"
personal_api_health_url="http://127.0.0.1:8787/api/health"
openworker_web_url="http://127.0.0.1:5274"
openworker_health_url="http://127.0.0.1:8765/v1/health"
check_only=false

if [[ "${1:-}" == "--check" ]]; then
  check_only=true
fi

fail() {
  print -u2 "\n启动失败：$1"
  return 1
}

on_error() {
  local exit_code=$?
  print -u2 "\nPersonal OS 没有完全启动。"
  print -u2 "Personal OS 日志：$personal_os_root/logs"
  print -u2 "OpenWorker 日志：$openworker_root/logs"
  /usr/bin/osascript -e 'display notification "请查看启动窗口中的错误和日志" with title "Personal OS 启动失败"' >/dev/null 2>&1 || true
  if [[ -t 0 ]]; then
    print -n "按回车键关闭窗口…"
    read -r
  fi
  exit "$exit_code"
}

trap on_error ERR

require_command() {
  command -v "$1" >/dev/null 2>&1 || fail "缺少命令：$1"
}

port_is_listening() {
  /usr/sbin/lsof -nP -iTCP:"$1" -sTCP:LISTEN -t >/dev/null 2>&1
}

stop_owned_listener() {
  local port="$1"
  local expected_path="$2"
  local pid command
  pid=$(/usr/sbin/lsof -nP -iTCP:"$port" -sTCP:LISTEN -t 2>/dev/null | head -n 1 || true)
  [[ -z "$pid" ]] && return 0
  command=$(ps -p "$pid" -o command=)
  [[ "$command" == *"$expected_path"* ]] || fail "端口 $port 被其他程序占用：$command"
  kill "$pid"
  for _ in {1..30}; do
    port_is_listening "$port" || return 0
    sleep 0.2
  done
  fail "无法停止端口 $port 上的旧服务"
}

wait_for_url() {
  local url="$1"
  local label="$2"
  local attempt
  for attempt in {1..60}; do
    if /usr/bin/curl -fsS "$url" >/dev/null 2>&1; then
      print "✓ $label"
      return 0
    fi
    sleep 0.5
  done
  fail "$label 在 30 秒内没有通过健康检查：$url"
}

require_command node
require_command npm
require_command /usr/bin/curl
require_command /usr/sbin/lsof
require_command /usr/bin/open
require_command /usr/bin/screen
require_command launchctl

[[ -f "$personal_os_root/package.json" ]] || fail "找不到 Personal OS：$personal_os_root"
[[ -x "$openworker_root/.venv/bin/openworker-server" ]] || fail "找不到 OpenWorker Python 环境：$openworker_root/.venv"
[[ -f "$openworker_gui_root/package.json" ]] || fail "找不到 OpenWorker Web：$openworker_gui_root"

if $check_only; then
  print "✓ Personal OS 路径：$personal_os_root"
  print "✓ OpenWorker 路径：$openworker_root"
  print "✓ 启动器依赖完整"
  exit 0
fi

print "\n正在启动 Personal OS…"
cd "$personal_os_root"
if [[ ! -d node_modules ]]; then
  print "首次运行：安装 Personal OS 依赖…"
  npm install
fi
npm run build

mkdir -p "$openworker_root/logs" "$openworker_state_root"
if [[ ! -d "$openworker_gui_root/node_modules" ]]; then
  print "首次运行：安装 OpenWorker Web 依赖…"
  cd "$openworker_gui_root"
  npm install
  cd "$personal_os_root"
fi

openworker_api_token=""
if [[ -f "$openworker_token_file" ]]; then
  openworker_api_token=$(<"$openworker_token_file")
elif port_is_listening 8765; then
  openworker_server_pid=$(/usr/sbin/lsof -nP -iTCP:8765 -sTCP:LISTEN -t 2>/dev/null | head -n 1 || true)
  openworker_api_token=$(ps eww -p "$openworker_server_pid" -o command= | tr ' ' '\n' | sed -n 's/^COWORKER_API_TOKEN=//p' | tail -n 1)
fi
if [[ -z "$openworker_api_token" ]]; then
  openworker_api_token=$(/usr/bin/openssl rand -hex 32)
fi
umask 077
print -rn -- "$openworker_api_token" > "$openworker_token_file"

uid=$(/usr/bin/id -u)
launchctl bootout "gui/$uid/com.frigidcrow.personal-os.openworker-web" >/dev/null 2>&1 || true
launchctl bootout "gui/$uid/com.frigidcrow.personal-os.openworker-server" >/dev/null 2>&1 || true
stop_owned_listener 5274 "$openworker_gui_root"

if ! /usr/bin/curl -fsS -H "X-OpenWorker-Token: $openworker_api_token" "$openworker_health_url" >/dev/null 2>&1; then
  /usr/bin/screen -S personal-os-openworker -X quit >/dev/null 2>&1 || true
  if port_is_listening 8765; then
    stop_owned_listener 8765 "openworker-server"
  fi
  COWORKER_API_TOKEN="$openworker_api_token" \
    /usr/bin/screen -dmS personal-os-openworker /bin/zsh -lc \
      "cd '$openworker_root' && exec '$openworker_root/.venv/bin/openworker-server' --cwd '$personal_os_root' --host 127.0.0.1 --port 8765 >>'$openworker_root/logs/personal-os-worker-server.log' 2>&1"
fi
wait_for_url "$openworker_health_url" "OpenWorker Server · 127.0.0.1:8765"
cd "$personal_os_root"

CODEX_MODE=live \
  DAILY_RADAR_ENABLED=true \
  DAILY_RADAR_CRON="0 8 * * *" \
  PERSONAL_OS_TIMEZONE="Asia/Tokyo" \
  INCLUDE_OPENWORKER=true \
  INCLUDE_OPENWORKER_SERVER=false \
  OPENWORKER_ROOT="$openworker_root" \
  OPENWORKER_API_TOKEN="$openworker_api_token" \
  npm run launchagent:install -- --apply
wait_for_url "$personal_api_health_url" "Personal OS API · 127.0.0.1:8787"
wait_for_url "$personal_web_url" "Personal OS Web · 127.0.0.1:5273"
wait_for_url "$openworker_web_url" "OpenWorker Web · 127.0.0.1:5274"

/usr/bin/open "$personal_web_url"
/usr/bin/open "$openworker_web_url"
/usr/bin/osascript -e 'display notification "Personal OS 与 OpenWorker 已启动" with title "Personal OS"' >/dev/null 2>&1 || true

print "\n全部启动成功："
print "  Personal OS  $personal_web_url"
print "  OpenWorker    $openworker_web_url"
print "\n可以关闭这个终端窗口，后台服务会继续运行。"
