'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { ServiceLogo } from '../logo'
import { Button } from '@/components/ui/button'
import { toast } from '@/hooks/use-toast'

interface MegaFile {
  name: string
  hash: string
  size: string
  downloadUrl: string
}

export function MegaView() {
  const [url, setUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [file, setFile] = useState<{ downloadUrl: string } | null>(null)
  const [folder, setFolder] = useState<MegaFile[] | null>(null)
  const [error, setError] = useState('')
  const [needWorker, setNeedWorker] = useState(false)

  async function resolve() {
    if (!url.trim()) return
    setBusy(true)
    setError('')
    setFile(null)
    setFolder(null)
    try {
      const res = await fetch('/api/mega', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'فشل الحل')
        setNeedWorker(Boolean(data.needWorker))
        return
      }
      if (data.type === 'file') {
        setFile(data)
        toast({ description: 'تم حل الرابط — اضغط للتحميل', title: 'جاهز 🐍' })
      } else {
        setFolder(data.files || [])
        toast({ description: `${data.count} ملف داخل المجلد`, title: 'تم فتح المجلد' })
      }
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
          <ServiceLogo service="mega" size={52} />
        </span>
        <h1 className="venom-title text-2xl mb-2">Venom MEGA</h1>
        <p className="text-[#8FA8A2]">العضة المباشرة على روابط MEGA — بدون إعلانات، عبر عامل Cloudflare الخاص بك</p>
      </header>

      <div className="venom-stretch venom-card p-2 flex gap-2 items-center">
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && resolve()}
          placeholder="https://mega.nz/file/…#… أو mega.nz/folder/…#…"
          className="venom-glass border-0 text-[#E7F1E5] text-base w-full bg-transparent outline-none px-3 py-2"
          dir="ltr"
          aria-label="رابط MEGA"
        />
        <Button onClick={resolve} disabled={busy}
          className="venom-glow bg-[#1D3933] hover:bg-[#4E7D7E] text-[#9FD6C9] border border-[#4E7D7E]/50 shrink-0">
          {busy ? '⏳' : '🦷 حل الرابط'}
        </Button>
      </div>

      <div className="text-[#5a6f6a] text-xs mt-2 text-center">
        يدعم روابط الملفات والمجلدات العامة — يمكنك لصق عدة روابط سطراً بسطر (نحل أول رابط حالياً)
      </div>

      {error && (
        <div className="mt-6 p-4 rounded-lg border border-[#8B0000] bg-[#1c0d0d] text-[#e08080] text-center">
          {error}
          {needWorker && (
            <div className="mt-3 text-sm text-[#8FA8A2] leading-relaxed">
              1) انشر <code dir="ltr" className="text-[#9FD6C9]">services/mega/worker.js</code> من مستودع المشروع على
              Cloudflare Workers (نسخ → لصق → نشر)
              <br />2) ضع رابط العامل في متغير البيئة <code dir="ltr" className="text-[#9FD6C9]">MEGA_INDEX_URL</code> ثم أعد النشر
            </div>
          )}
        </div>
      )}

      {file && (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="mt-6 venom-card venom-result-safe venom-glow p-6 text-center">
          <div className="text-4xl mb-3">📦</div>
          <div className="text-[#E7F1E5] font-bold mb-4">الملف جاهز للعضّ المباشر</div>
          <a href={file.downloadUrl} target="_blank" rel="noopener noreferrer"
            className="venom-glow inline-block bg-[#1D3933] hover:bg-[#4E7D7E] text-[#9FD6C9] font-bold px-8 py-3 rounded-lg border border-[#4E7D7E]/60 transition-all active:scale-95">
            ⬇️ حمّل الآن
          </a>
          <p className="text-[#5a6f6a] text-xs mt-3">التحميل يمر مباشرة من عامل Cloudflare — بلا وسطاء إعلانات</p>
        </motion.div>
      )}

      {folder && (
        <div className="mt-6 space-y-2">
          {folder.length === 0 && (
            <div className="venom-card p-6 text-center text-[#8FA8A2]">المجلد فارغ أو لم نتمكن من قراءة ملفاته</div>
          )}
          {folder.map((f, i) => (
            <motion.a
              key={f.hash + i}
              href={f.downloadUrl}
              target="_blank"
              rel="noopener noreferrer"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.04 }}
              className="venom-card venom-glow p-4 flex items-center justify-between group"
            >
              <span className="flex items-center gap-3 min-w-0">
                <span className="text-2xl">📄</span>
                <span className="text-[#E7F1E5] truncate group-hover:text-[#9FD6C9]">{f.name}</span>
              </span>
              <span className="text-[#8FA8A2] text-sm shrink-0 mr-2">{f.size || '⬇️'}</span>
            </motion.a>
          ))}
        </div>
      )}
    </div>
  )
}
