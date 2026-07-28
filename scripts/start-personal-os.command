#!/bin/zsh

set -euo pipefail

personal_os_root="${PERSONAL_OS_ROOT_OVERRIDE:-${0:A:h:h}}"
openworker_root="${OPENWORKER_ROOT_OVERRIDE:-/Users/frigidcrow/Documents/Codex/dev/openworker}"
openworker_gui_root="$openworker_root/surfaces/gui"
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
npm run launchagent:install -- --apply
wait_for_url "$personal_api_health_url" "Personal OS API · 127.0.0.1:8787"
wait_for_url "$personal_web_url" "Personal OS Web · 127.0.0.1:5273"

mkdir -p "$openworker_root/logs"

print "\n正在启动 OpenWorker…"
if ! port_is_listening 8765; then
  cd "$openworker_root"
  nohup "$openworker_root/.venv/bin/openworker-server" \
    --cwd "$personal_os_root" \
    --host 127.0.0.1 \
    --port 8765 \
    >>"$openworker_root/logs/personal-os-worker-server.log" 2>&1 </dev/null &
fi
wait_for_url "$openworker_health_url" "OpenWorker Server · 127.0.0.1:8765"

if ! port_is_listening 5274; then
  cd "$openworker_gui_root"
  if [[ ! -d node_modules ]]; then
    print "首次运行：安装 OpenWorker Web 依赖…"
    npm install
  fi
  NODE_OPTIONS=--no-experimental-webstorage \
    nohup npm run dev -- --host 127.0.0.1 --port 5274 --strictPort \
    >>"$openworker_root/logs/personal-os-worker-web.log" 2>&1 </dev/null &
fi
wait_for_url "$openworker_web_url" "OpenWorker Web · 127.0.0.1:5274"

/usr/bin/open "$personal_web_url"
/usr/bin/open "$openworker_web_url"
/usr/bin/osascript -e 'display notification "Personal OS 与 OpenWorker 已启动" with title "Personal OS"' >/dev/null 2>&1 || true

print "\n全部启动成功："
print "  Personal OS  $personal_web_url"
print "  OpenWorker    $openworker_web_url"
print "\n可以关闭这个终端窗口，后台服务会继续运行。"

