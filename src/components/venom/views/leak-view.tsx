'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { useVenom } from '../store'
import { ServiceLogo } from '../logo'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from '@/hooks/use-toast'

interface BreachDetail {
  name: string
  domain: string
  date: string
  pwnCount: number
  dataClasses: string[]
  verified: boolean
}

type Result =
  | { kind: 'password'; breaches: number; safe: boolean; suspect: boolean; cached?: boolean }
  | { kind: 'email'; breaches: number; safe: boolean; details: BreachDetail[]; cached?: boolean }

export function LeakView() {
  const { user } = useVenom()
  const [tab, setTab] = useState<'password' | 'email'>('password')
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<Result | null>(null)
  const [error, setError] = useState('')

  async function check() {
    if (!input.trim()) {
      toast({ title: 'أدخل قيمة للفحص', variant: 'destructive' })
      return
    }
    setBusy(true)
    setError('')
    setResult(null)
    try {
      const res = await fetch(`/api/leak/${tab}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tab === 'password' ? { password: input } : { email: input }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'فشل الفحص')
        return
      }
      setResult(data)
      if (data.cached) toast({ description: 'نتيجة من الكاش (أقل من 7 أيام)' })
    } catch {
      setError('تعذر الاتصال بالخادم')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-10 venom-morph-in">
      <header className="text-center mb-8">
        <span className="inline-block p-3 rounded-xl bg-[#1D3933]/40 border border-[#4E7D7E]/40 mb-3">
          <ServiceLogo service="leak" size={52} />
        </span>
        <h1 className="venom-title text-2xl mb-2">Venom Leak Check</h1>
        <p className="text-[#8FA8A2]">عين فينوم تلمح تسريباتك في الظلام — مدعوم بقاعدة Have I Been Pwned</p>
      </header>

      {/* tabs */}
      <div className="flex justify-center gap-2 mb-6" role="tablist">
        {(['password', 'email'] as const).map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => { setTab(t); setResult(null); setError(''); setInput('') }}
            className={`px-5 py-2 rounded-lg border transition-all ${
              tab === t
                ? 'border-[#9FD6C9] bg-[#1D3933] text-[#9FD6C9] venom-text-glow'
                : 'border-[#2A2A2A] text-[#8FA8A2] hover:border-[#4E7D7E]'
            }`}
          >
            {t === 'password' ? '🔑 كلمة مرور' : '📧 بريد إلكتروني'}
          </button>
        ))}
      </div>

      {/* input */}
      <div className="venom-stretch venom-card flex gap-2 p-2 items-center">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && check()}
          type={tab === 'password' ? 'password' : 'email'}
          placeholder={tab === 'password' ? 'اكتب كلمة المرور للفحص…' : 'example@mail.com'}
          className="venom-glass border-0 text-[#E7F1E5] text-lg"
          aria-label={tab === 'password' ? 'كلمة المرور للفحص' : 'البريد للفحص'}
        />
        <Button onClick={check} disabled={busy}
          className="venom-glow bg-[#1D3933] hover:bg-[#4E7D7E] text-[#9FD6C9] border border-[#4E7D7E]/50 shrink-0">
          {busy ? '⏳ الفحص…' : '👁️ اكشف التسريب'}
        </Button>
      </div>
      {tab === 'password' && (
        <p className="text-[#5a6f6a] text-xs mt-2 text-center">
          🔒 لا نرسل كلمة مرورك أبداً — نرسل أول 5 أحرف فقط من بصمة SHA-1 (تقنية k-anonymity)
        </p>
      )}

      {error && (
        <div className="mt-6 p-4 rounded-lg border border-[#8B0000] bg-[#1c0d0d] text-[#e08080] text-center">
          {error}
        </div>
      )}

      {/* results */}
      {result && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mt-6 space-y-4">
          {result.kind === 'password' ? (
            <div className={`venom-card venom-glow p-6 text-center ${result.safe ? 'venom-result-safe' : result.suspect ? 'venom-result-suspect' : 'venom-result-breach'}`}>
              <div className="text-5xl mb-3">{result.safe ? '🟢' : result.suspect ? '🟡' : '🔴'}</div>
              <div className="text-xl font-bold text-[#E7F1E5]">
                {result.safe ? 'آمنة — لم تُسرّب أبداً' : result.suspect ? 'مشتبه بها — ظهرت في تسريب واحد' : `مسربة! ظهرت ${result.breaches} مرة`}
              </div>
              <div className="text-[#8FA8A2] text-sm mt-2">
                {result.safe
                  ? 'كلمة مرور جيدة — استمر في استخدام كلمات فريدة'
                  : 'غيّرها فوراً في كل المواقع التي تستخدمها فيها'}
              </div>
            </div>
          ) : (
            <>
              <div className={`venom-card venom-glow p-6 text-center ${result.safe ? 'venom-result-safe' : 'venom-result-breach'}`}>
                <div className="text-5xl mb-3">{result.safe ? '🟢' : '🔴'}</div>
                <div className="text-xl font-bold text-[#E7F1E5]">
                  {result.safe ? 'لا تسريبات — بريد نظيف' : `مسرب في ${result.breaches} اختراق!`}
                </div>
              </div>
              {result.details?.map((b, i) => (
                <div key={i} className="venom-card venom-result-breach p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <span className="font-bold text-[#E7F1E5] text-lg">{b.name}</span>
                    <span className="text-xs text-[#8FA8A2]">{b.date}</span>
                  </div>
                  <div className="text-sm text-[#8FA8A2] mb-2">
                    النطاق: <span className="text-[#6EAFA1]">{b.domain}</span> · الحسابات المتأثرة:{' '}
                    <span className="text-[#c97a7a]">{b.pwnCount.toLocaleString('ar-EG')}</span>
                    {b.verified && <span className="text-[#6EAFA1]"> · موثّق ✓</span>}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {b.dataClasses.map((d) => (
                      <span key={d} className="text-[11px] px-2 py-0.5 rounded-full bg-[#1c0d0d] border border-[#8B0000]/40 text-[#e08080]">
                        {d}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
              {!result.safe && (
                <div className="text-center text-[#D9C07A] text-sm">
                  💡 غيّر كلمة المرور وفعّل التحقق بخطوتين في المواقع المتأثرة
                </div>
              )}
            </>
          )}
          {result.cached && <div className="text-center text-[#5a6f6a] text-xs">النتيجة مخزنة — الكاش مدته 7 أيام</div>}
        </motion.div>
      )}

      {!user && (
        <p className="text-center text-[#5a6f6a] text-xs mt-8">الخدمة تعمل للزوار — سجّل دخولك لدعم كامل</p>
      )}
    </div>
  )
}
