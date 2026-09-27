import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { ensureSeed, addLog } from '@/lib/seed'
import { rateLimit, clientIp } from '@/lib/rate-limit'
import type { NextRequest } from 'next/server'

/**
 * VenomXNG — meta-search engine (SearXNG-inspired, built-in)
 * Aggregates: DuckDuckGo (HTML lite) + Wikipedia API
 * If VENOMXNG_URL env is set (a real SearXNG instance, see docker-compose.yml),
 * it is used as the primary upstream and normalized into the same format.
 */

interface SearchResult {
  title: string
  url: string
  snippet: string
  engine: string
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
}

function stripTags(s: string): string {
  return decodeEntities(s.replace(/<[^>]*>/g, '')).replace(/\s+/g, ' ').trim()
}

async function duckduckgo(q: string): Promise<SearchResult[]> {
  const res = await fetch('https://html.duckduckgo.com/html/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) VenomXNG/1.0',
    },
    body: `q=${encodeURIComponent(q)}`,
    signal: AbortSignal.timeout(10_000),
  })
  if (!res.ok) throw new Error(`DDG ${res.status}`)
  const html = await res.text()
  const out: SearchResult[] = []
  // result blocks: <a rel="nofollow" class="result__a" href="...">TITLE</a> ... <a class="result__snippet" ...>SNIP</a>
  const re = /<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g
  const snRe = /<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g
  const snippets: string[] = []
  let sm: RegExpExecArray | null
  while ((sm = snRe.exec(html))) snippets.push(stripTags(sm[1]))
  let m: RegExpExecArray | null
  let i = 0
  while ((m = re.exec(html)) && out.length < 15) {
    let url = m[1]
    // DDG redirects: //duckduckgo.com/l/?uddg=<real url>
    const uddg = /[?&]uddg=([^&]+)/.exec(url)
    if (uddg) url = decodeURIComponent(uddg[1])
    if (url.startsWith('//')) url = 'https:' + url
    const title = stripTags(m[2])
    if (!title || title.includes('Next page')) continue
    out.push({ title, url, snippet: snippets[i] || '', engine: 'duckduckgo' })
    i++
  }
  return out
}

async function wikipedia(lang: 'ar' | 'en', q: string): Promise<SearchResult[]> {
  try {
    const res = await fetch(
      `https://${lang}.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(q)}&format=json&srlimit=4`,
      { headers: { 'User-Agent': 'VenomXNG/1.0 (search; contact@venom.services)' }, signal: AbortSignal.timeout(8_000) }
    )
    if (!res.ok) return []
    const data = await res.json()
    const hits = data?.query?.search || []
    return hits.map((h: { title: string; snippet: string }) => ({
      title: h.title,
      url: `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(h.title.replace(/ /g, '_'))}`,
      snippet: stripTags(h.snippet),
      engine: `wikipedia-${lang}`,
    }))
  } catch {
    return []
  }
}

async function searxngUpstream(q: string): Promise<SearchResult[] | null> {
  const base = (process.env.VENOMXNG_URL || '').replace(/\/$/, '')
  if (!base) return null
  const res = await fetch(`${base}/search?q=${encodeURIComponent(q)}&format=json`, {
    headers: { 'User-Agent': 'VenomXNG/1.0' },
    signal: AbortSignal.timeout(10_000),
  })
  if (!res.ok) return null
  const data = await res.json()
  return (data.results || []).slice(0, 20).map((r: { title: string; url: string; content?: string; engines?: string[] }) => ({
    title: r.title,
    url: r.url,
    snippet: r.content || '',
    engine: (r.engines && r.engines[0]) || 'searxng',
  }))
}

export async function GET(req: NextRequest) {
  await ensureSeed()
  if (!rateLimit(`search:${clientIp(req)}`, 30, 60_000)) {
    return NextResponse.json({ error: 'طلبات بحث كثيرة — انتظر قليلاً' }, { status: 429 })
  }
  const q = (new URL(req.url).searchParams.get('q') || '').trim().slice(0, 200)
  if (!q) return NextResponse.json({ error: 'أدخل كلمة البحث' }, { status: 400 })

  try {
    let results = await searxngUpstream(q)
    let engines: string[] = []
    if (results) {
      engines = ['searxng']
    } else {
      const [ddg, wikiAr, wikiEn] = await Promise.allSettled([duckduckgo(q), wikipedia('ar', q), wikipedia('en', q)])
      results = []
      if (ddg.status === 'fulfilled' && ddg.value.length > 0) { results.push(...ddg.value); engines.push('duckduckgo') }
      if (wikiAr.status === 'fulfilled' && wikiAr.value.length > 0) { results.push(...wikiAr.value); engines.push('wikipedia-ar') }
      if (wikiEn.status === 'fulfilled' && wikiEn.value.length > 0) { results.push(...wikiEn.value); engines.push('wikipedia-en') }
    }

    // dedupe by url
    const seen = new Set<string>()
    results = results.filter((r) => {
      if (seen.has(r.url) || !r.title) return false
      seen.add(r.url)
      return true
    })

    await db.logEntry.create({
      data: { level: 'info', source: 'search', message: `بحث: ${q}`, meta: `${results.length} نتيجة` },
    }).catch(() => {})

    return NextResponse.json({ query: q, engines, count: results.length, results })
  } catch (e) {
    await addLog('error', 'search', `فشل البحث: ${q}`, String(e).slice(0, 120))
    return NextResponse.json({ error: 'فشل البحث — محركات البحث لا تستجيب، حاول لاحقاً' }, { status: 502 })
  }
}
