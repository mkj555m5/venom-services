'use client'

import { useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useVenom } from '@/components/venom/store'
import { VenomLogo, VenomSvgFilters } from '@/components/venom/logo'
import { HomeView } from '@/components/venom/views/home-view'
import { AuthView } from '@/components/venom/views/auth-view'
import { LeakView } from '@/components/venom/views/leak-view'
import { XngView } from '@/components/venom/views/xng-view'
import { MegaView } from '@/components/venom/views/mega-view'
import { HostingView } from '@/components/venom/views/hosting-view'
import { ChatView } from '@/components/venom/views/chat-view'
import { OwnerPanel } from '@/components/venom/views/owner-panel'
import { Button } from '@/components/ui/button'

const NAV: Array<{ view: 'leak' | 'xng' | 'mega' | 'hosting' | 'chat'; label: string }> = [
  { view: 'leak', label: '👁️ كشف التسريب' },
  { view: 'xng', label: '🔍 البحث' },
  { view: 'mega', label: '🦷 MEGA' },
  { view: 'hosting', label: '🖥️ الاستضافة' },
  { view: 'chat', label: '💬 الدردشة' },
]

export default function Home() {
  const { view, setView, user, authLoaded, config, refreshMe } = useVenom()

  useEffect(() => {
    refreshMe()
  }, [])

  useEffect(() => {
    const t = setInterval(refreshMe, 60_000)
    return () => clearInterval(t)
  }, [])

  const roleBadge =
    user?.role === 'OWNER' ? '👑 المالك' : user?.role === 'ADMIN' ? '🛡️ مشرف' : ''

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    await refreshMe()
    setView('home')
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* global SVG filters (liquid effects) */}
      <VenomSvgFilters />
      {/* liquid skin background */}
      <div className="venom-skin" aria-hidden="true" />

      {/* ── Header ── */}
      <header className="sticky top-0 z-40 bg-[#0A0A0A]/85 backdrop-blur-md border-b border-[#2A2A2A]">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between gap-2">
          <button onClick={() => setView('home')} aria-label="الرئيسية" className="shrink-0">
            <VenomLogo size={40} />
          </button>

          {/* desktop nav */}
          <nav className="hidden md:flex items-center gap-1" aria-label="الخدمات">
            {NAV.map((n) => (
              <button key={n.view} onClick={() => setView(n.view)}
                className={`px-3 py-1.5 rounded-md text-sm transition-all hover:text-[#9FD6C9] hover:bg-[#1D3933]/50 ${
                  view === n.view ? 'text-[#9FD6C9] bg-[#1D3933] venom-glow' : 'text-[#8FA8A2]'
                }`}>
                {n.label}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            {authLoaded && user ? (
              <>
                {user.role === 'OWNER' && (
                  <Button size="sm" onClick={() => setView('panel')}
                    className="venom-glow bg-[#171010] hover:bg-[#2a1515] text-[#D9C07A] border border-[#B8A04A]/40 hidden sm:inline-flex">
                    👑 اللوحة
                  </Button>
                )}
                <span className="text-sm text-[#8FA8A2] hidden sm:inline">
                  {roleBadge && <span className="text-[#9FD6C9] text-xs mr-1">{roleBadge}</span>}
                  {user.username}
                </span>
                <Button size="sm" variant="outline" onClick={logout}
                  className="border-[#2A2A2A] text-[#8FA8A2] hover:text-[#e08080] hover:border-[#8B0000]/50">
                  خروج
                </Button>
              </>
            ) : authLoaded ? (
              <>
                <Button size="sm" variant="outline" onClick={() => setView('login')}
                  className="border-[#4E7D7E]/50 text-[#9FD6C9] hover:bg-[#1D3933] venom-glow">
                  دخول
                </Button>
                <Button size="sm" onClick={() => setView('register')}
                  className="venom-glow bg-[#1D3933] hover:bg-[#4E7D7E] text-[#E7F1E5] border border-[#4E7D7E]/50">
                  حساب جديد
                </Button>
              </>
            ) : (
              <span className="text-[#5a6f6a] text-sm">…</span>
            )}
          </div>
        </div>

        {/* mobile nav */}
        <nav className="md:hidden flex overflow-x-auto gap-1 px-3 pb-2" aria-label="خدمات الجوال">
          {NAV.map((n) => (
            <button key={n.view} onClick={() => setView(n.view)}
              className={`px-3 py-1.5 rounded-md text-xs whitespace-nowrap border transition-all ${
                view === n.view ? 'border-[#9FD6C9] text-[#9FD6C9] bg-[#1D3933]' : 'border-[#2A2A2A] text-[#8FA8A2]'
              }`}>
              {n.label}
            </button>
          ))}
        </nav>
      </header>

      {/* ── Main ── */}
      <main className="flex-1">
        <AnimatePresence mode="wait">
          <motion.div key={view} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
            {view === 'home' && <HomeView />}
            {view === 'login' && <AuthView initialMode="login" />}
            {view === 'register' && <AuthView initialMode="register" />}
            {view === 'reset' && <AuthView initialMode="reset" />}
            {view === 'leak' && <LeakView />}
            {view === 'xng' && <XngView />}
            {view === 'mega' && <MegaView />}
            {view === 'hosting' && <HostingView />}
            {view === 'chat' && <ChatView />}
            {view === 'panel' && (user?.role === 'OWNER' ? <OwnerPanel /> : <AuthView initialMode="login" />)}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* ── Footer (sticky bottom) ── */}
      <footer className="mt-auto bg-[#0A0A0A] border-t border-[#2A2A2A] py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="max-w-6xl mx-auto px-4 flex flex-wrap items-center justify-between gap-2 text-sm text-[#5a6f6a]">
          <span>© {new Date().getFullYear()} {config.siteTitle?.value || 'Venom Services'} — بأسلوب فينوم السام 🐍</span>
          <span className="flex gap-3">
            <button onClick={() => setView('leak')} className="hover:text-[#6EAFA1]">كشف التسريب</button>
            <button onClick={() => setView('xng')} className="hover:text-[#6EAFA1]">البحث</button>
            <button onClick={() => setView('mega')} className="hover:text-[#6EAFA1]">MEGA</button>
          </span>
        </div>
      </footer>
    </div>
  )
}
