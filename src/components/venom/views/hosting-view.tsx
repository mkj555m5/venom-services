'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { ServiceLogo } from '../logo'
import { useVenom, fmtMb } from '../store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { toast } from '@/hooks/use-toast'

interface Project {
  id: string
  name: string
  language: string
  entryFile: string
  status: string
  port: number
  liveRamMb: number
  liveDiskMb: number
}

interface FileEntry {
  name: string
  type: 'dir' | 'file'
  sizeMb: number
  modified: string
}

/** minimal ANSI → colored HTML converter (console support) */
function ansiToHtml(raw: string): string {
  const esc = raw.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  return esc
    .replace(/\x1b\[[0-9;]*m/g, (m) => {
      const codes = m.slice(2, -1).split(';').map(Number)
      if (codes.includes(0)) return '</span>'
      const color = codes.find((c) => [31, 32, 33, 34, 36].includes(c))
      return color ? `<span class="ansi-${color}">` : ''
    })
    .replace(/\r(?! )/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/\n/g, '<br/>')
}

export function HostingView() {
  const { user, setView } = useVenom()
  const [projects, setProjects] = useState<Project[]>([])
  const [quota, setQuota] = useState<{ ramMb: number; diskMb: number; projectLimit: number } | null>(null)
  const [active, setActive] = useState<Project | null>(null)
  const [files, setFiles] = useState<FileEntry[]>([])
  const [path, setPath] = useState('')
  const [log, setLog] = useState('')
  const [tab, setTab] = useState<'files' | 'console'>('files')
  const [loading, setLoading] = useState(true)
  const [newName, setNewName] = useState('')
  const [newLang, setNewLang] = useState('python')
  const [creating, setCreating] = useState(false)
  const [editContent, setEditContent] = useState<string | null>(null)
  const [editPath, setEditPath] = useState('')
  const consoleRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const isOwnerLike = user?.ramMb === -1

  const loadProjects = useCallback(async () => {
    try {
      const res = await fetch('/api/hosting/projects', { cache: 'no-store' })
      if (res.status === 401) return setView('login')
      const data = await res.json()
      setProjects(data.projects || [])
      setQuota(data.quota || null)
      setActive((cur) => (data.projects || []).find((p: Project) => p.id === cur?.id) || (data.projects || [])[0] || null)
    } finally {
      setLoading(false)
    }
  }, [setView])

  useEffect(() => {
    loadProjects()
  }, [loadProjects])

  // live status refresh
  useEffect(() => {
    const t = setInterval(loadProjects, 5000)
    return () => clearInterval(t)
  }, [loadProjects])

  // console poller
  useEffect(() => {
    if (!active || tab !== 'console') return
    let stop = false
    const poll = async () => {
      const res = await fetch('/api/hosting/action/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: active.id }),
      })
      if (!stop && res.ok) {
        const data = await res.json()
        setLog(data.log || '')
      }
    }
    poll()
    const t = setInterval(poll, 1500)
    return () => { stop = true; clearInterval(t) }
  }, [active, tab])

  useEffect(() => {
    if (consoleRef.current) consoleRef.current.scrollTop = consoleRef.current.scrollHeight
  }, [log])

  const loadFiles = useCallback(async (p: string) => {
    if (!active) return
    const res = await fetch(`/api/hosting/files?projectId=${active.id}&path=${encodeURIComponent(p)}`)
    if (res.ok) {
      const data = await res.json()
      setFiles(data.files || [])
      setPath(p)
    }
  }, [active])

  useEffect(() => {
    if (active && tab === 'files') loadFiles('')
  }, [active, tab, loadFiles])

  async function createProject() {
    if (!newName.trim()) return
    setCreating(true)
    try {
      const res = await fetch('/api/hosting/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim().toLowerCase(), language: newLang }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'فشل الإنشاء')
      toast({ title: 'وُلد المشروع! 🐍', description: `${data.project.name} (${data.project.language})` })
      setNewName('')
      await loadProjects()
    } catch (e) {
      toast({ title: 'خطأ', description: e instanceof Error ? e.message : 'فشل', variant: 'destructive' })
    } finally {
      setCreating(false)
    }
  }

  async function act(action: string, extra?: Record<string, unknown>) {
    if (!active) return
    const res = await fetch(`/api/hosting/action/${action}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId: active.id, ...extra }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      toast({ title: 'خطأ', description: data.error || 'فشلت العملية', variant: 'destructive' })
      return null
    }
    return data
  }

  async function onDeleteProject() {
    if (!active || !confirm(`حذف مشروع ${active.name} نهائياً بكل ملفاته؟`)) return
    await act('delete')
    setActive(null)
    await loadProjects()
    toast({ description: 'تم حذف المشروع', title: 'حُذف' })
  }

  async function uploadFile(file: File) {
    const buf = await file.arrayBuffer()
    let binary = ''
    const bytes = new Uint8Array(buf)
    for (let i = 0; i < bytes.length; i += 8192) {
      binary += String.fromCharCode(...bytes.subarray(i, i + 8192))
    }
    const contentB64 = btoa(binary)
    const res = await fetch('/api/hosting/files', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId: active?.id, path: path ? `${path}/${file.name}` : file.name, contentB64 }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      toast({ title: 'فشل الرفع', description: data.error, variant: 'destructive' })
      return
    }
    toast({ description: file.name, title: 'رُفع ✓' })
    if (file.name.endsWith('.zip')) await act('unzip', { path: path ? `${path}/${file.name}` : file.name })
    await loadFiles(path)
    await loadProjects()
  }

  async function openFile(f: FileEntry) {
    const rel = path ? `${path}/${f.name}` : f.name
    if (f.type === 'dir') return loadFiles(rel)
    const res = await fetch('/api/hosting/files', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId: active?.id, path: rel, read: true }),
    })
    const data = await res.json()
    if (data.tooBig) {
      toast({ description: `الملف كبير (${data.sizeMb}MB) — لا يمكن معاينته`, title: 'ملف كبير' })
      return
    }
    setEditPath(rel)
    try {
      setEditContent(atob(data.contentB64 || ''))
    } catch {
      setEditContent('')
    }
  }

  async function saveEdit() {
    const contentB64 = btoa(unescape(encodeURIComponent(editContent || '')))
    await fetch('/api/hosting/files', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId: active?.id, path: editPath, contentB64 }),
    })
    toast({ title: 'حُفظ ✓', description: editPath })
    setEditContent(null)
    await loadFiles(path)
  }

  const running = active?.status === 'running'

  if (!user) {
    return (
      <div className="max-w-lg mx-auto px-4 py-20 text-center venom-morph-in">
        <div className="text-5xl mb-4">🔒</div>
        <h1 className="venom-title text-xl mb-3">Venom Hosting</h1>
        <p className="text-[#8FA8A2] mb-6">سجّل الدخول لإنشاء مشروعك الأول — 4GB رام + 50GB مساحة + مشروع واحد</p>
        <Button onClick={() => setView('login')} className="venom-glow bg-[#1D3933] hover:bg-[#4E7D7E] text-[#E7F1E5]">
          🐍 تسجيل الدخول
        </Button>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 venom-morph-in">
      <header className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <span className="p-2.5 rounded-xl bg-[#1D3933]/40 border border-[#4E7D7E]/40">
            <ServiceLogo service="hosting" size={40} />
          </span>
          <div>
            <h1 className="venom-title text-xl">Venom Hosting</h1>
            <p className="text-[#5a6f6a] text-sm">حصتك: {fmtMb(quota?.ramMb ?? 0)} رام · {fmtMb(quota?.diskMb ?? 0)} مساحة · {quota?.projectLimit === -1 ? 'مشاريع بلا حدود' : `${projects.length}/${quota?.projectLimit} مشاريع`}</p>
          </div>
        </div>

        <Dialog>
          <DialogTrigger asChild>
            <Button className="venom-glow bg-[#1D3933] hover:bg-[#4E7D7E] text-[#9FD6C9] border border-[#4E7D7E]/50">＋ مشروع جديد</Button>
          </DialogTrigger>
          <DialogContent className="bg-[#141414] border border-[#4E7D7E]/40 rounded-xl">
            <DialogHeader>
              <DialogTitle className="text-[#9FD6C9]">🐍 إنشاء مشروع</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div>
                <label className="text-[#8FA8A2] text-sm mb-1 block">اسم المشروع (إنجليزي)</label>
                <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="my-venom-server"
                  className="venom-glass border-0 text-[#E7F1E5]" dir="ltr" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { k: 'python', label: '🐍 Python', sub: 'requirements.txt + pip' },
                  { k: 'node', label: '🟩 Node.js', sub: 'package.json + install' },
                ].map((l) => (
                  <button key={l.k} onClick={() => setNewLang(l.k)}
                    className={`venom-glow p-4 rounded-lg border text-center transition-all ${
                      newLang === l.k ? 'border-[#9FD6C9] bg-[#1D3933]' : 'border-[#2A2A2A] hover:border-[#4E7D7E]'
                    }`}>
                    <div className="text-2xl mb-1">{l.k === 'python' ? '🐍' : '🟩'}</div>
                    <div className="text-[#E7F1E5] font-bold">{l.label}</div>
                    <div className="text-[#5a6f6a] text-xs mt-1">{l.sub}</div>
                  </button>
                ))}
              </div>
              <Button onClick={createProject} disabled={creating || !newName.trim()}
                className="w-full venom-glow bg-[#1D3933] hover:bg-[#4E7D7E] text-[#E7F1E5] border border-[#4E7D7E]/50">
                {creating ? '⏳ يفقس…' : '🐍 أنشئ المشروع'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </header>

      {loading ? (
        <div className="venom-card p-10 text-center text-[#5a6f6a]">⏳ جارٍ التحميل…</div>
      ) : projects.length === 0 ? (
        <div className="venom-card p-12 text-center">
          <div className="text-5xl mb-4">🥚</div>
          <p className="text-[#8FA8A2] mb-4">لا مشاريع بعد — أنشئ مشروعك الأول ودعه يفقس</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-5">
          {/* ── project list ── */}
          <aside className="space-y-2">
            {projects.map((p) => (
              <button key={p.id} onClick={() => setActive(p)}
                className={`venom-card venom-glow w-full p-3 text-right ${active?.id === p.id ? 'border-[#9FD6C9]' : ''}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[#E7F1E5] font-bold truncate">{p.language === 'python' ? '🐍' : '🟩'} {p.name}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${
                    p.status === 'running'
                      ? 'border-[#4E7D7E] text-[#6EE7A0] bg-[#10201d]'
                      : p.status === 'crashed'
                        ? 'border-[#8B0000] text-[#e08080] bg-[#1c0d0d]'
                        : 'border-[#2A2A2A] text-[#5a6f6a]'
                  }`}>
                    {p.status === 'running' ? '● يعمل' : p.status === 'crashed' ? '● تحطم' : '○ متوقف'}
                  </span>
                </div>
                {p.status === 'running' && (
                  <div className="text-[11px] text-[#5a6f6a] mt-1.5">
                    رام: {p.liveRamMb}MB · منفذ: {p.port} · قرص: {p.liveDiskMb}MB
                  </div>
                )}
              </button>
            ))}
          </aside>

          {/* ── project detail ── */}
          {active && (
            <section className="venom-card p-4">
              {/* controls */}
              <div className="flex flex-wrap gap-2 mb-4">
                {running ? (
                  <Button size="sm" onClick={() => act('stop').then(loadProjects)}
                    className="venom-glow bg-[#1c0d0d] hover:bg-[#2a1515] text-[#e08080] border border-[#8B0000]/50">
                    ⏹ إيقاف
                  </Button>
                ) : (
                  <Button size="sm" onClick={() => act('start').then(loadProjects)}
                    className="venom-glow bg-[#1D3933] hover:bg-[#4E7D7E] text-[#6EE7A0] border border-[#4E7D7E]/50">
                    ▶ تشغيل
                  </Button>
                )}
                <Button size="sm" variant="outline" onClick={() => act('install').then((r) => r && toast({ title: r.ok ? 'اكتمل التثبيت ✓' : 'انتهى التثبيت بأخطاء — راجع الكونسول' }).then(loadFiles(path)))}
                  className="venom-glow border-[#4E7D7E]/50 text-[#9FD6C9]">
                  📦 تثبيت الحزم
                </Button>
                {running && active.port > 0 && (
                  <a href={`http://localhost:${active.port}`} target="_blank" rel="noopener noreferrer"
                    className="venom-glow inline-flex items-center px-3 py-1.5 text-sm rounded-md border border-[#4E7D7E]/50 text-[#6EAFA1] hover:bg-[#1D3933]">
                    🌐 معاينة المنفذ {active.port}
                  </a>
                )}
                <Button size="sm" variant="outline" onClick={onDeleteProject}
                  className="border-[#8B0000]/50 text-[#c97a7a] hover:bg-[#1c0d0d] mr-auto">🗑 حذف المشروع</Button>
              </div>

              {/* tabs */}
              <div className="flex gap-2 mb-3" role="tablist">
                {(['files', 'console'] as const).map((t) => (
                  <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
                    className={`px-4 py-1.5 rounded-md border text-sm transition-all ${
                      tab === t ? 'border-[#9FD6C9] text-[#9FD6C9] bg-[#1D3933]' : 'border-[#2A2A2A] text-[#8FA8A2]'
                    }`}>
                    {t === 'files' ? '📁 الملفات' : '🖥️ الكونسول الحي'}
                  </button>
                ))}
              </div>

              {tab === 'files' ? (
                <div>
                  <div className="flex flex-wrap items-center gap-2 mb-3">
                    <Button size="sm" variant="outline" onClick={() => loadFiles(path.split('/').slice(0, -1).join('/'))}
                      disabled={!path} className="border-[#2A2A2A] text-[#8FA8A2]">↩︎ للأعلى</Button>
                    <span className="text-[#5a6f6a] text-sm" dir="ltr">/{path}</span>
                    <input ref={fileInputRef} type="file" className="hidden" multiple
                      onChange={(e) => { Array.from(e.target.files || []).forEach(uploadFile); e.target.value = '' }} />
                    <Button size="sm" onClick={() => fileInputRef.current?.click()}
                      className="venom-glow bg-[#1D3933] hover:bg-[#4E7D7E] text-[#9FD6C9] border border-[#4E7D7E]/50 mr-auto">
                      ⬆️ رفع ملفات (ZIP يُفك تلقائياً)
                    </Button>
                  </div>
                  <div className="max-h-[420px] overflow-y-auto rounded-lg border border-[#2A2A2A]">
                    {files.length === 0 && <div className="p-6 text-center text-[#5a6f6a] text-sm">المجلد فارغ</div>}
                    {files.map((f) => (
                      <div key={f.name} className="flex items-center justify-between px-3 py-2 border-b border-[#1a1a1a] last:border-0 hover:bg-[#141414] group">
                        <button onClick={() => openFile(f)} className="flex items-center gap-2 text-right min-w-0 flex-1">
                          <span>{f.type === 'dir' ? '📁' : '📄'}</span>
                          <span className="text-[#E7F1E5] text-sm truncate group-hover:text-[#9FD6C9]" dir="ltr">{f.name}</span>
                        </button>
                        <span className="text-[#5a6f6a] text-xs shrink-0 mx-2">
                          {f.type === 'file' ? `${f.sizeMb}MB` : ''}
                        </span>
                        <button
                          onClick={async () => {
                            if (!confirm(`حذف ${f.name}؟`)) return
                            const rel = path ? `${path}/${f.name}` : f.name
                            await fetch(`/api/hosting/files?projectId=${active.id}&path=${encodeURIComponent(rel)}`, { method: 'DELETE' })
                            await loadFiles(path)
                          }}
                          className="text-[#5a6f6a] hover:text-[#e08080] text-sm px-1 shrink-0" aria-label={`حذف ${f.name}`}>🗑</button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div>
                  <div className="flex gap-2 mb-2">
                    <Button size="sm" variant="outline" onClick={() => act('clear').then(() => setLog(''))}
                      className="border-[#2A2A2A] text-[#8FA8A2]">🧹 تنظيف</Button>
                    <span className="text-[#5a6f6a] text-xs self-center">يدعم ألوان ANSI الكاملة — يُحدّث تلقائياً</span>
                  </div>
                  <div ref={consoleRef} className="venom-console venom-liquid-soft rounded-lg border border-[#1D3933] p-3 h-[380px] overflow-y-auto whitespace-pre-wrap break-all"
                    role="log" aria-live="polite"
                    dangerouslySetInnerHTML={{ __html: ansiToHtml(log) || '<span style="color:#3a4a45">— الكونسول فارغ، شغّل المشروع لترى الإخراج —</span>' }} />
                </div>
              )}
            </section>
          )}
        </div>
      )}

      {/* file editor dialog */}
      <Dialog open={editContent !== null} onOpenChange={(o) => !o && setEditContent(null)}>
        <DialogContent className="bg-[#141414] border border-[#4E7D7E]/40 rounded-xl max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-[#9FD6C9]" dir="ltr">{editPath}</DialogTitle>
          </DialogHeader>
          <textarea
            value={editContent || ''}
            onChange={(e) => setEditContent(e.target.value)}
            className="venom-console w-full h-[350px] rounded-lg border border-[#1D3933] p-3 outline-none"
            spellCheck={false}
          />
          <Button onClick={saveEdit} className="venom-glow bg-[#1D3933] hover:bg-[#4E7D7E] text-[#E7F1E5]">💾 حفظ</Button>
        </DialogContent>
      </Dialog>
    </div>
  )
}
