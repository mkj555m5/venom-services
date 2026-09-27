'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { useVenom } from '../store'
import { VenomLogo } from '../logo'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from '@/hooks/use-toast'

type Mode = 'login' | 'register' | 'reset'

export function AuthView({ initialMode = 'login' }: { initialMode?: Mode }) {
  const { setView, setUser, refreshMe } = useVenom()
  const [mode, setMode] = useState<Mode>(initialMode)
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState({ username: '', email: '', password: '', confirm: '', code: '' })

  useEffect(() => setMode(initialMode), [initialMode])

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    try {
      if (mode === 'login') {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: form.username, password: form.password }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'فشل تسجيل الدخول')
        setUser(data.user)
        toast({ title: `أهلاً بعودتك يا ${data.user.username} 🐍`, description: 'تم تسجيل الدخول بنجاح' })
        setView(data.user.role === 'OWNER' ? 'panel' : 'home')
      } else if (mode === 'register') {
        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'فشل إنشاء الحساب')
        setUser(data.user)
        await refreshMe()
        toast({ title: 'ولدت من السم! 🐍', description: 'تم إنشاء حسابك وتسجيل دخولك' })
        setView('home')
      } else {
        if (!form.code) {
          // step 1: request code
          const res = await fetch('/api/auth/reset', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: form.email }),
          })
          const data = await res.json()
          if (!res.ok) throw new Error(data.error)
          toast({ title: 'رمز الاستعادة', description: data.message })
          setForm((f) => ({ ...f, code: ' ' })) // move to step 2
        } else {
          // step 2: confirm
          const res = await fetch('/api/auth/reset', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: form.email, code: form.code.trim(), password: form.password }),
          })
          const data = await res.json()
          if (!res.ok) throw new Error(data.error || 'فشل التغيير')
          toast({ title: 'تم تغيير كلمة المرور ✓', description: 'سجّل الدخول بكلمة المرور الجديدة' })
          setMode('login')
        }
      }
    } catch (err) {
      toast({ title: 'خطأ', description: err instanceof Error ? err.message : 'خطأ غير متوقع', variant: 'destructive' })
    } finally {
      setBusy(false)
    }
  }

  const resetStep2 = form.code !== ''

  return (
    <div className="flex items-center justify-center px-4 py-12 venom-morph-in">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-6">
          <VenomLogo size={64} />
        </div>

        <div className="venom-card venom-glow p-6 md:p-8">
          <h1 className="venom-title text-lg text-center mb-6">
            {mode === 'login' ? 'تسجيل الدخول' : mode === 'register' ? 'حساب جديد' : 'استعادة كلمة المرور'}
          </h1>

          <form onSubmit={submit} className="space-y-4">
            {mode !== 'reset' && (
              <div className="space-y-1.5">
                <Label htmlFor="v-username" className="text-[#8FA8A2]">اسم المستخدم</Label>
                <Input id="v-username" value={form.username} onChange={set('username')} required
                  className="venom-glass border-0 text-[#E7F1E5] placeholder:text-[#5a6f6a]" placeholder="venom_user" autoComplete="username" />
              </div>
            )}

            {mode === 'register' && (
              <div className="space-y-1.5">
                <Label htmlFor="v-email" className="text-[#8FA8A2]">البريد الإلكتروني</Label>
                <Input id="v-email" type="email" value={form.email} onChange={set('email')} required
                  className="venom-glass border-0 text-[#E7F1E5] placeholder:text-[#5a6f6a]" placeholder="you@venom.services" autoComplete="email" />
              </div>
            )}

            {mode === 'reset' && (
              <div className="space-y-1.5">
                <Label htmlFor="v-email-r" className="text-[#8FA8A2]">البريد الإلكتروني</Label>
                <Input id="v-email-r" type="email" value={form.email} onChange={set('email')} required
                  className="venom-glass border-0 text-[#E7F1E5]" placeholder="you@venom.services" disabled={resetStep2} />
              </div>
            )}

            {mode === 'reset' && resetStep2 && (
              <div className="space-y-1.5">
                <Label htmlFor="v-code" className="text-[#8FA8A2]">رمز الاستعادة (6 أرقام)</Label>
                <Input id="v-code" value={form.code} onChange={set('code')} required
                  className="venom-glass border-0 text-[#E7F1E5] tracking-widest text-center" placeholder="______" maxLength={6} />
              </div>
            )}

            {mode !== 'reset' && (
              <div className="space-y-1.5">
                <Label htmlFor="v-pass" className="text-[#8FA8A2]">كلمة المرور</Label>
                <Input id="v-pass" type="password" value={form.password} onChange={set('password')} required
                  className="venom-glass border-0 text-[#E7F1E5]" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
              </div>
            )}

            {(mode === 'register' || (mode === 'reset' && resetStep2)) && (
              <div className="space-y-1.5">
                <Label htmlFor="v-pass2" className="text-[#8FA8A2]">
                  {mode === 'reset' ? 'كلمة المرور الجديدة' : 'تأكيد كلمة المرور'}
                </Label>
                <Input id="v-pass2" type="password" value={form.confirm} onChange={set('confirm')} required minLength={8}
                  className="venom-glass border-0 text-[#E7F1E5]" autoComplete="new-password" />
              </div>
            )}

            <Button type="submit" disabled={busy}
              className="w-full venom-glow bg-[#1D3933] hover:bg-[#4E7D7E] text-[#E7F1E5] border border-[#4E7D7E]/50 font-bold py-2.5">
              {busy ? '⏳ جارٍ…' : mode === 'login' ? '🐍 ادخل العرين' : mode === 'register' ? '🐍 وُلد من السم' : resetStep2 ? 'غيّر كلمة المرور' : 'أرسل رمز الاستعادة'}
            </Button>
          </form>

          <div className="mt-5 flex flex-col gap-2 text-center text-sm">
            {mode !== 'login' && (
              <button onClick={() => setMode('login')} className="text-[#6EAFA1] hover:text-[#9FD6C9] transition-colors">
                لديك حساب؟ سجّل الدخول
              </button>
            )}
            {mode === 'login' && (
              <>
                <button onClick={() => setMode('register')} className="text-[#6EAFA1] hover:text-[#9FD6C9] transition-colors">
                  ليس لديك حساب؟ أنشئ حساباً جديداً
                </button>
                <button onClick={() => setMode('reset')} className="text-[#5a6f6a] hover:text-[#6EAFA1] transition-colors text-xs">
                  نسيت كلمة المرور؟
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
