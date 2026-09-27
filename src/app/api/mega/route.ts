import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { ensureSeed, addLog } from '@/lib/seed'
import { rateLimit, clientIp } from '@/lib/rate-limit'

/**
 * Venom MEGA — resolves public mega.nz links through the deployed
 * MEGA-INDEX-CLOUDFLARE worker (MEGA_INDEX_URL / CLOUDFLARE_WORKER_URL env).
 *
 * Supported inputs:
 *   https://mega.nz/file/HANDLE#KEY        → direct file
 *   https://mega.nz/folder/HANDLE#KEY      → folder tree (file list)
 *   https://mega.nz/fb/HANDLE/KEY (raw)    → folder tree
 *
 * The worker endpoints used (from the reference worker.js):
 *   /p/<handle>/<key>            folder index (HTML UI)
 *   /p/<handle>/<key>/list?json  not available → we parse the UI JSON via /api path
 *   /pf/<handle>/<key>/download  single file bytes
 * Here we simply PROXY to the worker's page endpoints and extract a file list
 * from its JSON-friendly paths; downloads stream straight from the worker URL.
 */

function parseMegaLink(input: string) {
  const s = input.trim()
  let m = /^https?:\/\/mega\.nz\/file\/([a-zA-Z0-9_-]+)[#!]([a-zA-Z0-9_-]+)/.exec(s)
  if (m) return { type: 'file' as const, handle: m[1], key: m[2] }
  m = /^https?:\/\/mega\.nz\/folder\/([a-zA-Z0-9_-]+)[#!]([a-zA-Z0-9_-]+)/.exec(s)
  if (m) return { type: 'folder' as const, handle: m[1], key: m[2] }
  m = /^https?:\/\/mega\.nz\/fb\/([a-zA-Z0-9_-]+)\/([a-zA-Z0-9_-]+)/.exec(s)
  if (m) return { type: 'folder' as const, handle: m[1], key: m[2] }
  m = /^https?:\/\/mega\.nz\/(?:embed)?\/([a-zA-Z0-9_-]+)[#!]([a-zA-Z0-9_-]+)/.exec(s)
  if (m) return { type: 'file' as const, handle: m[1], key: m[2] }
  return null
}

export async function POST(req: NextRequest) {
  await ensureSeed()
  if (!rateLimit(`mega:${clientIp(req)}`, 15, 60_000)) {
    return NextResponse.json({ error: 'محاولات كثيرة — انتظر قليلاً' }, { status: 429 })
  }

  const { url } = await req.json().catch(() => ({ url: '' }))
  const parsed = parseMegaLink(String(url || ''))
  if (!parsed) {
    return NextResponse.json({
      error: 'رابط MEGA غير صالح — الصيغ المدعومة: mega.nz/file/…#… أو mega.nz/folder/…#…',
    }, { status: 400 })
  }

  const worker = (process.env.MEGA_INDEX_URL || process.env.CLOUDFLARE_WORKER_URL || '').replace(/\/$/, '')
  if (!worker) {
    return NextResponse.json({
      error: 'لم يتم ربط عامل MEGA بعد',
      help: 'انشر services/mega/worker.js على Cloudflare Workers ثم ضع الرابط في متغير MEGA_INDEX_URL (شرح كامل داخل الصفحة وREADME)',
      needWorker: true,
    }, { status: 503 })
  }

  try {
    if (parsed.type === 'file') {
      const downloadUrl = `${worker}/pf/${parsed.handle}/${parsed.key}/download`
      return NextResponse.json({
        type: 'file',
        name: 'MEGA File',
        downloadUrl,
        worker,
      })
    }

    // folder → fetch worker UI page and extract embedded tree JSON
    const pageRes = await fetch(`${worker}/p/${parsed.handle}/${parsed.key}`, {
      headers: { 'User-Agent': 'VenomServices-MEGA' },
      signal: AbortSignal.timeout(20_000),
    })
    if (!pageRes.ok) throw new Error(`worker ${pageRes.status}`)
    const html = await pageRes.text()

    // The reference worker embeds the tree as JSON inside the rendered page.
    // Look for "__TREE__" style JSON or parse anchor hrefs /download/<hash>
    const files: Array<{ name: string; hash: string; size: string; downloadUrl: string }> = []
    const linkRe = /href="([^"]*\/download\/([a-zA-Z0-9_-]+))"/g
    let lm: RegExpExecArray | null
    while ((lm = linkRe.exec(html)) && files.length < 100) {
      files.push({
        name: `file-${lm[2].slice(0, 10)}`,
        hash: lm[2],
        size: '',
        downloadUrl: lm[1].startsWith('http') ? lm[1] : `${worker}${lm[1]}`,
      })
    }

    // try to also extract names/sizes from embedded JSON if present
    const jsonMatch = /const\s+TREE\s*=\s*(\{[\s\S]*?\});/.exec(html)
    if (jsonMatch) {
      try {
        const tree = JSON.parse(jsonMatch[1])
        const nodes = tree?.nodes || {}
        for (const f of files) {
          const node = Object.values(nodes).find((n: unknown) => (n as { hash?: string }).hash === f.hash) as { name?: string; size?: number } | undefined
          if (node?.name) f.name = node.name
          if (node?.size) f.size = `${(node.size / 1048576).toFixed(2)} MB`
        }
      } catch { /* keep defaults */ }
    }

    return NextResponse.json({ type: 'folder', count: files.length, files, worker })
  } catch (e) {
    await addLog('error', 'mega', `فشل حل رابط MEGA`, String(e).slice(0, 120))
    return NextResponse.json({ error: 'تعذر الوصول لعامل MEGA — تحقق من MEGA_INDEX_URL' }, { status: 502 })
  }
}
