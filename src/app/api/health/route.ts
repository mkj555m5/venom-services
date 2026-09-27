import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { ensureSeed } from '@/lib/seed'

/** Railway healthcheck endpoint */
export async function GET() {
  await ensureSeed()
  let database = 'down'
  try {
    await db.user.count()
    database = 'up'
  } catch { /* db down */ }
  return NextResponse.json({
    ok: database === 'up',
    service: 'venom-services',
    database,
    time: new Date().toISOString(),
  })
}
