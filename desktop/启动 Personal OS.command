#!/bin/zsh

launcher="/Users/frigidcrow/Documents/Codex/dev/personal-os/scripts/start-personal-os.command"

if [[ ! -x "$launcher" ]]; then
  /usr/bin/osascript -e 'display dialog "找不到 Personal OS 启动器。请确认项目仍位于 /Users/frigidcrow/Documents/Codex/dev/personal-os。" with title "无法启动 Personal OS" buttons {"好"} default button "好" with icon stop'
  exit 1
fi

exec "$launcher"
