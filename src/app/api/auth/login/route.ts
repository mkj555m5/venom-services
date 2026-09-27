import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { ensureSeed, addLog } from '@/lib/seed'
import { verifyPassword, signToken, TOKEN_COOKIE } from '@/lib/auth'
import { rateLimit, clientIp } from '@/lib/rate-limit'
import type { NextRequest } from 'next/server'

export async function POST(req: NextRequest) {
  await ensureSeed()
  const ip = clientIp(req)
  if (!rateLimit(`login:${ip}`, 10, 60_000)) {
    await addLog('security', 'auth', `محاولات دخول متكررة من ${ip}`)
    return NextResponse.json({ error: 'محاولات كثيرة — انتظر دقيقة' }, { status: 429 })
  }

  let body: { username?: string; password?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'طلب غير صالح' }, { status: 400 })
  }

  const username = (body.username || '').trim()
  const password = body.password || ''
  if (!username || !password) {
    return NextResponse.json({ error: 'أدخل اسم المستخدم وكلمة المرور' }, { status: 400 })
  }

  const user = await db.user.findUnique({ where: { username } })
  // uniform error to prevent user enumeration
  const badCreds = { error: 'اسم المستخدم أو كلمة المرور غير صحيحة' }
  if (!user) return NextResponse.json(badCreds, { status: 401 })

  const ok = await verifyPassword(password, user.passwordHash)
  if (!ok) {
    await addLog('security', 'auth', `فشل تسجيل دخول: ${username}`, `ip=${ip}`)
    return NextResponse.json(badCreds, { status: 401 })
  }
  if (user.banned) {
    return NextResponse.json({ error: 'هذا الحساب محظور — تواصل مع المالك' }, { status: 403 })
  }

  await addLog('info', 'auth', `تسجيل دخول: ${username}`, `ip=${ip}`)

  const token = await signToken({
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role as 'USER' | 'ADMIN' | 'OWNER',
  })
  const res = NextResponse.json({
    user: { id: user.id, username: user.username, email: user.email, role: user.role },
  })
  res.cookies.set(TOKEN_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 7 * 24 * 3600,
    path: '/',
  })
  return res
}
