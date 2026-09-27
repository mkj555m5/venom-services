import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { requireUser, authErrorResponse } from '@/lib/auth'
import { addLog } from '@/lib/seed'

const HS = process.env.HOSTING_SERVICE_URL || 'http://127.0.0.1:3031'
const INTERNAL_TOKEN = process.env.INTERNAL_TOKEN || 'venom-internal'

export function hsHeaders() {
  return { 'Content-Type': 'application/json', 'x-internal-token': INTERNAL_TOKEN }
}

/** GET: list my projects with live status */
export async function GET() {
  try {
    const user = await requireUser()
    const projects = await db.hostingProject.findMany({
      where: { ownerId: user.id },
      orderBy: { createdAt: 'asc' },
    })
    const withStatus = await Promise.all(
      projects.map(async (p) => {
        try {
          const r = await fetch(
            `${HS}/status?username=${encodeURIComponent(user.username)}&name=${encodeURIComponent(p.name)}`,
            { headers: { 'x-internal-token': INTERNAL_TOKEN }, signal: AbortSignal.timeout(4000) }
          )
          if (r.ok) {
            const st = await r.json()
            await db.hostingProject.update({
              where: { id: p.id },
              data: { status: st.status, ramMb: st.ramMb || 0, diskMb: st.diskMb || 0, port: st.port || 0 },
            })
            return { ...p, status: st.status, liveRamMb: st.ramMb || 0, liveDiskMb: st.diskMb || 0, port: st.port || 0 }
          }
        } catch { /* service down */ }
        return { ...p, status: 'stopped', liveRamMb: p.ramMb, liveDiskMb: p.diskMb, port: p.port }
      })
    )
    return NextResponse.json({ projects: withStatus, quota: { ramMb: user.ramMb, diskMb: user.diskMb, projectLimit: user.projectLimit } })
  } catch (e) {
    return authErrorResponse(e)
  }
}

/** POST: create a new project (quota enforced) */
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser()
    if (!rateOk(user.username)) return NextResponse.json({ error: 'طلبات كثيرة، انتظر قليلاً' }, { status: 429 })

    const { name, language } = await req.json().catch(() => ({}))
    const safe = String(name || '').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 30)
    if (!safe || safe.length < 2) return NextResponse.json({ error: 'اسم المشروع: حروف إنجليزية/أرقام (2-30)' }, { status: 400 })
    if (!['python', 'node'].includes(language)) return NextResponse.json({ error: 'اختر اللغة: python أو node' }, { status: 400 })

    // ── strict quota: project count ──
    if (user.projectLimit >= 0) {
      const count = await db.hostingProject.count({ where: { ownerId: user.id } })
      if (count >= user.projectLimit) {
        return NextResponse.json(
          { error: `وصلت لحد المشاريع (${user.projectLimit}) — احذف مشروعاً أو تواصل مع المالك لرفع الحصة` },
          { status: 403 }
        )
      }
    }
    if (user.banned) return NextResponse.json({ error: 'حسابك محظور' }, { status: 403 })

    const exists = await db.hostingProject.findUnique({ where: { name: safe } })
    if (exists) return NextResponse.json({ error: 'اسم المشروع مستخدم — اختر اسماً آخر' }, { status: 409 })

    const r = await fetch(`${HS}/create`, {
      method: 'POST',
      headers: hsHeaders(),
      body: JSON.stringify({ username: user.username, name: safe, language }),
      signal: AbortSignal.timeout(10_000),
    })
    if (!r.ok) {
      const data = await r.json().catch(() => ({}))
      return NextResponse.json({ error: data.error || 'فشل إنشاء المشروع' }, { status: 502 })
    }

    const entry = (await r.json()).entry
    const project = await db.hostingProject.create({
      data: { ownerId: user.id, name: safe, language, entryFile: entry },
    })
    await addLog('info', 'hosting', `إنشاء مشروع ${safe} (${language}) — ${user.username}`)
    return NextResponse.json({ project })
  } catch (e) {
    return authErrorResponse(e)
  }
}

const hits = new Map<string, number[]>()
function rateOk(key: string): boolean {
  const now = Date.now()
  const t = (hits.get(key) || []).filter((x) => now - x < 60_000)
  if (t.length >= 30) return false
  t.push(now)
  hits.set(key, t)
  return true
}
