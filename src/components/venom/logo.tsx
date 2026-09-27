'use client'

// ─────────────────────────────────────────────
//  VENOM SERVICES — custom SVG logo system
//  Jagged V + liquid green lines + wordmark.
//  Responsive, works on dark & light backgrounds.
// ─────────────────────────────────────────────

export function VenomSvgFilters() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
      <defs>
        <filter id="venom-liquid-filter" x="-20%" y="-20%" width="140%" height="140%">
          <feTurbulence type="fractalNoise" baseFrequency="0.015 0.09" numOctaves="2" seed="7" result="n">
            <animate attributeName="seed" values="7;11;15;7" dur="8s" repeatCount="indefinite" />
          </feTurbulence>
          <feDisplacementMap in="SourceGraphic" in2="n" scale="6" />
        </filter>
        <filter id="venom-liquid-soft" x="-20%" y="-20%" width="140%" height="140%">
          <feTurbulence type="fractalNoise" baseFrequency="0.03 0.05" numOctaves="1" seed="3" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="3" />
        </filter>
      </defs>
    </svg>
  )
}

interface LogoProps {
  size?: number
  withWord?: boolean
  className?: string
}

/** Main VENOM SERVICES logo — jagged V with liquid lines */
export function VenomLogo({ size = 44, withWord = true, className = '' }: LogoProps) {
  return (
    <span className={`inline-flex items-center gap-3 ${className}`} role="img" aria-label="VENOM SERVICES">
      <svg width={size} height={size} viewBox="0 0 64 64" className="shrink-0">
        <defs>
          <linearGradient id="vl-gr" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#9FD6C9" />
            <stop offset="1" stopColor="#4E7D7E" />
          </linearGradient>
        </defs>
        <g className="venom-liquid-soft">
          {/* jagged V */}
          <path
            d="M8 6 L18 6 L23 16 L26 4 L28 6 L33 6 L26 58 L22 58 Z"
            fill="url(#vl-gr)"
          />
          {/* liquid venom lines across the V */}
          <path d="M11 18 C16 22 19 14 24 19 C28 23 31 16 30 21" stroke="#0A0A0A" strokeWidth="2.4" fill="none" opacity="0.75" />
          <path d="M13 28 C17 32 21 24 25 29 C28 32 29 27 28 31" stroke="#9FD6C9" strokeWidth="1.3" fill="none" opacity="0.9" />
          {/* venom drop at tip */}
          <circle cx="24" cy="54" r="2.2" fill="#9FD6C9" />
        </g>
      </svg>
      {withWord && (
        <span className="leading-none">
          <span
            className="block venom-text-glow text-[#9FD6C9]"
            style={{ fontFamily: 'Nosifer, cursive', fontSize: size * 0.42 }}
          >
            VENOM
          </span>
          <span
            className="block text-[#6EAFA1] font-bold"
            style={{ letterSpacing: '0.42em', fontSize: size * 0.22 }}
          >
            SERVICES
          </span>
        </span>
      )}
    </span>
  )
}

/** Per-service mini logos */
export function ServiceLogo({ service, size = 34 }: { service: string; size?: number }) {
  const common = { width: size, height: size, viewBox: '0 0 48 48', className: 'shrink-0' }
  switch (service) {
    case 'leak': // venom eye + shield
      return (
        <svg {...common} role="img" aria-label="Venom Leak Check">
          <path d="M24 3 L42 10 V24 C42 35 34 43 24 46 C14 43 6 35 6 24 V10 Z" fill="none" stroke="#4E7D7E" strokeWidth="2.4" />
          <ellipse cx="24" cy="25" rx="11" ry="8" fill="#1D3933" stroke="#9FD6C9" strokeWidth="1.6" />
          <circle cx="24" cy="25" r="4" fill="#9FD6C9" className="venom-liquid-soft" />
          <path d="M13 25 C18 19 30 19 35 25" stroke="#6EAFA1" strokeWidth="1.4" fill="none" />
        </svg>
      )
    case 'xng': // X inside circle with liquid lines
      return (
        <svg {...common} role="img" aria-label="VenomXNG">
          <circle cx="24" cy="24" r="20" fill="none" stroke="#4E7D7E" strokeWidth="2.4" className="venom-liquid-soft" />
          <path d="M15 15 L33 33 M33 15 L15 33" stroke="#9FD6C9" strokeWidth="3.6" strokeLinecap="round" />
          <path d="M12 24 C18 28 30 20 36 24" stroke="#6EAFA1" strokeWidth="1.4" fill="none" opacity="0.8" />
        </svg>
      )
    case 'mega': // fanged M
      return (
        <svg {...common} role="img" aria-label="Venom MEGA">
          <path d="M6 42 L10 10 L20 28 L24 6 L28 28 L38 10 L42 42" fill="none" stroke="#9FD6C9" strokeWidth="3" strokeLinejoin="round" className="venom-liquid-soft" />
          <path d="M18 38 L24 44 L30 38" fill="#4E7D7E" />
        </svg>
      )
    case 'hosting': // server with liquid lines
      return (
        <svg {...common} role="img" aria-label="Venom Hosting">
          <rect x="7" y="8" width="34" height="12" rx="2.5" fill="#1D3933" stroke="#9FD6C9" strokeWidth="1.8" />
          <rect x="7" y="27" width="34" height="12" rx="2.5" fill="#1D3933" stroke="#9FD6C9" strokeWidth="1.8" />
          <circle cx="13" cy="14" r="2" fill="#9FD6C9" />
          <circle cx="13" cy="33" r="2" fill="#9FD6C9" />
          <path d="M20 14 H34 M20 33 H34" stroke="#6EAFA1" strokeWidth="1.4" opacity="0.8" />
        </svg>
      )
    case 'chat': // chat bubble with liquid tail
      return (
        <svg {...common} role="img" aria-label="Venom Chat">
          <path
            d="M8 10 C8 6.5 11 4 14.5 4 H33.5 C37 4 40 6.5 40 10 V26 C40 29.5 37 32 33.5 32 H20 L11 42 C10 43 8 42.5 8 41 Z"
            fill="#1D3933"
            stroke="#9FD6C9"
            strokeWidth="1.8"
            className="venom-liquid-soft"
          />
          <path d="M15 13 H33 M15 19 H29 M15 25 H25" stroke="#6EAFA1" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      )
    default:
      return <VenomLogo size={size} withWord={false} />
  }
}
