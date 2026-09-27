#!/bin/bash
# Browser E2E v3 — extract refs dynamically within the same session
set -u
cd /home/z/my-project/naruto-spinner-web

python -m uvicorn app.main:app --host 0.0.0.0 --port 3000 > /tmp/naruto_server.log 2>&1 &
SRV_PID=$!
sleep 3

agent-browser open http://localhost:3000 > /dev/null 2>&1
agent-browser wait --load networkidle > /dev/null 2>&1

# fresh snapshot -> refs (format: ... [ref=e13])
SNAP=$(agent-browser snapshot -i -c 2>/dev/null)
ref_of() { echo "$SNAP" | grep "$1" | grep -oE 'ref=e[0-9]+' | head -1 | cut -d= -f2; }

ACC_REF=$(ref_of 'textbox')
PARSE_REF=$(ref_of 'فحص وتحليل')
ALL_REF=$(ref_of 'SPIN ALL EVENTS')
START_REF=$(ref_of 'ابدأ السحب')
echo "refs: acc=@$ACC_REF parse=@$PARSE_REF all=@$ALL_REF start=@$START_REF"

echo "══ 1. Fill + parse ══"
agent-browser fill "@$ACC_REF" '[{"uid":"123456789","password":"pass1"},{"uid":"987654321","password":"pass2"}]' 2>&1 | tail -1
agent-browser click "@$PARSE_REF" 2>&1 | tail -1
sleep 1
echo "accCount = $(agent-browser get text "#accCount" 2>/dev/null)"

echo "══ 2. Select ALL EVENTS ══"
agent-browser click "@$ALL_REF" 2>&1 | tail -1
sleep 0.5

echo "══ 3. Start job ══"
agent-browser click "@$START_REF" 2>&1 | tail -1
sleep 5
echo "startMsg = $(agent-browser get text "#startMsg" 2>/dev/null)"
echo "eventLabel = $(agent-browser get text "#eventLabel" 2>/dev/null)"
echo "terminal:"
agent-browser get text "#terminal" 2>/dev/null | head -8

echo "══ 4. Screenshots ══"
agent-browser set viewport 1280 900 2>/dev/null; sleep 1
agent-browser screenshot /home/z/my-project/download/naruto_desktop.png --full 2>&1 | tail -1
agent-browser set viewport 390 844 2>/dev/null; sleep 1
agent-browser screenshot /home/z/my-project/download/naruto_mobile.png --full 2>&1 | tail -1

echo "══ 5. Console errors ══"
agent-browser errors 2>&1 | head -3

agent-browser close 2>/dev/null
kill $SRV_PID 2>/dev/null
echo "══ DONE ══"
