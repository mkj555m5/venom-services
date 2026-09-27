// ─────────────────────────────────────────────
//  VENOM CHAT SERVICE — Socket.IO (port 3003)
//  Rooms (public), DMs, persistence via main app DB,
//  JWT auth (same secret as main app), rate limiting,
//  auto-reconnect handled by socket.io client.
// ─────────────────────────────────────────────
import { createServer } from 'http'
import { Server } from 'socket.io'
import { jwtVerify } from 'jose'

const PORT = Number(process.env.CHAT_PORT || 3003)
const MAIN_APP = process.env.MAIN_APP_URL || 'http://127.0.0.1:3000'
const INTERNAL_TOKEN = process.env.INTERNAL_TOKEN || 'venom-internal'
const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'venom-services-dev-secret-change-me-in-production'
)

interface SessionUser {
  id: string
  username: string
  email: string
  role: 'OWNER' | 'ADMIN' | 'USER'
}

const httpServer = createServer()
const io = new Server(httpServer, {
  // DO NOT change the path — Caddy forwards /?XTransformPort=3003 here
  path: '/',
  cors: { origin: '*', methods: ['GET', 'POST'] },
  pingTimeout: 60_000,
  pingInterval: 25_000,
  maxHttpBufferSize: 16_000,
})

// username → Set<socketId>
const online = new Map<string, Set<string>>()
// per-socket message timestamps for rate limiting
const msgTimes = new Map<string, number[]>()

async function persistMessage(room: string, username: string, role: string, content: string) {
  try {
    await fetch(`${MAIN_APP}/api/chat/persist`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-internal-token': INTERNAL_TOKEN },
      body: JSON.stringify({ room, username, role, content }),
    })
  } catch (e) {
    console.error('[chat] persist failed:', String(e).slice(0, 120))
  }
}

function nameColor(role: string): string {
  return role === 'OWNER' ? '#9FD6C9' : role === 'ADMIN' ? '#6EAFA1' : '#E7F1E5'
}

io.on('connection', (socket) => {
  let user: SessionUser | null = null
  const rooms = new Set<string>()

  // ── auth handshake ──
  socket.on('auth', async (token: string, cb?: (res: unknown) => void) => {
    try {
      const { payload } = await jwtVerify(String(token || ''), JWT_SECRET)
      user = {
        id: String(payload.id),
        username: String(payload.username),
        email: String(payload.email),
        role: payload.role as SessionUser['role'],
      }
      if (!online.has(user.username)) online.set(user.username, new Set())
      online.get(user.username)!.add(socket.id)
      cb?.({ ok: true, user, color: nameColor(user.role) })
      io.emit('presence', { online: Array.from(online.keys()).slice(0, 200) })
    } catch {
      cb?.({ ok: false, error: 'جلسة غير صالحة — سجّل الدخول من جديد' })
    }
  })

  // ── join room ──
  socket.on('join', async (room: string, cb?: (res: unknown) => void) => {
    if (!user) return cb?.({ error: 'غير مصرح' })
    const r = String(room || 'general').slice(0, 60)
    // DM room naming: dm:a|b must include the sender
    if (r.startsWith('dm:')) {
      const parts = r.slice(3).split('|').filter(Boolean)
      if (!parts.includes(user.username)) return cb?.({ error: 'غير مصرح بهذه الغرفة الخاصة' })
    } else if (!/^[a-zA-Z0-9_-]{1,40}$/.test(r)) {
      return cb?.({ error: 'اسم غرفة غير صالح' })
    }
    socket.join(r)
    rooms.add(r)
    cb?.({ ok: true, room: r })
    io.to(r).emit('system', { room: r, message: `${user.username} انضم إلى الغرفة`, at: Date.now() })
  })

  // ── message ──
  socket.on('message', async ({ room, content }: { room: string; content: string }, cb?: (res: unknown) => void) => {
    if (!user) return cb?.({ error: 'غير مصرح' })
    const r = String(room || '')
    const text = String(content || '').trim().slice(0, 1000)
    if (!text || !rooms.has(r)) return cb?.({ error: 'انضم للغرفة أولاً' })

    // rate limit: 8 messages / 10s
    const now = Date.now()
    const times = (msgTimes.get(socket.id) || []).filter((t) => now - t < 10_000)
    if (times.length >= 8) return cb?.({ error: 'هدوء يا وحش! انتظر قليلاً' })
    times.push(now)
    msgTimes.set(socket.id, times)

    const msg = {
      id: `m${now}${Math.random().toString(36).slice(2, 8)}`,
      room: r,
      username: user.username,
      role: user.role,
      color: nameColor(user.role),
      content: text,
      at: now,
    }
    io.to(r).emit('message', msg)
    await persistMessage(r, user.username, user.role, text)
    cb?.({ ok: true, id: msg.id })
  })

  // ── typing indicator ──
  socket.on('typing', ({ room }: { room: string }) => {
    if (!user || !rooms.has(String(room))) return
    socket.to(String(room)).emit('typing', { username: user.username })
  })

  // ── emoji reactions (custom venom set) ──
  socket.on('react', ({ room, emoji }: { room: string; emoji: string }) => {
    if (!user || !rooms.has(String(room))) return
    const allowed = ['🟢', '🐍', '💥', '🔥', '👍', '😂', '😮', '❤️']
    if (!allowed.includes(String(emoji))) return
    io.to(String(room)).emit('react', { username: user.username, emoji, at: Date.now() })
  })

  socket.on('disconnect', () => {
    if (user) {
      const set = online.get(user.username)
      if (set) {
        set.delete(socket.id)
        if (set.size === 0) {
          online.delete(user.username)
          for (const r of rooms) {
            io.to(r).emit('system', { room: r, message: `${user.username} غادر`, at: Date.now() })
          }
        }
      }
      io.emit('presence', { online: Array.from(online.keys()).slice(0, 200) })
    }
    msgTimes.delete(socket.id)
  })
})

httpServer.listen(PORT, () => {
  console.log(`[venom-chat] socket.io listening on :${PORT}`)
})
