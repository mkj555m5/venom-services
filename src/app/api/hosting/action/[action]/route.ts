import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { requireUser, authErrorResponse } from '@/lib/auth'
import { addLog } from '@/lib/seed'

const HS = process.env.HOSTING_SERVICE_URL || 'http://127.0.0.1:3031'
const INTERNAL_TOKEN = process.env.INTERNAL_TOKEN || 'venom-internal'

interface Params { params: Promise<{ action: string }> }

/**
 * POST /api/hosting/action/{start|stop|install|logs|clear|unzip|delete}
 * Proxies to hosting-service with ownership + quota checks.
 */
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const user = await requireUser()
    const { action } = await params
    const body = await req.json().catch(() => ({}))
    const projectId = String(body.projectId || '')
    if (!/^[a-z0-9]{10,45}$/.test(projectId)) return NextResponse.json({ error: 'معرف غير صالح' }, { status: 400 })

    // ownership check
    const project = await db.hostingProject.findUnique({ where: { id: projectId } })
    if (!project) return NextResponse.json({ error: 'المشروع غير موجود' }, { status: 404 })
    if (project.ownerId !== user.id && user.role === 'USER') {
      return NextResponse.json({ error: 'هذا المشروع ليس لك' }, { status: 403 })
    }

    const ownerRec = await db.user.findUnique({ where: { id: project.ownerId } })
    const username = ownerRec?.username || ''
    if (!username) return NextResponse.json({ error: 'مالك المشروع غير موجود' }, { status: 404 })
    const payload = { username, name: project.name }

    switch (action) {
      case 'start': {
        const r = await fetch(`${HS}/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-internal-token': INTERNAL_TOKEN },
          body: JSON.stringify({ ...payload, entry: project.entryFile, ramLimitMb: ownerRec?.ramMb ?? 4096 }),
          signal: AbortSignal.timeout(8000),
        })
        const data = await r.json().catch(() => ({}))
        if (!r.ok) return NextResponse.json({ error: data.error || 'فشل البدء' }, { status: 502 })
        await db.hostingProject.update({ where: { id: projectId }, data: { status: 'running', port: data.port || 0 } })
        await addLog('info', 'hosting', `تشغيل ${username}/${project.name}`)
        return NextResponse.json({ ok: true, port: data.port })
      }
      case 'stop': {
        await fetch(`${HS}/stop`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-internal-token': INTERNAL_TOKEN },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(8000),
        }).catch(() => {})
        await db.hostingProject.update({ where: { id: projectId }, data: { status: 'stopped', port: 0 } })
        await addLog('info', 'hosting', `إيقاف ${username}/${project.name}`)
        return NextResponse.json({ ok: true })
      }
      case 'install': {
        const r = await fetch(`${HS}/install`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-internal-token': INTERNAL_TOKEN },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(120_000),
        })
        const data = await r.json().catch(() => ({}))
        if (!r.ok) return NextResponse.json({ error: data.error || 'فشل التثبيت' }, { status: 502 })
        return NextResponse.json({ ok: data.installed })
      }
      case 'logs': {
        const r = await fetch(
          `${HS}/logs?username=${encodeURIComponent(username)}&name=${encodeURIComponent(project.name)}&max=30000`,
          { headers: { 'x-internal-token': INTERNAL_TOKEN }, signal: AbortSignal.timeout(5000) }
        )
        if (!r.ok) return NextResponse.json({ log: '' })
        const data = await r.json()
        return NextResponse.json({ log: data.log || '' })
      }
      case 'clear': {
        const r = await fetch(`${HS}/logs/clear`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-internal-token': INTERNAL_TOKEN },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(5000),
        })
        return NextResponse.json({ ok: r.ok })
      }
      case 'unzip': {
        const rel = String(body.path || '')
        if (!rel || rel.includes('..')) return NextResponse.json({ error: 'مسار غير صالح' }, { status: 400 })
        const r = await fetch(`${HS}/files/unzip`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-internal-token': INTERNAL_TOKEN },
          body: JSON.stringify({ ...payload, path: rel }),
          signal: AbortSignal.timeout(30_000),
        })
        const data = await r.json().catch(() => ({}))
        if (!r.ok) return NextResponse.json({ error: data.error || 'فشل فك الضغط' }, { status: 502 })
        return NextResponse.json({ ok: true })
      }
      case 'delete': {
        await fetch(`${HS}/stop`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-internal-token': INTERNAL_TOKEN },
          body: JSON.stringify(payload),
        }).catch(() => {})
        await fetch(
          `${HS}/files?username=${encodeURIComponent(username)}&name=${encodeURIComponent(project.name)}&path=`,
          { method: 'DELETE', headers: { 'x-internal-token': INTERNAL_TOKEN } }
        ).catch(() => {})
        await db.hostingProject.delete({ where: { id: projectId } })
        await addLog('warn', 'hosting', `حذف مشروع ${username}/${project.name}`)
        return NextResponse.json({ ok: true })
      }
      default:
        return NextResponse.json({ error: 'عملية غير معروفة' }, { status: 400 })
    }
  } catch (e) {
    return authErrorResponse(e)
  }
}
