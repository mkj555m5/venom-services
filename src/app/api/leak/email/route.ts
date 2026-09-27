import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { ensureSeed, addLog } from '@/lib/seed'
import { rateLimit, clientIp } from '@/lib/rate-limit'
import type { NextRequest } from 'next/server'

const CACHE_DAYS = 7

/**
 * Venom Leak Check — EMAIL check
 * HIBP API v3 requires a paid API key (HIBP_API_KEY env var).
 * Results are cached in DB for 7 days.
 * Status colors: safe (green) | breached (red) — with details per breach.
 */
export async function POST(req: NextRequest) {
  await ensureSeed()
  if (!rateLimit(`leak-email:${clientIp(req)}`, 10, 60_000)) {
    return NextResponse.json({ error: 'محاولات كثيرة — انتظر قليلاً' }, { status: 429 })
  }

  const { email } = await req.json().catch(() => ({ email: '' }))
  const mail = String(email || '').trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) {
    return NextResponse.json({ error: 'صيغة البريد غير صحيحة' }, { status: 400 })
  }

  const apiKey = process.env.HIBP_API_KEY || ''
  if (!apiKey) {
    return NextResponse.json({
      error: 'HIBP_API_KEY غير مُضبوط — أضف مفتاح haveibeenpwned.com (اشتراك $3.5/شهر) في متغيرات البيئة',
      needKey: true,
    }, { status: 503 })
  }

  // ── 7-day cache ──
  const cached = await db.breachCache.findUnique({
    where: { kind_queryKey: { kind: 'email', queryKey: mail } },
  })
  if (cached && cached.expiresAt > new Date()) {
    return NextResponse.json({ ...JSON.parse(cached.result), cached: true })
  }

  try {
    const res = await fetch(
      `https://haveibeenpwned.com/api/v3/breachedaccount/${encodeURIComponent(mail)}?truncateResponse=false`,
      {
        headers: { 'hibp-api-key': apiKey, 'User-Agent': 'VenomServices-LeakCheck' },
        signal: AbortSignal.timeout(15_000),
      }
    )

    let result: Record<string, unknown>
    if (res.status === 404) {
      result = { kind: 'email', breaches: 0, safe: true, details: [] }
    } else if (res.status === 401) {
      return NextResponse.json({ error: 'مفتاح HIBP غير صالح — تحقق من HIBP_API_KEY' }, { status: 401 })
    } else if (res.status === 429) {
      return NextResponse.json({ error: 'تجاوزت حد الطلبات من HIBP — انتظر قليلاً' }, { status: 429 })
    } else if (!res.ok) {
      throw new Error(`HIBP API ${res.status}`)
    } else {
      const data = (await res.json()) as Array<{
        Name: string; Title: string; Domain: string; BreachDate: string;
        PwnCount: number; Description: string; DataClasses: string[]; Verified: boolean;
      }>
      result = {
        kind: 'email',
        breaches: data.length,
        safe: false,
        details: data
          .sort((a, b) => (a.BreachDate < b.BreachDate ? 1 : -1))
          .map((b) => ({
            name: b.Title || b.Name,
            domain: b.Domain,
            date: b.BreachDate,
            pwnCount: b.PwnCount,
            dataClasses: b.DataClasses || [],
            verified: b.Verified,
          })),
      }
    }

    await db.breachCache.upsert({
      where: { kind_queryKey: { kind: 'email', queryKey: mail } },
      update: { result: JSON.stringify(result), expiresAt: new Date(Date.now() + CACHE_DAYS * 86_400_000) },
      create: { kind: 'email', queryKey: mail, result: JSON.stringify(result), expiresAt: new Date(Date.now() + CACHE_DAYS * 86_400_000) },
    })
    await addLog('info', 'leak', `فحص بريد: ${mail.slice(0, 3)}*** — ${result.breaches} تسريب`)
    return NextResponse.json({ ...result, cached: false })
  } catch (e) {
    await addLog('error', 'leak', 'فشل فحص البريد', String(e).slice(0, 150))
    return NextResponse.json({ error: 'تعذر الاتصال بخدمة HIBP — حاول لاحقاً' }, { status: 502 })
  }
}
