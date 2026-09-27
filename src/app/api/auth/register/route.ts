import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { ensureSeed, addLog } from '@/lib/seed'
import { hashPassword, signToken, TOKEN_COOKIE, OWNER_USERNAME } from '@/lib/auth'
import { rateLimit, clientIp } from '@/lib/rate-limit'
import type { NextRequest } from 'next/server'

export async function POST(req: NextRequest) {
  await ensureSeed()
  const ip = clientIp(req)
  if (!rateLimit(`register:${ip}`, 5, 60_000)) {
    return NextResponse.json({ error: 'محاولات كثيرة — انتظر دقيقة' }, { status: 429 })
  }

  let body: { username?: string; email?: string; password?: string; confirm?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'طلب غير صالح' }, { status: 400 })
  }

  const username = (body.username || '').trim()
  const email = (body.email || '').trim().toLowerCase()
  const password = body.password || ''

  // ── Input validation / sanitization ──
  if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
    return NextResponse.json({ error: 'اسم المستخدم: 3-20 حرفاً إنجليزياً/أرقام/شرطة سفلية' }, { status: 400 })
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'صيغة البريد الإلكتروني غير صحيحة' }, { status: 400 })
  }
  if (password.length < 8) {
    return NextResponse.json({ error: 'كلمة المرور يجب أن تكون 8 أحرف على الأقل' }, { status: 400 })
  }
  if (body.confirm !== undefined && body.confirm !== password) {
    return NextResponse.json({ error: 'كلمتا المرور غير متطابقتين' }, { status: 400 })
  }
  if (username.toLowerCase() === OWNER_USERNAME.toLowerCase()) {
    return NextResponse.json({ error: 'اسم المستخدم محجوز' }, { status: 400 })
  }

  const exists = await db.user.findFirst({
    where: { OR: [{ username }, { email }] },
  })
  if (exists) {
    return NextResponse.json(
      { error: exists.username === username ? 'اسم المستخدم مستخدم بالفعل' : 'البريد الإلكتروني مسجل بالفعل' },
      { status: 409 }
    )
  }

  const user = await db.user.create({
    data: {
      username,
      email,
      passwordHash: await hashPassword(password),
      role: 'USER',
    },
  })

  await addLog('info', 'auth', `تسجيل مستخدم جديد: ${username}`, `email=${email}`)

  const token = await signToken({ id: user.id, username: user.username, email: user.email, role: 'USER' })
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
