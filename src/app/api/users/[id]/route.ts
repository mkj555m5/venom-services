import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { requireOwner, authErrorResponse, OWNER_USERNAME } from '@/lib/auth'
import { addLog } from '@/lib/seed'

interface Params { params: Promise<{ id: string }> }

/** Update user: quotas / role / ban — owner only */
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const actor = await requireOwner()
    const { id } = await params
    const target = await db.user.findUnique({ where: { id } })
    if (!target) return NextResponse.json({ error: 'المستخدم غير موجود' }, { status: 404 })

    // ── OWNER account is immutable except by the owner himself ──
    if (target.username === OWNER_USERNAME && actor.id !== target.id) {
      return NextResponse.json({ error: 'حساب المالك ثابت — لا يمكن تعديله إلا من قبله' }, { status: 403 })
    }

    const body = await req.json().catch(() => ({}))
    const data: Record<string, unknown> = {}

    if (typeof body.ramMb === 'number' && body.ramMb >= -1) data.ramMb = Math.floor(body.ramMb)
    if (typeof body.diskMb === 'number' && body.diskMb >= -1) data.diskMb = Math.floor(body.diskMb)
    if (typeof body.projectLimit === 'number' && body.projectLimit >= -1) data.projectLimit = Math.floor(body.projectLimit)

    if (typeof body.banned === 'boolean') {
      if (target.role === 'OWNER') return NextResponse.json({ error: 'لا يمكن حظر المالك' }, { status: 403 })
      data.banned = body.banned
    }

    if (typeof body.role === 'string' && ['ADMIN', 'USER'].includes(body.role)) {
      if (target.role === 'OWNER') return NextResponse.json({ error: 'لا يمكن تغيير دور المالك' }, { status: 403 })
      data.role = body.role
    }

    // owner changing his own password/email
    if (actor.id === target.id && target.role === 'OWNER') {
      if (typeof body.password === 'string' && body.password.length >= 8) {
        const { hashPassword } = await import('@/lib/auth')
        data.passwordHash = await hashPassword(body.password)
      }
      if (typeof body.email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) {
        data.email = body.email.trim().toLowerCase()
      }
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'لا توجد تغييرات صالحة' }, { status: 400 })
    }

    const updated = await db.user.update({
      where: { id },
      data,
      select: { id: true, username: true, role: true, ramMb: true, diskMb: true, projectLimit: true, banned: true },
    })
    await addLog('warn', 'owner-panel', `تعديل المستخدم ${target.username}`, JSON.stringify(data).slice(0, 300))
    return NextResponse.json({ user: updated })
  } catch (e) {
    return authErrorResponse(e)
  }
}

/** Delete user (owner only) — owner account can never be deleted */
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const actor = await requireOwner()
    const { id } = await params
    const target = await db.user.findUnique({ where: { id } })
    if (!target) return NextResponse.json({ error: 'المستخدم غير موجود' }, { status: 404 })
    if (target.username === OWNER_USERNAME) {
      return NextResponse.json({ error: 'حساب المالك ثابت — لا يمكن حذفه' }, { status: 403 })
    }

    // ask hosting-service to wipe the user's project files
    try {
      const hs = process.env.HOSTING_SERVICE_URL || 'http://127.0.0.1:3031'
      await fetch(`${hs}/wipe/${encodeURIComponent(target.username)}`, {
        method: 'DELETE',
        headers: { 'x-internal-token': process.env.INTERNAL_TOKEN || 'venom-internal' },
      }).catch(() => {})
    } catch { /* best effort */ }

    await db.user.delete({ where: { id } })
    await addLog('warn', 'owner-panel', `حذف المستخدم ${target.username}`, `by=${actor.username}`)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return authErrorResponse(e)
  }
}

/** Get single user (staff) */
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    await requireStaff()
    const { id } = await params
    const user = await db.user.findUnique({
      where: { id },
      select: {
        id: true, username: true, email: true, role: true,
        ramMb: true, diskMb: true, projectLimit: true, banned: true, createdAt: true,
      },
    })
    if (!user) return NextResponse.json({ error: 'غير موجود' }, { status: 404 })
    return NextResponse.json({ user })
  } catch (e) {
    return authErrorResponse(e)
  }
}
