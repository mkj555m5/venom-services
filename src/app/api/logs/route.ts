import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { requireStaff, authErrorResponse } from '@/lib/auth'

/** Staff: system logs (owner + admins), paginated */
export async function GET(req: NextRequest) {
  try {
    await requireStaff()
    const url = new URL(req.url)
    const take = Math.min(parseInt(url.searchParams.get('take') || '100', 10), 300)
    const level = url.searchParams.get('level') || undefined
    const logs = await db.logEntry.findMany({
      where: level ? { level } : undefined,
      orderBy: { createdAt: 'desc' },
      take,
    })
    return NextResponse.json({ logs })
  } catch (e) {
    return authErrorResponse(e)
  }
}
