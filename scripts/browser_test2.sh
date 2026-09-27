#!/bin/bash
# Browser E2E v2 — direct refs from previous snapshot
set -u
cd /home/z/my-project/naruto-spinner-web

python -m uvicorn app.main:app --host 0.0.0.0 --port 3000 > /tmp/naruto_server.log 2>&1 &
SRV_PID=$!
sleep 3

agent-browser open http://localhost:3000 > /dev/null 2>&1
agent-browser wait --load networkidle > /dev/null 2>&1

echo "══ 1. Fill accounts textarea (@e13) + parse ══"
agent-browser fill @e13 '[{"uid":"123456789","password":"pass1"},{"uid":"987654321","password":"pass2"}]' 2>&1 | tail -1
agent-browser click @e11 2>&1 | tail -1
sleep 1
echo "accCount = $(agent-browser get text "#accCount" 2>/dev/null)"
echo "parseMsg = $(agent-browser get text "#parseMsg" 2>/dev/null)"

echo "══ 2. Select ALL EVENTS (@e33) ══"
agent-browser click @e33 2>&1 | tail -1
sleep 0.5

echo "══ 3. Start job (@e20) ══"
agent-browser click @e20 2>&1 | tail -1
sleep 5
echo "startMsg = $(agent-browser get text "#startMsg" 2>/dev/null)"
echo "eventLabel = $(agent-browser get text "#eventLabel" 2>/dev/null)"
echo "stopBtn enabled? $(agent-browser is enabled @e21 2>/dev/null)"

echo "══ 4. Terminal content ══"
agent-browser get text "#terminal" 2>/dev/null | head -10

echo "══ 5. Progress ══"
echo "done=$(agent-browser get text "#accDone" 2>/dev/null) total=$(agent-browser get text "#accTotal" 2>/dev/null)"

echo "══ 6. Screenshots ══"
agent-browser set viewport 1280 900 2>/dev/null
sleep 1
agent-browser screenshot /home/z/my-project/download/naruto_desktop.png --full 2>&1 | tail -1
agent-browser set viewport 390 844 2>/dev/null
sleep 1
agent-browser screenshot /home/z/my-project/download/naruto_mobile.png --full 2>&1 | tail -1

echo "══ 7. Console errors ══"
agent-browser errors 2>&1 | head -5

agent-browser close 2>/dev/null
kill $SRV_PID 2>/dev/null
echo "══ DONE ══"
