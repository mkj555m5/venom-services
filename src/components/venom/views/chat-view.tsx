'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { io, Socket } from 'socket.io-client'
import { ServiceLogo } from '../logo'
import { useVenom } from '../store'
import { Button } from '@/components/ui/button'
import { toast } from '@/hooks/use-toast'

interface Msg {
  id: string
  room: string
  username: string
  role: string
  color: string
  content: string
  at: number
}

const EMOJIS = ['🟢', '🐍', '💥', '🔥', '👍', '😂', '😮', '❤️']
const roleColor = (role: string, fallback: string) =>
  role === 'OWNER' ? '#9FD6C9' : role === 'ADMIN' ? '#7FB3D5' : fallback || '#E7F1E5'

export function ChatView() {
  const { user, setView } = useVenom()
  const [socket, setSocket] = useState<Socket | null>(null)
  const [connected, setConnected] = useState(false)
  const [room, setRoom] = useState('general')
  const [messages, setMessages] = useState<Msg[]>([])
  const [online, setOnline] = useState<string[]>([])
  const [input, setInput] = useState('')
  const [dmTarget, setDmTarget] = useState<string | null>(null)
  const boxRef = useRef<HTMLDivElement>(null)

  const loadHistory = useCallback(async (r: string) => {
    const res = await fetch(`/api/chat/history?room=${encodeURIComponent(r)}`)
    if (res.ok) {
      const data = await res.json()
      setMessages(
        (data.messages || []).map((m: { id: string; username: string; role: string; content: string; at: number }) => ({
          ...m,
          room: r,
          color: roleColor(m.role, ''),
        }))
      )
    }
  }, [])

  useEffect(() => {
    if (!user) return
    const s = io('/?XTransformPort=3003', { path: '/', reconnectionDelayMax: 5000 })
    setSocket(s)

    s.on('connect', () => setConnected(true))
    s.on('disconnect', () => setConnected(false))
    s.on('connect_error', () => setConnected(false))

    return () => {
      s.disconnect()
    }
  }, [user])

  // get signed JWT for socket (exposed via secure endpoint once per session)
  useEffect(() => {
    if (!socket || !user) return
    let cancelled = false
    ;(async () => {
      const res = await fetch('/api/chat/token', { cache: 'no-store' })
      if (!res.ok) return
      const { token } = await res.json()
      if (cancelled) return
      socket.emit('auth', token, (res2: { ok: boolean; error?: string }) => {
        if (!res2?.ok) {
          toast({ title: 'الدردشة', description: res2?.error || 'فشل التحقق', variant: 'destructive' })
          return
        }
        socket.emit('join', 'general')
        loadHistory('general')
      })
    })()
    return () => {
      cancelled = true
    }
  }, [socket, user, loadHistory])

  useEffect(() => {
    if (!socket) return
    const onMsg = (m: Msg) => setMessages((cur) => [...cur.slice(-300), m])
    const onSys = ({ room: r, message, at }: { room: string; message: string; at: number }) =>
      setMessages((cur) =>
        r === room ? [...cur.slice(-300), { id: `s${at}${Math.random()}`, room: r, username: '', role: '', color: '#5a6f6a', content: message, at }] : cur
      )
    const onPresence = ({ online: o }: { online: string[] }) => setOnline(o)
    socket.on('message', onMsg)
    socket.on('system', onSys)
    socket.on('presence', onPresence)
    return () => {
      socket.off('message', onMsg)
      socket.off('system', onSys)
      socket.off('presence', onPresence)
    }
  }, [socket, room])

  useEffect(() => {
    if (boxRef.current) boxRef.current.scrollTop = boxRef.current.scrollHeight
  }, [messages])

  function switchRoom(r: string, dm: string | null = null) {
    if (!socket) return
    socket.emit('join', r, (res: { ok?: boolean; error?: string }) => {
      if (res?.error) {
        toast({ title: 'خطأ', description: res.error, variant: 'destructive' })
        return
      }
      setRoom(r)
      setDmTarget(dm)
      setMessages([])
      loadHistory(r)
    })
  }

  function send() {
    const text = input.trim()
    if (!text || !socket) return
    socket.emit('message', { room, content: text }, (res: { ok?: boolean; error?: string }) => {
      if (res?.error) toast({ title: 'لم تُرسل', description: res.error, variant: 'destructive' })
    })
    setInput('')
  }

  if (!user) {
    return (
      <div className="max-w-lg mx-auto px-4 py-20 text-center venom-morph-in">
        <div className="text-5xl mb-4">🔒</div>
        <h1 className="venom-title text-xl mb-3">Venom Chat</h1>
        <p className="text-[#8FA8A2] mb-6">الدردشة للمسجلين فقط — سجّل دخولك لتتكلم بلسان السم</p>
        <Button onClick={() => setView('login')} className="venom-glow bg-[#1D3933] hover:bg-[#4E7D7E] text-[#E7F1E5]">
          🐍 تسجيل الدخول
        </Button>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 venom-morph-in">
      <header className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-3">
          <span className="p-2.5 rounded-xl bg-[#1D3933]/40 border border-[#4E7D7E]/40">
            <ServiceLogo service="chat" size={40} />
          </span>
          <div>
            <h1 className="venom-title text-xl">Venom Chat</h1>
            <span className={`text-xs ${connected ? 'text-[#6EE7A0]' : 'text-[#e08080]'}`}>
              {connected ? '● متصل — إعادة الاتصال تلقائية' : '● غير متصل…'}
            </span>
          </div>
        </div>
        <div className="text-[#5a6f6a] text-sm">
          🟢 متواجدون: <span className="text-[#6EAFA1]">{online.length}</span>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-4">
        {/* sidebar */}
        <aside className="venom-card p-3 space-y-1.5 max-h-[240px] lg:max-h-[480px] overflow-y-auto">
          <button onClick={() => switchRoom('general', null)}
            className={`w-full text-right px-3 py-2 rounded-md border text-sm transition-colors ${
              room === 'general' ? 'border-[#9FD6C9] text-[#9FD6C9] bg-[#1D3933]' : 'border-transparent text-[#8FA8A2] hover:bg-[#141414]'
            }`}>
            🌍 الغرفة العامة
          </button>
          {online.filter((u) => u !== user.username).map((u) => (
            <button key={u} onClick={() => {
              const dm = `dm:${[user.username, u].sort().join('|')}`
              switchRoom(dm, u)
            }}
              className={`w-full text-right px-3 py-2 rounded-md border text-sm transition-colors ${
                dmTarget === u ? 'border-[#9FD6C9] text-[#9FD6C9] bg-[#1D3933]' : 'border-transparent text-[#8FA8A2] hover:bg-[#141414]'
              }`}>
              💬 خاص: {u}
            </button>
          ))}
        </aside>

        {/* chat box */}
        <section className="venom-card p-3 flex flex-col h-[60vh]">
          <div ref={boxRef} className="flex-1 overflow-y-auto space-y-2 pr-1" aria-live="polite">
            {messages.map((m) =>
              m.username === '' ? (
                <div key={m.id} className="text-center text-[#5a6f6a] text-xs py-1">— {m.content} —</div>
              ) : (
                <div key={m.id} className={`flex ${m.username === user.username ? 'justify-start' : 'justify-end'}`}>
                  <div className={`max-w-[80%] px-3 py-2 venom-send-pop ${
                    m.username === user.username ? 'venom-bubble-me' : 'venom-bubble-other'
                  }`}>
                    {m.username !== user.username && (
                      <div className="text-xs font-bold mb-0.5" style={{ color: roleColor(m.role, '#E7F1E5') }}>
                        {m.role === 'OWNER' && '👑 '}{m.role === 'ADMIN' && '🛡️ '}{m.username}
                      </div>
                    )}
                    <div className="text-[#E7F1E5] text-sm break-words whitespace-pre-wrap">{m.content}</div>
                    <div className="text-[9px] text-[#5a6f6a] mt-1 text-left">
                      {new Date(m.at).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
              )
            )}
          </div>

          {/* emoji bar */}
          <div className="flex gap-1 py-2 flex-wrap">
            {EMOJIS.map((e) => (
              <button key={e} onClick={() => setInput((i) => i + e)}
                className="hover:scale-125 transition-transform text-lg" aria-label={`إيموجي ${e}`}>{e}</button>
            ))}
          </div>

          <div className="flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && send()}
              placeholder={dmTarget ? `رسالة خاصة إلى ${dmTarget}…` : 'اكتب في الغرفة العامة…'}
              className="venom-glass flex-1 rounded-md px-3 py-2.5 text-[#E7F1E5] outline-none text-sm"
              aria-label="رسالة"
              maxLength={1000}
            />
            <Button onClick={send} className="venom-glow bg-[#1D3933] hover:bg-[#4E7D7E] text-[#9FD6C9] border border-[#4E7D7E]/50 shrink-0">
              🐍 أرسل
            </Button>
          </div>
        </section>
      </div>
    </div>
  )
}
