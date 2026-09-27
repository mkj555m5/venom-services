import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireOwner, authErrorResponse } from '@/lib/auth'

const startedAt = Date.now()

/** Owner: live system statistics */
export async function GET() {
  try {
    await requireOwner()

    const [users, admins, projects, runningProjects, messages, scans, searches] = await Promise.all([
      db.user.count(),
      db.user.count({ where: { role: 'ADMIN' } }),
      db.hostingProject.count(),
      db.hostingProject.count({ where: { status: 'running' } }),
      db.chatMessage.count(),
      db.breachCache.count(),
      db.logEntry.count({ where: { source: 'search' } }),
    ])

    const recentLogs = await db.logEntry.findMany({ orderBy: { createdAt: 'desc' }, take: 8 })
    const latestUsers = await db.user.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { username: true, role: true, createdAt: true },
    })

    const mem = process.memoryUsage()
    return NextResponse.json({
      live: {
        uptimeSec: Math.floor((Date.now() - startedAt) / 1000),
        rssMb: Math.round(mem.rss / 1048576),
        heapMb: Math.round(mem.heapUsed / 1048576),
        nodeVersion: process.version,
        time: new Date().toISOString(),
      },
      totals: {
        users,
        admins,
        projects,
        runningProjects,
        messages,
        scans,
        searches,
      },
      recentLogs,
      latestUsers,
    })
  } catch (e) {
    return authErrorResponse(e)
  }
}
