#!/bin/bash
# Venom Services — API integration test (one-shot)
B=http://localhost:3000
PASS=0; FAIL=0
check() { # name, actual, expected_substr
  if echo "$2" | grep -q "$3"; then echo "✓ $1"; PASS=$((PASS+1)); else echo "✗ $1 → $(echo "$2" | head -c 160)"; FAIL=$((FAIL+1)); fi
}

echo "── Auth ──"
R=$(curl -s $B/api/auth/me); check "me → guest" "$R" '"user":null'

# register test user
R=$(curl -s -c /tmp/venom_user.jar -X POST $B/api/auth/register -H 'Content-Type: application/json' \
  -d '{"username":"venomtest1","email":"test1@venom.services","password":"P@ssw0rd123","confirm":"P@ssw0rd123"}')
check "register user" "$R" '"role":"USER"'
R=$(curl -s -b /tmp/venom_user.jar $B/api/auth/me); check "me → user session" "$R" '"username":"venomtest1"'
check "default quota 4GB" "$R" '"ramMb":4096'
check "default disk 50GB" "$R" '"diskMb":51200'

# validation guards
R=$(curl -s -X POST $B/api/auth/register -H 'Content-Type: application/json' -d '{"username":"x","email":"bad","password":"123"}')
check "register validation blocks bad input" "$R" 'اسم المستخدم'
R=$(curl -s -X POST $B/api/auth/register -H 'Content-Type: application/json' -d '{"username":"RTQ_67","email":"o@o.com","password":"12345678"}')
check "owner username reserved" "$R" 'محجوز'

# owner login (fixed credentials)
R=$(curl -s -c /tmp/venom_owner.jar -X POST $B/api/auth/login -H 'Content-Type: application/json' \
  -d '{"username":"RTQ_67","password":"@ROblox2011"}')
check "owner login RTQ_67" "$R" '"role":"OWNER"'

echo "── Users management ──"
R=$(curl -s -b /tmp/venom_owner.jar $B/api/users)
check "owner lists users" "$R" 'venomtest1'
UID_TEST=$(echo "$R" | python3 -c "import json,sys; d=json.load(sys.stdin); print([u['id'] for u in d['users'] if u['username']=='venomtest1'][0])")
R=$(curl -s -b /tmp/venom_user.jar $B/api/users); check "user blocked from users list" "$R" 'للمالك فقط\|صلاحيات'
R=$(curl -s -b /tmp/venom_owner.jar -X PATCH $B/api/users/$UID_TEST -H 'Content-Type: application/json' -d '{"ramMb":8192,"role":"ADMIN"}')
check "owner promotes to admin + custom quota" "$R" '"ramMb":8192'
R=$(curl -s -X DELETE -b /tmp/venom_owner.jar $B/api/users/$UID_TEST)
check "owner deletes user" "$R" '"ok":true'
OWNER_ID=$(curl -s -b /tmp/venom_owner.jar $B/api/users | python3 -c "import json,sys; print([u['id'] for u in json.load(sys.stdin)['users'] if u['role']=='OWNER'][0])")
R=$(curl -s -b /tmp/venom_owner.jar -X DELETE $B/api/users/$OWNER_ID)
check "owner account undeletable" "$R" 'لا يمكن حذفه'

echo "── Leak Check ──"
R=$(curl -s -X POST $B/api/leak/password -H 'Content-Type: application/json' -d '{"password":"password"}')
check "leaked password detected" "$R" '"safe":false'
R=$(curl -s -X POST $B/api/leak/password -H 'Content-Type: application/json' -d '{"password":"Xk9$mQv2#LpZ8wN4!rT"}')
check "strong password safe" "$R" '"safe":true'

echo "── Search ──"
R=$(curl -s "$B/api/search?q=free+fire" --max-time 20)
check "search returns results" "$R" '"results":\['

echo "── Hosting ──"
curl -s -c /tmp/venom_u2.jar -X POST $B/api/auth/register -H 'Content-Type: application/json' \
  -d '{"username":"hosttest1","email":"h1@venom.services","password":"P@ssw0rd123","confirm":"P@ssw0rd123"}' > /dev/null
R=$(curl -s -b /tmp/venom_u2.jar -X POST $B/api/hosting/projects -H 'Content-Type: application/json' -d '{"name":"demo-proj","language":"python"}')
check "create project" "$R" '"language":"python"'
PID=$(echo "$R" | python3 -c "import json,sys; print(json.load(sys.stdin)['project']['id'])")
R=$(curl -s -b /tmp/venom_u2.jar $B/api/hosting/projects)
check "project list with quota" "$R" '"projectLimit":1'
R=$(curl -s -b /tmp/venom_u2.jar -X POST $B/api/hosting/projects -H 'Content-Type: application/json' -d '{"name":"second-proj","language":"node"}')
check "quota blocks 2nd project" "$R" 'حد المشاريع'
R=$(curl -s -b /tmp/venom_u2.jar -X POST $B/api/hosting/action/start -H 'Content-Type: application/json' -d "{\"projectId\":\"$PID\"}")
check "start project" "$R" '"port"'
sleep 2
R=$(curl -s -b /tmp/venom_u2.jar -X POST $B/api/hosting/action/logs -H 'Content-Type: application/json' -d "{\"projectId\":\"$PID\"}")
check "console logs captured" "$R" 'Serving on port'
R=$(curl -s -b /tmp/venom_u2.jar -X POST $B/api/hosting/action/stop -H 'Content-Type: application/json' -d "{\"projectId\":\"$PID\"}")
check "stop project" "$R" '"ok":true'

echo "── Chat persistence ──"
R=$(curl -s -X POST $B/api/chat/persist -H 'Content-Type: application/json' -H 'x-internal-token: venom-internal' \
  -d '{"room":"general","username":"RTQ_67","role":"OWNER","content":"أهل السم"}')
check "chat persist (internal)" "$R" '"ok":true'
R=$(curl -s -X POST $B/api/chat/persist -H 'Content-Type: application/json' -H 'x-internal-token: wrong' -d '{}')
check "chat persist rejects wrong token" "$R" 'unauthorized'
R=$(curl -s -b /tmp/venom_u2.jar "$B/api/chat/history?room=general")
check "chat history returns" "$R" 'أهل السم'

echo "── Config / Stats / Logs / Logo ──"
R=$(curl -s -b /tmp/venom_owner.jar -X PATCH $B/api/config -H 'Content-Type: application/json' -d '{"announcement":"اختبار الإعلان السام"}')
check "owner updates config" "$R" '"ok":true'
R=$(curl -s $B/api/config); check "public config shows announcement" "$R" 'اختبار الإعلان السام'
R=$(curl -s -b /tmp/venom_owner.jar $B/api/stats); check "owner stats" "$R" '"uptimeSec"'
R=$(curl -s -b /tmp/venom_owner.jar "$B/api/logs?take=5"); check "owner logs" "$R" '"logs":\['
R=$(curl -s -b /tmp/venom_owner.jar $B/api/logo); check "logo generator variants" "$R" '"svg"'

echo "── Security headers ──"
R=$(curl -sI $B/)
check "CSP header present" "$R" "Content-Security-Policy"
check "nosniff present" "$R" "X-Content-Type-Options"

echo ""
echo "════════ RESULT: $PASS passed / $FAIL failed ════════"
rm -f /tmp/venom_*.jar
exit $FAIL
