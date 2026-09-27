#!/bin/bash
# Browser E2E verification in one session (sandbox kills bg processes between calls)
set -u
cd /home/z/my-project/naruto-spinner-web

python -m uvicorn app.main:app --host 0.0.0.0 --port 3000 > /tmp/naruto_server.log 2>&1 &
SRV_PID=$!
sleep 3

echo "══ 1. Open page ══"
agent-browser open http://localhost:3000 2>&1 | tail -1
agent-browser wait --load networkidle 2>/dev/null
agent-browser get title

echo "══ 2. Snapshot interactive elements ══"
agent-browser snapshot -i -c 2>&1 | head -40

echo "══ 3. Console errors? ══"
agent-browser errors 2>&1 | head -5

echo "══ 4. Fill accounts + parse ══"
REF_ACC=$(agent-browser snapshot -i -c 2>/dev/null | grep -oE '@e[0-9]+ textbox' | head -1 | grep -oE '@e[0-9]+')
agent-browser fill "$REF_ACC" '[{"uid":"123456789","password":"pass1"},{"uid":"987654321","password":"pass2"}]' 2>&1 | tail -1
agent-browser find text "فحص وتحليل" click 2>&1 | tail -1
sleep 1
agent-browser get text "#accCount"

echo "══ 5. Select ALL EVENTS card ══"
agent-browser find text "🔥 SPIN ALL EVENTS" click 2>&1 | tail -1
sleep 0.5

echo "══ 6. Start job ══"
agent-browser find text "ابدأ السحب" click 2>&1 | tail -1
sleep 4
agent-browser get text "#startMsg"
agent-browser get text "#eventLabel"

echo "══ 7. Terminal live? ══"
agent-browser get text "#terminal" 2>/dev/null | head -8

echo "══ 8. Stats ══"
agent-browser get text "#accDone"
agent-browser get text "#accTotal"

echo "══ 9. Screenshots (desktop + mobile) ══"
agent-browser set viewport 1280 900
sleep 1
agent-browser screenshot /home/z/my-project/download/naruto_desktop.png --full 2>&1 | tail -1
agent-browser set viewport 390 844
sleep 1
agent-browser screenshot /home/z/my-project/download/naruto_mobile.png --full 2>&1 | tail -1

echo "══ 10. Stop job ══"
agent-browser find text "إيقاف" click 2>&1 | tail -1
sleep 1

agent-browser close 2>/dev/null
kill $SRV_PID 2>/dev/null
echo "══ DONE ══"
