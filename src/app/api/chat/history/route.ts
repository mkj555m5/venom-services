import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { requireUser, authErrorResponse } from '@/lib/auth'

/** GET /api/chat/history?room=general&before=<iso> — last 80 messages */
export async function GET(req: NextRequest) {
  try {
    await requireUser()
    const sp = new URL(req.url).searchParams
    const room = String(sp.get('room') || 'general').slice(0, 60)
    const messages = await db.chatMessage.findMany({
      where: { room },
      orderBy: { createdAt: 'desc' },
      take: 80,
    })
    return NextResponse.json({
      messages: messages.reverse().map((m) => ({
        id: m.id,
        username: m.username || '[محذوف]',
        role: m.role,
        content: m.content,
        at: m.createdAt.getTime(),
      })),
    })
  } catch (e) {
    return authErrorResponse(e)
  }
}
