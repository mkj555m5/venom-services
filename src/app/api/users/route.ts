import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { requireStaff, authErrorResponse } from '@/lib/auth'
import { addLog } from '@/lib/seed'

/** List all users (owner + admins) */
export async function GET() {
  try {
    await requireStaff()
    const users = await db.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, username: true, email: true, role: true,
        ramMb: true, diskMb: true, projectLimit: true,
        banned: true, emailVerified: true, createdAt: true,
        _count: { select: { projects: true, chatMessages: true } },
      },
    })
    return NextResponse.json({ users })
  } catch (e) {
    return authErrorResponse(e)
  }
}
