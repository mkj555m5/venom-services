import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { rateLimit } from '@/lib/rate-limit'

/**
 * Internal endpoint — called by the chat socket mini-service to persist messages.
 * Protected by INTERNAL_TOKEN (never exposed to browsers).
 */
export async function POST(req: NextRequest) {
  if ((req.headers.get('x-internal-token') || '') !== (process.env.INTERNAL_TOKEN || 'venom-internal')) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  if (!rateLimit('chat-persist', 300, 60_000)) {
    return NextResponse.json({ error: 'slow down' }, { status: 429 })
  }

  const { room, username, role, content } = await req.json().catch(() => ({}))
  const r = String(room || '').slice(0, 60)
  const u = String(username || '').slice(0, 40)
  const c = String(content || '').slice(0, 1000)
  if (!r || !u || !c) return NextResponse.json({ error: 'bad payload' }, { status: 400 })

  await db.chatMessage.create({
    data: { room: r, username: u, role: String(role || 'USER'), content: c },
  })
  return NextResponse.json({ ok: true })
}
