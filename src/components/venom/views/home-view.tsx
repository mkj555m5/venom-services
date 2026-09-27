'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { VenomLogo, ServiceLogo } from '../logo'
import { useVenom, VenomView } from '../store'
import { Button } from '@/components/ui/button'

const SERVICES: Array<{
  key: VenomView
  serviceKey: string
  title: string
  desc: string
}> = [
  { key: 'leak', serviceKey: 'leak', title: 'Venom Leak Check', desc: 'كشف تسريبات البريد وكلمات المرور بقاعدة Have I Been Pwned — عين فينوم لا تنام' },
  { key: 'xng', serviceKey: 'xng', title: 'VenomXNG', desc: 'محرك بحث خاص بنتائج سريعة وواجهة سام — يزحف الويب بأنياب ظاهرة' },
  { key: 'mega', serviceKey: 'mega', title: 'Venom MEGA', desc: 'تحميل مباشر من روابط MEGA العامة بدون إعلانات — عبر عامل Cloudflare الخاص بك' },
  { key: 'hosting', serviceKey: 'hosting', title: 'Venom Hosting', desc: 'استضافة مشاريع Python / Node.js مع كونسول حي وإدارة ملفات وحصص صارمة' },
  { key: 'chat', serviceKey: 'chat', title: 'Venom Chat', desc: 'دردشة فورية بغرف عامة ورسائل خاصة — أسماء بألوان الأدوار وفقاعات سائلة' },
]

/** Liquid typing effect for the hero title */
function LiquidTyping() {
  const words = ['VENOM SERVICES', 'منصة السم الأخضر', 'قوة · سرية · حرية']
  const [wi, setWi] = useState(0)
  const [txt, setTxt] = useState('')
  const [del, setDel] = useState(false)

  useEffect(() => {
    const word = words[wi]
    const t = setTimeout(
      () => {
        if (!del) {
          if (txt.length < word.length) setTxt(word.slice(0, txt.length + 1))
          else setTimeout(() => setDel(true), 1600)
        } else {
          if (txt.length > 0) setTxt(word.slice(0, txt.length - 1))
          else {
            setDel(false)
            setWi((wi + 1) % words.length)
          }
        }
      },
      del ? 45 : 110
    )
    return () => clearTimeout(t)
  }, [txt, del, wi, words])

  return (
    <span className="venom-caret inline-block min-h-[1.2em]" aria-live="polite">
      {txt}
    </span>
  )
}

export function HomeView() {
  const { setView, user, config } = useVenom()
  const title = config.siteTitle?.value || 'Venom Services'
  const announcement = config.announcement?.value || ''

  return (
    <div className="venom-morph-in">
      {/* ── Hero ── */}
      <section className="relative py-14 md:py-20 px-4 text-center">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.6 }}
          className="flex justify-center mb-6"
        >
          <VenomLogo size={90} withWord={false} />
        </motion.div>
        <h1 className="venom-title text-3xl md:text-5xl mb-4 break-words leading-relaxed">
          <LiquidTyping />
        </h1>
        <p className="text-[#8FA8A2] max-w-2xl mx-auto text-lg leading-relaxed">
          {title} — خمس خدمات تحت سقف واحد بأسلوب فينوم: أسود عميق، أخضر سام، وحواف سائلة تمزق التقاليد.
          سجّل حسابك، اختر خدمتك، واترك السم يعمل.
        </p>
        {announcement && (
          <div className="venom-card venom-glow max-w-xl mx-auto mt-6 p-3 text-[#D9C07A] border-[#B8A04A]/40 text-sm">
            📢 {announcement}
          </div>
        )}
        <div className="flex flex-wrap justify-center gap-3 mt-8">
          {!user ? (
            <>
              <Button size="lg" className="venom-glow bg-[#1D3933] hover:bg-[#4E7D7E] text-[#E7F1E5] border border-[#4E7D7E]/50" onClick={() => setView('register')}>
                🐍 أنشئ حسابك
              </Button>
              <Button size="lg" variant="outline" className="venom-glow border-[#4E7D7E]/60 text-[#9FD6C9] hover:bg-[#1D3933]" onClick={() => setView('login')}>
                تسجيل الدخول
              </Button>
            </>
          ) : (
            <>
              <Button size="lg" className="venom-glow bg-[#1D3933] hover:bg-[#4E7D7E] text-[#E7F1E5] border border-[#4E7D7E]/50" onClick={() => setView('hosting')}>
                🚀 ابدأ الاستضافة
              </Button>
              <Button size="lg" variant="outline" className="venom-glow border-[#4E7D7E]/60 text-[#9FD6C9] hover:bg-[#1D3933]" onClick={() => setView('chat')}>
                💬 افتح الدردشة
              </Button>
            </>
          )}
        </div>
      </section>

      {/* ── Services grid ── */}
      <section className="px-4 pb-16 max-w-6xl mx-auto" aria-label="الخدمات">
        <h2 className="venom-title text-xl md:text-2xl text-center mb-8">الخدمات</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {SERVICES.map((s, i) => {
            const enabled = config[s.serviceKey]?.enabled !== false
            return (
              <motion.button
                key={s.key}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 }}
                onClick={() => setView(s.key)}
                className={`venom-card venom-glow p-6 text-right group ${!enabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                disabled={!enabled}
                aria-label={s.title}
              >
                <div className="flex items-center gap-3 mb-3">
                  <span className="p-2 rounded-lg bg-[#1D3933]/50 border border-[#4E7D7E]/30 group-hover:border-[#9FD6C9]/60 transition-colors">
                    <ServiceLogo service={s.serviceKey} />
                  </span>
                  <span className="font-bold text-lg text-[#E7F1E5]">{s.title}</span>
                </div>
                <p className="text-[#8FA8A2] text-sm leading-relaxed min-h-[3em]">{s.desc}</p>
                <div className="mt-4 flex items-center justify-between">
                  <span className="text-[#9FD6C9] text-sm font-semibold">ادخل الخدمة ←</span>
                  {enabled ? (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#1D3933] text-[#6EAFA1] border border-[#4E7D7E]/40">مفعلة</span>
                  ) : (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#2a1515] text-[#c97a7a] border border-[#8B0000]/50">معطلة من المالك</span>
                  )}
                </div>
              </motion.button>
            )
          })}

          {/* Owner panel card (only for owner) */}
          {user?.role === 'OWNER' && (
            <motion.button
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              onClick={() => setView('panel')}
              className="venom-card venom-glow p-6 text-right group border-[#8B0000]/40"
              aria-label="لوحة المالك"
            >
              <div className="flex items-center gap-3 mb-3">
                <span className="text-3xl">👑</span>
                <span className="font-bold text-lg text-[#D9C07A]">لوحة المالك</span>
              </div>
              <p className="text-[#8FA8A2] text-sm leading-relaxed">إدارة المستخدمين والحصص، تفعيل الخدمات، إحصائيات حية، سجلات النظام، ومولد الشعارات — صلاحيات بلا حدود.</p>
              <div className="mt-4">
                <span className="text-[#D9C07A] text-sm font-semibold">ادخل اللوحة ←</span>
              </div>
            </motion.button>
          )}
        </div>
      </section>

      {/* ── Quota strip ── */}
      <section className="px-4 pb-20 max-w-4xl mx-auto" aria-label="الحصص">
        <div className="venom-card p-6 md:p-8">
          <h3 className="venom-text-glow text-[#9FD6C9] font-bold text-lg mb-4 text-center">نظام الحصص</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
            <div className="p-4 rounded-lg bg-[#101413] border border-[#2A2A2A]">
              <div className="text-2xl mb-1">👤</div>
              <div className="text-[#E7F1E5] font-bold">مستخدم عادي</div>
              <div className="text-[#8FA8A2] text-sm mt-1">4GB رام · 50GB مساحة<br />مشروع واحد</div>
            </div>
            <div className="p-4 rounded-lg bg-[#101413] border border-[#2A2A2A]">
              <div className="text-2xl mb-1">🛡️</div>
              <div className="text-[#7FB3D5] font-bold">مشرف</div>
              <div className="text-[#8FA8A2] text-sm mt-1">حصص مخصصة<br />يحددها المالك</div>
            </div>
            <div className="p-4 rounded-lg bg-[#101413] border border-[#3A1F1F]">
              <div className="text-2xl mb-1">👑</div>
              <div className="text-[#D9C07A] font-bold">المالك RTQ_67</div>
              <div className="text-[#8FA8A2] text-sm mt-1">بلا حدود<br />رام · مساحة · مشاريع</div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
