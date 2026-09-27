'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { ServiceLogo } from '../logo'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'

interface SearchResult {
  title: string
  url: string
  snippet: string
  engine: string
}

export function XngView() {
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState(false)
  const [results, setResults] = useState<SearchResult[] | null>(null)
  const [engines, setEngines] = useState<string[]>([])
  const [error, setError] = useState('')
  const [searched, setSearched] = useState('')

  async function search(query?: string) {
    const term = (query ?? q).trim()
    if (!term) return
    setQ(term)
    setBusy(true)
    setError('')
    setSearched(term)
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(term)}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'فشل البحث')
      setResults(data.results)
      setEngines(data.engines || [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'فشل البحث')
      setResults(null)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-10 venom-morph-in">
      <header className="text-center mb-8">
        <span className="inline-flex items-center gap-2 justify-center mb-3">
          <span className="p-3 rounded-xl bg-[#1D3933]/40 border border-[#4E7D7E]/40">
            <ServiceLogo service="xng" size={52} />
          </span>
          <span className="venom-title text-2xl">VenomXNG</span>
        </span>
        <p className="text-[#8FA8A2]">محرك البحث السام — نتائج من عدة محركات بقلب واحد</p>
      </header>

      {/* search bar with liquid stretch */}
      <div className="venom-stretch venom-card flex gap-2 p-2 items-center">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && search()}
          placeholder="ابحث في الويب…"
          className="venom-glass border-0 text-[#E7F1E5] text-lg"
          aria-label="بحث VenomXNG"
        />
        <Button onClick={() => search()} disabled={busy}
          className="venom-glow bg-[#1D3933] hover:bg-[#4E7D7E] text-[#9FD6C9] border border-[#4E7D7E]/50 shrink-0">
          {busy ? '⏳' : '🐍 ابحث'}
        </Button>
      </div>

      {busy && (
        <div className="mt-6 space-y-3" aria-busy="true">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="venom-card p-4">
              <Skeleton className="h-4 w-1/3 mb-2 bg-[#1D3933]" />
              <Skeleton className="h-3 w-2/3 bg-[#16281f]" />
            </div>
          ))}
        </div>
      )}

      {error && !busy && (
        <div className="mt-6 p-4 rounded-lg border border-[#8B0000] bg-[#1c0d0d] text-[#e08080] text-center">{error}</div>
      )}

      {results && !busy && (
        <>
          <div className="mt-5 text-sm text-[#5a6f6a] flex items-center justify-between">
            <span>{results.length} نتيجة عن «{searched}»</span>
            <span className="flex gap-1">
              {engines.map((e) => (
                <span key={e} className="text-[10px] px-2 py-0.5 rounded-full bg-[#1D3933] text-[#6EAFA1] border border-[#4E7D7E]/40">
                  {e}
                </span>
              ))}
            </span>
          </div>
          <div className="mt-3 space-y-3">
            {results.length === 0 && (
              <div className="venom-card p-8 text-center text-[#8FA8A2]">لا نتائج — السم لم يجد شيئاً 🐍</div>
            )}
            {results.map((r, i) => (
              <motion.a
                key={r.url}
                href={r.url}
                target="_blank"
                rel="noopener noreferrer"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.05, 0.4) }}
                className="venom-card venom-glow block p-4 group"
              >
                <div className="text-xs text-[#5a6f6a] mb-1 truncate" dir="ltr">
                  {new URL(r.url).hostname}
                </div>
                <div className="text-[#9FD6C9] font-bold text-lg group-hover:underline mb-1">{r.title}</div>
                {r.snippet && <div className="text-[#8FA8A2] text-sm leading-relaxed">{r.snippet}</div>}
                <span className="inline-block mt-2 text-[10px] px-2 py-0.5 rounded-full bg-[#101413] text-[#5a6f6a] border border-[#2A2A2A]">
                  {r.engine}
                </span>
              </motion.a>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
