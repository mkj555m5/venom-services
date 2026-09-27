import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { requireUser, authErrorResponse } from '@/lib/auth'

const HS = process.env.HOSTING_SERVICE_URL || 'http://127.0.0.1:3031'
const INTERNAL_TOKEN = process.env.INTERNAL_TOKEN || 'venom-internal'
const UPLOAD_MAX_BYTES = 22 * 1024 * 1024

async function ownership(user: { id: string; role: string }, projectId: string) {
  const project = await db.hostingProject.findUnique({ where: { id: projectId } })
  if (!project) return { error: 'المشروع غير موجود', status: 404 as const }
  if (project.ownerId !== user.id && user.role === 'USER') return { error: 'هذا المشروع ليس لك', status: 403 as const }
  const ownerRec = await db.user.findUnique({ where: { id: project.ownerId } })
  return { username: ownerRec?.username || '', name: project.name }
}

/** GET /api/hosting/files?projectId=&path= — list directory */
export async function GET(req: NextRequest) {
  try {
    const user = await requireUser()
    const sp = new URL(req.url).searchParams
    const o = await ownership(user, sp.get('projectId') || '')
    if ('error' in o) return NextResponse.json({ error: o.error }, { status: o.status })
    const rel = String(sp.get('path') || '').replace(/^\/+/, '')
    const r = await fetch(
      `${HS}/files?username=${encodeURIComponent(o.username)}&name=${encodeURIComponent(o.name)}&path=${encodeURIComponent(rel)}`,
      { headers: { 'x-internal-token': INTERNAL_TOKEN }, signal: AbortSignal.timeout(6000) }
    )
    const data = await r.json().catch(() => ({ files: [] }))
    return NextResponse.json({ files: data.files || [], path: rel })
  } catch (e) {
    return authErrorResponse(e)
  }
}

/**
 * POST /api/hosting/files
 * body: { projectId, path, contentB64 } → upload/write file (disk quota enforced)
 * body: { projectId, path, read: true } → read small file
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser()
    const body = await req.json().catch(() => ({}))
    const o = await ownership(user, String(body.projectId || ''))
    if ('error' in o) return NextResponse.json({ error: o.error }, { status: o.status })
    const rel = String(body.path || '').replace(/^\/+/, '')
    if (!rel || rel.includes('..')) return NextResponse.json({ error: 'مسار غير صالح' }, { status: 400 })

    // ── read file ──
    if (body.read) {
      const r = await fetch(
        `${HS}/files/read?username=${encodeURIComponent(o.username)}&name=${encodeURIComponent(o.name)}&path=${encodeURIComponent(rel)}`,
        { headers: { 'x-internal-token': INTERNAL_TOKEN }, signal: AbortSignal.timeout(6000) }
      )
      const data = await r.json().catch(() => ({}))
      return NextResponse.json(data)
    }

    // ── write/upload with DISK QUOTA check ──
    const contentB64 = String(body.contentB64 || '')
    const sizeBytes = Math.floor(contentB64.length * 0.75)
    if (sizeBytes > UPLOAD_MAX_BYTES) {
      return NextResponse.json({ error: 'حجم الملف يتجاوز 22MB' }, { status: 413 })
    }

    const ownerRec = await db.user.findUnique({ where: { id: (await db.hostingProject.findUnique({ where: { id: String(body.projectId || '') } }))?.ownerId || '' } })
    if (ownerRec && ownerRec.diskMb >= 0) {
      const u = await fetch(
        `${HS}/usage?username=${encodeURIComponent(o.username)}`,
        { headers: { 'x-internal-token': INTERNAL_TOKEN }, signal: AbortSignal.timeout(8000) }
      )
      const usage = await u.json().catch(() => ({ diskMb: 0 }))
      if ((usage.diskMb || 0) * 1048576 + sizeBytes > ownerRec.diskMb * 1048576) {
        return NextResponse.json(
          { error: `تجاوزت حصة المساحة (${ownerRec.diskMb}MB) — المساحة الحالية ${usage.diskMb}MB` },
          { status: 403 }
        )
      }
    }

    const r = await fetch(`${HS}/files/write`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-internal-token': INTERNAL_TOKEN },
      body: JSON.stringify({ username: o.username, name: o.name, path: rel, contentB64 }),
      signal: AbortSignal.timeout(30_000),
    })
    const data = await r.json().catch(() => ({}))
    if (!r.ok) return NextResponse.json({ error: data.error || 'فشل رفع الملف' }, { status: 502 })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return authErrorResponse(e)
  }
}

/** DELETE /api/hosting/files?projectId=&path= */
export async function DELETE(req: NextRequest) {
  try {
    const user = await requireUser()
    const sp = new URL(req.url).searchParams
    const o = await ownership(user, sp.get('projectId') || '')
    if ('error' in o) return NextResponse.json({ error: o.error }, { status: o.status })
    const rel = String(sp.get('path') || '').replace(/^\/+/, '')
    if (!rel || rel.includes('..')) return NextResponse.json({ error: 'مسار غير صالح' }, { status: 400 })
    const r = await fetch(
      `${HS}/files?username=${encodeURIComponent(o.username)}&name=${encodeURIComponent(o.name)}&path=${encodeURIComponent(rel)}`,
      { method: 'DELETE', headers: { 'x-internal-token': INTERNAL_TOKEN }, signal: AbortSignal.timeout(6000) }
    )
    return NextResponse.json({ ok: r.ok })
  } catch (e) {
    return authErrorResponse(e)
  }
}
