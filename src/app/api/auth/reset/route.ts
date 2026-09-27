import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { ensureSeed, addLog } from '@/lib/seed'
import { rateLimit, clientIp } from '@/lib/rate-limit'
import type { NextRequest } from 'next/server'

/**
 * Password reset: request a temporary code.
 * SMTP (nodemailer) is used only if SMTP_URL is configured — otherwise the
 * code is delivered to the system logs (visible to the owner) for demo setups.
 */
export async function POST(req: NextRequest) {
  await ensureSeed()
  const ip = clientIp(req)
  if (!rateLimit(`reset:${ip}`, 5, 60_000)) {
    return NextResponse.json({ error: 'محاولات كثيرة — انتظر دقيقة' }, { status: 429 })
  }

  const { email } = await req.json().catch(() => ({ email: '' }))
  const mail = String(email || '').trim().toLowerCase()
  if (!mail) return NextResponse.json({ error: 'أدخل بريدك الإلكتروني' }, { status: 400 })

  const user = await db.user.findUnique({ where: { email: mail } })

  // Always answer OK (no email enumeration)
  if (user) {
    const code = String(Math.floor(100000 + Math.random() * 900000))
    await db.resetCode.create({
      data: { email: mail, code, expiresAt: new Date(Date.now() + 15 * 60_000) },
    })

    const smtpUrl = process.env.SMTP_URL || ''
    let sentVia = 'logs'
    if (smtpUrl) {
      try {
        const nodemailer = await import('nodemailer')
        const transport = nodemailer.createTransport(smtpUrl)
        await transport.sendMail({
          from: process.env.SMTP_FROM || 'Venom Services <no-reply@venom.services>',
          to: mail,
          subject: 'Venom Services — رمز استعادة كلمة المرور',
          text: `رمز الاستعادة الخاص بك: ${code}\nصالح لمدة 15 دقيقة.`,
        })
        sentVia = 'email'
      } catch (e) {
        await addLog('error', 'smtp', `فشل إرسال بريد الاستعادة إلى ${mail}`, String(e).slice(0, 200))
      }
    }
    if (sentVia === 'logs') {
      await addLog('warn', 'auth', `رمز استعادة كلمة المرور لـ ${mail}: ${code} (لم يُضبط SMTP_URL — الرمز في السجلات)`)
    }
  }

  return NextResponse.json({ ok: true, message: 'إن كان البريد مسجلاً لدينا فسيصلك رمز الاستعادة (أو راجع سجلات النظام إن لم يُضبط البريد)' })
}

/** Confirm reset with code + new password */
export async function PUT(req: NextRequest) {
  await ensureSeed()
  const ip = clientIp(req)
  if (!rateLimit(`reset-c:${ip}`, 10, 60_000)) {
    return NextResponse.json({ error: 'محاولات كثيرة — انتظر دقيقة' }, { status: 429 })
  }
  const { email, code, password } = await req.json().catch(() => ({}))
  const mail = String(email || '').trim().toLowerCase()
  if (!mail || !code || !password) return NextResponse.json({ error: 'بيانات ناقصة' }, { status: 400 })
  if (password.length < 8) return NextResponse.json({ error: 'كلمة المرور قصيرة جداً' }, { status: 400 })

  const rec = await db.resetCode.findFirst({
    where: { email: mail, used: false, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: 'desc' },
  })
  if (!rec || rec.code !== String(code)) {
    return NextResponse.json({ error: 'الرمز غير صحيح أو منتهي الصلاحية' }, { status: 400 })
  }

  const { hashPassword } = await import('@/lib/auth')
  const user = await db.user.findUnique({ where: { email: mail } })
  if (!user) return NextResponse.json({ error: 'حساب غير موجود' }, { status: 404 })
  if (user.role === 'OWNER') {
    return NextResponse.json({ error: 'لا يمكن استعادة كلمة مرور المالك عبر البريد — يغيّرها بنفسه من لوحته' }, { status: 403 })
  }

  await db.resetCode.update({ where: { id: rec.id }, data: { used: true } })
  await db.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(password) } })
  await addLog('security', 'auth', `استعادة كلمة مرور ناجحة: ${user.username}`, `ip=${ip}`)

  return NextResponse.json({ ok: true, message: 'تم تغيير كلمة المرور — سجّل الدخول الآن' })
}
