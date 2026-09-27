import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { requireOwner, authErrorResponse } from '@/lib/auth'
import { addLog } from '@/lib/seed'

/**
 * Owner: logo generator — generates VENOM SERVICES logo variants as SVG.
 * If LOGO_GENERATOR_API_KEY is set, a remote AI generator could be wired here;
 * the built-in SVG engine works offline and guarantees the venom style.
 */
const STYLES = ['venom', 'fang', 'splash'] as const

function buildLogo(style: string, word: string, primary: string, accent: string): string {
  const w = word.toUpperCase().slice(0, 24)
  switch (style) {
    case 'fang':
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 200" width="520" height="200">
  <defs>
    <linearGradient id="vg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${primary}"/><stop offset="1" stop-color="${accent}"/>
    </linearGradient>
    <filter id="goo"><feTurbulence baseFrequency="0.02" numOctaves="2" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="6"/></filter>
  </defs>
  <g filter="url(#goo)">
    <path d="M40 30 L110 30 L150 120 L190 30 L200 30 L150 170 Z" fill="url(#vg)"/>
    <path d="M150 170 L142 150 L158 150 Z" fill="${accent}"/>
  </g>
  <text x="225" y="95" font-family="Arial Black, sans-serif" font-weight="900" font-size="46" fill="${primary}" letter-spacing="2">VENOM</text>
  <text x="225" y="140" font-family="Arial, sans-serif" font-weight="700" font-size="24" fill="${accent}" letter-spacing="8">SERVICES</text>
</svg>`
    case 'splash':
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 200" width="520" height="200">
  <defs><radialGradient id="sp" cx="0.25" cy="0.5" r="0.8">
    <stop offset="0" stop-color="${accent}"/><stop offset="1" stop-color="${primary}"/>
  </radialGradient></defs>
  <circle cx="110" cy="100" r="70" fill="url(#sp)"/>
  <path d="M85 60 L110 105 L135 60 L150 60 L110 150 L70 60 Z" fill="#0A0A0A"/>
  <circle cx="160" cy="45" r="9" fill="${accent}"/><circle cx="175" cy="30" r="5" fill="${primary}"/>
  <text x="210" y="95" font-family="Arial Black, sans-serif" font-weight="900" font-size="46" fill="${primary}" letter-spacing="2">VENOM</text>
  <text x="210" y="140" font-family="Arial, sans-serif" font-weight="700" font-size="24" fill="${accent}" letter-spacing="8">SERVICES</text>
</svg>`
    default: // venom — jagged V with liquid lines
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 200" width="520" height="200">
  <defs>
    <linearGradient id="lg" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="${accent}"/><stop offset="1" stop-color="${primary}"/>
    </linearGradient>
    <filter id="liq"><feTurbulence type="fractalNoise" baseFrequency="0.015 0.09" numOctaves="2" result="n" seed="7"/><feDisplacementMap in="SourceGraphic" in2="n" scale="8"/></filter>
  </defs>
  <g filter="url(#liq)">
    <path d="M35 28 L65 28 L95 22 L112 60 L128 22 L148 28 L178 28 L115 175 L102 175 Z" fill="url(#lg)"/>
    <path d="M60 55 C80 65 90 40 105 52 C120 64 132 42 150 55" stroke="#0A0A0A" stroke-width="6" fill="none" opacity="0.7"/>
    <path d="M70 80 C90 92 105 66 122 80 C136 90 148 70 160 82" stroke="${accent}" stroke-width="3" fill="none" opacity="0.9"/>
  </g>
  <text x="205" y="92" font-family="Arial Black, sans-serif" font-weight="900" font-size="48" fill="${primary}" letter-spacing="3" filter="url(#liq)">VENOM</text>
  <text x="205" y="138" font-family="Arial, sans-serif" font-weight="700" font-size="22" fill="${accent}" letter-spacing="10">SERVICES</text>
  <path d="M205 155 q40 12 80 0 q40 -12 80 0 q40 12 80 0" stroke="${primary}" stroke-width="3" fill="none" filter="url(#liq)"/>
</svg>`
  }
}

export async function GET() {
  try {
    await requireOwner()
    const variants = STYLES.map((s) => ({
      style: s,
      svg: buildLogo(s, 'VENOM', '#9FD6C9', '#4E7D7E'),
    }))
    return NextResponse.json({
      variants,
      aiKeyConfigured: Boolean(process.env.LOGO_GENERATOR_API_KEY),
    })
  } catch (e) {
    return authErrorResponse(e)
  }
}

/** Generate custom-color variant */
export async function POST(req: NextRequest) {
  try {
    await requireOwner()
    const body = await req.json().catch(() => ({}))
    const style = STYLES.includes(body.style) ? body.style : 'venom'
    const primary = /^#[0-9a-fA-F]{6}$/.test(body.primary || '') ? body.primary : '#9FD6C9'
    const accent = /^#[0-9a-fA-F]{6}$/.test(body.accent || '') ? body.accent : '#4E7D7E'
    const svg = buildLogo(style, 'VENOM', primary, accent)
    await addLog('info', 'logo', `توليد شعار (${style})`, `primary=${primary}`)
    return NextResponse.json({ style, svg })
  } catch (e) {
    return authErrorResponse(e)
  }
}
