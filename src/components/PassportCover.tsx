/** Navy passport cover with a gold globe + plane emblem */
export function PassportCover({ className = '', compact = false }: { className?: string; compact?: boolean }) {
  return (
    <div
      className={`relative flex flex-col items-center justify-between overflow-hidden rounded-r-xl rounded-l-md text-center ${className}`}
      style={{
        background:
          'radial-gradient(120% 80% at 30% 10%, rgba(60,90,150,0.35), transparent 60%), repeating-linear-gradient(45deg, rgba(255,255,255,0.012) 0 2px, transparent 2px 5px), linear-gradient(160deg, #13274a 0%, #0b1a33 55%, #081327 100%)',
        boxShadow: 'inset 6px 0 10px rgba(0,0,0,0.45), inset -1px 0 0 rgba(216,180,106,0.25), 6px 6px 0 #1c1d21',
      }}
      aria-label="RANDOM PASSPORT"
    >
      <div className="pointer-events-none absolute inset-2 rounded-r-lg rounded-l-sm border border-gold/25" />
      <div className={`relative ${compact ? 'pt-3' : 'pt-8'} font-display font-semibold leading-tight tracking-[0.18em] text-gold`} style={{ fontSize: compact ? 9 : 19, textShadow: '0 1px 0 rgba(0,0,0,0.6)' }}>
        RANDOM
        <br />
        PASSPORT
      </div>
      <svg viewBox="0 0 120 120" className={compact ? 'w-[52%]' : 'w-[48%]'} aria-hidden>
        <defs>
          <linearGradient id="gold" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#f2d99a" />
            <stop offset="0.5" stopColor="#d8b46a" />
            <stop offset="1" stopColor="#a8823e" />
          </linearGradient>
        </defs>
        <g fill="none" stroke="url(#gold)" strokeWidth="2.2">
          <circle cx="60" cy="60" r="44" />
          <ellipse cx="60" cy="60" rx="20" ry="44" />
          <ellipse cx="60" cy="60" rx="36" ry="44" strokeWidth="1.3" />
          <path d="M16 60 H104" />
          <path d="M22 38 Q60 30 98 38" strokeWidth="1.4" />
          <path d="M22 82 Q60 90 98 82" strokeWidth="1.4" />
          <path d="M8 84 Q60 120 112 36" strokeWidth="1.6" strokeDasharray="3 4" />
        </g>
        <g transform="translate(84 46) rotate(-38)" fill="url(#gold)">
          <path d="M0 -12 C2 -12 2.6 -9 2.6 -6 L2.6 -2 L13 4 L13 7 L2.6 3.5 L2.6 9 L6 11.5 L6 13.5 L0 11.8 L-6 13.5 L-6 11.5 L-2.6 9 L-2.6 3.5 L-13 7 L-13 4 L-2.6 -2 L-2.6 -6 C-2.6 -9 -2 -12 0 -12 Z" />
        </g>
      </svg>
      <div className={`relative ${compact ? 'pb-3' : 'pb-8'} flex flex-col items-center gap-2`}>
        <div className="font-display tracking-[0.3em] text-gold/90" style={{ fontSize: compact ? 6 : 11 }}>
          WORLD EXPLORER
        </div>
        {/* e-passport chip symbol */}
        <svg viewBox="0 0 40 26" className={compact ? 'w-4' : 'w-9'} aria-hidden>
          <rect x="1" y="1" width="38" height="24" rx="3" fill="none" stroke="#d8b46a" strokeWidth="2" />
          <circle cx="20" cy="13" r="6" fill="none" stroke="#d8b46a" strokeWidth="2" />
          <path d="M1 13 H14 M26 13 H39" stroke="#d8b46a" strokeWidth="2" />
        </svg>
      </div>
    </div>
  )
}
