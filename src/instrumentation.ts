// ─────────────────────────────────────────────
//  Next.js instrumentation — runs once on server boot.
//  Spawns the Venom mini-services (hosting + chat socket) as child
//  processes of the main server so the whole platform boots with
//  a single process tree (works identically on Railway).
// ─────────────────────────────────────────────
export async function register() {
  // Node runtime only (skip edge)
  if (process.env.NEXT_RUNTIME !== 'nodejs') return

  // avoid double-spawn on dev hot reloads
  const g = globalThis as unknown as { __venomServicesStarted?: boolean }
  if (g.__venomServicesStarted) return
  g.__venomServicesStarted = true

  const { spawn } = await import('child_process')
  const path = await import('path')

  const cwd = process.cwd()
  const isSandbox = cwd.startsWith('/home/z/my-project')

  const env = {
    ...process.env,
    INTERNAL_TOKEN: process.env.INTERNAL_TOKEN || 'venom-internal',
    JWT_SECRET: process.env.JWT_SECRET || 'venom-services-dev-secret-change-me-in-production',
    MAIN_APP_URL: process.env.MAIN_APP_URL || `http://127.0.0.1:${process.env.PORT || 3000}`,
  }

  // hosting-service: keep volatile project data OUT of the app source tree
  const hostingEnv = {
    ...env,
    HOSTING_PORT: '3031',
    HOSTING_DATA_DIR: process.env.HOSTING_DATA_DIR || (isSandbox ? '/home/z/venom_data/hosting' : path.join(cwd, 'hosting_data')),
  }
  const chatEnv = { ...env, CHAT_PORT: '3003' }

  // skip spawn if the port is already served (dev supervisor may own it)
  async function portBusy(port: number): Promise<boolean> {
    try {
      const net = await import('net')
      return await new Promise<boolean>((resolve) => {
        const s = net.createConnection({ port, host: '127.0.0.1' })
        s.once('connect', () => { s.destroy(); resolve(true) })
        s.once('error', () => resolve(false))
        s.setTimeout(800, () => { s.destroy(); resolve(false) })
      })
    } catch {
      return false
    }
  }

  const jobs: Array<{ dir: string; port: number; env: NodeJS.ProcessEnv; name: string }> = [
    { dir: path.join(cwd, 'mini-services', 'hosting-service'), port: 3031, env: hostingEnv, name: 'hosting' },
    { dir: path.join(cwd, 'mini-services', 'chat-service'), port: 3003, env: chatEnv, name: 'chat' },
  ]

  for (const job of jobs) {
    if (await portBusy(job.port)) {
      console.log(`[venom] ${job.name} service already running on :${job.port}`)
      continue
    }
    try {
      const child = spawn('bun', ['index.ts'], {
        cwd: job.dir,
        env: job.env,
        stdio: 'ignore',
        detached: false,
      })
      child.on('error', (e) => console.error(`[venom] ${job.name} spawn failed:`, String(e)))
      child.unref()
      console.log(`[venom] started ${job.name} service (pid ${child.pid}) on :${job.port}`)
    } catch (e) {
      console.error(`[venom] ${job.name} failed to start:`, String(e))
    }
  }
}
