// ─────────────────────────────────────────────
//  VENOM HOSTING SERVICE (port 3031)
//  Process + file manager for user projects.
//  Inspired by Gojgui panel concepts (quotas, PTY console, RAM monitor)
//  rewritten from scratch for Bun — NO old code/design carried over.
//
//  Security: internal token header required on every request.
//  All paths are sanitized (no traversal).
// ─────────────────────────────────────────────

import fs from 'node:fs'
import pathMod from 'node:path'

const PORT = Number(process.env.HOSTING_PORT || 3031)
const TOKEN = process.env.INTERNAL_TOKEN || 'venom-internal'
const DATA_ROOT = process.env.HOSTING_DATA_DIR || '/home/z/my-project/hosting_data'

const MAX_LOG_CHARS = 120_000
const UPLOAD_MAX_B64 = 30 * 1024 * 1024 // ~30MB encoded → ~22MB file

// procKey → process info
const procs = new Map<string, {
  proc: ReturnType<typeof Bun.spawn>
  username: string
  name: string
  port: number
  startedAt: number
  ramMb: number
  limitMb: number
  status: 'running' | 'stopped' | 'crashed'
  exitCode: number | null
}>()

// ── helpers ──────────────────────────────────
function ok(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })
}
function err(message: string, status = 400) {
  return new Response(JSON.stringify({ error: message }), { status, headers: { 'Content-Type': 'application/json' } })
}
function authorized(req: Request): boolean {
  return (req.headers.get('x-internal-token') || '') === TOKEN
}
function safeName(s: string): string {
  return /^[a-zA-Z0-9_-]{1,40}$/.test(s) ? s : ''
}
/** relative path inside a project — blocks traversal */
function safeRel(p: string): string {
  const cleaned = (p || '').replace(/\\/g, '/').split('/').filter((seg) => seg && seg !== '.' && seg !== '..')
  return cleaned.join('/')
}
function projectDir(username: string, name: string): string {
  return `${DATA_ROOT}/${safeName(username)}/${safeName(name)}`
}
export function procKeyOf(username: string, name: string): string {
  return `${safeName(username)}::${safeName(name)}`
}

async function dirSizeMb(dir: string): Promise<number> {
  let total = 0
  const walk = (d: string) => {
    let entries: string[] = []
    try { entries = fs.readdirSync(d) } catch { return }
    for (const e of entries) {
      const full = `${d}/${e}`
      let st
      try { st = fs.statSync(full) } catch { continue }
      if (st.isDirectory()) walk(full)
      else total += st.size
    }
  }
  try { walk(dir) } catch { /* missing dir */ }
  return Math.round((total / 1048576) * 100) / 100
}

function logFile(username: string, name: string): string {
  return `${projectDir(username, name)}/.venom-console.log`
}

async function appendLog(username: string, name: string, text: string) {
  const f = logFile(username, name)
  let prev = ''
  try { prev = await Bun.file(f).text() } catch { /* new */ }
  let next = (prev + text).slice(-MAX_LOG_CHARS)
  await Bun.write(f, next)
}

async function readLogTail(username: string, name: string, maxChars = 40_000): Promise<string> {
  try {
    const t = await Bun.file(logFile(username, name)).text()
    return t.slice(-maxChars)
  } catch { return '' }
}

// ── RAM monitor (Gojgui-style: watch /proc, kill over quota) ──
async function ramMonitor(key: string) {
  const info = procs.get(key)
  if (!info) return
  const pid = info.proc.pid
  const read = async (): Promise<number> => {
    try {
      const st = await Bun.file(`/proc/${pid}/status`).text()
      const m = /VmRSS:\s+(\d+) kB/.exec(st)
      return m ? Math.round(parseInt(m[1], 10) / 1024) : 0
    } catch { return 0 }
  }
  while (procs.get(key) === info) {
    const rss = await read()
    info.ramMb = rss
    if (info.limitMb > 0 && rss > info.limitMb) {
      await appendLog(info.username, info.name,
        `\r\n\u001b[31m[VENOM] تجاوز حد الذاكرة (${rss}MB > ${info.limitMb}MB) — تم إنهاء المشروع\u001b[0m\r\n`)
      try { process.kill(-pid, 'SIGKILL') } catch { try { info.proc.kill() } catch { /* gone */ } }
      info.status = 'crashed'
      procs.delete(key)
      return
    }
    await new Promise((r) => setTimeout(r, 3000))
  }
}

// ── orphan sweep at boot (processes from previous service run) ──
function sweepOrphans() {
  try {
      for (const pid of fs.readdirSync('/proc').filter((p: string) => /^\d+$/.test(p))) {
      try {
        const env = fs.readFileSync(`/proc/${pid}/environ`, 'utf8')
        if (env.includes('VENOM_PROJECT=1')) {
          process.kill(parseInt(pid, 10), 'SIGKILL')
          console.log(`[sweep] killed orphan ${pid}`)
        }
      } catch { /* can't read → skip */ }
    }
  } catch { /* ignore */ }
}

// ── starter templates ────────────────────────
const PY_MAIN = `# Venom Hosting — Python project
import os, http.server, socketserver

PORT = int(os.environ.get("PORT", "8080"))

class Handler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path == "/":
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.end_headers()
            self.wfile.write("<h1>🐍 مشروع بايثون يعمل على Venom Hosting!</h1>".encode())

if __name__ == "__main__":
    with socketserver.TCPServer(("", PORT), Handler) as httpd:
        print(f"Serving on port {PORT}")
        httpd.serve_forever()
`
const PY_REQ = `# أضف حزم بايثون هنا مثال:
# flask==3.0.0
`
const NODE_MAIN = `// Venom Hosting — Node.js project
const http = require("http");
const PORT = process.env.PORT || 8080;

http.createServer((req, res) => {
  if (req.url === "/") {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end("<h1>🟩 مشروع Node.js يعمل على Venom Hosting!</h1>");
  } else {
    res.writeHead(404); res.end("Not found");
  }
}).listen(PORT, () => console.log("Serving on port " + PORT));
`
const NODE_PKG = {
  name: "venom-node-project",
  version: "1.0.0",
  private: true,
  scripts: { start: "bun main.js" },
}

async function createProject(username: string, name: string, language: string) {
  const dir = projectDir(username, name)
  if (fs.existsSync(dir)) return err('يوجد مشروع بهذا الاسم بالفعل', 409)
  fs.mkdirSync(dir, { recursive: true })

  let entry = 'main.py'
  if (language === 'python') {
    await Bun.write(`${dir}/main.py`, PY_MAIN)
    await Bun.write(`${dir}/requirements.txt`, PY_REQ)
  } else if (language === 'node') {
    entry = 'main.js'
    await Bun.write(`${dir}/main.js`, NODE_MAIN)
    await Bun.write(`${dir}/package.json`, JSON.stringify(NODE_PKG, null, 2))
  } else {
    return err('اللغة غير مدعومة (python | node)')
  }
  await Bun.write(`${dir}/.venom-meta.json`, JSON.stringify({ language, entry, createdAt: new Date().toISOString() }))
  return ok({ created: true, entry, language })
}

// next free port for the project process (bound INSIDE the sandbox only)
function nextPort(): number {
  const used = new Set(Array.from(procs.values()).map((p) => p.port))
  for (let p = 3101; p < 3300; p++) if (!used.has(p)) return p
  return 0
}

async function startProject(username: string, name: string, entry: string, ramLimitMb: number) {
  const key = procKeyOf(username, name)
  if (procs.has(key)) return err('المشروع يعمل بالفعل', 409)
  const dir = projectDir(username, name)
  if (!fs.existsSync(dir)) return err('المشروع غير موجود', 404)

  const meta = await Bun.file(`${dir}/.venom-meta.json`).json().catch(() => null)
  const language = meta?.language || (entry.endsWith('.js') ? 'node' : 'python')
  const entryFile = entry || meta?.entry || (language === 'python' ? 'main.py' : 'main.js')
  const port = nextPort()
  if (!port) return err('لا توجد منافذ متاحة حالياً', 503)

  await appendLog(username, name, `\r\n\u001b[36m[VENOM] بدء التشغيل (${language}) — ${new Date().toLocaleString('ar-EG')}\u001b[0m\r\n`)

  const isPy = language === 'python'
  const cmd = isPy ? ['python3', entryFile] : ['bun', entryFile]

  const proc = Bun.spawn(cmd, {
    cwd: dir,
    env: {
      ...process.env,
      PORT: String(port),
      VENOM_PROJECT: '1',
      PYTHONUNBUFFERED: '1',
      FORCE_COLOR: '1',
    },
    stdout: 'pipe',
    stderr: 'pipe',
  })

  const info = {
    proc, username, name, port, startedAt: Date.now(),
    ramMb: 0, limitMb: ramLimitMb, status: 'running' as const, exitCode: null,
  }
  procs.set(key, info)

  const pump = async (stream: ReadableStream<Uint8Array> | undefined) => {
    if (!stream) return
    const reader = stream.getReader()
    const dec = new TextDecoder()
    try {
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        await appendLog(username, name, dec.decode(value))
      }
    } catch { /* closed */ }
  }
  pump(proc.stdout)
  pump(proc.stderr)

  proc.exited.then((code) => {
    const cur = procs.get(key)
    if (cur === info) {
      info.status = code === 0 ? 'stopped' : 'crashed'
      info.exitCode = code
      appendLog(username, name, `\r\n\u001b[33m[VENOM] انتهت العملية (code ${code})\u001b[0m\r\n`)
      procs.delete(key)
    }
  })

  ramMonitor(key) // fire & forget
  return ok({ started: true, port })
}

async function stopProject(username: string, name: string) {
  const key = procKeyOf(username, name)
  const info = procs.get(key)
  if (!info) return ok({ stopped: true, wasRunning: false })
  try { process.kill(-info.proc.pid, 'SIGKILL') } catch { try { info.proc.kill() } catch { /* gone */ } }
  procs.delete(key)
  await appendLog(username, name, `\r\n\u001b[31m[VENOM] أوقف المستخدم المشروع\u001b[0m\r\n`)
  return ok({ stopped: true, wasRunning: true })
}

// ── router ───────────────────────────────────
const server = Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url)
    const path = url.pathname
    const method = req.method

    if (path === '/health') return ok({ ok: true, service: 'venom-hosting', projects: procs.size })
    if (!authorized(req)) return err('unauthorized', 401)

    try {
      // ── create ──
      if (method === 'POST' && path === '/create') {
        const b = await req.json()
        const username = safeName(b.username || '')
        const name = safeName(b.name || '')
        if (!username || !name) return err('بيانات غير صالحة')
        return await createProject(username, name, b.language)
      }

      // ── process actions ──
      if (method === 'POST' && path === '/start') {
        const b = await req.json()
        return await startProject(safeName(b.username || ''), safeName(b.name || ''), String(b.entry || ''), Number(b.ramLimitMb || 0))
      }
      if (method === 'POST' && path === '/stop') {
        const b = await req.json()
        return await stopProject(safeName(b.username || ''), safeName(b.name || ''))
      }
      if (method === 'GET' && path === '/status') {
        const username = safeName(url.searchParams.get('username') || '')
        const name = safeName(url.searchParams.get('name') || '')
        const info = procs.get(procKeyOf(username, name))
        const diskMb = await dirSizeMb(projectDir(username, name))
        if (!info) return ok({ status: 'stopped', ramMb: 0, diskMb, port: 0 })
        return ok({ status: info.status, ramMb: info.ramMb, diskMb, port: info.port, startedAt: info.startedAt })
      }
      if (method === 'GET' && path === '/logs') {
        const username = safeName(url.searchParams.get('username') || '')
        const name = safeName(url.searchParams.get('name') || '')
        const max = Math.min(parseInt(url.searchParams.get('max') || '30000', 10), MAX_LOG_CHARS)
        return ok({ log: await readLogTail(username, name, max) })
      }
      if (method === 'POST' && path === '/logs/clear') {
        const b = await req.json()
        const dir = projectDir(safeName(b.username || ''), safeName(b.name || ''))
        await Bun.write(`${dir}/.venom-console.log`, '')
        return ok({ cleared: true })
      }

      // ── package install ──
      if (method === 'POST' && path === '/install') {
        const b = await req.json()
        const username = safeName(b.username || '')
        const name = safeName(b.name || '')
        const dir = projectDir(username, name)
              const isPy = fs.existsSync(`${dir}/requirements.txt`)
        await appendLog(username, name, `\r\n\u001b[36m[VENOM] تثبيت الحزم...\u001b[0m\r\n`)
        const cmd = isPy
          ? ['python3', '-m', 'pip', 'install', '-r', 'requirements.txt', '--no-warn-script-location']
          : ['bun', 'install']
        const p = Bun.spawn(cmd, { cwd: dir, stdout: 'pipe', stderr: 'pipe', env: { ...process.env, FORCE_COLOR: '0' } })
        const out = await new Response(p.stdout).text()
        const errOut = await new Response(p.stderr).text()
        const code = await p.exited
        await appendLog(username, name, (out + errOut).slice(-8000) + `\r\n\u001b[${code === 0 ? 32 : 31}m[VENOM] اكتمل التثبيت (code ${code})\u001b[0m\r\n`)
        return ok({ installed: code === 0, code })
      }

      // ── files ──
      if (method === 'GET' && path === '/files') {
        const username = safeName(url.searchParams.get('username') || '')
        const name = safeName(url.searchParams.get('name') || '')
        const rel = safeRel(url.searchParams.get('path') || '')
        const base = projectDir(username, name)
        const target = `${base}/${rel}`
              if (!fs.existsSync(base)) return err('المشروع غير موجود', 404)
        if (!fs.existsSync(target)) return ok({ files: [], path: rel })
        const entries = fs.readdirSync(target, { withFileTypes: true })
        const files = entries
          .filter((e: { name: string }) => e.name !== '.venom-console.log' && e.name !== '.venom-meta.json')
          .map((e: { name: string; isDirectory: () => boolean }) => {
            const st = fs.statSync(`${target}/${e.name}`)
            return { name: e.name, type: e.isDirectory() ? 'dir' : 'file', sizeMb: Math.round((st.size / 1048576) * 100) / 100, modified: st.mtime }
          })
          .sort((a: { type: string; name: string }, b: { type: string; name: string }) =>
            a.type === b.type ? a.name.localeCompare(b.name) : a.type === 'dir' ? -1 : 1)
        return ok({ files, path: rel })
      }

      if (method === 'POST' && path === '/files/write') {
        const b = await req.json()
        const username = safeName(b.username || '')
        const name = safeName(b.name || '')
        const rel = safeRel(b.path || '')
        if (!rel) return err('مسار غير صالح')
        if (typeof b.contentB64 !== 'string' || b.contentB64.length > UPLOAD_MAX_B64) {
          return err('حجم الملف كبير جداً (الحد ~22MB)', 413)
        }
        const target = `${projectDir(username, name)}/${rel}`
              fs.mkdirSync(pathMod.dirname(target), { recursive: true })
        await Bun.write(target, Buffer.from(b.contentB64, 'base64'))
        return ok({ written: true })
      }

      if (method === 'GET' && path === '/files/read') {
        const username = safeName(url.searchParams.get('username') || '')
        const name = safeName(url.searchParams.get('name') || '')
        const rel = safeRel(url.searchParams.get('path') || '')
        if (!rel) return err('مسار غير صالح')
        const target = `${projectDir(username, name)}/${rel}`
        const f = Bun.file(target)
        if (!await f.exists()) return err('الملف غير موجود', 404)
        if (f.size > 2 * 1024 * 1024) return ok({ contentB64: null, tooBig: true, sizeMb: Math.round(f.size / 1048576 * 100) / 100 })
        const buf = Buffer.from(await f.arrayBuffer())
        return ok({ contentB64: buf.toString('base64'), tooBig: false })
      }

      if (method === 'POST' && path === '/files/unzip') {
        const b = await req.json()
        const username = safeName(b.username || '')
        const name = safeName(b.name || '')
        const rel = safeRel(b.path || '')
        const dir = projectDir(username, name)
        const target = `${dir}/${rel}`
        const destDir = pathMod.dirname(target)
        // try unzip CLI, fallback to python zipfile
        let code = -1
        try {
          const p1 = Bun.spawn(['unzip', '-o', rel, '-d', '.'], { cwd: destDir, stdout: 'pipe', stderr: 'pipe' })
          await p1.exited
          code = p1.exitCode
        } catch { /* no unzip binary */ }
        if (code !== 0) {
          const p2 = Bun.spawn(['python3', '-m', 'zipfile', '-e', rel, '.'], { cwd: destDir, stdout: 'pipe', stderr: 'pipe' })
          await p2.exited
          code = p2.exitCode
        }
        return code === 0 ? ok({ unzipped: true }) : err('فشل فك الضغط (الصيغة غير مدعومة؟)')
      }

      if (method === 'DELETE' && path === '/files') {
        const username = safeName(url.searchParams.get('username') || '')
        const name = safeName(url.searchParams.get('name') || '')
        const rel = safeRel(url.searchParams.get('path') || '')
        if (!rel) return err('مسار غير صالح')
        const target = `${projectDir(username, name)}/${rel}`
              fs.rmSync(target, { recursive: true, force: true })
        return ok({ deleted: true })
      }

      // ── usage summary for a whole user dir ──
      if (method === 'GET' && path === '/usage') {
        const username = safeName(url.searchParams.get('username') || '')
        const dir = `${DATA_ROOT}/${username}`
        return ok({ diskMb: await dirSizeMb(dir) })
      }

      // ── wipe all projects of a user (account deletion) ──
      if (method === 'DELETE' && path.startsWith('/wipe/')) {
        const username = safeName(path.slice('/wipe/'.length))
        if (!username) return err('بيانات غير صالحة')
        // stop all their processes
        for (const [key, info] of Array.from(procs.entries())) {
          if (info.username === username) {
            try { process.kill(-info.proc.pid, 'SIGKILL') } catch { /* gone */ }
            procs.delete(key)
          }
        }
              fs.rmSync(`${DATA_ROOT}/${username}`, { recursive: true, force: true })
        return ok({ wiped: true })
      }

      return err('not found', 404)
    } catch (e) {
      console.error('[hosting]', e)
      return err('خطأ داخلي في خدمة الاستضافة', 500)
    }
  },
})

sweepOrphans()
console.log(`[venom-hosting] listening on :${PORT}, data at ${DATA_ROOT}`)
