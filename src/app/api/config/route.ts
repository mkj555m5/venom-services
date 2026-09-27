import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ensureSeed } from '@/lib/seed'
import { requireOwner, authErrorResponse, getSessionUser } from '@/lib/auth'

/** Public: site config + service toggles */
export async function GET() {
  await ensureSeed()
  const cfg = await db.serviceConfig.findMany()
  const map: Record<string, { enabled: boolean; value: string }> = {}
  for (const c of cfg) map[c.key] = { enabled: c.enabled, value: c.value }
  const user = await getSessionUser()
  return NextResponse.json({ config: map, role: user?.role || null })
}

/** Owner: update config / toggle services */
export async function PATCH(req: NextRequest) {
  try {
    await requireOwner()
    const body = await req.json().catch(() => ({}))
    const allowed = ['leak', 'xng', 'mega', 'hosting', 'chat', 'siteTitle', 'announcement']
    for (const [key, val] of Object.entries(body)) {
      if (!allowed.includes(key)) continue
      if (key === 'siteTitle' || key === 'announcement') {
        const value = String(val ?? '')
        await db.serviceConfig.upsert({
          where: { key },
          update: { value },
          create: { key, enabled: true, value },
        })
      } else {
        await db.serviceConfig.upsert({
          where: { key },
          update: { enabled: Boolean(val) },
          create: { key, enabled: Boolean(val) },
        })
      }
    }
    await import('@/lib/seed').then(({ addLog }) => addLog('warn', 'owner-panel', 'تعديل إعدادات الموقع', JSON.stringify(body).slice(0, 300)))
    return NextResponse.json({ ok: true })
  } catch (e) {
    return authErrorResponse(e)
  }
}
