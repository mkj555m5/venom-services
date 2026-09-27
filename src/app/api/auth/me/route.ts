import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { ensureSeed } from '@/lib/seed'
import { getSessionUser } from '@/lib/auth'

export async function GET() {
  await ensureSeed()
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ user: null })

  const projects = await db.hostingProject.count({ where: { ownerId: user.id } })
  return NextResponse.json({
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      ramMb: user.ramMb,
      diskMb: user.diskMb,
      projectLimit: user.projectLimit,
      banned: user.banned,
      createdAt: user.createdAt,
    },
    projects,
  })
}
