// ─────────────────────────────────────────────
//  Seed: owner account RTQ_67 + default service config (idempotent)
// ─────────────────────────────────────────────
import { db } from './db'
import { hashPassword, OWNER_USERNAME, OWNER_PASSWORD } from './auth'

let seeded = false

export const DEFAULT_SERVICES: Record<string, { enabled: boolean; value?: string }> = {
  leak: { enabled: true },
  xng: { enabled: true },
  mega: { enabled: true },
  hosting: { enabled: true },
  chat: { enabled: true },
  siteTitle: { enabled: true, value: 'Venom Services' },
  announcement: { enabled: true, value: '' },
}

export async function ensureSeed() {
  if (seeded) return
  seeded = true
  try {
    // ── Owner account (fixed credentials, recreated if missing) ──
    const owner = await db.user.findUnique({ where: { username: OWNER_USERNAME } })
    if (!owner) {
      await db.user.create({
        data: {
          username: OWNER_USERNAME,
          email: 'rtq67@venom.services',
          passwordHash: await hashPassword(OWNER_PASSWORD),
          role: 'OWNER',
          ramMb: -1, // unlimited
          diskMb: -1, // unlimited
          projectLimit: -1, // unlimited
          emailVerified: true,
        },
      })
      await addLog('info', 'seed', `تم إنشاء حساب المالك ${OWNER_USERNAME}`)
    } else if (owner.role !== 'OWNER') {
      await db.user.update({ where: { username: OWNER_USERNAME }, data: { role: 'OWNER' } })
    }

    // ── Service toggles ──
    for (const [key, cfg] of Object.entries(DEFAULT_SERVICES)) {
      await db.serviceConfig.upsert({
        where: { key },
        update: {},
        create: { key, enabled: cfg.enabled, value: cfg.value || '' },
      })
    }
  } catch (e) {
    seeded = false
    console.error('[seed] failed:', e)
  }
}

export async function addLog(level: 'info' | 'warn' | 'error' | 'security', source: string, message: string, meta = '') {
  try {
    await db.logEntry.create({ data: { level, source, message, meta } })
  } catch {
    // logging must never break the request
  }
}
