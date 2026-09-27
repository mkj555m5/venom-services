'use client'

// ─────────────────────────────────────────────
//  Venom global store (Zustand) — session + view routing
// ─────────────────────────────────────────────
import { create } from 'zustand'

export type VenomView = 'home' | 'login' | 'register' | 'reset' | 'leak' | 'xng' | 'mega' | 'hosting' | 'chat' | 'panel'

export interface CurrentUser {
  id: string
  username: string
  email: string
  role: 'USER' | 'ADMIN' | 'OWNER'
  ramMb: number
  diskMb: number
  projectLimit: number
  banned?: boolean
  createdAt?: string
}

export interface SiteConfig {
  [key: string]: { enabled: boolean; value: string }
}

interface VenomState {
  view: VenomView
  user: CurrentUser | null
  authLoaded: boolean
  config: SiteConfig
  setView: (v: VenomView) => void
  setUser: (u: CurrentUser | null) => void
  setAuthLoaded: (v: boolean) => void
  setConfig: (c: SiteConfig) => void
  refreshMe: () => Promise<void>
}

export const useVenom = create<VenomState>((set) => ({
  view: 'home',
  user: null,
  authLoaded: false,
  config: {},
  setView: (view) => {
    set({ view })
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior })
  },
  setUser: (user) => set({ user }),
  setAuthLoaded: (authLoaded) => set({ authLoaded }),
  setConfig: (config) => set({ config }),
  refreshMe: async () => {
    try {
      const res = await fetch('/api/auth/me', { cache: 'no-store' })
      const data = await res.json()
      set({ user: data.user || null, authLoaded: true })
    } catch {
      set({ user: null, authLoaded: true })
    }
  },
}))

export function fmtMb(mb: number): string {
  if (mb < 0) return 'غير محدود'
  if (mb >= 1024) return `${(mb / 1024).toFixed(mb % 1024 === 0 ? 0 : 1)} GB`
  return `${mb} MB`
}
