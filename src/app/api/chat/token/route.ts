import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { ensureSeed } from '@/lib/seed'
import { getSessionUser, signToken } from '@/lib/auth'

/**
 * Returns a JWT for the socket.io chat service (same credential as the cookie).
 * Only reachable by an authenticated browser session (cookie is httpOnly).
 */
export async function GET() {
  await ensureSeed()
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const token = await signToken({
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role as 'USER' | 'ADMIN' | 'OWNER',
  })
  return NextResponse.json({ token })
}
