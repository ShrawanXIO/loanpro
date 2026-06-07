// src/lib/logo.tsx
// ─────────────────────────────────────────────
// Change the SVG here ONCE — updates everywhere:
// app bar, mobile drawer, login page, landing page
// ─────────────────────────────────────────────

interface LogoProps {
  size?: number       // px (default 40)
  className?: string
}

export function Logo({ size = 40, className = '' }: LogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="LoanPro"
      role="img"
      className={className}
    >
      <defs>
        <linearGradient id="lp-bg" x1="0%" y1="0%" x2="135%" y2="135%">
          <stop offset="0%" stopColor="#1976D2"/>
          <stop offset="100%" stopColor="#0D47A1"/>
        </linearGradient>
        <linearGradient id="lp-green" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#66BB6A"/>
          <stop offset="100%" stopColor="#2E7D32"/>
        </linearGradient>
        <filter id="lp-shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="3" stdDeviation="4"
            floodColor="#0a2a6e" floodOpacity="0.45"/>
        </filter>
        <filter id="lp-dot" x="-40%" y="-40%" width="180%" height="180%">
          <feDropShadow dx="0" dy="2" stdDeviation="3"
            floodColor="#1B5E20" floodOpacity="0.5"/>
        </filter>
      </defs>

      {/* Blue rounded square */}
      <rect x="0" y="0" width="100" height="100" rx="22"
        fill="url(#lp-bg)" filter="url(#lp-shadow)"/>

      {/* Subtle top shine */}
      <rect x="0" y="0" width="100" height="45" rx="22"
        fill="white" opacity="0.08"/>

      {/* ₹ symbol — actual character, white, centered */}
      <text
        x="44"
        y="82"
        fontFamily="Georgia, 'Times New Roman', serif"
        fontSize="72"
        fontWeight="700"
        fill="white"
        textAnchor="middle"
        opacity="0.95"
      >₹</text>

      {/* Green circle — top right */}
      <circle cx="78" cy="24" r="18"
        fill="url(#lp-green)" filter="url(#lp-dot)"/>

      {/* Up arrow shaft */}
      <line x1="78" y1="33" x2="78" y2="17"
        stroke="white" strokeWidth="4" strokeLinecap="round"/>

      {/* Up arrow head */}
      <polyline points="69,25 78,14 87,25"
        fill="none" stroke="white" strokeWidth="4"
        strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}