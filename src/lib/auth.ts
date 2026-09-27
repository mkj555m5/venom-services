// ─────────────────────────────────────────────
//  VENOM AUTH — JWT sessions (jose) + bcrypt
// ─────────────────────────────────────────────
import { SignJWT, jwtVerify } from 'jose'
import bcrypt from 'bcryptjs'
import { cookies } from 'next/headers'
import { db } from './db'

const JWT_SECRET = process.env.JWT_SECRET || 'venom-services-dev-secret-change-me-in-production'
const secret = new TextEncoder().encode(JWT_SECRET)
export const TOKEN_COOKIE = 'venom_token'

export type Role = 'OWNER' | 'ADMIN' | 'USER'

export interface SessionUser {
  id: string
  username: string
  email: string
  role: Role
}

export async function hashPassword(pw: string): Promise<string> {
  return bcrypt.hash(pw, 10)
}

export async function verifyPassword(pw: string, hash: string): Promise<boolean> {
  return bcrypt.compare(pw, hash)
}

export async function signToken(payload: SessionUser): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(secret)
}

export async function verifyToken(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, secret)
    return {
      id: String(payload.id),
      username: String(payload.username),
      email: String(payload.email),
      role: payload.role as Role,
    }
  } catch {
    return null
  }
}

/** Get current session user from cookie → fresh DB record (checks ban). */
export async function getSessionUser() {
  const token = (await cookies()).get(TOKEN_COOKIE)?.value
  if (!token) return null
  const sess = await verifyToken(token)
  if (!sess) return null
  const user = await db.user.findUnique({ where: { username: sess.username } })
  if (!user || user.banned) return null
  return user
}

/** Role helpers */
export function isOwner(u: { role: string } | null) { return u?.role === 'OWNER' }
export function isStaff(u: { role: string } | null) { return u?.role === 'OWNER' || u?.role === 'ADMIN' }

/** Standard API guard: returns user or throws a Response-ready error object */
export async function requireUser() {
  const user = await getSessionUser()
  if (!user) throw new AuthError(401, 'يجب تسجيل الدخول أولاً')
  return user
}

export async function requireOwner() {
  const user = await requireUser()
  if (user.role !== 'OWNER') throw new AuthError(403, 'هذه الصلاحية للمالك فقط')
  return user
}

export async function requireStaff() {
  const user = await requireUser()
  if (user.role !== 'OWNER' && user.role !== 'ADMIN') throw new AuthError(403, 'صلاحيات غير كافية')
  return user
}

export class AuthError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export function authErrorResponse(e: unknown) {
  if (e instanceof AuthError) {
    return Response.json({ error: e.message }, { status: e.status })
  }
  return Response.json({ error: 'خطأ داخلي غير متوقع' }, { status: 500 })
}

/** Owner account constants — fixed, cannot be deleted or renamed except by owner himself */
export const OWNER_USERNAME = process.env.OWNER_USERNAME || 'RTQ_67'
export const OWNER_PASSWORD = process.env.OWNER_PASSWORD || '@ROblox2011'
