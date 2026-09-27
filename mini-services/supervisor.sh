#!/bin/bash
# Venom mini-services supervisor: keeps hosting + chat services alive.
# If the sandbox kills them, the loop restarts them within 1s.
cd "$(dirname "$0")"

watch() {
  local dir="$1" name="$2"
  while true; do
    cd "$dir"
    bun index.ts >> "/tmp/${name}.log" 2>&1
    echo "[$(date '+%H:%M:%S')] ${name} exited (code $?) — restarting in 1s" >> /tmp/venom-supervisor.log
    sleep 1
  done
}

watch /home/z/my-project/mini-services/hosting-service hosting-svc &
watch /home/z/my-project/mini-services/chat-service chat-svc &
wait
