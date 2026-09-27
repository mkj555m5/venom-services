'use client'

import { useCallback, useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { useVenom, fmtMb, CurrentUser } from '../store'
import { VenomLogo } from '../logo'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from '@/hooks/use-toast'

interface OwnerUser extends CurrentUser {
  email: string
  banned: boolean
  createdAt?: string
  _count?: { projects: number; chatMessages: number }
}

interface Stats {
  live: { uptimeSec: number; rssMb: number; heapMb: number; nodeVersion: string }
  totals: { users: number; admins: number; projects: number; runningProjects: number; messages: number; scans: number; searches: number }
  recentLogs: Array<{ id: string; level: string; source: string; message: string; createdAt: string }>
  latestUsers: Array<{ username: string; role: string; createdAt: string }>
}

const SERVICE_LABELS: Record<string, string> = {
  leak: '👁️ Venom Leak Check',
  xng: '🔍 VenomXNG',
  mega: '🦷 Venom MEGA',
  hosting: '🖥️ Venom Hosting',
  chat: '💬 Venom Chat',
}

export function OwnerPanel() {
  const { user, setView, setConfig } = useVenom()
  const [users, setUsers] = useState<OwnerUser[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [logs, setLogs] = useState<Array<{ id: string; level: string; source: string; message: string; createdAt: string }>>([])
  const [cfg, setCfg] = useState<Record<string, { enabled: boolean; value: string }>>({})
  const [siteTitle, setSiteTitle] = useState('')
  const [announcement, setAnnouncement] = useState('')
  const [logos, setLogos] = useState<Array<{ style: string; svg: string }>>([])
  const [ownPassword, setOwnPassword] = useState('')

  const loadUsers = useCallback(async () => {
    const res = await fetch('/api/users', { cache: 'no-store' })
    if (res.ok) setUsers((await res.json()).users)
  }, [])

  const loadAll = useCallback(async () => {
    const [s, l, c] = await Promise.all([
      fetch('/api/stats', { cache: 'no-store' }),
      fetch('/api/logs?take=120', { cache: 'no-store' }),
      fetch('/api/config', { cache: 'no-store' }),
    ])
    if (s.ok) setStats(await s.json())
    if (l.ok) setLogs((await l.json()).logs)
    if (c.ok) {
      const data = await c.json()
      setCfg(data.config || {})
      setSiteTitle(data.config?.siteTitle?.value || '')
      setAnnouncement(data.config?.announcement?.value || '')
      setConfig(data.config || {})
    }
  }, [setConfig])

  useEffect(() => {
    if (user?.role !== 'OWNER') return
    loadUsers()
    loadAll()
    const t = setInterval(loadAll, 6000) // live stats
    return () => clearInterval(t)
  }, [user, loadUsers, loadAll])

  const loadLogos = useCallback(async () => {
    const res = await fetch('/api/logo')
    if (res.ok) setLogos((await res.json()).variants)
  }, [])
  useEffect(() => {
    if (user?.role === 'OWNER') loadLogos()
  }, [user, loadLogos])

  async function patchUser(id: string, data: Record<string, unknown>) {
    const res = await fetch(`/api/users/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    const j = await res.json().catch(() => ({}))
    if (!res.ok) toast({ title: 'خطأ', description: j.error, variant: 'destructive' })
    else {
      toast({ title: 'تم التعديل ✓' })
      await loadUsers()
    }
  }

  async function deleteUser(u: OwnerUser) {
    if (!confirm(`حذف ${u.username} نهائياً بكل مشاريعه؟`)) return
    const res = await fetch(`/api/users/${u.id}`, { method: 'DELETE' })
    const j = await res.json().catch(() => ({}))
    if (!res.ok) toast({ title: 'خطأ', description: j.error, variant: 'destructive' })
    else {
      toast({ title: `حُذف ${u.username}` })
      await loadUsers()
      await loadAll()
    }
  }

  async function saveConfig(data: Record<string, unknown>) {
    const res = await fetch('/api/config', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (res.ok) {
      toast({ title: 'حُفظ ✓' })
      await loadAll()
    }
  }

  function downloadLogo(svg: string, name: string) {
    const blob = new Blob([svg], { type: 'image/svg+xml' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${name}.svg`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  if (user?.role !== 'OWNER') {
    return (
      <div className="max-w-lg mx-auto px-4 py-20 text-center venom-morph-in">
        <div className="text-5xl mb-4">⛔</div>
        <h1 className="venom-title text-xl mb-3">منطقة المالك</h1>
        <p className="text-[#8FA8A2]">هذه اللوحة لحساب المالك RTQ_67 فقط</p>
      </div>
    )
  }

  const uptimeH = stats ? Math.floor(stats.live.uptimeSec / 3600) : 0
  const uptimeM = stats ? Math.floor((stats.live.uptimeSec % 3600) / 60) : 0

  return (
    <div className="venom-owner max-w-6xl mx-auto px-4 py-8 venom-morph-in">
      <header className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <VenomLogo size={54} />
          <div>
            <h1 className="venom-title text-xl text-[#D9C07A]">👑 لوحة المالك</h1>
            <p className="text-[#8FA8A2] text-sm">مرحباً {user.username} — صلاحياتك بلا حدود</p>
          </div>
        </div>
        <div className="text-xs text-[#5a6f6a] flex gap-3">
          <span>⏱ {uptimeH}س {uptimeM}د تشغيل</span>
          <span>💾 {stats?.live.rssMb}MB ذاكرة</span>
          <span dir="ltr" className="hidden sm:inline">{stats?.live.nodeVersion}</span>
        </div>
      </header>

      <Tabs defaultValue="stats" dir="rtl">
        <TabsList className="bg-[#141414] border border-[#3A1F1F] flex-wrap h-auto">
          <TabsTrigger value="stats" className="data-[state=active]:text-[#D9C07A]">📊 الإحصائيات</TabsTrigger>
          <TabsTrigger value="users" className="data-[state=active]:text-[#D9C07A]">👥 المستخدمون</TabsTrigger>
          <TabsTrigger value="services" className="data-[state=active]:text-[#D9C07A]">🧩 الخدمات</TabsTrigger>
          <TabsTrigger value="logs" className="data-[state=active]:text-[#D9C07A]">📜 السجلات</TabsTrigger>
          <TabsTrigger value="logo" className="data-[state=active]:text-[#D9C07A]">🎨 الشعار</TabsTrigger>
        </TabsList>

        {/* ── stats ── */}
        <TabsContent value="stats">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            {[
              { label: 'المستخدمون', value: stats?.totals.users, icon: '👥' },
              { label: 'المشرفون', value: stats?.totals.admins, icon: '🛡️' },
              { label: 'المشاريع', value: `${stats?.totals.projects} (${stats?.totals.runningProjects} يعمل)`, icon: '🖥️' },
              { label: 'رسائل الدردشة', value: stats?.totals.messages, icon: '💬' },
              { label: 'فحوص التسريب (كاش)', value: stats?.totals.scans, icon: '👁️' },
              { label: 'عمليات البحث', value: stats?.totals.searches, icon: '🔍' },
              { label: 'ذاكرة الخادم', value: `${stats?.live.rssMb}MB`, icon: '💾' },
              { label: 'وقت التشغيل', value: `${uptimeH}س ${uptimeM}د`, icon: '⏱' },
            ].map((s, i) => (
              <motion.div key={s.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                className="venom-card p-4 text-center">
                <div className="text-2xl mb-1">{s.icon}</div>
                <div className="text-xl font-bold text-[#D9C07A]">{s.value ?? '—'}</div>
                <div className="text-xs text-[#8FA8A2] mt-1">{s.label}</div>
              </motion.div>
            ))}
          </div>
          <div className="venom-card p-4">
            <h3 className="text-[#9FD6C9] font-bold mb-2">أحدث المستخدمين</h3>
            <div className="space-y-1">
              {stats?.latestUsers.map((u) => (
                <div key={u.username} className="flex justify-between text-sm text-[#8FA8A2] border-b border-[#1a1a1a] pb-1">
                  <span>{u.role === 'OWNER' ? '👑 ' : u.role === 'ADMIN' ? '🛡️ ' : ''}{u.username}</span>
                  <span dir="ltr">{new Date(u.createdAt).toLocaleDateString('ar-EG')}</span>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>

        {/* ── users ── */}
        <TabsContent value="users">
          {/* owner account settings */}
          <div className="venom-card p-4 mb-4 border-[#B8A04A]/40">
            <h3 className="text-[#D9C07A] font-bold mb-2">👑 حسابك (RTQ_67) — ثابت ولا يمكن حذفه</h3>
            <div className="flex flex-wrap gap-2 items-end">
              <div className="flex-1 min-w-[220px]">
                <label className="text-[#8FA8A2] text-sm block mb-1">تغيير كلمة مرورك</label>
                <Input type="password" value={ownPassword} onChange={(e) => setOwnPassword(e.target.value)}
                  placeholder="كلمة مرور جديدة (8+)" className="venom-glass border-0 text-[#E7F1E5]" />
              </div>
              <Button onClick={() => { patchUser(user.id, { password: ownPassword }); setOwnPassword('') }}
                disabled={ownPassword.length < 8}
                className="venom-glow bg-[#1D3933] hover:bg-[#4E7D7E] text-[#E7F1E5]">💾 تغيير</Button>
            </div>
          </div>

          <div className="venom-card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[#8FA8A2] border-b border-[#3A1F1F] text-right">
                  <th className="p-3">المستخدم</th>
                  <th className="p-3">الدور</th>
                  <th className="p-3">رام</th>
                  <th className="p-3">مساحة</th>
                  <th className="p-3">مشاريع</th>
                  <th className="p-3">حالة</th>
                  <th className="p-3">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const isSelf = u.id === user.id
                  const isOwnerAcc = u.role === 'OWNER'
                  return (
                    <tr key={u.id} className="border-b border-[#1a1a1a] last:border-0">
                      <td className="p-3">
                        <div className="text-[#E7F1E5] font-bold">{isOwnerAcc ? '👑 ' : u.role === 'ADMIN' ? '🛡️ ' : ''}{u.username}</div>
                        <div className="text-[#5a6f6a] text-xs" dir="ltr">{u.email}</div>
                      </td>
                      <td className="p-3">
                        {isOwnerAcc ? (
                          <span className="text-[#D9C07A]">المالك</span>
                        ) : (
                          <select value={u.role} onChange={(e) => patchUser(u.id, { role: e.target.value })}
                            className="bg-[#141414] border border-[#2A2A2A] rounded px-2 py-1 text-[#E7F1E5] text-xs"
                            aria-label={`دور ${u.username}`}>
                            <option value="USER">مستخدم</option>
                            <option value="ADMIN">مشرف</option>
                          </select>
                        )}
                      </td>
                      {[['ramMb', 'رام'], ['diskMb', 'مساحة'], ['projectLimit', 'مشاريع']].map(([field, label], fi) => (
                        <td key={field} className="p-3">
                          {isOwnerAcc ? (
                            <span className="text-[#D9C07A] text-xs">∞ {label}</span>
                          ) : (
                            <input
                              type="number"
                              defaultValue={u[field as 'ramMb' | 'diskMb' | 'projectLimit']}
                              onBlur={(e) => {
                                const v = parseInt(e.target.value, 10)
                                if (!isNaN(v) && v !== u[field as 'ramMb' | 'diskMb' | 'projectLimit']) {
                                  patchUser(u.id, { [field]: v })
                                }
                              }}
                              className="w-20 bg-[#141414] border border-[#2A2A2A] rounded px-2 py-1 text-[#E7F1E5] text-xs"
                              aria-label={`${label} ${u.username}`}
                            />
                          )}
                        </td>
                      ))}
                      <td className="p-3">
                        {isOwnerAcc ? (
                          <span className="text-[#6EE7A0] text-xs">نشط دائماً</span>
                        ) : (
                          <Switch checked={!u.banned} onCheckedChange={(v) => patchUser(u.id, { banned: !v })}
                            aria-label={`تفعيل ${u.username}`} />
                        )}
                      </td>
                      <td className="p-3">
                        {!isOwnerAcc && (
                          <div className="flex gap-1">
                            <button onClick={() => deleteUser(u)} className="text-[#c97a7a] hover:text-[#ff6b6b] px-1" aria-label={`حذف ${u.username}`}>🗑</button>
                            {isSelf && <span className="text-[#5a6f6a] text-xs">(أنت)</span>}
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <p className="text-[#5a6f6a] text-xs mt-2">
            💡 القيم: رام/مساحة بالميجابايت (4096 = 4GB، 51200 = 50GB) — وضع -1 = بلا حدود · المشرفون بلا حدود افتراضياً عند الترقية (اضبط الحصص كما تشاء)
          </p>
        </TabsContent>

        {/* ── services ── */}
        <TabsContent value="services">
          <div className="venom-card p-4 mb-4 space-y-4">
            <h3 className="text-[#9FD6C9] font-bold">إعدادات الموقع العامة</h3>
            <div>
              <label className="text-[#8FA8A2] text-sm block mb-1">عنوان الموقع</label>
              <div className="flex gap-2">
                <Input value={siteTitle} onChange={(e) => setSiteTitle(e.target.value)}
                  className="venom-glass border-0 text-[#E7F1E5]" />
                <Button onClick={() => saveConfig({ siteTitle })} className="venom-glow bg-[#1D3933] hover:bg-[#4E7D7E] text-[#E7F1E5] shrink-0">💾</Button>
              </div>
            </div>
            <div>
              <label className="text-[#8FA8A2] text-sm block mb-1">إعلان عام (يظهر في الرئيسية)</label>
              <div className="flex gap-2">
                <Input value={announcement} onChange={(e) => setAnnouncement(e.target.value)}
                  className="venom-glass border-0 text-[#E7F1E5]" placeholder="اتركه فارغاً لإخفاء الإعلان" />
                <Button onClick={() => saveConfig({ announcement })} className="venom-glow bg-[#1D3933] hover:bg-[#4E7D7E] text-[#E7F1E5] shrink-0">💾</Button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {Object.entries(SERVICE_LABELS).map(([key, label]) => (
              <div key={key} className="venom-card p-4 flex items-center justify-between">
                <span className="text-[#E7F1E5] font-bold">{label}</span>
                <Switch checked={cfg[key]?.enabled !== false} onCheckedChange={(v) => saveConfig({ [key]: v })}
                  aria-label={`تفعيل ${label}`} />
              </div>
            ))}
          </div>
        </TabsContent>

        {/* ── logs ── */}
        <TabsContent value="logs">
          <div className="venom-card p-3 max-h-[520px] overflow-y-auto venom-console !text-[13px]" dir="rtl">
            {logs.length === 0 && <div className="text-center text-[#3a4a45] p-6">— لا سجلات بعد —</div>}
            {logs.map((l) => (
              <div key={l.id} className="py-1 border-b border-[#111514] last:border-0 flex gap-2 flex-wrap">
                <span className="text-[#3a4a45]" dir="ltr">{new Date(l.createdAt).toLocaleString('ar-EG')}</span>
                <span className={
                  l.level === 'error' ? 'text-[#e05252]' : l.level === 'warn' || l.level === 'security' ? 'text-[#D9C07A]' : 'text-[#4ed4c2]'
                }>[{l.level}]</span>
                <span className="text-[#6EAFA1]">{l.source}:</span>
                <span className="text-[#9FB8B2]">{l.message}</span>
              </div>
            ))}
          </div>
        </TabsContent>

        {/* ── logo ── */}
        <TabsContent value="logo">
          <div className="venom-card p-4">
            <h3 className="text-[#9FD6C9] font-bold mb-1">🎨 مولد شعار VENOM SERVICES</h3>
            <p className="text-[#5a6f6a] text-xs mb-4">
              مولد SVG مدمج (يعمل بلا إنترنت) — حمّل النسخة التي تعجبك واستخدمها في الموقع أو PWA.
              {stats && <span> · يمكن ربط مولد AI خارجي بمتغير LOGO_GENERATOR_API_KEY لاحقاً.</span>}
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {logos.map((v) => (
                <div key={v.style} className="venom-card venom-glow p-3 text-center">
                  <div className="bg-[#0A0A0A] rounded-lg p-3 mb-3 overflow-hidden"
                    dangerouslySetInnerHTML={{ __html: v.svg }} />
                  <div className="flex gap-2 justify-center">
                    <Button size="sm" onClick={() => downloadLogo(v.svg, `venom-logo-${v.style}`)}
                      className="venom-glow bg-[#1D3933] hover:bg-[#4E7D7E] text-[#9FD6C9] border border-[#4E7D7E]/50">
                      ⬇️ SVG
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
