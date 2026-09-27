import { NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { db } from '@/lib/db'
import { ensureSeed, addLog } from '@/lib/seed'
import { rateLimit, clientIp } from '@/lib/rate-limit'
import type { NextRequest } from 'next/server'

const CACHE_DAYS = 7

/**
 * Venom Leak Check — PASSWORD check
 * Uses Pwned Passwords k-anonymity range API (FREE — no API key needed):
 * we send only the first 5 chars of the SHA-1 hash; the service returns
 * all hashes with that prefix and we match the suffix locally.
 */
export async function POST(req: NextRequest) {
  await ensureSeed()
  if (!rateLimit(`leak-pw:${clientIp(req)}`, 20, 60_000)) {
    return NextResponse.json({ error: 'محاولات كثيرة — انتظر قليلاً' }, { status: 429 })
  }

  const { password } = await req.json().catch(() => ({ password: '' }))
  const pw = String(password || '')
  if (!pw) return NextResponse.json({ error: 'أدخل كلمة المرور للفحص' }, { status: 400 })
  if (pw.length < 4) return NextResponse.json({ error: 'كلمة المرور قصيرة جداً للفحص' }, { status: 400 })

  const sha1 = createHash('sha1').update(pw).digest('hex').toUpperCase()
  const prefix = sha1.slice(0, 5)
  const suffix = sha1.slice(5)
  const queryKey = createHash('sha256').update(sha1).digest('hex') // never store the hash itself

  // ── 7-day cache ──
  const cached = await db.breachCache.findUnique({
    where: { kind_queryKey: { kind: 'password', queryKey } },
  })
  if (cached && cached.expiresAt > new Date()) {
    return NextResponse.json({ ...JSON.parse(cached.result), cached: true })
  }

  try {
    const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: { 'User-Agent': 'VenomServices-LeakCheck' },
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) throw new Error(`HIBP range API ${res.status}`)
    const text = await res.text()
    let count = 0
    for (const line of text.split('\n')) {
      const [suf, cnt] = line.trim().split(':')
      if (suf === suffix) { count = parseInt(cnt, 10) || 0; break }
    }

    const result = {
      kind: 'password',
      breaches: count,
      safe: count === 0,
      // "suspect" if seen 1 time only — likely an old/small leak
      suspect: count > 0 && count <= 1,
    }
    await db.breachCache.upsert({
      where: { kind_queryKey: { kind: 'password', queryKey } },
      update: { result: JSON.stringify(result), expiresAt: new Date(Date.now() + CACHE_DAYS * 86_400_000) },
      create: { kind: 'password', queryKey, result: JSON.stringify(result), expiresAt: new Date(Date.now() + CACHE_DAYS * 86_400_000) },
    })
    await addLog('info', 'leak', `فحص كلمة مرور: ${count === 0 ? 'آمنة' : `مسربة (${count} مرة)`}`)
    return NextResponse.json({ ...result, cached: false })
  } catch (e) {
    await addLog('error', 'leak', `فشل فحص كلمة المرور`, String(e).slice(0, 150))
    return NextResponse.json({ error: 'تعذر الاتصال بخدمة Pwned Passwords — حاول لاحقاً' }, { status: 502 })
  }
}
